import { A, useParams } from "@solidjs/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { AlertTriangle, Clapperboard, ExternalLink, Layers3, RefreshCw, Tv2 } from "lucide-solid";
import { For, Show, createEffect, createMemo, createSignal, type ParentProps } from "solid-js";
import { IdentifyModal } from "@/components/identify-modal";
import { TvdbSearchInput } from "@/components/tvdb-search-input";
import { FileRowIdentity, Pill, RowSkeleton, SourceSubgroupSeparator, StatusBadge } from "@/components/common-ui";
import { CastPanel, DetailPageBackdrop } from "@/components/media-shared";
import { mediaApi } from "@/lib/api";
import { parseEpisodeInfo } from "@/lib/filename-parser";
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
import type { ScannedFile, SeasonInfo, TvdbSearchResult, TvdbSeasonType } from "@/lib/types";

const tvdbSeasonTypeOptions: Array<{ value: TvdbSeasonType; label: string }> = [
    { value: "default", label: "Default" },
    { value: "official", label: "Official" },
    { value: "dvd", label: "DVD" },
    { value: "absolute", label: "Absolute" },
    { value: "alternate", label: "Alternate" },
    { value: "regional", label: "Regional" },
];

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

function showStatusVariant(status: string | null | undefined): "default" | "success" | "info" | "warning" | "error" {
    const normalized = status?.trim().toLowerCase();
    if (normalized === "returning series" || normalized === "in production") return "info";
    if (normalized === "ended") return "success";
    if (normalized === "canceled") return "error";
    if (normalized === "planned" || normalized === "pilot") return "warning";
    return "default";
}

function seasonCoveragePercent(group: SeasonCoverageGroup): number {
    if (group.episodeCount <= 0) return 0;
    return Math.min(100, (group.episodeCountScanned / group.episodeCount) * 100);
}

function debridMediaManagerSeasonUrl(input: {
    imdbId: string | null | undefined;
    title: string;
    seasonNumber: number;
}): string {
    if (input.imdbId) {
        return `https://debridmediamanager.com/show/${encodeURIComponent(input.imdbId)}/${input.seasonNumber}`;
    }

    const season = String(input.seasonNumber).padStart(2, "0");
    const query = encodeURIComponent(`${input.title} S${season}`);
    return `https://debridmediamanager.com/search?query=${query}`;
}

function debridMediaManagerEpisodeUrl(input: {
    imdbId: string | null | undefined;
    title: string;
    seasonNumber: number;
    episodeNumber: number;
}): string {
    return debridMediaManagerSeasonUrl(input);
}

function DetailMetricTile(props: { label: string; value: string; detail: string; accent?: "orange" | "cyan" | "lime" | "rose" }) {
    const accentClass = () => {
        if (props.accent === "cyan") return "border-info/26 bg-info/8";
        if (props.accent === "lime") return "border-success/26 bg-success/8";
        if (props.accent === "rose") return "border-error/26 bg-error/8";
        return "border-accent/26 bg-accent/8";
    };

    return (
        <div class={`rounded-[1.2rem] border px-4 py-4 ${accentClass()}`}>
            <p class="text-[0.64rem] font-mono uppercase tracking-[0.18em] text-text-tertiary">{props.label}</p>
            <p class="mt-2 text-2xl font-semibold leading-none text-text-primary">{props.value}</p>
            <p class="mt-1.5 text-sm leading-snug text-text-secondary">{props.detail}</p>
        </div>
    );
}

function DetailPanel(props: ParentProps<{ eyebrow: string; title: string; aside?: string }>) {
    return (
        <section class="rounded-[1.6rem] border border-border-subtle bg-surface-1/88 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
            <div class="flex items-center justify-between gap-3">
                <div>
                    <p class="text-[0.68rem] font-mono uppercase tracking-[0.18em] text-text-tertiary">{props.eyebrow}</p>
                    <h2 class="mt-1 text-xl font-semibold text-text-primary">{props.title}</h2>
                </div>
                <Show when={props.aside}>{(aside) => <Pill>{aside()}</Pill>}</Show>
            </div>
            <div class="mt-4">{props.children}</div>
        </section>
    );
}

function EpisodeFileRow(props: { file: ScannedFile; sourceDividerPath?: string | null }) {
    return (
        <>
            <Show when={props.sourceDividerPath}>{(p) => <SourceSubgroupSeparator sourcePath={p()} />}</Show>
            <div class="flex items-start justify-between gap-4 rounded-[1.1rem] border border-border-subtle bg-surface-0/35 px-4 py-3">
                <FileRowIdentity file={props.file} />
                <div class="flex shrink-0 flex-wrap items-center gap-1.5">
                    <Pill variant="success">{formatEpisodeCode(props.file.seasonNumber, props.file.episodeNumber, props.file.episodeNumber2)}</Pill>
                    <StatusBadge status={props.file.status} />
                </div>
            </div>
        </>
    );
}

