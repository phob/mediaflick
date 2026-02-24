import { mediaApi } from "@/lib/api";
import type {
    ConfigurationPayload,
    FolderMappingConfig,
    LogLevel,
    MediaType,
    MediaStatus,
    ScannedFile,
} from "@/lib/types";

const TMDB_IMG = "https://image.tmdb.org/t/p";

export const mediaTypeOptions: MediaType[] = [
    "Movies",
    "TvShows",
    "Extras",
    "Unknown",
];

export const logLevels: LogLevel[] = [
    "Verbose",
    "Debug",
    "Information",
    "Warning",
    "Error",
    "Fatal",
];

export function cloneConfig(config: ConfigurationPayload): ConfigurationPayload {
    return {
        plex: {
            ...config.plex,
            folderMappings: config.plex.folderMappings.map((m) => ({ ...m })),
        },
        tmDb: { ...config.tmDb },
        mediaDetection: { ...config.mediaDetection },
        zurg: { ...config.zurg },
    };
}

export function defaultFolderMapping(): FolderMappingConfig {
    return {
        sourceFolder: "/mnt/zurg/new-source",
        destinationFolder: "/mnt/organized/new-destination",
        mediaType: "TvShows",
    };
}

export function fileName(path: string): string {
    const parts = path.split("/");
    return parts[parts.length - 1] ?? path;
}

