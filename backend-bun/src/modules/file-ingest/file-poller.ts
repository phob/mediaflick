import { Dirent } from "node:fs";
import { access, readdir, stat } from "node:fs/promises";
import { basename, dirname, extname } from "node:path";
import { eq } from "drizzle-orm";
import type { AppContext } from "@/app/context";
import { normalizeTitle } from "@/modules/detection/normalization";
import { detectMovieFromFileName } from "@/modules/detection/movie-detection";
import { SeriesIdentityService } from "@/modules/detection/series-identity-service";
import { detectTvEpisode } from "@/modules/detection/tv-detection";
import {
    seriesAliases,
    seriesIdentityMap,
} from "@/db/schema";
import { MediaMetadataResolver } from "@/modules/media-lookup/media-metadata-resolver";
import {
    buildDestinationPath,
    cleanupDeadSymlinks,
    createSymlinkAt,
    isDestinationConflictError,
    removeSymlinkIfExists,
} from "@/modules/symlink/symlink-service";
import type { RuntimeConfig } from "@/config/runtime-config";
import type { MediaType } from "@/shared/types";

const mediaExtensions = new Set([
    ".mkv",
    ".mp4",
    ".avi",
    ".m4v",
    ".ts",
    ".m2ts",
]);

async function fileExists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

async function collectFiles(root: string): Promise<string[]> {
    const files: string[] = [];
    const queue = [root];

    while (queue.length > 0) {
        const current = queue.shift()!;
        let entries: Dirent[] = [];
        try {
            entries = await readdir(current, { withFileTypes: true });
        } catch {
            continue;
        }

        for (const entry of entries) {
            if (entry.name.startsWith(".")) {
                continue;
            }

            const fullPath = `${current}/${entry.name}`;
            if (entry.isDirectory()) {
                queue.push(fullPath);
                continue;
            }

            const extension = entry.name.includes(".")
                ? `.${entry.name.split(".").pop()?.toLowerCase()}`
                : "";
            if (mediaExtensions.has(extension)) {
                files.push(fullPath);
            }
        }
    }

    return files;
}

async function processWithLimit<T>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<void>,
): Promise<void> {
    const executing = new Set<Promise<void>>();

    for (const item of items) {
        const task = worker(item);
        executing.add(task);
        task.finally(() => executing.delete(task));

        if (executing.size >= limit) {
            await Promise.race(executing);
        }
    }

    await Promise.all(executing);
}

type FolderMapping = RuntimeConfig["plex"]["folderMappings"][number];

export class FilePoller {
    private timer: Timer | null = null;
    private isRunning = false;
    private currentRun: Promise<void> | null = null;
    private currentConfig: RuntimeConfig | null = null;
    private readonly metadataResolver: MediaMetadataResolver;

    constructor(private readonly context: AppContext) {
        this.metadataResolver = new MediaMetadataResolver(
            context.db,
            () => context.tmdb,
        );
    }

    start(config: RuntimeConfig): void {
        this.currentConfig = config;
        void this.run();
        this.timer = setInterval(() => {
            void this.run();
        }, config.plex.pollingInterval * 1000);
    }

    async stop(): Promise<void> {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        // Wait for any in-flight run to complete to prevent overlapping runs
        if (this.currentRun) {
            await this.currentRun;
        }
    }

    restart(config: RuntimeConfig): void {
        void this.stop().then(() => this.start(config));
    }

    private extractTvAliasCandidates(sourceFile: string): string[] {
        const fileName = basename(sourceFile, extname(sourceFile));
        const parent = basename(dirname(sourceFile));
        const grandParent = basename(dirname(dirname(sourceFile)));
        const cleanedFileName = fileName
            .replace(
                /s\d{1,2}[ ._-]*(?:e|ep)\d{1,3}(?:[- ]?(?:e|ep)?\d{1,3})?/gi,
                " ",
            )
            .replace(/\d{1,2}x\d{1,3}(?:-\d{1,3})?/gi, " ")
            .replace(/\s{2,}/g, " ")
            .trim();

        return [cleanedFileName, parent, grandParent]
            .map(normalizeTitle)
            .filter(Boolean);
    }

