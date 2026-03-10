import { useQuery } from "@tanstack/solid-query";
import { For, Show, createMemo, createSignal } from "solid-js";
import { Tv2 } from "lucide-solid";
import { CardSkeleton, JellyfinSyncBadge, Pill } from "@/components/common-ui";
import { CollectionHero, MediaShelfCard } from "@/components/media-shared";
import { mediaApi } from "@/lib/api";
import type { JellyfinSyncSummary, MediaInfo } from "@/lib/types";

function showStatusVariant(status: string | null | undefined): "default" | "success" | "info" | "warning" | "error" {
    const normalized = status?.trim().toLowerCase();
    if (normalized === "returning series" || normalized === "in production") return "info";
    if (normalized === "ended") return "success";
    if (normalized === "canceled" || normalized === "cancelled") return "error";
    if (normalized === "planned" || normalized === "pilot") return "warning";
    return "default";
}

function showLifecycleLabel(status: string | null | undefined): string | null {
    const normalized = status?.trim().toLowerCase();
    if (normalized === "returning series" || normalized === "in production") return "Ongoing";
    if (normalized === "ended") return "Ended";
    if (normalized === "canceled" || normalized === "cancelled") return "Cancelled";
    return null;
}

function showCoveragePercent(show: Pick<MediaInfo, "episodeCount" | "episodeCountScanned">): number {
    const total = show.episodeCount ?? 0;
    const scanned = show.episodeCountScanned ?? 0;
    if (total <= 0) return 0;
    return Math.max(0, Math.min(100, (scanned / total) * 100));
}

function TvShowPosterCard(props: {
    href: string;
    tmdbId: number;
    title: string;
    year: number | null;
    posterPath: string | null | undefined;
    jellyfin: JellyfinSyncSummary | null;
}) {
    const displayTitle = createMemo(() => props.year ? `${props.title} (${props.year})` : props.title);
    const showQuery = useQuery(() => ({
        queryKey: ["show-card", props.tmdbId],
        queryFn: () => mediaApi.getShow(props.tmdbId),
        staleTime: 5 * 60 * 1000,
    }));
    const lifecycleLabel = createMemo(() => showLifecycleLabel(showQuery.data?.status));
    const coveragePercent = createMemo(() => showQuery.data ? showCoveragePercent(showQuery.data) : 0);
    const episodeCoverageLabel = createMemo(() => {
        const scanned = showQuery.data?.episodeCountScanned ?? 0;
        const total = showQuery.data?.episodeCount ?? 0;
        if (total <= 0) return "Episode totals unavailable";
        return `${scanned}/${total} episodes scanned`;
    });

    return (
        <MediaShelfCard
            href={props.href}
            title={displayTitle()}
            posterPath={props.posterPath}
            eyebrow="TV Show"
            subtitle="Open the series to inspect seasons, files, and alternative episode orderings."
            tone="tv"
            topRight={
                <JellyfinSyncBadge sync={props.jellyfin} compact />
            }
        >
            <div class="space-y-3 text-xs text-white/80">
                <div class="flex flex-wrap items-center gap-2">
                    <Show when={lifecycleLabel()}>
                        {(label) => <Pill variant={showStatusVariant(showQuery.data?.status)}>{label()}</Pill>}
                    </Show>
                </div>
                <div class="space-y-2">
                    <div class="flex items-center justify-between gap-3 text-[0.72rem] text-white/70">
                        <span>{episodeCoverageLabel()}</span>
                        <Show when={showQuery.data?.episodeCount && showQuery.data.episodeCount > 0}>
                            <span>{Math.round(coveragePercent())}%</span>
                        </Show>
                    </div>
                    <div class="h-2 overflow-hidden rounded-full bg-white/10">
                        <div class="h-full rounded-full bg-info transition-[width] duration-300" style={{ width: `${coveragePercent()}%` }} />
                    </div>
                </div>
            </div>
        </MediaShelfCard>
    );
}

export default function TvShowsPage() {
    const [searchTerm, setSearchTerm] = createSignal("");
    const titlesQuery = useQuery(() => ({
        queryKey: ["titles", "tv", searchTerm().trim().toLowerCase()],
        queryFn: () => mediaApi.listTitles("TvShows", searchTerm()),
    }));
    const filteredTitles = createMemo(() => titlesQuery.data ?? []);
    const titlesWithPosters = createMemo(() => filteredTitles().filter((item) => !!item.posterPath).length);
    const filterLabel = createMemo(() => {
        const value = searchTerm().trim();
        return value.length > 0 ? `Filter: ${value}` : "Browse all shows";
    });

    return (
        <section>
            <CollectionHero
                eyebrow="Signal Desk"
                title="TV Shows"
                subtitle="Track the series wall with a stronger sense of season coverage, current status, and the route into alternate episode groupings."
                searchValue={searchTerm()}
                onSearch={setSearchTerm}
                statusLabel={filterLabel()}
                stats={[
                    {
                        label: "Visible shows",
                        value: String(filteredTitles().length),
                        detail: searchTerm().trim() ? "Series matching the current filter." : "Tracked TV identities in the library.",
                        accent: "cyan",
                    },
                    {
                        label: "Artwork ready",
                        value: String(titlesWithPosters()),
                        detail: "Shows already carrying poster art in this view.",
                        accent: "orange",
                    },
                    {
                        label: "Season tools",
                        value: "Episode groups",
                        detail: "Open a show to swap TMDb orderings and review remapped files.",
                        accent: "lime",
                    },
                    {
                        label: "Workflow",
                        value: "Coverage first",
                        detail: "This view is tuned for missing episodes, scanned seasons, and file validation.",
                        accent: "rose",
                    },
                ]}
            />
            <Show when={titlesQuery.isLoading}><div class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5"><For each={Array(10)}>{() => <CardSkeleton />}</For></div></Show>
            <Show when={titlesQuery.isError}><p class="text-error text-sm">Unable to load TV shows right now.</p></Show>
            <Show when={!titlesQuery.isLoading && !titlesQuery.isError && (titlesQuery.data?.length ?? 0) === 0}><p class="text-text-tertiary text-sm py-12 text-center">No TV shows found for this filter.</p></Show>

            <div class="mb-4 flex items-center justify-between gap-3">
                <div>
                    <p class="text-[0.68rem] font-mono uppercase tracking-[0.18em] text-text-tertiary">Series wall</p>
                    <h2 class="mt-1 text-2xl font-semibold text-text-primary">Current shows</h2>
                </div>
                <div class="inline-flex items-center gap-2 rounded-full border border-border-default bg-surface-1/80 px-3 py-2 text-xs font-mono uppercase tracking-[0.14em] text-text-secondary">
                    <Tv2 size={13} />
                    <span>{filteredTitles().length} results</span>
                </div>
            </div>

            <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
                <For each={filteredTitles()}>
                    {(item) => <TvShowPosterCard href={`/shows/${item.tmdbId}`} tmdbId={item.tmdbId} title={item.title ?? "Unknown title"} year={item.year} posterPath={item.posterPath} jellyfin={item.jellyfin} />}
                </For>
            </div>
        </section>
    );
}
