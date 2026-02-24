import { A, useParams } from "@solidjs/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { For, Show, createMemo, createSignal } from "solid-js";
import { IdentifyModal } from "@/components/identify-modal";
import { FileRowIdentity, Pill, RowSkeleton, SourceSubgroupSeparator, StatusBadge } from "@/components/common-ui";
import { CastPanel, DetailPageBackdrop } from "@/components/media-shared";
import { mediaApi } from "@/lib/api";
import {
    annotateFilesWithSourceDividers,
    backdropUrl,
    compareEpisodeFiles,
    formatAirDate,
    formatEpisodeCode,
    formatRating,
    formatReleaseDate,
    posterUrl,
    sourceDirectory,
} from "@/lib/media-helpers";
import type { ScannedFile, SeasonInfo } from "@/lib/types";

interface ScannedEpisodeCard { kind: "file"; episodeNumber: number; file: ScannedFile }
interface MissingEpisodeCard { kind: "missing"; episodeNumber: number; episodeName: string | null; airDate: string | null }
type SeasonEpisodeCard = ScannedEpisodeCard | MissingEpisodeCard;

function annotateSeasonCardsWithSourceDividers(cards: SeasonEpisodeCard[]) {
    let prev: string | null = null;
    return cards.map((card) => {
        if (card.kind !== "file") return { card, sourceDividerPath: null };
        const cur = sourceDirectory(card.file.sourceFile);
        const divider = prev !== null && prev !== cur ? cur : null;
        prev = cur;
        return { card, sourceDividerPath: divider };
    });
}

interface SeasonCoverageGroup {
    seasonNumber: number;
    episodeCount: number;
    episodeCountScanned: number;
    cards: SeasonEpisodeCard[];
}

function EpisodeFileRow(props: { file: ScannedFile; sourceDividerPath?: string | null }) {
    return (
        <>
            <Show when={props.sourceDividerPath}>{(p) => <SourceSubgroupSeparator sourcePath={p()} />}</Show>
            <div class="flex items-start justify-between gap-4 bg-surface-2 border border-border-subtle rounded-lg px-4 py-3">
                <FileRowIdentity file={props.file} />
                <div class="flex flex-wrap items-center gap-1.5 shrink-0"><Pill variant="success">{formatEpisodeCode(props.file.seasonNumber, props.file.episodeNumber, props.file.episodeNumber2)}</Pill><StatusBadge status={props.file.status} /></div>
            </div>
        </>
    );
}

function MissingEpisodeRow(props: { seasonNumber: number; episodeNumber: number; episodeName: string | null; airDate: string | null }) {
    return (
        <div class="flex items-start justify-between gap-4 bg-warning-muted border border-warning/20 rounded-lg px-4 py-3">
            <div class="min-w-0 flex-1">
                <p class="font-semibold text-sm text-warning">Missing S{String(props.seasonNumber).padStart(2, "0")}E{String(props.episodeNumber).padStart(2, "0")}<Show when={props.episodeName}><span class="font-normal text-text-secondary"> · {props.episodeName}</span></Show></p>
                <p class="text-xs text-text-tertiary mt-0.5">Aired: {formatAirDate(props.airDate)}</p>
            </div>
            <Pill variant="warning">Missing</Pill>
        </div>
    );
}

function showStatusVariant(status: string | null | undefined): "default" | "success" | "info" | "warning" | "error" {
    const normalized = status?.trim().toLowerCase();
    if (normalized === "returning series" || normalized === "in production") return "info";
    if (normalized === "canceled") return "error";
    if (normalized === "planned" || normalized === "pilot") return "warning";
    return "default";
}