export function formatBytes(value: number | null): string {
    if (!value || value <= 0) return "Unknown size";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let current = value;
    let unit = 0;
    while (current >= 1024 && unit < units.length - 1) {
        current /= 1024;
        unit += 1;
    }
    return `${current.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function formatLogTimestamp(value: string | undefined): string {
    if (!value) return "Unknown";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
}

export function logLevelColor(level: string | undefined): string {
    if (level === "Error" || level === "Fatal") return "text-error";
    if (level === "Warning") return "text-warning";
    if (level === "Debug" || level === "Verbose") return "text-text-tertiary";
    return "text-success";
}

export function logLevelBg(level: string | undefined): string {
    if (level === "Error" || level === "Fatal") return "bg-error-muted border-error/30";
    if (level === "Warning") return "bg-warning-muted border-warning/30";
    if (level === "Debug" || level === "Verbose") return "bg-surface-3 border-border-default";
    return "bg-success-muted border-success/30";
}

export function formatLogProperties(value: Record<string, unknown> | undefined): string {
    if (!value || Object.keys(value).length === 0) return "{}";
    return JSON.stringify(value, null, 2);
}

export function formatAirDate(value: string | null): string {
    if (!value) return "Unknown";
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return "Unknown";
    return parsed.toLocaleDateString();
}

export function formatReleaseDate(value: string | null | undefined): string {
    if (!value) return "Unknown";
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return "Unknown";
    return parsed.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

export function formatRuntime(runtimeMinutes: number | null | undefined): string {
    if (!runtimeMinutes || runtimeMinutes <= 0) return "Unknown";
    const hours = Math.floor(runtimeMinutes / 60);
    const minutes = runtimeMinutes % 60;
    if (hours <= 0) return `${minutes}m`;
    if (minutes <= 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
}

export function formatRating(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
    return `${value.toFixed(1)} / 10`;
}

export function parseIntOr(value: string, fallback: number): number {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function errorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) return error.message;
    return "unknown error";
}

export function sourceDirectory(path: string): string {
    const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
    const slashIndex = normalized.lastIndexOf("/");
    if (slashIndex < 0) return normalized;
    if (slashIndex === 0) return "/";
    return normalized.slice(0, slashIndex);
}

export function sourceGroupLabel(path: string): string {
    const label = fileName(path);
    return label.length > 0 ? label : path;
}

function timestampValue(value: string | null | undefined): number {
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
}

export function compareByRecency(left: ScannedFile, right: ScannedFile): number {
    return timestampValue(right.updatedAt ?? right.createdAt) - timestampValue(left.updatedAt ?? left.createdAt);
}

export function compareBySourceDirectoryThenRecency(left: ScannedFile, right: ScannedFile): number {
    const byDir = sourceDirectory(left.sourceFile).localeCompare(sourceDirectory(right.sourceFile));
    if (byDir !== 0) return byDir;
    const byRec = compareByRecency(left, right);
    if (byRec !== 0) return byRec;
    return left.sourceFile.localeCompare(right.sourceFile);
}

export function annotateFilesWithSourceDividers(files: ScannedFile[]) {
    let previousDirectory: string | null = null;
    return files.map((file) => {
        const currentDirectory = sourceDirectory(file.sourceFile);
        const sourceDividerPath = previousDirectory !== null && previousDirectory !== currentDirectory ? currentDirectory : null;
        previousDirectory = currentDirectory;
        return { file, sourceDividerPath };
    });
}

export function groupFilesBySourceDirectory(files: ScannedFile[]): { directory: string; label: string; files: ScannedFile[] }[] {
    const map = new Map<string, ScannedFile[]>();
    for (const f of files) {
        const dir = sourceDirectory(f.sourceFile);
        const existing = map.get(dir);
        if (existing) existing.push(f);
        else map.set(dir, [f]);
    }
    return [...map.entries()].map(([directory, dirFiles]) => ({
        directory,
        label: sourceGroupLabel(directory),
        files: dirFiles,
    }));
}

export function compareEpisodeFiles(left: ScannedFile, right: ScannedFile): number {
    const ls = left.seasonNumber ?? Number.MAX_SAFE_INTEGER;
    const rs = right.seasonNumber ?? Number.MAX_SAFE_INTEGER;
    if (ls !== rs) return ls - rs;
    const le = left.episodeNumber ?? Number.MAX_SAFE_INTEGER;
    const re = right.episodeNumber ?? Number.MAX_SAFE_INTEGER;
    if (le !== re) return le - re;
    return left.sourceFile.localeCompare(right.sourceFile);
}

export function formatEpisodeCode(seasonNumber: number | null, episodeNumber: number | null, episodeNumber2: number | null): string {
    const seasonLabel = seasonNumber && seasonNumber > 0 ? `S${String(seasonNumber).padStart(2, "0")}` : "S??";
    const episodeLabel = episodeNumber && episodeNumber > 0 ? `E${String(episodeNumber).padStart(2, "0")}` : "E??";
    if (episodeNumber2 && episodeNumber2 > (episodeNumber ?? 0)) {
        return `${seasonLabel}${episodeLabel}E${String(episodeNumber2).padStart(2, "0")}`;
    }
    return `${seasonLabel}${episodeLabel}`;
}

export function remapRangeSummary(file: ScannedFile): string | null {
    const remap = file.episodeRemap;
    if (!remap || remap.collapsedRanges.length === 0) return null;
    return remap.collapsedRanges
        .map((range) =>
            range.sourceStart === range.sourceEnd
                ? `E${String(range.sourceStart).padStart(2, "0")}`
                : `E${String(range.sourceStart).padStart(2, "0")}-E${String(range.sourceEnd).padStart(2, "0")}`,
        )
        .join(", ");
}

export function primaryFileName(file: ScannedFile): string {
    return fileName(file.destFile ?? file.sourceFile);
}

export function scannedFileHref(file: ScannedFile): string | null {
    if (!file.tmdbId) return null;
    if (file.mediaType === "TvShows") return `/shows/${file.tmdbId}`;
    if (file.mediaType === "Movies") return `/movies/${file.tmdbId}`;
    return null;
}

export function posterUrl(path: string | null | undefined, size = "w342"): string | null {
    if (!path) return null;
    return `${TMDB_IMG}/${size}${path}`;
}

export function backdropUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    return `${TMDB_IMG}/w1280${path}`;
}

export async function listAllScannedFiles(params: {
    status?: MediaStatus;
    mediaType?: MediaType;
    searchTerm?: string;
}): Promise<ScannedFile[]> {
    const pageSize = 200;
    const first = await mediaApi.listScannedFiles({ ...params, sortBy: "updatedAt", sortOrder: "desc", page: 1, pageSize });
    const items = [...first.items];
    for (let page = 2; page <= first.totalPages; page += 1) {
        const next = await mediaApi.listScannedFiles({ ...params, sortBy: "updatedAt", sortOrder: "desc", page, pageSize });
        items.push(...next.items);
    }
    return items;
}

export async function countScannedFiles(params: { status?: MediaStatus; mediaType?: MediaType }): Promise<number> {
    const result = await mediaApi.listScannedFiles({ ...params, page: 1, pageSize: 1 });
    return result.totalItems;
}

async function mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    if (items.length === 0) return [];
    const nextResults = new Array<R>(items.length);
    let cursor = 0;
    const workerCount = Math.max(1, Math.min(limit, items.length));
    const workers = Array.from({ length: workerCount }, async () => {
        while (true) {
            const index = cursor;
            cursor += 1;
            if (index >= items.length) return;
            nextResults[index] = await mapper(items[index], index);
        }
    });
    await Promise.all(workers);
    return nextResults;
}

export interface WantedShowItem {
    tmdbId: number;
    title: string;
    year: number | null;
    posterPath: string | null;
    missingEpisodes: number;
    airedEpisodes: number;
    scannedEpisodes: number;
    lastAirDate: string | null | undefined;
}

export async function listWantedShows(searchTerm = ""): Promise<WantedShowItem[]> {
    const titles = await mediaApi.listTitles("TvShows", searchTerm);
    const todayIso = new Date().toISOString().slice(0, 10);
    const details = await mapWithConcurrency(titles, 6, async (title) => {
        try {
            const show = await mediaApi.getShow(title.tmdbId);
            const airedEpisodes = Math.max(0, show.episodeCount ?? 0);
            const scannedEpisodes = Math.max(0, show.episodeCountScanned ?? 0);
            const missingEpisodes = Math.max(0, airedEpisodes - scannedEpisodes);
            const isAiredAlready = !!show.lastAirDate && show.lastAirDate <= todayIso;
            if (missingEpisodes <= 0 || !isAiredAlready) return null;
            return {
                tmdbId: title.tmdbId,
                title: show.title,
                year: show.year,
                posterPath: show.posterPath,
                missingEpisodes,
                airedEpisodes,
                scannedEpisodes,
                lastAirDate: show.lastAirDate,
            } satisfies WantedShowItem;
        } catch {
            return null;
        }
    });

    return details
        .filter((item): item is WantedShowItem => item !== null)
        .sort((left, right) => right.missingEpisodes - left.missingEpisodes || left.title.localeCompare(right.title));
}
