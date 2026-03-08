export type MediaType = "Movies" | "TvShows" | "Extras" | "Unknown"
export type MediaStatus = "Processing" | "Success" | "Failed" | "Duplicate"
export type LogLevel = "Verbose" | "Debug" | "Information" | "Warning" | "Error" | "Fatal"

export interface FolderMappingConfig {
  sourceFolder: string
  destinationFolder: string
  mediaType: MediaType
}

export interface PlexConfig {
  host: string
  port: number
  plexToken: string
  folderMappings: FolderMappingConfig[]
  pollingInterval: number
  processNewFolderDelay: number
}

export interface TMDbConfig {
  apiKey: string
}

export interface MediaDetectionConfig {
  cacheDuration: number
  autoExtrasThresholdBytes: number
}

export interface ZurgConfig {
  versionLocation: string
}

export interface ConfigurationPayload {
  plex: PlexConfig
  tmDb: TMDbConfig
  mediaDetection: MediaDetectionConfig
  zurg: ZurgConfig
}

export interface MediaTitleItem {
  tmdbId: number
  title: string | null
  year: number | null
  posterPath: string | null
}

export interface MediaCastMember {
  id: number
  name: string
  character: string | null
  profilePath: string | null
  order: number | null
}

export interface MediaInfo {
  title: string
  year: number | null
  tmdbId: number
  tvdbId?: number | null
  imdbId: string | null
  mediaType: MediaType
  posterPath: string | null
  backdropPath: string | null
  overview: string | null
  status: string | null
  genres: string[]
  tagline?: string | null
  releaseDate?: string | null
  firstAirDate?: string | null
  lastAirDate?: string | null
  runtimeMinutes?: number | null
  voteAverage?: number | null
  voteCount?: number | null
  originalLanguage?: string | null
  originCountry?: string[]
  networks?: string[]
  cast?: MediaCastMember[]
  episodeCount?: number
  episodeCountScanned?: number
  seasonCount?: number
  seasonCountScanned?: number
}

export interface EpisodeInfo {
  episodeNumber: number
  name: string | null
  overview: string | null
  stillPath: string | null
  airDate: string | null
  tmdbId?: number
  tvdbId?: number
  isScanned?: boolean
}

export interface SeasonInfo {
  seasonNumber: number
  name: string | null
  overview: string | null
  posterPath: string | null
  airDate: string | null
  episodes: EpisodeInfo[]
  episodeCount: number
  episodeCountScanned: number
}

export interface ScannedFile {
  id: number
  sourceFile: string
  destFile: string | null
  fileSize: number | null
  fileHash: string | null
  mediaType: MediaType | null
  tmdbId: number | null
  tvdbId: number | null
  imdbId: string | null
  title: string | null
  year: number | null
  genres: string[] | null
  seasonNumber: number | null
  episodeNumber: number | null
  episodeNumber2: number | null
  episodeRemap?: EpisodeRemapInfo | null
  posterPath: string | null
  status: MediaStatus
  createdAt: string
  updatedAt: string | null
}

export interface EpisodeRemapRange {
  sourceStart: number
  sourceEnd: number
}

export interface EpisodeRemapInfo {
  reason: "season-episode-compaction"
  sourceSeasonNumber: number
  sourceEpisodeNumber: number
  sourceEpisodeNumber2: number | null
  remappedSeasonNumber: number
  remappedEpisodeNumber: number
  remappedEpisodeNumber2: number | null
  tmdbEpisodeCount: number
  sourceEpisodeMax: number
  collapsedRanges: EpisodeRemapRange[]
}

export interface PagedResult<T> {
  items: T[]
  totalItems: number
  page: number
  pageSize: number
  totalPages: number
}

export interface TvEpisodeGroup {
  id: string
  name: string
  description: string | null
  type: number
  episodeCount: number
  groupCount: number
  selected: boolean
}

export interface TvEpisodeGroupsResponse {
  tmdbId: number
  selectedEpisodeGroupId: string | null
  selectedEpisodeGroupName: string | null
  groups: TvEpisodeGroup[]
}

export interface TvFilesResponse {
  tmdbId: number
  selectedEpisodeGroupId: string | null
  selectedEpisodeGroupName: string | null
  categorizedFiles: ScannedFile[]
  uncategorizedFiles: ScannedFile[]
}

export interface MovieFilesResponse {
  tmdbId: number
  primaryFiles: ScannedFile[]
  extraFiles: ScannedFile[]
}

export type TvEpisodeSourceType = "tmdb" | "tvdb"
export type TvdbSeasonType = "default" | "official" | "dvd" | "absolute" | "alternate" | "regional"

export interface TvEpisodeSourceSelection {
  tmdbId: number
  source: TvEpisodeSourceType
  sourceLabel: string
  tvdbId: number | null
  tvdbSeriesName: string | null
  tvdbSeasonType: TvdbSeasonType | null
  tvdbSeasonTypeLabel: string | null
  suggestedTvdbSeries: TvdbSearchResult | null
  updatedAt: string | null
}

export interface TvdbSearchResult {
  tvdbId: number
  title: string
  year: number | null
  posterPath: string | null
  overview: string | null
}

export interface EpisodeSourceChangeResponse extends TvEpisodeSourceSelection {
  removedCount: number
  reprocessedCount: number
}

export interface EpisodeGroupChangeResponse {
  tmdbId: number
  selectedEpisodeGroupId: string | null
  selectedEpisodeGroupName: string | null
  removedCount: number
  reprocessedCount: number
}

export interface RealtimeEnvelope {
  type: "file.added" | "file.updated" | "file.removed" | "heartbeat" | "zurg.version"
  payload: unknown
}

export interface LogEntry {
  Timestamp?: string
  Level?: LogLevel | string
  RenderedMessage?: string
  Properties?: Record<string, unknown>
}