function MissingEpisodeRow(props: {
    seasonNumber: number;
    episodeNumber: number;
    episodeName: string | null;
    airDate: string | null;
    showTitle: string;
    showImdbId: string | null | undefined;
}) {
    const dmmUrl = () => debridMediaManagerEpisodeUrl({
        imdbId: props.showImdbId,
        title: props.showTitle,
        seasonNumber: props.seasonNumber,
        episodeNumber: props.episodeNumber,
    });

    return (
        <div class="flex items-start justify-between gap-4 rounded-[1.1rem] border border-warning/20 bg-warning-muted/16 px-4 py-3">
            <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold text-warning">
                    Missing {formatEpisodeCode(props.seasonNumber, props.episodeNumber, null)}
                    <Show when={props.episodeName}><span class="font-normal text-text-secondary"> · {props.episodeName}</span></Show>
                </p>
                <p class="mt-0.5 text-xs text-text-tertiary">Aired: {formatAirDate(props.airDate)}</p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
                <a
                    href={dmmUrl()}
                    target="_blank"
                    rel="noreferrer"
                    class="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-warning/30 bg-warning-muted/14 px-3 py-2 text-xs font-medium text-warning transition hover:bg-warning-muted/22 hover:text-yellow-100"
                    title={`Open ${formatEpisodeCode(props.seasonNumber, props.episodeNumber, null)} season page in Debrid Media Manager`}
                >
                    <ExternalLink size={14} />
                    <span>Open Season In DMM</span>
                </a>
                <Pill variant="warning">Missing</Pill>
            </div>
        </div>
    );
}