    private async getShowAliasSet(tmdbId: number): Promise<Set<string>> {
        const [identityRows, aliasRows] = await Promise.all([
            this.context.db
                .select({
                    normalizedTitle: seriesIdentityMap.normalizedTitle,
                    canonicalTitle: seriesIdentityMap.canonicalTitle,
                })
                .from(seriesIdentityMap)
                .where(eq(seriesIdentityMap.tmdbId, tmdbId)),
            this.context.db
                .select({ aliasNormalized: seriesAliases.aliasNormalized })
                .from(seriesAliases)
                .innerJoin(
                    seriesIdentityMap,
                    eq(seriesAliases.identityId, seriesIdentityMap.id),
                )
                .where(eq(seriesIdentityMap.tmdbId, tmdbId)),
        ]);

        const aliasSet = new Set<string>();
        for (const row of identityRows) {
            aliasSet.add(row.normalizedTitle);
            aliasSet.add(normalizeTitle(row.canonicalTitle));
        }

        for (const row of aliasRows) {
            aliasSet.add(row.aliasNormalized);
        }

        return aliasSet;
    }

    async rebuildTvShow(
        tmdbId: number,
    ): Promise<{ removedCount: number; reprocessedCount: number }> {
        const config = await this.context.configStore.get();
        const mapping = config.plex.folderMappings.find(
            (item) => item.mediaType === "TvShows",
        );
        if (!mapping) {
            throw new Error("No TvShows destination folder mapping configured");
        }

        const [directTracked, allTvFiles, aliasSet] = await Promise.all([
            this.context.scannedFilesRepo.listByTmdbId(tmdbId, "TvShows"),
            this.context.scannedFilesRepo.listByMediaType("TvShows"),
            this.getShowAliasSet(tmdbId),
        ]);
        const showSourceFolders = new Set(
            directTracked.map((item) => dirname(item.sourceFile)),
        );

        const relatedTracked = allTvFiles.filter((file) => {
            if (file.tmdbId === tmdbId) {
                return true;
            }

            if (showSourceFolders.has(dirname(file.sourceFile))) {
                return true;
            }

            if (file.tmdbId !== null || aliasSet.size === 0) {
                return false;
            }

            const candidates = this.extractTvAliasCandidates(file.sourceFile);
            return candidates.some((candidate) => aliasSet.has(candidate));
        });

        const sourceFiles = [
            ...new Set(
                (relatedTracked.length > 0
                    ? relatedTracked
                    : directTracked
                ).map((item) => item.sourceFile),
            ),
        ];
        const sourceFileSet = new Set(sourceFiles);
        const rowsToDelete = allTvFiles.filter((item) =>
            sourceFileSet.has(item.sourceFile),
        );

        for (const item of rowsToDelete) {
            if (item.destFile) {
                await removeSymlinkIfExists(item.destFile);
            }
        }

        if (rowsToDelete.length > 0) {
            const deletedRows = await this.context.scannedFilesRepo.deleteByIds(
                rowsToDelete.map((item) => item.id),
            );
            for (const item of deletedRows) {
                this.context.wsHub.broadcast("file.removed", item);
            }
        }

        await processWithLimit(sourceFiles, 8, (sourceFile) =>
            this.processFile(sourceFile, mapping.destinationFolder, "TvShows"),
        );
        await cleanupDeadSymlinks(mapping.destinationFolder);

        return {
            removedCount: rowsToDelete.length,
            reprocessedCount: sourceFiles.length,
        };
    }

    private async run(): Promise<void> {
        if (this.isRunning || !this.currentConfig) {
            return;
        }

        this.isRunning = true;
        this.currentRun = this.runInternal();

        try {
            await this.currentRun;
        } finally {
            this.isRunning = false;
            this.currentRun = null;
        }
    }