export default function TvShowDetailsPage() {
    const params = useParams();
    const queryClient = useQueryClient();
    const tmdbId = createMemo(() => Number(params.tmdbId));
    const [reassignOpen, setReassignOpen] = createSignal(false);

    const showQuery = useQuery(() => ({ queryKey: ["show", tmdbId()], queryFn: () => mediaApi.getShow(tmdbId()), enabled: Number.isInteger(tmdbId()) && tmdbId() > 0 }));
    const episodeGroupsQuery = useQuery(() => ({ queryKey: ["tv-episode-groups", tmdbId()], queryFn: () => mediaApi.getShowEpisodeGroups(tmdbId()), enabled: Number.isInteger(tmdbId()) && tmdbId() > 0 }));
    const tvFilesQuery = useQuery(() => ({ queryKey: ["tv-files", tmdbId()], queryFn: () => mediaApi.getShowFiles(tmdbId()), enabled: Number.isInteger(tmdbId()) && tmdbId() > 0 }));
    const seasonDetailsQuery = useQuery(() => ({
        queryKey: ["tv-seasons", tmdbId(), showQuery.data?.seasonCount ?? 0],
        queryFn: async () => {
            const count = showQuery.data?.seasonCount ?? 0;
            const reqs: Promise<SeasonInfo | null>[] = [];
            for (let s = 0; s <= count; s += 1) reqs.push(mediaApi.getShowSeason(tmdbId(), s).catch(() => null));
            return (await Promise.all(reqs)).filter((season): season is SeasonInfo => season !== null).sort((a, b) => a.seasonNumber - b.seasonNumber);
        },
        enabled: Number.isInteger(tmdbId()) && tmdbId() > 0 && (showQuery.data?.seasonCount ?? 0) > 0,
    }));

    const episodeGroupMutation = useMutation(() => ({
        mutationFn: (episodeGroupId: string | null) => mediaApi.setShowEpisodeGroup(tmdbId(), episodeGroupId),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["show", tmdbId()] }),
                queryClient.invalidateQueries({ queryKey: ["tv-files", tmdbId()] }),
                queryClient.invalidateQueries({ queryKey: ["tv-episode-groups", tmdbId()] }),
            ]);
        },
    }));

    const categorizedBySeason = createMemo(() => {
        const seasons = new Map<number, ScannedFile[]>();
        for (const item of tvFilesQuery.data?.categorizedFiles ?? []) {
            const s = item.seasonNumber ?? 0;
            const existing = seasons.get(s);
            if (existing) existing.push(item);
            else seasons.set(s, [item]);
        }
        return [...seasons.entries()].sort((a, b) => a[0] - b[0]).map(([sn, files]) => [sn, [...files].sort(compareEpisodeFiles)] as const);
    });

    const seasonCoverageBySeason = createMemo<SeasonCoverageGroup[]>(() => {
        const sd = seasonDetailsQuery.data;
        if (!sd || sd.length === 0) return [];
        const scannedBySeason = new Map<number, Map<number, ScannedFile>>();
        for (const file of tvFilesQuery.data?.categorizedFiles ?? []) {
            if (!file.seasonNumber || !file.episodeNumber) continue;
            const sm = scannedBySeason.get(file.seasonNumber) ?? new Map<number, ScannedFile>();
            sm.set(file.episodeNumber, file);
            if (file.episodeNumber2 && file.episodeNumber2 > file.episodeNumber) sm.set(file.episodeNumber2, file);
            scannedBySeason.set(file.seasonNumber, sm);
        }

        const knownSeasons = new Set<number>();
        const groups: SeasonCoverageGroup[] = [];
        for (const season of sd) {
            knownSeasons.add(season.seasonNumber);
            const sm = scannedBySeason.get(season.seasonNumber) ?? new Map<number, ScannedFile>();
            const tmdbEps = new Set<number>();
            const cards: SeasonEpisodeCard[] = [];
            for (const ep of season.episodes) {
                tmdbEps.add(ep.episodeNumber);
                const sf = sm.get(ep.episodeNumber);
                cards.push(sf ? { kind: "file", episodeNumber: ep.episodeNumber, file: sf } : { kind: "missing", episodeNumber: ep.episodeNumber, episodeName: ep.name, airDate: ep.airDate });
            }
            for (const [en, f] of [...sm.entries()].filter(([n]) => !tmdbEps.has(n)).sort((a, b) => a[0] - b[0])) cards.push({ kind: "file", episodeNumber: en, file: f });
            groups.push({ seasonNumber: season.seasonNumber, episodeCount: season.episodes.length, episodeCountScanned: season.episodes.filter((e) => sm.has(e.episodeNumber)).length, cards });
        }

        for (const [sn, sm] of [...scannedBySeason.entries()].filter(([s]) => !knownSeasons.has(s)).sort((a, b) => a[0] - b[0])) {
            const cards = [...sm.entries()].sort((a, b) => a[0] - b[0]).map(([en, f]) => ({ kind: "file" as const, episodeNumber: en, file: f }));
            groups.push({ seasonNumber: sn, episodeCount: cards.length, episodeCountScanned: cards.length, cards });
        }

        return groups.sort((a, b) => a.seasonNumber - b.seasonNumber);
    });

    const seasonGroupsToRender = createMemo<SeasonCoverageGroup[]>(() => {
        const cg = seasonCoverageBySeason();
        if (cg.length > 0) return cg;
        return categorizedBySeason().map(([sn, files]) => ({
            seasonNumber: sn,
            episodeCount: files.length,
            episodeCountScanned: files.length,
            cards: files.map((f) => ({ kind: "file" as const, episodeNumber: f.episodeNumber ?? Number.MAX_SAFE_INTEGER, file: f })),
        }));
    });

    const seasonMetaByNumber = createMemo(() => {
        const map = new Map<number, SeasonInfo>();
        for (const season of seasonDetailsQuery.data ?? []) map.set(season.seasonNumber, season);
        return map;
    });

    const selectedEpisodeGroup = createMemo(() => {
        const id = episodeGroupsQuery.data?.selectedEpisodeGroupId;
        if (!id) return null;
        return (episodeGroupsQuery.data?.groups ?? []).find((g) => g.id === id) ?? null;
    });
    const displayedEpisodeTotal = createMemo(() => selectedEpisodeGroup()?.episodeCount ?? showQuery.data?.episodeCount ?? 0);
    const scannedSeasonCount = createMemo(() => new Set(seasonGroupsToRender().filter((g) => g.seasonNumber > 0 && g.cards.some((c) => c.kind === "file")).map((g) => g.seasonNumber)).size);
    const missingEpisodeCount = createMemo(() => seasonCoverageBySeason().reduce((t, g) => t + g.cards.filter((c) => c.kind === "missing").length, 0));
    const remappedEpisodeFileCount = createMemo(() => new Set([...(tvFilesQuery.data?.categorizedFiles ?? []), ...(tvFilesQuery.data?.uncategorizedFiles ?? [])].filter((f) => f.episodeRemap).map((f) => f.id)).size);

    const handleEpisodeGroupChange = (v: string) => {
        const cur = episodeGroupsQuery.data?.selectedEpisodeGroupId ?? "";
        const n = v.length > 0 ? v : null;
        if ((n ?? "") === cur) return;
        if (!window.confirm("Changing episode grouping will remove and recreate this show's episodes and symlinks. Continue?")) return;
        episodeGroupMutation.mutate(n);
    };

    return (
        <section class="space-y-6 relative isolate">
            <DetailPageBackdrop backdropPath={showQuery.data?.backdropPath} />
            <div class="relative z-10 space-y-6">
                <A href="/shows" class="inline-flex items-center gap-1 text-sm text-accent hover:text-accent-hover transition"><span>&larr;</span> Back to TV shows</A>
                <Show when={showQuery.isLoading}><div class="space-y-4"><div class="skeleton h-48 rounded-2xl" /><div class="skeleton h-8 w-64 rounded-lg" /></div></Show>
                <Show when={showQuery.isError}><p class="text-error text-sm">Unable to load show details.</p></Show>

                <Show when={showQuery.data}>
                    {(show) => (
                        <>
                            <div class="relative rounded-2xl overflow-hidden bg-surface-2 border border-border-subtle">
                                <Show when={backdropUrl(show().backdropPath)}>{(url) => <img src={url()} alt="" class="w-full h-48 sm:h-64 object-cover" />}</Show>
                                <div class="absolute inset-0 bg-linear-to-t from-surface-1 via-surface-1/60 to-transparent" />
                                <div class="relative px-5 pb-5 pt-4 flex flex-wrap items-end justify-between gap-4 -mt-20">
                                    <div class="flex items-end gap-4">
                                        <Show when={posterUrl(show().posterPath, "w185")}>{(url) => <img src={url()} alt={show().title} class="w-24 rounded-lg shadow-xl border-2 border-surface-1 hidden sm:block" />}</Show>
                                        <div><h1 class="text-2xl font-bold">{show().title}</h1><p class="text-sm text-text-secondary mt-1">{show().year ?? "Year unknown"} · {show().genres.join(", ") || "No genres"}</p></div>
                                    </div>
                                    <div class="flex flex-wrap items-center gap-2">
                                        <Pill variant="success">Scanned: {show().episodeCountScanned ?? 0}</Pill>
                                        <Pill>Total: {displayedEpisodeTotal()}</Pill>
                                        <Pill>Seasons: {scannedSeasonCount()} / {show().seasonCount ?? 0}</Pill>
                                        <Show when={remappedEpisodeFileCount() > 0}><Pill variant="info">Remapped from source: {remappedEpisodeFileCount()}</Pill></Show>
                                        <button type="button" onClick={() => setReassignOpen(true)} class="px-3 py-1.5 text-xs rounded-lg border border-border-default bg-surface-2/80 text-text-secondary hover:text-text-primary hover:border-border-hover transition">Reassign Show</button>
                                    </div>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
                                <article class="bg-surface-2 border border-border-subtle rounded-xl p-4 space-y-2.5">
                                    <h2 class="text-base font-bold">Story</h2>
                                    <Show when={show().tagline}>{(tagline) => <p class="text-sm text-accent italic">{tagline()}</p>}</Show>
                                    <p class="text-sm text-text-secondary leading-relaxed">{show().overview ?? "No TMDb overview is available for this show yet."}</p>
                                </article>
                                <article class="bg-surface-2 border border-border-subtle rounded-xl p-4 space-y-3">
                                    <h2 class="text-base font-bold">Show Details</h2>
                                    <div class="grid grid-cols-2 gap-2 text-sm">
                                        <div class="rounded-lg border border-border-subtle bg-surface-1 px-3 py-2"><p class="text-[0.68rem] uppercase tracking-wide text-text-tertiary">First Air Date</p><p class="text-text-primary font-semibold mt-1">{formatReleaseDate(show().firstAirDate)}</p></div>
                                        <div class="rounded-lg border border-border-subtle bg-surface-1 px-3 py-2"><p class="text-[0.68rem] uppercase tracking-wide text-text-tertiary">Last Air Date</p><p class="text-text-primary font-semibold mt-1">{formatReleaseDate(show().lastAirDate)}</p></div>
                                        <div class="rounded-lg border border-border-subtle bg-surface-1 px-3 py-2"><p class="text-[0.68rem] uppercase tracking-wide text-text-tertiary">Network</p><p class="text-text-primary font-semibold mt-1 truncate">{show().networks?.join(", ") || "Unknown"}</p></div>
                                        <div class="rounded-lg border border-border-subtle bg-surface-1 px-3 py-2"><p class="text-[0.68rem] uppercase tracking-wide text-text-tertiary">Rating</p><p class="text-text-primary font-semibold mt-1">{formatRating(show().voteAverage)}</p></div>
                                    </div>
                                    <div class="flex flex-wrap items-center gap-2">
                                        <Pill>Votes: {show().voteCount?.toLocaleString() ?? "N/A"}</Pill>
                                        <Pill>Language: {show().originalLanguage?.toUpperCase() ?? "N/A"}</Pill>
                                        <Show when={show().originCountry?.length}><Pill>Countries: {show().originCountry?.join(", ")}</Pill></Show>
                                        <Pill variant={showStatusVariant(show().status)}>Status: {show().status ?? "Unknown"}</Pill>
                                    </div>
                                </article>
                            </div>

                            <CastPanel cast={show().cast} />

                            <Show when={(episodeGroupsQuery.data?.groups.length ?? 0) > 1}>
                                <div class="bg-surface-2 border border-border-subtle rounded-xl p-4 space-y-3">
                                    <label class="text-sm font-semibold">Episode grouping</label>
                                    <select class="block w-full max-w-md bg-surface-3 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary" value={episodeGroupsQuery.data?.selectedEpisodeGroupId ?? ""} disabled={episodeGroupMutation.isPending} onChange={(e) => handleEpisodeGroupChange(e.currentTarget.value)}>
                                        <option value="">Default TMDb order</option>
                                        <For each={episodeGroupsQuery.data?.groups ?? []}>{(g) => <option value={g.id}>{g.name}</option>}</For>
                                    </select>
                                    <Show when={episodeGroupMutation.isPending}><p class="text-xs text-text-secondary animate-pulse">Rebuilding episodes and symlinks...</p></Show>
                                    <Show when={selectedEpisodeGroup()}>{(g) => <Pill>Active: {g().name} ({g().episodeCount} episodes)</Pill>}</Show>
                                </div>
                            </Show>

                            <div class="space-y-4">
                                <h2 class="text-lg font-bold">Categorized Episodes</h2>
                                <Show when={seasonDetailsQuery.isLoading && (tvFilesQuery.data?.categorizedFiles.length ?? 0) === 0}><div class="space-y-3"><For each={Array(4)}>{() => <RowSkeleton />}</For></div></Show>
                                <Show when={missingEpisodeCount() > 0}><p class="text-xs text-warning">{missingEpisodeCount()} episodes missing from TMDb season order</p></Show>
                                <Show when={remappedEpisodeFileCount() > 0}><p class="text-xs text-info">{remappedEpisodeFileCount()} files use season remapping where source tuple numbering is compacted to TMDb season order.</p></Show>
                                <Show when={seasonGroupsToRender().length === 0}><p class="text-text-tertiary text-sm py-8 text-center">No categorized episodes found for this show yet.</p></Show>
                                <For each={seasonGroupsToRender()}>
                                    {(group) => {
                                        const seasonMeta = seasonMetaByNumber().get(group.seasonNumber);
                                        const seasonLabel = group.seasonNumber > 0 ? `Season ${String(group.seasonNumber).padStart(2, "0")}` : "Unassigned";
                                        const missingCount = group.cards.filter((card) => card.kind === "missing").length;
                                        return (
                                            <details class="group rounded-xl border border-border-subtle bg-surface-2/65 overflow-hidden" open={group.seasonNumber === 1}>
                                                <summary class="list-none [&::-webkit-details-marker]:hidden cursor-pointer px-4 py-3.5 flex items-center gap-3.5">
                                                    <Show when={posterUrl(seasonMeta?.posterPath, "w154")} fallback={<div class="w-14 h-20 rounded-md border border-border-default bg-surface-3 flex items-center justify-center text-[0.62rem] text-text-tertiary font-mono uppercase tracking-wider text-center px-1">{seasonLabel}</div>}>
                                                        {(url) => <img src={url()} alt={seasonMeta?.name ?? seasonLabel} loading="lazy" class="w-14 h-20 rounded-md object-cover border border-border-default" />}
                                                    </Show>
                                                    <div class="min-w-0 flex-1">
                                                        <h3 class="text-sm font-semibold uppercase tracking-wide text-text-secondary group-open:text-text-primary transition">{seasonLabel}</h3>
                                                        <p class="text-xs text-text-tertiary mt-0.5">{group.episodeCountScanned}/{group.episodeCount || group.cards.length} scanned<Show when={missingCount > 0}><span>{` · ${missingCount} missing`}</span></Show></p>
                                                        <Show when={seasonMeta?.overview}>{(overview) => <p class="text-xs text-text-secondary mt-1 line-clamp-2">{overview()}</p>}</Show>
                                                    </div>
                                                    <span class="text-text-tertiary group-open:rotate-180 transition-transform"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path d="m6 9 6 6 6-6" /></svg></span>
                                                </summary>
                                                <div class="border-t border-border-subtle px-3.5 py-3 space-y-1.5">
                                                    <For each={annotateSeasonCardsWithSourceDividers(group.cards)}>
                                                        {(entry) => entry.card.kind === "file" ? <EpisodeFileRow file={entry.card.file} sourceDividerPath={entry.sourceDividerPath} /> : <MissingEpisodeRow seasonNumber={group.seasonNumber} episodeNumber={entry.card.episodeNumber} episodeName={entry.card.episodeName} airDate={entry.card.airDate} />}
                                                    </For>
                                                </div>
                                            </details>
                                        );
                                    }}
                                </For>
                            </div>

                            <div class="space-y-4">
                                <h2 class="text-lg font-bold">Uncategorized Related Files</h2>
                                <p class="text-xs text-text-secondary">Alias-linked rows from this show's identity map.</p>
                                <Show when={tvFilesQuery.isLoading}><div class="space-y-3"><For each={Array(3)}>{() => <RowSkeleton />}</For></div></Show>
                                <Show when={(tvFilesQuery.data?.uncategorizedFiles.length ?? 0) === 0}><p class="text-text-tertiary text-sm py-4 text-center">No uncategorized files connected to this show.</p></Show>
                                <div class="space-y-1.5">
                                    <For each={annotateFilesWithSourceDividers(tvFilesQuery.data?.uncategorizedFiles ?? [])}>{(entry) => <EpisodeFileRow file={entry.file} sourceDividerPath={entry.sourceDividerPath} />}</For>
                                </div>
                            </div>

                            <IdentifyModal
                                open={reassignOpen()}
                                onClose={() => {
                                    setReassignOpen(false);
                                    void queryClient.invalidateQueries({ queryKey: ["show", tmdbId()] });
                                    void queryClient.invalidateQueries({ queryKey: ["tv-files", tmdbId()] });
                                    void queryClient.invalidateQueries({ queryKey: ["titles"] });
                                }}
                                initialMode="TvShows"
                                files={[...(tvFilesQuery.data?.categorizedFiles ?? []), ...(tvFilesQuery.data?.uncategorizedFiles ?? [])]}
                                preselectedTmdbId={tmdbId()}
                                reassignOldTmdbId={tmdbId()}
                            />
                        </>
                    )}
                </Show>
            </div>
        </section>
    );
}