export default function TvShowDetailsPage() {
    const params = useParams();
    const queryClient = useQueryClient();
    const tmdbId = createMemo(() => Number(params.tmdbId));
    const [reassignOpen, setReassignOpen] = createSignal(false);
    const [reassignSeasonNumber, setReassignSeasonNumber] = createSignal<number | null>(null);
    const [pendingTvdbMatch, setPendingTvdbMatch] = createSignal<TvdbSearchResult | null>(null);
    const [pendingTvdbSeasonType, setPendingTvdbSeasonType] = createSignal<TvdbSeasonType>("default");
    const [hydratedEpisodeSourceTmdbId, setHydratedEpisodeSourceTmdbId] = createSignal<number | null>(null);

    const showQuery = useQuery(() => ({ queryKey: ["show", tmdbId()], queryFn: () => mediaApi.getShow(tmdbId()), enabled: Number.isInteger(tmdbId()) && tmdbId() > 0 }));
    const episodeSourceQuery = useQuery(() => ({ queryKey: ["tv-episode-source", tmdbId()], queryFn: () => mediaApi.getShowEpisodeSource(tmdbId()), enabled: Number.isInteger(tmdbId()) && tmdbId() > 0 }));
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

    const episodeSourceMutation = useMutation(() => ({
        mutationFn: (body: { source: "tmdb" | "tvdb"; tvdbId?: number | null; tvdbSeriesName?: string | null; tvdbSeasonType?: TvdbSeasonType | null }) => mediaApi.setShowEpisodeSource(tmdbId(), body),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["show", tmdbId()] }),
                queryClient.invalidateQueries({ queryKey: ["tv-files", tmdbId()] }),
                queryClient.invalidateQueries({ queryKey: ["tv-seasons", tmdbId()] }),
                queryClient.invalidateQueries({ queryKey: ["tv-episode-source", tmdbId()] }),
                queryClient.invalidateQueries({ queryKey: ["tv-episode-groups", tmdbId()] }),
            ]);
        },
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

    createEffect(() => {
        const currentTmdbId = tmdbId();
        const selection = episodeSourceQuery.data;
        if (!selection || !episodeSourceQuery.isFetched || currentTmdbId <= 0 || hydratedEpisodeSourceTmdbId() === currentTmdbId) return;
        setPendingTvdbSeasonType(selection.tvdbSeasonType ?? "default");
        const tvdbId = selection.tvdbId;
        const tvdbSeriesName = selection.tvdbSeriesName;
        if (selection.source === "tvdb" && tvdbId && tvdbSeriesName) {
            setPendingTvdbMatch({
                tvdbId,
                title: tvdbSeriesName,
                year: null,
                posterPath: null,
                overview: null,
            });
        } else {
            setPendingTvdbMatch(selection.suggestedTvdbSeries ?? null);
        }
        setHydratedEpisodeSourceTmdbId(currentTmdbId);
    });

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
    const relatedFiles = createMemo(() => [...(tvFilesQuery.data?.categorizedFiles ?? []), ...(tvFilesQuery.data?.uncategorizedFiles ?? [])]);
    const reassignableFilesBySeason = createMemo(() => {
        const map = new Map<number, ScannedFile[]>();
        for (const file of relatedFiles()) {
            const seasonNumber = file.seasonNumber ?? parseEpisodeInfo(file.sourceFile).season ?? null;
            if (!seasonNumber || seasonNumber <= 0) continue;
            const existing = map.get(seasonNumber);
            if (existing) existing.push(file);
            else map.set(seasonNumber, [file]);
        }
        return map;
    });
    const activeReassignFiles = createMemo(() => {
        const seasonNumber = reassignSeasonNumber();
        if (seasonNumber === null) return relatedFiles();
        return reassignableFilesBySeason().get(seasonNumber) ?? [];
    });
    const activeEpisodeSource = createMemo(() => episodeSourceQuery.data);
    const activeEpisodeSourceLabel = createMemo(() => activeEpisodeSource()?.sourceLabel ?? "TMDb");
    const isEpisodeSourceBusy = createMemo(() => episodeSourceMutation.isPending || episodeGroupMutation.isPending);
    const pendingTvdbMatchesActive = createMemo(() => {
        const active = activeEpisodeSource();
        const pending = pendingTvdbMatch();
        if (!active || active.source !== "tvdb" || !pending) return false;
        return active.tvdbId === pending.tvdbId && (active.tvdbSeasonType ?? "default") === pendingTvdbSeasonType();
    });

    const selectedEpisodeGroup = createMemo(() => {
        if (activeEpisodeSource()?.source === "tvdb") return null;
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
    const handleUseTmdbEpisodeSource = () => {
        if (activeEpisodeSource()?.source === "tmdb") return;
        if (!window.confirm("Switch back to TMDb episode discovery and rebuild this show's mapped episodes and symlinks?")) return;
        episodeSourceMutation.mutate({ source: "tmdb" });
    };
    const handleUseTvdbEpisodeSource = () => {
        const match = pendingTvdbMatch() ?? episodeSourceQuery.data?.suggestedTvdbSeries ?? null;
        if (!match) return;
        if (!window.confirm("Switch to TVDB episode discovery for this show and rebuild the mapped episodes and symlinks?")) return;
        episodeSourceMutation.mutate({
            source: "tvdb",
            tvdbId: match.tvdbId,
            tvdbSeriesName: match.title,
            tvdbSeasonType: pendingTvdbSeasonType(),
        });
    };
    const openReassign = (seasonNumber: number | null) => {
        setReassignSeasonNumber(seasonNumber);
        setReassignOpen(true);
    };

    return (
        <section class="relative isolate space-y-6">
            <DetailPageBackdrop backdropPath={showQuery.data?.backdropPath} />
            <div class="relative z-10 space-y-6">
                <A href="/shows" class="inline-flex items-center gap-1 text-sm text-accent transition hover:text-accent-hover"><span>&larr;</span> Back to TV shows</A>
                <Show when={showQuery.isLoading}><div class="space-y-4"><div class="skeleton h-56 rounded-[2rem]" /><div class="skeleton h-8 w-64 rounded-lg" /></div></Show>
                <Show when={showQuery.isError}><p class="text-error text-sm">Unable to load show details.</p></Show>

                <Show when={showQuery.data}>
                    {(show) => (
                        <>
                            <section class="relative overflow-hidden rounded-[2rem] border border-border-subtle bg-[linear-gradient(140deg,rgba(34,211,238,0.1),transparent_40%),linear-gradient(180deg,rgba(13,18,27,0.96),rgba(8,12,18,0.98))] shadow-[0_30px_90px_rgba(0,0,0,0.28)]">
                                <Show when={backdropUrl(show().backdropPath)}>
                                    {(url) => <img src={url()} alt="" class="absolute inset-0 h-full w-full object-cover opacity-20" />}
                                </Show>
                                <div class="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,12,18,0.12),rgba(8,12,18,0.42)_38%,rgba(8,12,18,0.94)_100%)]" />
                                <div class="relative grid gap-6 px-5 py-5 md:px-7 md:py-7 xl:grid-cols-[15rem_1fr]">
                                    <div class="mx-auto w-full max-w-[15rem] xl:mx-0">
                                        <Show
                                            when={posterUrl(show().posterPath, "w500")}
                                            fallback={<div class="flex aspect-[2/3] items-center justify-center rounded-[1.6rem] border border-border-default bg-surface-3 text-center text-sm uppercase tracking-[0.14em] text-text-tertiary">No poster</div>}
                                        >
                                            {(url) => <img src={url()} alt={show().title} class="aspect-[2/3] w-full rounded-[1.6rem] border border-border-default object-cover shadow-[0_24px_60px_rgba(0,0,0,0.32)]" />}
                                        </Show>
                                    </div>

                                    <div class="space-y-5">
                                        <div class="flex flex-wrap items-center justify-between gap-3">
                                            <div class="inline-flex flex-wrap items-center gap-2">
                                                <Pill variant="info">TV Show</Pill>
                                                <Pill variant={showStatusVariant(show().status)}>Status: {show().status ?? "Unknown"}</Pill>
                                                <Pill>TMDb {show().tmdbId}</Pill>
                                                <Show when={show().tvdbId}><Pill variant="info">TVDB {show().tvdbId}</Pill></Show>
                                                <Pill variant="info">Episodes: {activeEpisodeSourceLabel()}</Pill>
                                                <Show when={selectedEpisodeGroup()}>{(group) => <Pill variant="info">Group: {group().name}</Pill>}</Show>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => openReassign(null)}
                                                class="inline-flex min-h-11 items-center justify-center rounded-xl border border-border-default bg-surface-0/45 px-4 py-2 text-sm text-text-secondary transition hover:border-border-hover hover:text-text-primary"
                                            >
                                                Reassign Show
                                            </button>
                                        </div>

                                        <div>
                                            <p class="text-[0.72rem] font-mono uppercase tracking-[0.24em] text-text-tertiary">Series control</p>
                                            <h1 class="mt-2 text-4xl font-semibold leading-[0.94] text-text-primary md:text-5xl">{show().title}</h1>
                                            <p class="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary">
                                                {show().tagline ? `${show().tagline} ` : ""}
                                                {show().overview ?? "No TMDb overview is available for this show yet."}
                                            </p>
                                        </div>

                                        <div class="flex flex-wrap gap-2">
                                            <For each={show().genres}>
                                                {(genre) => <Pill>{genre}</Pill>}
                                            </For>
                                            <Show when={(show().genres?.length ?? 0) === 0}><Pill>No genres</Pill></Show>
                                        </div>

                                        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                            <DetailMetricTile label="Episodes scanned" value={String(show().episodeCountScanned ?? 0)} detail={`${displayedEpisodeTotal()} episodes expected in the active ordering.`} accent="cyan" />
                                            <DetailMetricTile label="Seasons covered" value={`${scannedSeasonCount()} / ${show().seasonCount ?? 0}`} detail="Seasons that currently contain mapped files." accent="orange" />
                                            <DetailMetricTile label="Missing episodes" value={String(missingEpisodeCount())} detail={`${activeEpisodeSourceLabel()} ordering entries not represented by scanned files.`} accent="rose" />
                                            <DetailMetricTile label="Remapped files" value={String(remappedEpisodeFileCount())} detail={`Files whose source numbering was compacted into the active ${activeEpisodeSourceLabel()} order.`} accent="lime" />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <div class="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                                <DetailPanel eyebrow="Overview" title="Series notes">
                                    <div class="space-y-3">
                                        <Show when={show().tagline}>
                                            {(tagline) => <p class="text-lg italic text-info">{tagline()}</p>}
                                        </Show>
                                        <p class="text-sm leading-relaxed text-text-secondary">{show().overview ?? "No TMDb overview is available for this show yet."}</p>
                                    </div>
                                </DetailPanel>

                                <DetailPanel eyebrow="Signals" title="Show metadata">
                                    <div class="grid gap-3 sm:grid-cols-2">
                                        <div class="rounded-[1.2rem] border border-border-subtle bg-surface-0/30 px-4 py-4">
                                            <div class="flex items-center gap-2 text-text-primary"><Tv2 size={16} class="text-info" /><span class="text-sm font-medium">Network</span></div>
                                            <p class="mt-2 text-xl font-semibold text-text-primary">{show().networks?.join(", ") || "Unknown"}</p>
                                            <p class="mt-1 text-sm text-text-secondary">Primary network or platform metadata from TMDb.</p>
                                        </div>
                                        <div class="rounded-[1.2rem] border border-border-subtle bg-surface-0/30 px-4 py-4">
                                            <div class="flex items-center gap-2 text-text-primary"><Clapperboard size={16} class="text-accent" /><span class="text-sm font-medium">Rating</span></div>
                                            <p class="mt-2 text-xl font-semibold text-text-primary">{formatRating(show().voteAverage)}</p>
                                            <p class="mt-1 text-sm text-text-secondary">{show().voteCount?.toLocaleString() ?? "0"} votes recorded on TMDb.</p>
                                        </div>
                                        <div class="rounded-[1.2rem] border border-border-subtle bg-surface-0/30 px-4 py-4">
                                            <div class="flex items-center gap-2 text-text-primary"><Layers3 size={16} class="text-warning" /><span class="text-sm font-medium">First aired</span></div>
                                            <p class="mt-2 text-xl font-semibold text-text-primary">{formatReleaseDate(show().firstAirDate)}</p>
                                            <p class="mt-1 text-sm text-text-secondary">Last update: {formatReleaseDate(show().lastAirDate)}</p>
                                        </div>
                                        <div class="rounded-[1.2rem] border border-border-subtle bg-surface-0/30 px-4 py-4">
                                            <div class="flex items-center gap-2 text-text-primary"><RefreshCw size={16} class="text-success" /><span class="text-sm font-medium">Language</span></div>
                                            <p class="mt-2 text-xl font-semibold text-text-primary">{show().originalLanguage?.toUpperCase() ?? "N/A"}</p>
                                            <p class="mt-1 text-sm text-text-secondary">{show().originCountry?.join(", ") || "Origin country unavailable."}</p>
                                        </div>
                                    </div>
                                </DetailPanel>
                            </div>

                            <DetailPanel eyebrow="Ordering" title="Episode source" aside={isEpisodeSourceBusy() ? "Rebuilding" : activeEpisodeSourceLabel()}>
                                <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
                                    <div class="space-y-4">
                                        <p class="text-sm leading-relaxed text-text-secondary">TMDb stays canonical for show identity. Use TVDB only when you need a different episode order for this specific show.</p>

                                        <div class="grid gap-3 sm:grid-cols-2">
                                            <button
                                                type="button"
                                                disabled={isEpisodeSourceBusy() || activeEpisodeSource()?.source === "tmdb"}
                                                onClick={handleUseTmdbEpisodeSource}
                                                class={`flex min-h-[8.5rem] flex-col items-start justify-between rounded-xl border px-4 py-4 text-left transition ${activeEpisodeSource()?.source === "tmdb" ? "border-info/35 bg-info/10 text-text-primary" : "border-border-default bg-surface-0/35 text-text-primary hover:border-border-hover"} disabled:cursor-not-allowed disabled:opacity-60`}
                                            >
                                                <div class="flex w-full items-start justify-between gap-3">
                                                    <div>
                                                        <p class="text-sm font-semibold">TMDb standard order</p>
                                                        <p class="mt-1 text-sm leading-relaxed text-text-secondary">Default discovery and canonical metadata for this show.</p>
                                                    </div>
                                                    <span class={`rounded-md border px-2 py-1 text-[0.68rem] font-medium ${activeEpisodeSource()?.source === "tmdb" ? "border-info/30 bg-info/10 text-info" : "border-border-default bg-surface-2 text-text-tertiary"}`}>
                                                        {activeEpisodeSource()?.source === "tmdb" ? "Current" : "Available"}
                                                    </span>
                                                </div>
                                                <p class="text-xs text-text-tertiary">{selectedEpisodeGroup() ? `Episode group override: ${selectedEpisodeGroup()?.name}` : "Uses the default TMDb episode order unless you choose a TMDb group below."}</p>
                                            </button>

                                            <button
                                                type="button"
                                                disabled={isEpisodeSourceBusy() || !(pendingTvdbMatch() ?? episodeSourceQuery.data?.suggestedTvdbSeries) || pendingTvdbMatchesActive()}
                                                onClick={handleUseTvdbEpisodeSource}
                                                class={`flex min-h-[8.5rem] flex-col items-start justify-between rounded-xl border px-4 py-4 text-left transition ${activeEpisodeSource()?.source === "tvdb" ? "border-warning/28 bg-warning-muted/12 text-text-primary" : "border-border-default bg-surface-0/35 text-text-primary hover:border-border-hover"} disabled:cursor-not-allowed disabled:opacity-60`}
                                            >
                                                <div class="flex w-full items-start justify-between gap-3">
                                                    <div>
                                                        <p class="text-sm font-semibold">TVDB alternate order</p>
                                                        <p class="mt-1 text-sm leading-relaxed text-text-secondary">Apply a selected TVDB series and season type for episode mapping.</p>
                                                    </div>
                                                    <span class={`rounded-md border px-2 py-1 text-[0.68rem] font-medium ${activeEpisodeSource()?.source === "tvdb" ? "border-warning/25 bg-warning-muted/15 text-warning" : "border-border-default bg-surface-2 text-text-tertiary"}`}>
                                                        {activeEpisodeSource()?.source === "tvdb" ? "Current" : pendingTvdbMatch() ? "Ready" : "Select first"}
                                                    </span>
                                                </div>
                                                <p class="text-xs text-text-tertiary">
                                                    {pendingTvdbMatch()
                                                        ? `${pendingTvdbMatch()?.title} · ${tvdbSeasonTypeOptions.find((option) => option.value === pendingTvdbSeasonType())?.label ?? "Default"}`
                                                        : "Search for a TVDB series below before switching this show to TVDB ordering."}
                                                </p>
                                            </button>
                                        </div>

                                        <div class="rounded-xl border border-border-subtle bg-surface-0/28 p-4">
                                            <div class="flex flex-wrap items-start justify-between gap-3">
                                                <div>
                                                    <h3 class="text-sm font-semibold text-text-primary">TVDB lookup</h3>
                                                    <p class="mt-1 text-sm text-text-secondary">Pick the TVDB series match first, then choose which season ordering MediaFlick should use.</p>
                                                </div>
                                                <Show when={pendingTvdbMatch()}>
                                                    {(match) => (
                                                        <div class="rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-secondary">
                                                            <p class="text-[0.68rem] font-medium uppercase tracking-[0.14em] text-text-tertiary">Selected</p>
                                                            <p class="mt-1 font-medium text-text-primary">{match().title}</p>
                                                            <p class="text-xs text-text-tertiary">TVDB #{match().tvdbId}{match().year ? ` · ${match().year}` : ""}</p>
                                                        </div>
                                                    )}
                                                </Show>
                                            </div>

                                            <div class="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_13rem]">
                                                <label class="block">
                                                    <span class="block text-xs font-medium text-text-secondary">TVDB series</span>
                                                    <TvdbSearchInput
                                                        class="mt-1"
                                                        tmdbId={tmdbId()}
                                                        initialQuery={show().title}
                                                        onSelect={(result) => setPendingTvdbMatch(result)}
                                                        placeholder="Search TVDB for an alternate episode order..."
                                                    />
                                                </label>

                                                <label class="block">
                                                    <span class="block text-xs font-medium text-text-secondary">Season type</span>
                                                    <select
                                                        class="mt-1 block w-full rounded-lg border border-border-default bg-surface-3 px-3.5 py-2.5 text-sm text-text-primary transition focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
                                                        value={pendingTvdbSeasonType()}
                                                        onChange={(e) => setPendingTvdbSeasonType(e.currentTarget.value as TvdbSeasonType)}
                                                    >
                                                        <For each={tvdbSeasonTypeOptions}>{(option) => <option value={option.value}>{option.label}</option>}</For>
                                                    </select>
                                                </label>
                                            </div>
                                        </div>

                                        <Show when={activeEpisodeSource()?.source !== "tvdb" && (episodeGroupsQuery.data?.groups.length ?? 0) > 1}>
                                            <div class="rounded-xl border border-border-subtle bg-surface-0/28 p-4">
                                                <div class="flex flex-wrap items-start justify-between gap-3">
                                                    <div>
                                                        <h3 class="text-sm font-semibold text-text-primary">TMDb group override</h3>
                                                        <p class="mt-1 text-sm text-text-secondary">If you stay on TMDb, you can still switch to one of TMDb’s alternate episode groups.</p>
                                                    </div>
                                                    <Show when={selectedEpisodeGroup()}>
                                                        {(g) => <Pill variant="info">{g().episodeCount} episodes</Pill>}
                                                    </Show>
                                                </div>
                                                <select
                                                    class="mt-4 block w-full max-w-xl rounded-lg border border-border-default bg-surface-3 px-3.5 py-2.5 text-sm text-text-primary transition focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
                                                    value={episodeGroupsQuery.data?.selectedEpisodeGroupId ?? ""}
                                                    disabled={episodeGroupMutation.isPending}
                                                    onChange={(e) => handleEpisodeGroupChange(e.currentTarget.value)}
                                                >
                                                    <option value="">Default TMDb order</option>
                                                    <For each={episodeGroupsQuery.data?.groups ?? []}>{(g) => <option value={g.id}>{g.name}</option>}</For>
                                                </select>
                                                <Show when={selectedEpisodeGroup()}>
                                                    {(g) => <p class="mt-3 text-sm text-text-secondary">Current TMDb group: <span class="font-medium text-text-primary">{g().name}</span></p>}
                                                </Show>
                                            </div>
                                        </Show>

                                        <Show when={isEpisodeSourceBusy()}>
                                            <p class="text-xs text-text-secondary animate-pulse">Rebuilding episodes and symlinks...</p>
                                        </Show>
                                    </div>

                                    <aside class="rounded-xl border border-border-subtle bg-surface-0/32 p-4">
                                        <p class="text-[0.7rem] font-medium uppercase tracking-[0.14em] text-text-tertiary">Current source</p>
                                        <h3 class="mt-2 text-lg font-semibold text-text-primary">{activeEpisodeSourceLabel()}</h3>
                                        <dl class="mt-4 space-y-3 text-sm">
                                            <div>
                                                <dt class="text-text-tertiary">Mode</dt>
                                                <dd class="mt-1 text-text-primary">{activeEpisodeSource()?.source === "tvdb" ? "TVDB episode order" : "TMDb standard order"}</dd>
                                            </div>
                                            <Show
                                                when={activeEpisodeSource()?.source === "tvdb"}
                                                fallback={
                                                    <div>
                                                        <dt class="text-text-tertiary">TMDb group</dt>
                                                        <dd class="mt-1 text-text-primary">{selectedEpisodeGroup()?.name ?? "Default TMDb order"}</dd>
                                                    </div>
                                                }
                                            >
                                                <div>
                                                    <dt class="text-text-tertiary">TVDB series</dt>
                                                    <dd class="mt-1 text-text-primary">{activeEpisodeSource()?.tvdbSeriesName ?? "Unknown TVDB series"}</dd>
                                                </div>
                                                <div>
                                                    <dt class="text-text-tertiary">Season type</dt>
                                                    <dd class="mt-1 text-text-primary">{activeEpisodeSource()?.tvdbSeasonTypeLabel ?? "Default"}</dd>
                                                </div>
                                            </Show>
                                        </dl>

                                        <div class="mt-5 border-t border-border-subtle pt-4">
                                            <p class="text-[0.7rem] font-medium uppercase tracking-[0.14em] text-text-tertiary">Pending TVDB selection</p>
                                            <Show
                                                when={pendingTvdbMatch()}
                                                fallback={<p class="mt-2 text-sm leading-relaxed text-text-secondary">Choose a TVDB series if this show needs a different episode order than TMDb provides.</p>}
                                            >
                                                {(match) => (
                                                    <div class="mt-2 space-y-2">
                                                        <p class="text-sm font-medium text-text-primary">{match().title}</p>
                                                        <p class="text-sm text-text-secondary">TVDB #{match().tvdbId}{match().year ? ` · ${match().year}` : ""}</p>
                                                        <p class="text-sm text-text-secondary">Season type: {tvdbSeasonTypeOptions.find((option) => option.value === pendingTvdbSeasonType())?.label ?? "Default"}</p>
                                                        <Show when={pendingTvdbMatchesActive()}>
                                                            <p class="text-sm text-warning">This selection is already active.</p>
                                                        </Show>
                                                    </div>
                                                )}
                                            </Show>
                                        </div>
                                    </aside>
                                </div>
                            </DetailPanel>

                            <CastPanel cast={show().cast} />

                            <DetailPanel eyebrow="Coverage map" title="Categorized episodes" aside={`${seasonGroupsToRender().length} seasons`}>
                                <div class="space-y-4">
                                    <Show when={seasonDetailsQuery.isLoading && (tvFilesQuery.data?.categorizedFiles.length ?? 0) === 0}><div class="space-y-3"><For each={Array(4)}>{() => <RowSkeleton />}</For></div></Show>
                                    <Show when={missingEpisodeCount() > 0}>
                                        <div class="flex items-center gap-2 rounded-[1.1rem] border border-warning/20 bg-warning-muted/14 px-4 py-3 text-sm text-warning">
                                            <AlertTriangle size={16} />
                                            <span>{missingEpisodeCount()} episodes are missing from the active {activeEpisodeSourceLabel()} season order.</span>
                                        </div>
                                    </Show>
                                    <Show when={remappedEpisodeFileCount() > 0}>
                                        <div class="flex items-center gap-2 rounded-[1.1rem] border border-info/20 bg-info/10 px-4 py-3 text-sm text-info">
                                            <RefreshCw size={16} />
                                            <span>{remappedEpisodeFileCount()} files use source-to-{activeEpisodeSourceLabel()} episode remapping.</span>
                                        </div>
                                    </Show>
                                    <Show when={seasonGroupsToRender().length === 0}><p class="py-8 text-center text-sm text-text-tertiary">No categorized episodes found for this show yet.</p></Show>
                                    <For each={seasonGroupsToRender()}>
                                        {(group) => {
                                            const seasonMeta = seasonMetaByNumber().get(group.seasonNumber);
                                            const seasonLabel = group.seasonNumber > 0 ? `Season ${String(group.seasonNumber).padStart(2, "0")}` : "Unassigned";
                                            const missingCount = group.cards.filter((card) => card.kind === "missing").length;
                                            const reassignableFiles = reassignableFilesBySeason().get(group.seasonNumber) ?? [];
                                            const coveragePercent = seasonCoveragePercent(group);
                                            const dmmSeasonUrl = debridMediaManagerSeasonUrl({
                                                imdbId: show().imdbId,
                                                title: show().title,
                                                seasonNumber: group.seasonNumber,
                                            });
                                            return (
                                                <details class="group overflow-hidden rounded-[1.4rem] border border-border-subtle bg-surface-0/25" open={group.seasonNumber === 1}>
                                                    <summary class="flex cursor-pointer list-none items-center gap-4 px-4 py-4 [&::-webkit-details-marker]:hidden">
                                                        <Show when={posterUrl(seasonMeta?.posterPath, "w154")} fallback={<div class="flex h-24 w-16 items-center justify-center rounded-xl border border-border-default bg-surface-3 px-1 text-center text-[0.62rem] font-mono uppercase tracking-wider text-text-tertiary">{seasonLabel}</div>}>
                                                            {(url) => <img src={url()} alt={seasonMeta?.name ?? seasonLabel} loading="lazy" class="h-24 w-16 rounded-xl border border-border-default object-cover" />}
                                                        </Show>
                                                        <div class="min-w-0 flex-1">
                                                            <div class="flex flex-wrap items-center gap-2">
                                                                <h3 class="text-base font-semibold text-text-primary">{seasonLabel}</h3>
                                                                <Show when={missingCount > 0}><Pill variant="warning">{missingCount} missing</Pill></Show>
                                                            </div>
                                                            <p class="mt-1 text-sm text-text-secondary">{group.episodeCountScanned}/{group.episodeCount || group.cards.length} scanned in this season.</p>
                                                            <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
                                                                <div class={`h-full rounded-full ${coveragePercent >= 100 ? "bg-success" : coveragePercent > 0 ? "bg-warning" : "bg-error"}`} style={{ width: `${coveragePercent}%` }} />
                                                            </div>
                                                            <Show when={seasonMeta?.overview}>
                                                                {(overview) => <p class="mt-2 line-clamp-2 text-xs text-text-tertiary">{overview()}</p>}
                                                            </Show>
                                                        </div>
                                                        <Show when={group.seasonNumber > 0 && reassignableFiles.length > 0}>
                                                            <button
                                                                type="button"
                                                                class="inline-flex min-h-11 items-center justify-center rounded-xl border border-border-default bg-surface-1/70 px-4 py-2 text-sm text-text-secondary transition hover:border-border-hover hover:text-text-primary"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    openReassign(group.seasonNumber);
                                                                }}
                                                            >
                                                                Reassign Season
                                                            </button>
                                                        </Show>
                                                        <Show when={missingCount > 0}>
                                                            <a
                                                                href={dmmSeasonUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-default bg-surface-1/70 px-4 py-2 text-sm text-text-secondary transition hover:border-border-hover hover:text-text-primary"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <ExternalLink size={15} />
                                                                <span>Search Season In DMM</span>
                                                            </a>
                                                        </Show>
                                                        <span class="text-text-tertiary transition-transform group-open:rotate-180">
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4"><path d="m6 9 6 6 6-6" /></svg>
                                                        </span>
                                                    </summary>
                                                    <div class="border-t border-border-subtle px-3.5 py-3 space-y-1.5">
                                                        <For each={annotateSeasonCardsWithSourceDividers(group.cards)}>
                                                            {(entry) => entry.card.kind === "file"
                                                                ? <EpisodeFileRow file={entry.card.file} sourceDividerPath={entry.sourceDividerPath} />
                                                                : <MissingEpisodeRow seasonNumber={group.seasonNumber} episodeNumber={entry.card.episodeNumber} episodeName={entry.card.episodeName} airDate={entry.card.airDate} showTitle={show().title} showImdbId={show().imdbId} />}
                                                        </For>
                                                    </div>
                                                </details>
                                            );
                                        }}
                                    </For>
                                </div>
                            </DetailPanel>

                            <DetailPanel eyebrow="Alias-linked rows" title="Uncategorized related files" aside={`${tvFilesQuery.data?.uncategorizedFiles.length ?? 0} items`}>
                                <p class="mb-3 text-sm text-text-secondary">These rows are connected to the show identity but not currently mapped into categorized season/episode placement.</p>
                                <Show when={tvFilesQuery.isLoading}><div class="space-y-3"><For each={Array(3)}>{() => <RowSkeleton />}</For></div></Show>
                                <Show when={(tvFilesQuery.data?.uncategorizedFiles.length ?? 0) === 0}><p class="py-6 text-center text-sm text-text-tertiary">No uncategorized files connected to this show.</p></Show>
                                <div class="space-y-1.5">
                                    <For each={annotateFilesWithSourceDividers(tvFilesQuery.data?.uncategorizedFiles ?? [])}>
                                        {(entry) => <EpisodeFileRow file={entry.file} sourceDividerPath={entry.sourceDividerPath} />}
                                    </For>
                                </div>
                            </DetailPanel>

                            <IdentifyModal
                                open={reassignOpen()}
                                onClose={() => {
                                    setReassignOpen(false);
                                    setReassignSeasonNumber(null);
                                    void queryClient.invalidateQueries({ queryKey: ["show", tmdbId()] });
                                    void queryClient.invalidateQueries({ queryKey: ["tv-files", tmdbId()] });
                                    void queryClient.invalidateQueries({ queryKey: ["titles"] });
                                }}
                                initialMode="TvShows"
                                files={activeReassignFiles()}
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