    private async runInternal(): Promise<void> {
        try {
            const config = await this.context.configStore.get();
            this.currentConfig = config;

            if (
                !config.tmDb.apiKey ||
                config.tmDb.apiKey === "your-tmdb-api-key"
            ) {
                this.context.logger.warn("TMDb API key is not configured");
                return;
            }

            const zurgReady = await fileExists(config.zurg.versionLocation);
            if (!zurgReady) {
                this.context.logger.info("Zurg version file not found", {
                    path: config.zurg.versionLocation,
                });
                return;
            }

            this.context.wsHub.broadcast("zurg.version", Date.now());

            for (const mapping of config.plex.folderMappings) {
                await this.reconcileMapping(mapping);
            }
        } catch (error) {
            this.context.logger.error("File polling failed", {
                error: String(error),
            });
        }
    }

    private async reconcileMapping(mapping: FolderMapping): Promise<void> {
        if (!(await fileExists(mapping.sourceFolder))) {
            this.context.logger.warn(
                "Source folder not found, skipping mapping reconciliation",
                {
                    sourceFolder: mapping.sourceFolder,
                    mediaType: mapping.mediaType,
                },
            );
            return;
        }

        const tracked = await this.context.scannedFilesRepo.listBySourcePrefix(
            mapping.sourceFolder,
        );
        const trackedSources = new Set(tracked.map((item) => item.sourceFile));

        const files = await collectFiles(mapping.sourceFolder);
        const currentSourceFiles = new Set(files);
        const untrackedFiles = files.filter(
            (file) => !trackedSources.has(file),
        );

        if (untrackedFiles.length > 0) {
            this.context.logger.info("Discovered new source files", {
                sourceFolder: mapping.sourceFolder,
                destinationFolder: mapping.destinationFolder,
                mediaType: mapping.mediaType,
                discoveredCount: untrackedFiles.length,
            });
        }

        await processWithLimit(untrackedFiles, 8, (file) =>
            this.processFile(
                file,
                mapping.destinationFolder,
                mapping.mediaType,
            ),
        );
        await this.pruneDeletedSources(tracked, currentSourceFiles);
        await cleanupDeadSymlinks(mapping.destinationFolder);
    }

    private async pruneDeletedSources(
        tracked: Array<{
            id: number;
            sourceFile: string;
            destFile: string | null;
        }>,
        currentSourceFiles: Set<string>,
    ): Promise<void> {
        if (tracked.length === 0) {
            return;
        }

        const deletedTracked = tracked.filter(
            (item) => !currentSourceFiles.has(item.sourceFile),
        );

        if (deletedTracked.length === 0) {
            return;
        }

        for (const item of deletedTracked) {
            if (item.destFile) {
                await removeSymlinkIfExists(item.destFile);
            }
        }

        const deletedRows = await this.context.scannedFilesRepo.deleteByIds(
            deletedTracked.map((item) => item.id),
        );
        for (const item of deletedRows) {
            this.context.wsHub.broadcast("file.removed", item);
        }
    }