export interface LogsResponse {
  logs: LogEntry[]
}

export interface StatusCount {
  status: MediaStatus
  count: number
}

export interface MediaTypeCount {
  mediaType: MediaType
  count: number
}

export interface MediaTypeStorage {
  mediaType: MediaType
  count: number
  totalFileSize: number
}

export interface DashboardRecentItem {
  id: number
  mediaType: "Movies" | "TvShows"
  tmdbId: number
  title: string | null
  year: number | null
  posterPath: string | null
  imagePath: string | null
  imageKind: "poster" | "still"
  episodeTitle: string | null
  seasonNumber: number | null
  episodeNumber: number | null
  episodeNumber2: number | null
  sourceFile: string
  destFile: string | null
  fileSize: number | null
  createdAt: string
  updatedAt: string | null
}

export type TriageIssueKind =
    | "wanted-show"
    | "unidentified-tv"
    | "unidentified-movie"
    | "failed-file"
    | "duplicate-file"
    | "episode-order";

export type TriageEntityType = "show" | "movie" | "file" | "folder";
export type TriagePriority = "critical" | "high" | "medium" | "low";

export interface TriageItemCounts {
    files: number;
    missingEpisodes?: number;
    scannedEpisodes?: number;
    airedEpisodes?: number;
    missingSeasons?: number[];
}

export interface TriageInboxItem {
    id: string;
    kind: TriageIssueKind;
    entityType: TriageEntityType;
    entityId: string;
    title: string;
    subtitle: string;
    priority: TriagePriority;
    recommendedAction: string;
    counts: TriageItemCounts;
    lastActivityAt: string | null;
    deepLink: string;
    tmdbId?: number | null;
    imdbId?: string | null;
    mediaType?: MediaType | null;
    sourceFolder?: string | null;
    fileIds: number[];
    sampleFiles: ScannedFile[];
    diagnosticsSummary?: string | null;
}

export interface TriageInboxResponse {
    items: TriageInboxItem[];
    summary: {
        totalItems: number;
        wantedShows: number;
        missingEpisodes: number;
        unidentifiedTv: number;
        unidentifiedMovies: number;
        failedFiles: number;
        duplicateFiles: number;
        episodeOrderShows: number;
    };
}

export interface ScannedFileDiagnostics {
    file: ScannedFile;
    inferredMediaKind: "tv" | "movie" | "unknown";
    parseSnapshot: {
        rawTitleHint: string | null;
        normalizedTitleHint: string | null;
        yearHint: number | null;
        seasonNumber: number | null;
        episodeNumber: number | null;
        episodeNumber2: number | null;
    };
    identitySnapshot: {
        mediaType: MediaType | null;
        tmdbId: number | null;
        tvdbId: number | null;
        imdbId: string | null;
        storedTitle: string | null;
        storedYear: number | null;
        canonicalTitle: string | null;
        normalizedTitle: string | null;
        aliases: string[];
    };
    orderingSnapshot: {
        episodeSource: TvEpisodeSourceType | null;
        tvdbSeriesName: string | null;
        tvdbSeasonType: TvdbSeasonType | null;
        episodeGroupId: string | null;
        episodeGroupName: string | null;
        storedSeasonNumber: number | null;
        storedEpisodeNumber: number | null;
        storedEpisodeNumber2: number | null;
        resolvedSeasonNumber: number | null;
        resolvedEpisodeNumber: number | null;
        resolvedEpisodeNumber2: number | null;
        episodeRemap: EpisodeRemapInfo | null;
    };
    processingSnapshot: {
        status: MediaStatus;
        destinationFile: string | null;
        createdAt: string;
        updatedAt: string | null;
        versionUpdated: number;
        updateToVersion: number;
    };
    explanations: string[];
}

export interface ScannedFilesDashboard {
  totalFiles: number
  totalSuccessfulFiles: number
  totalFileSize: number
  totalSuccessfulFileSize: number
  distinctMovies: number
  distinctTvShows: number
  addedLast7Days: number
  addedLast30Days: number
  attentionCount: number
  lastIngestedAt: string | null
  lastLibraryItemAt: string | null
  byStatus: StatusCount[]
  byMediaType: MediaTypeCount[]
  storageByMediaType: MediaTypeStorage[]
  recentItems: DashboardRecentItem[]
}

/* ── TMDb search ── */

export interface MediaSearchResult {
  tmdbId: number
  title: string
  year: number | null
  posterPath: string | null
}

/* ── Bulk update ── */

export interface BulkUpdateItem {
  id: number
  tmdbId?: number
  seasonNumber?: number
  episodeNumber?: number
  episodeNumber2?: number
  mediaType?: MediaType
}

export interface IdentityUpdatePayload {
  oldTmdbId: number
  newTmdbId: number
  newCanonicalTitle: string
  newYear: number | null
  newImdbId: string | null
}

export interface BulkUpdateRequest {
  dryRun?: boolean
  updates: BulkUpdateItem[]
  identityUpdate?: IdentityUpdatePayload
}

export interface BulkUpdateConflict {
  id: number
  sourceFile: string
  reason: string
}

export interface BulkUpdateDryRunResponse {
  totalFiles: number
  willUpdate: number
  conflicts: BulkUpdateConflict[]
  identityUpdate: {
    aliasesWillRedirect: number
    identitiesWillUpdate: number
  } | null
}

export interface BulkUpdateApplyResponse {
  updated: number
  failed: Array<{ id: number; error: string }>
  symlinksRecreated: number
  symlinksFailed: number
  identityUpdated: boolean
}

export interface UpdateScannedFileRequest {
  tmdbId?: number
  seasonNumber?: number
  episodeNumber?: number
  episodeNumber2?: number
  mediaType?: MediaType
}
