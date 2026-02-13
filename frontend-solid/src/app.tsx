import { A, Route, Router, useLocation, useParams } from "@solidjs/router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query"
import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount, type ParentComponent } from "solid-js"
import { mediaApi } from "@/lib/api"
import { createRealtimeSocket } from "@/lib/realtime"
import type { ConfigurationPayload, FolderMappingConfig, MediaStatus, MediaType, ScannedFile, SeasonInfo } from "@/lib/types"

const mediaTypeOptions: MediaType[] = ["Movies", "TvShows", "Extras", "Unknown"]

function cloneConfig(config: ConfigurationPayload): ConfigurationPayload {
  return {
    plex: {
      ...config.plex,
      folderMappings: config.plex.folderMappings.map(mapping => ({ ...mapping })),
    },
    tmDb: { ...config.tmDb },
    mediaDetection: { ...config.mediaDetection },
    zurg: { ...config.zurg },
  }
}

function defaultFolderMapping(): FolderMappingConfig {
  return {
    sourceFolder: "/mnt/zurg/new-source",
    destinationFolder: "/mnt/organized/new-destination",
    mediaType: "TvShows",
  }
}

function fileName(path: string): string {
  const parts = path.split("/")
  return parts[parts.length - 1] ?? path
}

function formatBytes(value: number | null): string {
  if (!value || value <= 0) {
    return "Unknown size"
  }

  const units = ["B", "KB", "MB", "GB", "TB"]
  let current = value
  let unit = 0
  while (current >= 1024 && unit < units.length - 1) {
    current /= 1024
    unit += 1
  }
  return `${current.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

function formatDate(value: string | null): string {
  if (!value) return "Unknown"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "Unknown"
  return parsed.toLocaleString()
}

function formatAirDate(value: string | null): string {
  if (!value) return "Unknown"
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return "Unknown"
  return parsed.toLocaleDateString()
}

function parseIntOr(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function compareEpisodeFiles(left: ScannedFile, right: ScannedFile): number {
  const leftSeason = left.seasonNumber ?? Number.MAX_SAFE_INTEGER
  const rightSeason = right.seasonNumber ?? Number.MAX_SAFE_INTEGER
  if (leftSeason !== rightSeason) {
    return leftSeason - rightSeason
  }

  const leftEpisode = left.episodeNumber ?? Number.MAX_SAFE_INTEGER
  const rightEpisode = right.episodeNumber ?? Number.MAX_SAFE_INTEGER
  if (leftEpisode !== rightEpisode) {
    return leftEpisode - rightEpisode
  }

  return left.sourceFile.localeCompare(right.sourceFile)
}

function primaryFileName(file: ScannedFile): string {
  return fileName(file.destFile ?? file.sourceFile)
}

function FileRowIdentity(props: { file: ScannedFile }) {
  const hasDestination = Boolean(props.file.destFile)

  return (
    <div>
      <p class="file-title">{primaryFileName(props.file)}</p>
      <p class="file-path">{hasDestination ? `Source file: ${fileName(props.file.sourceFile)}` : props.file.sourceFile}</p>
    </div>
  )
}

async function listAllScannedFiles(params: {
  status?: MediaStatus
  mediaType?: MediaType
  searchTerm?: string
}): Promise<ScannedFile[]> {
  const pageSize = 200
  const first = await mediaApi.listScannedFiles({
    ...params,
    sortBy: "updatedAt",
    sortOrder: "desc",
    page: 1,
    pageSize,
  })

  const items = [...first.items]
  for (let page = 2; page <= first.totalPages; page += 1) {
    const next = await mediaApi.listScannedFiles({
      ...params,
      sortBy: "updatedAt",
      sortOrder: "desc",
      page,
      pageSize,
    })
    items.push(...next.items)
  }

  return items
}

function NavLink(props: { href: string; children: string }) {
  const location = useLocation()
  const active = createMemo(() => location.pathname === props.href || location.pathname.startsWith(`${props.href}/`))
  return (
    <A href={props.href} class={`nav-link ${active() ? "is-active" : ""}`}>
      {props.children}
    </A>
  )
}

const AppShell: ParentComponent = props => {
  const queryClient = useQueryClient()
  const [lastHeartbeat, setLastHeartbeat] = createSignal<number>(0)
  const [lastZurgSignal, setLastZurgSignal] = createSignal<number>(0)

  onMount(() => {
    const cleanupSocket = createRealtimeSocket(message => {
      if (message.type === "heartbeat") {
        const timestamp = Number(message.payload)
        if (Number.isFinite(timestamp)) {
          setLastHeartbeat(timestamp)
        }
        return
      }

      if (message.type === "zurg.version") {
        const timestamp = Number(message.payload)
        if (Number.isFinite(timestamp)) {
          setLastZurgSignal(timestamp)
        }
        return
      }

      if (message.type === "file.added" || message.type === "file.updated" || message.type === "file.removed") {
        void queryClient.invalidateQueries({ queryKey: ["titles"] })
        void queryClient.invalidateQueries({ queryKey: ["show"] })
        void queryClient.invalidateQueries({ queryKey: ["movie"] })
        void queryClient.invalidateQueries({ queryKey: ["tv-files"] })
        void queryClient.invalidateQueries({ queryKey: ["movie-files"] })
        void queryClient.invalidateQueries({ queryKey: ["unidentified-files"] })
      }
    })

    onCleanup(() => cleanupSocket())
  })

  const backendOnline = createMemo(() => {
    const delta = Date.now() - lastHeartbeat()
    return lastHeartbeat() > 0 && delta < 70_000
  })

  const zurgOnline = createMemo(() => {
    const delta = Date.now() - lastZurgSignal()
    return lastZurgSignal() > 0 && delta < 70_000
  })

  return (
    <div class="app-shell">
      <header class="hero">
        <div class="hero-top-row">
          <p class="eyebrow">Mediaflick / Solid Frontend</p>
          <div class="status-chips">
            <span class={`chip ${backendOnline() ? "ok" : "warn"}`}>{backendOnline() ? "Backend Online" : "Backend Waiting"}</span>
            <span class={`chip ${zurgOnline() ? "ok" : "warn"}`}>{zurgOnline() ? "Zurg Online" : "Zurg Waiting"}</span>
          </div>
        </div>
        <h1>Media-first organizing for shows and movies</h1>
        <p>
          Browse titles directly, control TV episode grouping, and review movie extras from related source folders.
        </p>
      </header>

      <nav class="main-nav">
        <NavLink href="/shows">TV Shows</NavLink>
        <NavLink href="/movies">Movies</NavLink>
        <NavLink href="/unidentified">Unidentified</NavLink>
        <NavLink href="/settings">Configuration</NavLink>
      </nav>

      <main class="content">{props.children}</main>
    </div>
  )
}

function MediaSearchHeader(props: {
  title: string
  subtitle: string
  searchValue: string
  onSearch: (next: string) => void
}) {
  return (
    <section class="section-header">
      <div>
        <h2>{props.title}</h2>
        <p>{props.subtitle}</p>
      </div>
      <input
        value={props.searchValue}
        onInput={event => props.onSearch(event.currentTarget.value)}
        class="search-input"
        placeholder="Search titles"
      />
    </section>
  )
}

function TvShowsPage() {
  const [searchTerm, setSearchTerm] = createSignal("")
  const titlesQuery = useQuery(() => ({
    queryKey: ["titles", "tv", searchTerm().trim().toLowerCase()],
    queryFn: () => mediaApi.listTitles("TvShows", searchTerm()),
  }))

  return (
    <section class="panel">
      <MediaSearchHeader
        title="TV Shows"
        subtitle="Open any show and switch episode grouping when TMDb offers alternatives."
        searchValue={searchTerm()}
        onSearch={setSearchTerm}
      />

      <Show when={titlesQuery.isLoading}>
        <p class="empty-state">Loading TV shows...</p>
      </Show>
      <Show when={titlesQuery.isError}>
        <p class="empty-state">Unable to load TV shows right now.</p>
      </Show>
      <Show when={!titlesQuery.isLoading && !titlesQuery.isError && (titlesQuery.data?.length ?? 0) === 0}>
        <p class="empty-state">No TV shows found for this filter.</p>
      </Show>

      <div class="media-grid">
        <For each={titlesQuery.data ?? []}>
          {item => (
            <A class="media-card" href={`/shows/${item.tmdbId}`}>
              <p class="media-card-title">{item.title ?? "Unknown title"}</p>
              <p class="media-card-meta">TMDb {item.tmdbId}</p>
            </A>
          )}
        </For>
      </div>
    </section>
  )
}

function MoviesPage() {
  const [searchTerm, setSearchTerm] = createSignal("")
  const titlesQuery = useQuery(() => ({
    queryKey: ["titles", "movies", searchTerm().trim().toLowerCase()],
    queryFn: () => mediaApi.listTitles("Movies", searchTerm()),
  }))

  return (
    <section class="panel">
      <MediaSearchHeader
        title="Movies"
        subtitle="Inspect each movie directly and reveal same-folder files that should be treated as extras."
        searchValue={searchTerm()}
        onSearch={setSearchTerm}
      />

      <Show when={titlesQuery.isLoading}>
        <p class="empty-state">Loading movies...</p>
      </Show>
      <Show when={titlesQuery.isError}>
        <p class="empty-state">Unable to load movies right now.</p>
      </Show>
      <Show when={!titlesQuery.isLoading && !titlesQuery.isError && (titlesQuery.data?.length ?? 0) === 0}>
        <p class="empty-state">No movies found for this filter.</p>
      </Show>

      <div class="media-grid">
        <For each={titlesQuery.data ?? []}>
          {item => (
            <A class="media-card" href={`/movies/${item.tmdbId}`}>
              <p class="media-card-title">{item.title ?? "Unknown title"}</p>
              <p class="media-card-meta">TMDb {item.tmdbId}</p>
            </A>
          )}
        </For>
      </div>
    </section>
  )
}

function UnidentifiedFileRow(props: { file: ScannedFile }) {
  const typeLabel = props.file.mediaType ?? "No media type"
  const updatedLabel = formatDate(props.file.updatedAt ?? props.file.createdAt)

  return (
    <div class="file-row">
      <FileRowIdentity file={props.file} />
      <div class="file-meta">
        <span>Status: {props.file.status}</span>
        <span>Type: {typeLabel}</span>
        <span>{formatBytes(props.file.fileSize)}</span>
        <span>Updated: {updatedLabel}</span>
      </div>
    </div>
  )
}

function UnidentifiedPage() {
  const [searchTerm, setSearchTerm] = createSignal("")
  const unidentifiedQuery = useQuery(() => ({
    queryKey: ["unidentified-files", searchTerm().trim().toLowerCase()],
    queryFn: async () => {
      const normalizedSearch = searchTerm().trim()
      const [failedFiles, duplicateFiles, unknownTypeFiles] = await Promise.all([
        listAllScannedFiles({ status: "Failed", searchTerm: normalizedSearch }),
        listAllScannedFiles({ status: "Duplicate", searchTerm: normalizedSearch }),
        listAllScannedFiles({ mediaType: "Unknown", searchTerm: normalizedSearch }),
      ])

      const byId = new Map<number, ScannedFile>()
      for (const file of [...failedFiles, ...duplicateFiles, ...unknownTypeFiles]) {
        byId.set(file.id, file)
      }

      const files = [...byId.values()].sort((left, right) => {
        const leftParsed = Date.parse(left.updatedAt ?? left.createdAt)
        const rightParsed = Date.parse(right.updatedAt ?? right.createdAt)
        const leftTime = Number.isNaN(leftParsed) ? 0 : leftParsed
        const rightTime = Number.isNaN(rightParsed) ? 0 : rightParsed
        return rightTime - leftTime
      })

      const groupedByType = new Map<string, ScannedFile[]>()
      for (const file of files) {
        const key = file.mediaType ?? "No media type"
        const bucket = groupedByType.get(key) ?? []
        bucket.push(file)
        groupedByType.set(key, bucket)
      }

      const typeOrder: Record<string, number> = {
        "No media type": 0,
        Unknown: 1,
        TvShows: 2,
        Movies: 3,
        Extras: 4,
      }

      const typeGroups = [...groupedByType.entries()]
        .sort((left, right) => {
          const leftOrder = typeOrder[left[0]] ?? Number.MAX_SAFE_INTEGER
          const rightOrder = typeOrder[right[0]] ?? Number.MAX_SAFE_INTEGER
          if (leftOrder !== rightOrder) {
            return leftOrder - rightOrder
          }
          return left[0].localeCompare(right[0])
        })
        .map(([type, groupFiles]) => ({
          type,
          count: groupFiles.length,
          files: groupFiles,
        }))

      return {
        files,
        typeGroups,
        total: files.length,
        failedCount: files.filter(file => file.status === "Failed").length,
        duplicateCount: files.filter(file => file.status === "Duplicate").length,
        unknownTypeCount: files.filter(file => file.mediaType === "Unknown").length,
      }
    },
  }))

  return (
    <section class="panel detail-panel">
      <MediaSearchHeader
        title="Unidentified Media"
        subtitle="Read-only queue for files that still need identity work before they can be organized."
        searchValue={searchTerm()}
        onSearch={setSearchTerm}
      />

      <Show when={unidentifiedQuery.isLoading}>
        <p class="empty-state">Loading unidentified files...</p>
      </Show>
      <Show when={unidentifiedQuery.isError}>
        <p class="empty-state">Unable to load unidentified files right now.</p>
      </Show>

      <Show when={(unidentifiedQuery.data?.total ?? 0) > 0}>
        <section class="files-section">
          <div class="pill-stack">
            <span class="pill">Total: {unidentifiedQuery.data?.total ?? 0}</span>
            <span class="pill">Failed: {unidentifiedQuery.data?.failedCount ?? 0}</span>
            <span class="pill">Duplicate: {unidentifiedQuery.data?.duplicateCount ?? 0}</span>
            <span class="pill">Unknown type: {unidentifiedQuery.data?.unknownTypeCount ?? 0}</span>
          </div>
          <p class="section-help">Includes failed detection, duplicate destination conflicts, and non-media type entries.</p>
          <For each={unidentifiedQuery.data?.typeGroups ?? []}>
            {group => (
              <div class="season-group">
                <h4>{group.type} ({group.count})</h4>
                <div class="season-list">
                  <For each={group.files}>{file => <UnidentifiedFileRow file={file} />}</For>
                </div>
              </div>
            )}
          </For>
        </section>
      </Show>

      <Show when={!unidentifiedQuery.isLoading && !unidentifiedQuery.isError && (unidentifiedQuery.data?.total ?? 0) === 0}>
        <p class="empty-state">No unidentified files found for this filter.</p>
      </Show>
    </section>
  )
}

interface ScannedEpisodeCard {
  kind: "file"
  episodeNumber: number
  file: ScannedFile
}

interface MissingEpisodeCard {
  kind: "missing"
  episodeNumber: number
  episodeName: string | null
  airDate: string | null
}

type SeasonEpisodeCard = ScannedEpisodeCard | MissingEpisodeCard

interface SeasonCoverageGroup {
  seasonNumber: number
  episodeCount: number
  episodeCountScanned: number
  cards: SeasonEpisodeCard[]
}

function EpisodeFileRow(props: { file: ScannedFile }) {
  return (
    <div class="file-row">
      <FileRowIdentity file={props.file} />
      <div class="file-meta">
        <span>{props.file.seasonNumber ? `S${String(props.file.seasonNumber).padStart(2, "0")}` : "S??"}</span>
        <span>{props.file.episodeNumber ? `E${String(props.file.episodeNumber).padStart(2, "0")}` : "E??"}</span>
        <span>{props.file.status}</span>
        <span>{formatDate(props.file.updatedAt ?? props.file.createdAt)}</span>
      </div>
    </div>
  )
}

function MissingEpisodeRow(props: { seasonNumber: number; episodeNumber: number; episodeName: string | null; airDate: string | null }) {
  return (
    <div class="file-row missing-file-row">
      <div>
        <p class="file-title">
          Missing S{String(props.seasonNumber).padStart(2, "0")}E{String(props.episodeNumber).padStart(2, "0")}
          <Show when={props.episodeName}> · {props.episodeName}</Show>
        </p>
        <p class="file-path">Originally aired: {formatAirDate(props.airDate)}</p>
      </div>
      <div class="file-meta">
        <span class="missing-pill">Missing</span>
        <span>Aired: {formatAirDate(props.airDate)}</span>
      </div>
    </div>
  )
}

function TvShowDetailsPage() {
  const params = useParams()
  const queryClient = useQueryClient()
  const tmdbId = createMemo(() => Number(params.tmdbId))

  const showQuery = useQuery(() => ({
    queryKey: ["show", tmdbId()],
    queryFn: () => mediaApi.getShow(tmdbId()),
    enabled: Number.isInteger(tmdbId()) && tmdbId() > 0,
  }))

  const episodeGroupsQuery = useQuery(() => ({
    queryKey: ["tv-episode-groups", tmdbId()],
    queryFn: () => mediaApi.getShowEpisodeGroups(tmdbId()),
    enabled: Number.isInteger(tmdbId()) && tmdbId() > 0,
  }))

  const tvFilesQuery = useQuery(() => ({
    queryKey: ["tv-files", tmdbId()],
    queryFn: () => mediaApi.getShowFiles(tmdbId()),
    enabled: Number.isInteger(tmdbId()) && tmdbId() > 0,
  }))

  const seasonDetailsQuery = useQuery(() => ({
    queryKey: ["tv-seasons", tmdbId(), showQuery.data?.seasonCount ?? 0],
    queryFn: async () => {
      const seasonCount = showQuery.data?.seasonCount ?? 0
      const requests: Promise<SeasonInfo>[] = []
      for (let seasonNumber = 1; seasonNumber <= seasonCount; seasonNumber += 1) {
        requests.push(mediaApi.getShowSeason(tmdbId(), seasonNumber))
      }

      const seasons = await Promise.all(requests)
      return seasons.sort((left, right) => left.seasonNumber - right.seasonNumber)
    },
    enabled: Number.isInteger(tmdbId()) && tmdbId() > 0 && (showQuery.data?.seasonCount ?? 0) > 0,
  }))

  const episodeGroupMutation = useMutation(() => ({
    mutationFn: (episodeGroupId: string | null) => mediaApi.setShowEpisodeGroup(tmdbId(), episodeGroupId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["show", tmdbId()] }),
        queryClient.invalidateQueries({ queryKey: ["tv-files", tmdbId()] }),
        queryClient.invalidateQueries({ queryKey: ["tv-episode-groups", tmdbId()] }),
      ])
    },
  }))

  const categorizedBySeason = createMemo(() => {
    const seasons = new Map<number, ScannedFile[]>()
    for (const item of tvFilesQuery.data?.categorizedFiles ?? []) {
      const season = item.seasonNumber ?? 0
      const bucket = seasons.get(season) ?? []
      bucket.push(item)
      seasons.set(season, bucket)
    }

    return [...seasons.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([seasonNumber, files]) => [seasonNumber, [...files].sort(compareEpisodeFiles)] as const)
  })

  const seasonCoverageBySeason = createMemo<SeasonCoverageGroup[]>(() => {
    const seasonDetails = seasonDetailsQuery.data
    if (!seasonDetails || seasonDetails.length === 0) {
      return []
    }

    const scannedBySeason = new Map<number, Map<number, ScannedFile>>()
    for (const file of tvFilesQuery.data?.categorizedFiles ?? []) {
      if (!file.seasonNumber || !file.episodeNumber) {
        continue
      }

      const seasonMap = scannedBySeason.get(file.seasonNumber) ?? new Map<number, ScannedFile>()
      seasonMap.set(file.episodeNumber, file)
      if (file.episodeNumber2 && file.episodeNumber2 > file.episodeNumber) {
        seasonMap.set(file.episodeNumber2, file)
      }
      scannedBySeason.set(file.seasonNumber, seasonMap)
    }

    const knownSeasons = new Set<number>()
    const groups: SeasonCoverageGroup[] = []

    for (const season of seasonDetails) {
      knownSeasons.add(season.seasonNumber)

      const seasonMap = scannedBySeason.get(season.seasonNumber) ?? new Map<number, ScannedFile>()
      const tmdbEpisodeNumbers = new Set<number>()
      const cards: SeasonEpisodeCard[] = []

      for (const episode of season.episodes) {
        tmdbEpisodeNumbers.add(episode.episodeNumber)
        const scannedFile = seasonMap.get(episode.episodeNumber)
        if (scannedFile) {
          cards.push({
            kind: "file",
            episodeNumber: episode.episodeNumber,
            file: scannedFile,
          })
          continue
        }

        cards.push({
          kind: "missing",
          episodeNumber: episode.episodeNumber,
          episodeName: episode.name,
          airDate: episode.airDate,
        })
      }

      const additionalScanned = [...seasonMap.entries()]
        .filter(([episodeNumber]) => !tmdbEpisodeNumbers.has(episodeNumber))
        .sort((left, right) => left[0] - right[0])
      for (const [episodeNumber, file] of additionalScanned) {
        cards.push({ kind: "file", episodeNumber, file })
      }

      const episodeCountScanned = season.episodes.filter(episode => seasonMap.has(episode.episodeNumber)).length
      groups.push({
        seasonNumber: season.seasonNumber,
        episodeCount: season.episodes.length,
        episodeCountScanned,
        cards,
      })
    }

    const orphanSeasons = [...scannedBySeason.entries()]
      .filter(([seasonNumber]) => !knownSeasons.has(seasonNumber))
      .sort((left, right) => left[0] - right[0])

    for (const [seasonNumber, seasonMap] of orphanSeasons) {
      const cards = [...seasonMap.entries()]
        .sort((left, right) => left[0] - right[0])
        .map(([episodeNumber, file]) => ({
          kind: "file" as const,
          episodeNumber,
          file,
        }))

      groups.push({
        seasonNumber,
        episodeCount: cards.length,
        episodeCountScanned: cards.length,
        cards,
      })
    }

    return groups.sort((left, right) => left.seasonNumber - right.seasonNumber)
  })

  const seasonGroupsToRender = createMemo<SeasonCoverageGroup[]>(() => {
    const coverageGroups = seasonCoverageBySeason()
    if (coverageGroups.length > 0) {
      return coverageGroups
    }

    return categorizedBySeason().map(([seasonNumber, files]) => ({
      seasonNumber,
      episodeCount: files.length,
      episodeCountScanned: files.length,
      cards: files.map(file => ({
        kind: "file" as const,
        episodeNumber: file.episodeNumber ?? Number.MAX_SAFE_INTEGER,
        file,
      })),
    }))
  })

  const selectedEpisodeGroup = createMemo(() => {
    const selectedId = episodeGroupsQuery.data?.selectedEpisodeGroupId
    if (!selectedId) {
      return null
    }
    return (episodeGroupsQuery.data?.groups ?? []).find(group => group.id === selectedId) ?? null
  })

  const displayedEpisodeTotal = createMemo(() => {
    return selectedEpisodeGroup()?.episodeCount ?? showQuery.data?.episodeCount ?? 0
  })

  const scannedSeasonCount = createMemo(() => {
    const seasons = seasonGroupsToRender()
      .filter(group => group.seasonNumber > 0 && group.cards.some(card => card.kind === "file"))
      .map(group => group.seasonNumber)
    return new Set(seasons).size
  })

  const missingEpisodeCount = createMemo(() => {
    return seasonCoverageBySeason().reduce((total, group) => {
      const missingInSeason = group.cards.filter(card => card.kind === "missing").length
      return total + missingInSeason
    }, 0)
  })

  const handleEpisodeGroupChange = (nextValue: string) => {
    const currentSelection = episodeGroupsQuery.data?.selectedEpisodeGroupId ?? ""
    const normalized = nextValue.length > 0 ? nextValue : null
    if ((normalized ?? "") === currentSelection) {
      return
    }

    const accepted = window.confirm(
      "Changing episode grouping will remove and recreate this show's episodes and symlinks. Continue?",
    )

    if (!accepted) {
      return
    }

    episodeGroupMutation.mutate(normalized)
  }

  return (
    <section class="panel detail-panel">
      <A class="back-link" href="/shows">← Back to TV shows</A>

      <Show when={showQuery.isLoading}>
        <p class="empty-state">Loading show details...</p>
      </Show>
      <Show when={showQuery.isError}>
        <p class="empty-state">Unable to load show details.</p>
      </Show>

      <Show when={showQuery.data}>
        {show => (
          <>
            <header class="detail-header">
              <div>
                <h2>{show().title}</h2>
                <p>
                  {show().year ?? "Year unknown"} · {show().genres.join(", ") || "No genres"}
                </p>
              </div>
              <div class="pill-stack">
                <span class="pill">Episodes scanned: {show().episodeCountScanned ?? 0}</span>
                <span class="pill">
                  {selectedEpisodeGroup() ? "Total selected-group episodes" : "Total TMDb episodes"}: {displayedEpisodeTotal()}
                </span>
                <span class="pill">Seasons scanned: {scannedSeasonCount()} / {show().seasonCount ?? 0}</span>
              </div>
            </header>

            <Show when={(episodeGroupsQuery.data?.groups.length ?? 0) > 1}>
              <section class="inline-controls">
                <label for="episode-group-select">Episode grouping</label>
                <select
                  id="episode-group-select"
                  class="group-select"
                  value={episodeGroupsQuery.data?.selectedEpisodeGroupId ?? ""}
                  disabled={episodeGroupMutation.isPending}
                  onChange={event => handleEpisodeGroupChange(event.currentTarget.value)}
                >
                  <option value="">Default TMDb order</option>
                  <For each={episodeGroupsQuery.data?.groups ?? []}>
                    {group => <option value={group.id}>{group.name}</option>}
                  </For>
                </select>
                <Show when={episodeGroupMutation.isPending}>
                  <p class="inline-note">Rebuilding episodes and symlinks...</p>
                </Show>
                <Show when={selectedEpisodeGroup()}>
                  {group => <span class="pill">Active grouping: {group().name} ({group().episodeCount} episodes)</span>}
                </Show>
              </section>
            </Show>

            <section class="files-section">
              <h3>Categorized episodes</h3>
              <Show when={seasonDetailsQuery.isLoading && (tvFilesQuery.data?.categorizedFiles.length ?? 0) === 0}>
                <p class="empty-state">Loading TMDb seasons to calculate missing episodes...</p>
              </Show>
              <Show when={seasonDetailsQuery.isError}>
                <p class="empty-state">Unable to load TMDb season breakdown. Showing scanned episodes only.</p>
              </Show>
              <Show when={missingEpisodeCount() > 0}>
                <p class="section-help">Highlighted cards are episodes missing from the TMDb season order: {missingEpisodeCount()}</p>
              </Show>
              <Show when={(seasonGroupsToRender().length ?? 0) === 0}>
                <p class="empty-state">No categorized episodes found for this show yet.</p>
              </Show>
              <For each={seasonGroupsToRender()}>
                {group => (
                  <div class="season-group">
                    <h4>
                      Season {group.seasonNumber > 0 ? String(group.seasonNumber).padStart(2, "0") : "Unassigned"}
                      {group.episodeCount > 0 ? ` · ${group.episodeCountScanned}/${group.episodeCount} scanned` : ""}
                    </h4>
                    <div class="season-list">
                      <For each={group.cards}>
                        {card =>
                          card.kind === "file"
                            ? <EpisodeFileRow file={card.file} />
                            : <MissingEpisodeRow
                                seasonNumber={group.seasonNumber}
                                episodeNumber={card.episodeNumber}
                                episodeName={card.episodeName}
                                airDate={card.airDate}
                              />}
                      </For>
                    </div>
                  </div>
                )}
              </For>
            </section>

            <section class="files-section">
              <h3>Uncategorized related files</h3>
              <p class="section-help">
                Alias-linked rows from this show's identity map. Useful for release-group extras or alternate episode packs.
              </p>
              <Show when={tvFilesQuery.isLoading}>
                <p class="empty-state">Loading uncategorized files...</p>
              </Show>
              <Show when={(tvFilesQuery.data?.uncategorizedFiles.length ?? 0) === 0}>
                <p class="empty-state">No uncategorized files connected to this show.</p>
              </Show>
              <div class="season-list">
                <For each={tvFilesQuery.data?.uncategorizedFiles ?? []}>{file => <EpisodeFileRow file={file} />}</For>
              </div>
            </section>
          </>
        )}
      </Show>
    </section>
  )
}

function MovieFileRow(props: {
  file: ScannedFile
  showMarkExtra?: boolean
  onMarkExtra?: (id: number) => void
  disabled?: boolean
}) {
  return (
    <div class="file-row">
      <FileRowIdentity file={props.file} />
      <div class="file-meta">
        <span>{formatBytes(props.file.fileSize)}</span>
        <span>{props.file.status}</span>
        <Show when={props.showMarkExtra}>
          <button class="ghost-button" disabled={props.disabled} onClick={() => props.onMarkExtra?.(props.file.id)}>
            Mark as extra
          </button>
        </Show>
      </div>
    </div>
  )
}

function MovieDetailsPage() {
  const params = useParams()
  const queryClient = useQueryClient()
  const tmdbId = createMemo(() => Number(params.tmdbId))

  const movieQuery = useQuery(() => ({
    queryKey: ["movie", tmdbId()],
    queryFn: () => mediaApi.getMovie(tmdbId()),
    enabled: Number.isInteger(tmdbId()) && tmdbId() > 0,
  }))

  const filesQuery = useQuery(() => ({
    queryKey: ["movie-files", tmdbId()],
    queryFn: () => mediaApi.getMovieFiles(tmdbId()),
    enabled: Number.isInteger(tmdbId()) && tmdbId() > 0,
  }))

  const markExtraMutation = useMutation(() => ({
    mutationFn: (fileId: number) => mediaApi.markAsExtra(fileId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["movie-files", tmdbId()] }),
        queryClient.invalidateQueries({ queryKey: ["titles"] }),
      ])
    },
  }))

  const markAsExtra = (fileId: number) => {
    markExtraMutation.mutate(fileId)
  }

  return (
    <section class="panel detail-panel">
      <A class="back-link" href="/movies">← Back to movies</A>

      <Show when={movieQuery.isLoading}>
        <p class="empty-state">Loading movie details...</p>
      </Show>
      <Show when={movieQuery.isError}>
        <p class="empty-state">Unable to load movie details.</p>
      </Show>

      <Show when={movieQuery.data}>
        {movie => (
          <>
            <header class="detail-header">
              <div>
                <h2>{movie().title}</h2>
                <p>
                  {movie().year ?? "Year unknown"} · {movie().genres.join(", ") || "No genres"}
                </p>
              </div>
              <div class="pill-stack">
                <span class="pill">TMDb {movie().tmdbId}</span>
                <span class="pill">IMDb {movie().imdbId ?? "n/a"}</span>
              </div>
            </header>

            <section class="files-section">
              <h3>Main movie files</h3>
              <Show when={filesQuery.isLoading}>
                <p class="empty-state">Loading files...</p>
              </Show>
              <Show when={(filesQuery.data?.primaryFiles.length ?? 0) === 0}>
                <p class="empty-state">No direct movie files are currently mapped.</p>
              </Show>
              <div class="season-list">
                <For each={filesQuery.data?.primaryFiles ?? []}>
                  {file => (
                    <MovieFileRow
                      file={file}
                      showMarkExtra
                      onMarkExtra={markAsExtra}
                      disabled={markExtraMutation.isPending}
                    />
                  )}
                </For>
              </div>
            </section>

            <section class="files-section">
              <h3>Related files in the same source directories</h3>
              <p class="section-help">These files are visible under this movie because they share source folders.</p>
              <Show when={(filesQuery.data?.extraFiles.length ?? 0) === 0}>
                <p class="empty-state">No related files detected as extras.</p>
              </Show>
              <div class="season-list">
                <For each={filesQuery.data?.extraFiles ?? []}>
                  {file => (
                    <MovieFileRow
                      file={file}
                      showMarkExtra={file.mediaType !== "Extras"}
                      onMarkExtra={markAsExtra}
                      disabled={markExtraMutation.isPending}
                    />
                  )}
                </For>
              </div>
            </section>
          </>
        )}
      </Show>
    </section>
  )
}

function SettingsPage() {
  const queryClient = useQueryClient()
  const configQuery = useQuery(() => ({
    queryKey: ["config"],
    queryFn: () => mediaApi.getConfig(),
  }))

  const [draft, setDraft] = createSignal<ConfigurationPayload | null>(null)

  createEffect(() => {
    if (configQuery.data && !draft()) {
      setDraft(cloneConfig(configQuery.data))
    }
  })

  const saveMutation = useMutation(() => ({
    mutationFn: (payload: ConfigurationPayload) => mediaApi.updateConfig(payload),
    onSuccess: async updated => {
      setDraft(cloneConfig(updated))
      await queryClient.invalidateQueries({ queryKey: ["config"] })
    },
  }))

  const isDirty = createMemo(() => {
    const local = draft()
    const remote = configQuery.data
    if (!local || !remote) {
      return false
    }
    return JSON.stringify(local) !== JSON.stringify(remote)
  })

  const patchDraft = (updater: (current: ConfigurationPayload) => ConfigurationPayload) => {
    setDraft(current => {
      if (!current) {
        return current
      }
      return updater(cloneConfig(current))
    })
  }

  const updateMappingField = (index: number, field: keyof FolderMappingConfig, value: string) => {
    patchDraft(current => {
      const next = cloneConfig(current)
      const mapping = next.plex.folderMappings[index]
      if (!mapping) {
        return next
      }

      if (field === "mediaType") {
        mapping.mediaType = value as MediaType
      } else if (field === "sourceFolder") {
        mapping.sourceFolder = value
      } else {
        mapping.destinationFolder = value
      }

      return next
    })
  }

  const addFolderMapping = () => {
    patchDraft(current => {
      const next = cloneConfig(current)
      next.plex.folderMappings.push(defaultFolderMapping())
      return next
    })
  }

  const removeFolderMapping = (index: number) => {
    patchDraft(current => {
      const next = cloneConfig(current)
      if (next.plex.folderMappings.length <= 1) {
        return next
      }
      next.plex.folderMappings = next.plex.folderMappings.filter((_, itemIndex) => itemIndex !== index)
      return next
    })
  }

  const resetDraft = () => {
    if (!configQuery.data) {
      return
    }
    setDraft(cloneConfig(configQuery.data))
  }

  const submitConfiguration = (event: SubmitEvent) => {
    event.preventDefault()
    const payload = draft()
    if (!payload) {
      return
    }
    saveMutation.mutate(payload)
  }

  return (
    <section class="panel detail-panel">
      <header class="detail-header">
        <div>
          <h2>Configuration</h2>
          <p>Edit backend settings directly and save to restart the poller with the updated runtime config.</p>
        </div>
        <div class="pill-stack">
          <span class="pill">Endpoint: /api/config</span>
          <span class="pill">Status: {configQuery.isFetching ? "Refreshing" : "Idle"}</span>
        </div>
      </header>

      <Show when={configQuery.isLoading}>
        <p class="empty-state">Loading configuration...</p>
      </Show>

      <Show when={configQuery.isError}>
        <p class="empty-state">Unable to load configuration from backend.</p>
      </Show>

      <Show when={draft()}>
        {config => (
          <form class="settings-form" onSubmit={submitConfiguration}>
            <section class="settings-section">
              <h3>Plex</h3>
              <div class="settings-grid">
                <label>
                  Host
                  <input
                    value={config().plex.host}
                    onInput={event => patchDraft(current => ({ ...current, plex: { ...current.plex, host: event.currentTarget.value } }))}
                  />
                </label>
                <label>
                  Port
                  <input
                    type="number"
                    min="1"
                    value={String(config().plex.port)}
                    onInput={event =>
                      patchDraft(current => ({
                        ...current,
                        plex: { ...current.plex, port: parseIntOr(event.currentTarget.value, current.plex.port) },
                      }))}
                  />
                </label>
                <label>
                  Polling interval (seconds)
                  <input
                    type="number"
                    min="1"
                    value={String(config().plex.pollingInterval)}
                    onInput={event =>
                      patchDraft(current => ({
                        ...current,
                        plex: { ...current.plex, pollingInterval: parseIntOr(event.currentTarget.value, current.plex.pollingInterval) },
                      }))}
                  />
                </label>
                <label>
                  Process-new-folder delay (seconds)
                  <input
                    type="number"
                    min="0"
                    value={String(config().plex.processNewFolderDelay)}
                    onInput={event =>
                      patchDraft(current => ({
                        ...current,
                        plex: {
                          ...current.plex,
                          processNewFolderDelay: parseIntOr(event.currentTarget.value, current.plex.processNewFolderDelay),
                        },
                      }))}
                  />
                </label>
              </div>

              <label class="settings-block">
                Plex token
                <input
                  type="password"
                  value={config().plex.plexToken}
                  onInput={event => patchDraft(current => ({ ...current, plex: { ...current.plex, plexToken: event.currentTarget.value } }))}
                />
              </label>
            </section>

            <section class="settings-section">
              <h3>TMDb + Detection + Zurg</h3>
              <div class="settings-grid">
                <label>
                  TMDb API key
                  <input
                    type="password"
                    value={config().tmDb.apiKey}
                    onInput={event => patchDraft(current => ({ ...current, tmDb: { ...current.tmDb, apiKey: event.currentTarget.value } }))}
                  />
                </label>
                <label>
                  Detection cache duration (seconds)
                  <input
                    type="number"
                    min="1"
                    value={String(config().mediaDetection.cacheDuration)}
                    onInput={event =>
                      patchDraft(current => ({
                        ...current,
                        mediaDetection: {
                          ...current.mediaDetection,
                          cacheDuration: parseIntOr(event.currentTarget.value, current.mediaDetection.cacheDuration),
                        },
                      }))}
                  />
                </label>
                <label>
                  Auto extras threshold (bytes)
                  <input
                    type="number"
                    min="0"
                    max="1073741824"
                    value={String(config().mediaDetection.autoExtrasThresholdBytes)}
                    onInput={event =>
                      patchDraft(current => ({
                        ...current,
                        mediaDetection: {
                          ...current.mediaDetection,
                          autoExtrasThresholdBytes: parseIntOr(
                            event.currentTarget.value,
                            current.mediaDetection.autoExtrasThresholdBytes,
                          ),
                        },
                      }))}
                  />
                </label>
                <label>
                  Zurg version file
                  <input
                    value={config().zurg.versionLocation}
                    onInput={event =>
                      patchDraft(current => ({ ...current, zurg: { ...current.zurg, versionLocation: event.currentTarget.value } }))}
                  />
                </label>
              </div>
            </section>

            <section class="settings-section">
              <div class="settings-section-head">
                <h3>Folder mappings</h3>
                <button class="ghost-button" type="button" onClick={addFolderMapping}>Add mapping</button>
              </div>
              <div class="mapping-list">
                <For each={config().plex.folderMappings}>
                  {(mapping, index) => (
                    <div class="mapping-row">
                      <label>
                        Source folder
                        <input
                          value={mapping.sourceFolder}
                          onInput={event => updateMappingField(index(), "sourceFolder", event.currentTarget.value)}
                        />
                      </label>
                      <label>
                        Destination folder
                        <input
                          value={mapping.destinationFolder}
                          onInput={event => updateMappingField(index(), "destinationFolder", event.currentTarget.value)}
                        />
                      </label>
                      <label>
                        Media type
                        <select
                          value={mapping.mediaType}
                          onChange={event => updateMappingField(index(), "mediaType", event.currentTarget.value)}
                        >
                          <For each={mediaTypeOptions}>{type => <option value={type}>{type}</option>}</For>
                        </select>
                      </label>
                      <button
                        class="ghost-button"
                        type="button"
                        disabled={config().plex.folderMappings.length <= 1}
                        onClick={() => removeFolderMapping(index())}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </section>

            <div class="settings-actions">
              <button class="ghost-button" type="button" disabled={!isDirty() || saveMutation.isPending} onClick={resetDraft}>
                Reset changes
              </button>
              <button class="primary-button" type="submit" disabled={!isDirty() || saveMutation.isPending}>
                {saveMutation.isPending ? "Saving configuration..." : "Save configuration"}
              </button>
            </div>

            <Show when={saveMutation.isError}>
              <p class="empty-state">Save failed: {(saveMutation.error as Error)?.message ?? "unknown error"}</p>
            </Show>
            <Show when={saveMutation.isSuccess && !saveMutation.isPending}>
              <p class="inline-note">Configuration saved. Backend poller restarted with your new settings.</p>
            </Show>
          </form>
        )}
      </Show>
    </section>
  )
}

function NotFoundPage() {
  return (
    <section class="panel">
      <h2>Not found</h2>
      <p class="empty-state">This route does not exist in the Solid frontend.</p>
      <div class="route-links">
        <A href="/shows">Go to TV shows</A>
        <A href="/movies">Go to movies</A>
        <A href="/unidentified">Go to unidentified media</A>
        <A href="/settings">Go to configuration</A>
      </div>
    </section>
  )
}

export default function App() {
  return (
    <Router root={AppShell}>
      <Route path="/" component={TvShowsPage} />
      <Route path="/shows" component={TvShowsPage} />
      <Route path="/shows/:tmdbId" component={TvShowDetailsPage} />
      <Route path="/movies" component={MoviesPage} />
      <Route path="/movies/:tmdbId" component={MovieDetailsPage} />
      <Route path="/unidentified" component={UnidentifiedPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="*" component={NotFoundPage} />
    </Router>
  )
}