    private async processFile(
        sourceFile: string,
        destinationFolder: string,
        mediaType: MediaType,
    ): Promise<void> {
        let fileInfo;
        try {
            fileInfo = await stat(sourceFile);
        } catch (error) {
            if ((error as { code?: string }).code === "ENOENT") {
                return;
            }
            this.context.logger.warn("Failed to read source file details", {
                sourceFile,
                mediaType,
                error: String(error),
            });
            return;
        }

        const tracked =
            await this.context.scannedFilesRepo.createProcessingEntry({
                sourceFile,
                fileSize: fileInfo.size,
                fileHash: null,
                mediaType,
            });

        this.context.wsHub.broadcast("file.added", tracked);
        this.context.logger.info("File discovered", {
            id: tracked.id,
            sourceFile,
            mediaType,
            fileSize: fileInfo.size,
        });

        if (mediaType === "Extras" || mediaType === "Unknown") {
            const updated = await this.context.scannedFilesRepo.updateProcessed(
                {
                    id: tracked.id,
                    destFile: null,
                    mediaType,
                    tmdbId: null,
                    imdbId: null,
                    title: null,
                    year: null,
                    genres: null,
                    seasonNumber: null,
                    episodeNumber: null,
                    episodeNumber2: null,
                    status: "Success",
                },
            );
            if (updated) {
                this.context.wsHub.broadcast("file.updated", updated);
                this.logProcessingOutcome({
                    id: tracked.id,
                    sourceFile,
                    mediaType,
                    status: "Success",
                    destFile: null,
                    reason: "categorized-without-symlink",
                });
            }
            return;
        }

        try {
            if (mediaType === "Movies") {
                const detected = detectMovieFromFileName(sourceFile);
                if (!detected) {
                    await this.markFailed(
                        tracked.id,
                        mediaType,
                        sourceFile,
                        "movie-title-detection-failed",
                    );
                    return;
                }

                const searchResults = await this.context.tmdb.searchMovie(
                    detected.title,
                );
                const best =
                    searchResults
                        .filter((item) =>
                            detected.year
                                ? this.context.tmdb.movieYear(item) ===
                                  detected.year
                                : true,
                        )
                        .sort(
                            (a, b) => (b.popularity ?? 0) - (a.popularity ?? 0),
                        )[0] ?? searchResults[0];

                if (!best) {
                    await this.markFailed(
                        tracked.id,
                        mediaType,
                        sourceFile,
                        "movie-tmdb-search-no-match",
                    );
                    return;
                }

                const movie = await this.metadataResolver.resolveMovie(best.id);

                const destinationPath = buildDestinationPath(
                    sourceFile,
                    destinationFolder,
                    mediaType,
                    {
                        title: movie.title,
                        year: movie.year,
                        imdbId: movie.imdbId,
                    },
                );

                await createSymlinkAt(sourceFile, destinationPath);

                const updated =
                    await this.context.scannedFilesRepo.updateProcessed({
                        id: tracked.id,
                        destFile: destinationPath,
                        mediaType,
                        tmdbId: movie.tmdbId,
                        imdbId: movie.imdbId,
                        title: movie.title,
                        year: movie.year,
                        genres: movie.genres,
                        seasonNumber: null,
                        episodeNumber: null,
                        episodeNumber2: null,
                        posterPath: movie.posterPath,
                        status: "Success",
                    });

                if (updated) {
                    this.context.wsHub.broadcast("file.updated", updated);
                    this.logProcessingOutcome({
                        id: tracked.id,
                        sourceFile,
                        mediaType,
                        status: "Success",
                        destFile: destinationPath,
                        tmdbId: movie.tmdbId,
                        title: movie.title,
                    });
                }
                return;
            }

            if (mediaType === "TvShows") {
                const identityService = new SeriesIdentityService(
                    this.context.db,
                    this.context.tmdb,
                );
                const detected = await detectTvEpisode(
                    sourceFile,
                    identityService,
                );
                if (!detected) {
                    await this.markFailed(
                        tracked.id,
                        mediaType,
                        sourceFile,
                        "tv-episode-detection-failed",
                    );
                    return;
                }

                const show = await this.metadataResolver.resolveTv({
                    tmdbId: detected.tmdbId,
                    seasonNumber: detected.seasonNumber,
                    episodeNumber: detected.episodeNumber,
                    episodeNumber2: detected.episodeNumber2,
                    imdbIdFallback: detected.imdbId,
                    sourceFile,
                });

                const destinationPath = buildDestinationPath(
                    sourceFile,
                    destinationFolder,
                    mediaType,
                    {
                        title: show.title,
                        year: show.year,
                        imdbId: show.imdbId,
                        seasonNumber: show.seasonNumber,
                        episodeNumber: show.episodeNumber,
                        episodeNumber2: show.episodeNumber2,
                        episodeTitle: show.episodeTitle,
                    },
                );

                await createSymlinkAt(sourceFile, destinationPath);

                const updated =
                    await this.context.scannedFilesRepo.updateProcessed({
                        id: tracked.id,
                        destFile: destinationPath,
                        mediaType,
                        tmdbId: show.tmdbId,
                        imdbId: show.imdbId,
                        title: show.title,
                        year: show.year,
                        genres: show.genres,
                        seasonNumber: show.seasonNumber,
                        episodeNumber: show.episodeNumber,
                        episodeNumber2: show.episodeNumber2,
                        posterPath: show.posterPath,
                        status: "Success",
                    });

                if (updated) {
                    this.context.wsHub.broadcast("file.updated", updated);
                    this.logProcessingOutcome({
                        id: tracked.id,
                        sourceFile,
                        mediaType,
                        status: "Success",
                        destFile: destinationPath,
                        tmdbId: show.tmdbId,
                        title: show.title,
                        seasonNumber: show.seasonNumber,
                        episodeNumber: show.episodeNumber,
                        episodeNumber2: show.episodeNumber2,
                    });
                }
            }
        } catch (error) {
            this.context.logger.warn("Failed processing file", {
                sourceFile,
                mediaType,
                error: String(error),
            });
            if (isDestinationConflictError(error)) {
                await this.markDuplicate(
                    tracked.id,
                    mediaType,
                    sourceFile,
                    "destination-conflict",
                );
            } else {
                await this.markFailed(
                    tracked.id,
                    mediaType,
                    sourceFile,
                    "processing-exception",
                );
            }
        }
    }

