import { Dirent } from "node:fs"
import { access, readdir, stat } from "node:fs/promises"
import type { AppContext } from "@/app/context"
import { detectMovieFromFileName } from "@/modules/detection/movie-detection"
import { SeriesIdentityService } from "@/modules/detection/series-identity-service"
import { detectTvEpisode } from "@/modules/detection/tv-detection"
import { buildDestinationPath, createSymlinkAt } from "@/modules/symlink/symlink-service"
import type { RuntimeConfig } from "@/config/runtime-config"
import type { MediaType } from "@/shared/types"

const mediaExtensions = new Set([".mkv", ".mp4", ".avi", ".m4v", ".ts", ".mov", ".wmv"])

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function collectFiles(root: string): Promise<string[]> {
  const files: string[] = []
  const queue = [root]

  while (queue.length > 0) {
    const current = queue.shift()!
    let entries: Dirent[] = []
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue
      }

      const fullPath = `${current}/${entry.name}`
      if (entry.isDirectory()) {
        queue.push(fullPath)
        continue
      }

      const extension = entry.name.includes(".") ? `.${entry.name.split(".").pop()?.toLowerCase()}` : ""
      if (mediaExtensions.has(extension)) {
        files.push(fullPath)
      }
    }
  }

  return files
}

async function processWithLimit<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  const executing = new Set<Promise<void>>()

  for (const item of items) {
    const task = worker(item)
    executing.add(task)
    task.finally(() => executing.delete(task))

    if (executing.size >= limit) {
      await Promise.race(executing)
    }
  }

  await Promise.all(executing)
}

export class FilePoller {
  private timer: Timer | null = null
  private isRunning = false
  private currentRun: Promise<void> | null = null
  private currentConfig: RuntimeConfig | null = null

  constructor(private readonly context: AppContext) {}

  start(config: RuntimeConfig): void {
    this.currentConfig = config
    void this.run()
    this.timer = setInterval(() => {
      void this.run()
    }, config.plex.pollingInterval * 1000)
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    // Wait for any in-flight run to complete to prevent overlapping runs
    if (this.currentRun) {
      await this.currentRun
    }
  }

  restart(config: RuntimeConfig): void {
    void this.stop().then(() => this.start(config))
  }

  private async run(): Promise<void> {
    if (this.isRunning || !this.currentConfig) {
      return
    }

    this.isRunning = true
    this.currentRun = this.runInternal()
    
    try {
      await this.currentRun
    } finally {
      this.isRunning = false
      this.currentRun = null
    }
  }

  private async runInternal(): Promise<void> {
    try {
      const config = await this.context.configStore.get()
      this.currentConfig = config

      if (!config.tmDb.apiKey || config.tmDb.apiKey === "your-tmdb-api-key") {
        this.context.logger.warn("TMDb API key is not configured")
        return
      }

      const zurgReady = await fileExists(config.zurg.versionLocation)
      if (!zurgReady) {
        this.context.logger.info("Zurg version file not found", { path: config.zurg.versionLocation })
        return
      }

      this.context.wsHub.broadcast("zurg.version", Date.now())

      for (const mapping of config.plex.folderMappings) {
        const files = await collectFiles(mapping.sourceFolder)
        await processWithLimit(files, 8, file => this.processFile(file, mapping.destinationFolder, mapping.mediaType))
      }
    } catch (error) {
      this.context.logger.error("File polling failed", { error: String(error) })
    }
  }