    private logProcessingOutcome(params: {
        id: number;
        sourceFile: string;
        mediaType: MediaType;
        status: "Success" | "Failed" | "Duplicate";
        destFile: string | null;
        tmdbId?: number | null;
        title?: string | null;
        seasonNumber?: number | null;
        episodeNumber?: number | null;
        episodeNumber2?: number | null;
        reason?: string;
    }): void {
        const payload = {
            id: params.id,
            sourceFile: params.sourceFile,
            mediaType: params.mediaType,
            status: params.status,
            destFile: params.destFile,
            tmdbId: params.tmdbId ?? null,
            title: params.title ?? null,
            seasonNumber: params.seasonNumber ?? null,
            episodeNumber: params.episodeNumber ?? null,
            episodeNumber2: params.episodeNumber2 ?? null,
            reason: params.reason ?? null,
        };

        if (params.status === "Success") {
            this.context.logger.info("File processed", payload);
            return;
        }

        this.context.logger.warn("File processed with issue", payload);
    }

    private async markDuplicate(
        id: number,
        mediaType: MediaType,
        sourceFile: string,
        reason: string,
    ): Promise<void> {
        const updated = await this.context.scannedFilesRepo.updateProcessed({
            id,
            destFile: null,
            mediaType,
            tmdbId: null,
            imdbId: null,
            title: null,
            year: null,
            genres: null,
            seasonNumber: null,
            episodeNumber: null,
            episodeNumber2: null,
            status: "Duplicate",
        });
        if (updated) {
            this.context.wsHub.broadcast("file.updated", updated);
            this.logProcessingOutcome({
                id,
                sourceFile,
                mediaType,
                status: "Duplicate",
                destFile: null,
                reason,
            });
        }
    }

    private async markFailed(
        id: number,
        mediaType: MediaType,
        sourceFile: string,
        reason: string,
    ): Promise<void> {
        const updated = await this.context.scannedFilesRepo.updateProcessed({
            id,
            destFile: null,
            mediaType,
            tmdbId: null,
            imdbId: null,
            title: null,
            year: null,
            genres: null,
            seasonNumber: null,
            episodeNumber: null,
            episodeNumber2: null,
            status: "Failed",
        });
        if (updated) {
            this.context.wsHub.broadcast("file.updated", updated);
            this.logProcessingOutcome({
                id,
                sourceFile,
                mediaType,
                status: "Failed",
                destFile: null,
                reason,
            });
        }
    }
}