  private async processFile(sourceFile: string, destinationFolder: string, mediaType: MediaType): Promise<void> {
    const existing = await this.context.scannedFilesRepo.findBySource(sourceFile)
    if (existing && existing.status === "Success") {
      return
    }

    const fileInfo = await stat(sourceFile)

    const tracked = existing
      ? existing
      : await this.context.scannedFilesRepo.createProcessingEntry({
        sourceFile,
        fileSize: fileInfo.size,
        fileHash: null,
        mediaType,
      })

    if (!existing) {
      this.context.wsHub.broadcast("file.added", tracked)
    }

    if (mediaType === "Extras" || mediaType === "Unknown") {
      const updated = await this.context.scannedFilesRepo.updateProcessed({
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
      })
      if (updated) {
        this.context.wsHub.broadcast("file.updated", updated)
      }
      return
    }

    try {
      if (mediaType === "Movies") {
        const detected = detectMovieFromFileName(sourceFile)
        if (!detected) {
          await this.markFailed(tracked.id, mediaType)
          return
        }

        const searchResults = await this.context.tmdb.searchMovie(detected.title)
        const best = searchResults
          .filter(item => (detected.year ? this.context.tmdb.movieYear(item) === detected.year : true))
          .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))[0] ?? searchResults[0]

        if (!best) {
          await this.markFailed(tracked.id, mediaType)
          return
        }

        const [movie, externalIds] = await Promise.all([
          this.context.tmdb.getMovie(best.id),
          this.context.tmdb.getMovieExternalIds(best.id),
        ])

        const destinationPath = buildDestinationPath(sourceFile, destinationFolder, mediaType, {
          title: movie.title,
          year: this.context.tmdb.movieYear(movie),
          imdbId: externalIds.imdb_id,
        })

        await createSymlinkAt(sourceFile, destinationPath)

        const updated = await this.context.scannedFilesRepo.updateProcessed({
          id: tracked.id,
          destFile: destinationPath,
          mediaType,
          tmdbId: movie.id,
          imdbId: externalIds.imdb_id,
          title: movie.title,
          year: this.context.tmdb.movieYear(movie),
          genres: movie.genres?.map(g => g.name) ?? [],
          seasonNumber: null,
          episodeNumber: null,
          episodeNumber2: null,
          status: "Success",
        })

        if (updated) {
          this.context.wsHub.broadcast("file.updated", updated)
        }
        return
      }

      if (mediaType === "TvShows") {
        const identityService = new SeriesIdentityService(this.context.db, this.context.tmdb)
        const detected = await detectTvEpisode(sourceFile, identityService)
        if (!detected) {
          await this.markFailed(tracked.id, mediaType)
          return
        }

        const [show, episode] = await Promise.all([
          this.context.tmdb.getTv(detected.tmdbId),
          this.context.tmdb.getTvEpisode(detected.tmdbId, detected.seasonNumber, detected.episodeNumber),
        ])

        const destinationPath = buildDestinationPath(sourceFile, destinationFolder, mediaType, {
          title: show.name,
          year: this.context.tmdb.tvYear(show),
          imdbId: detected.imdbId,
          seasonNumber: detected.seasonNumber,
          episodeNumber: detected.episodeNumber,
          episodeNumber2: detected.episodeNumber2,
          episodeTitle: episode.name,
        })

        await createSymlinkAt(sourceFile, destinationPath)

        const updated = await this.context.scannedFilesRepo.updateProcessed({
          id: tracked.id,
          destFile: destinationPath,
          mediaType,
          tmdbId: show.id,
          imdbId: detected.imdbId,
          title: show.name,
          year: this.context.tmdb.tvYear(show),
          genres: show.genres?.map(g => g.name) ?? [],
          seasonNumber: detected.seasonNumber,
          episodeNumber: detected.episodeNumber,
          episodeNumber2: detected.episodeNumber2,
          status: "Success",
        })

        if (updated) {
          this.context.wsHub.broadcast("file.updated", updated)
        }
      }
    } catch (error) {
      this.context.logger.warn("Failed processing file", {
        sourceFile,
        mediaType,
        error: String(error),
      })
      await this.markFailed(tracked.id, mediaType)
    }
  }

  private async markFailed(id: number, mediaType: MediaType): Promise<void> {
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
    })
    if (updated) {
      this.context.wsHub.broadcast("file.updated", updated)
    }
  }
}
