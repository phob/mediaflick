import { useQuery } from "@tanstack/solid-query";
import { For, Show, createMemo, createSignal } from "solid-js";
import { Signal, Tv2 } from "lucide-solid";
import { CardSkeleton, Pill } from "@/components/common-ui";
import { CollectionHero, MediaShelfCard } from "@/components/media-shared";
import { mediaApi } from "@/lib/api";

type PillVariant = "default" | "success" | "info" | "warning" | "error";

function showStatusVariant(status: string | null | undefined): PillVariant {
    const normalized = status?.trim().toLowerCase();
    if (normalized === "returning series" || normalized === "in production") return "info";
    if (normalized === "canceled") return "error";
    if (normalized === "planned" || normalized === "pilot") return "warning";
    return "default";
}

function episodeCoverageDisplay(
    episodeCount: number | undefined,
    episodeCountScanned: number | undefined,
): { available: boolean; label: string; percent: number; barClass: string; textClass: string } {
    const total = Math.max(0, episodeCount ?? 0);
    if (total <= 0) return { available: false, label: "", percent: 0, barClass: "bg-border-default", textClass: "text-text-secondary" };
    const scanned = Math.max(0, episodeCountScanned ?? 0);
    const percent = Math.min(100, (scanned / total) * 100);
    if (scanned >= total) return { available: true, label: `${scanned} / ${total} Episodes`, percent, barClass: "bg-success", textClass: "text-success" };
    if (scanned === 0) return { available: true, label: `${scanned} / ${total} Episodes`, percent, barClass: "bg-error", textClass: "text-error" };
    return { available: true, label: `${scanned} / ${total} Episodes`, percent, barClass: "bg-warning", textClass: "text-warning" };
}

function TvShowPosterCard(props: {
    href: string;
    tmdbId: number;
    fallbackTitle: string;
    fallbackYear: number | null;
    fallbackPosterPath: string | null | undefined;
}) {
    const showQuery = useQuery(() => ({
        queryKey: ["show", props.tmdbId],
        queryFn: () => mediaApi.getShow(props.tmdbId),
        staleTime: 15 * 60 * 1000,
        enabled: Number.isInteger(props.tmdbId) && props.tmdbId > 0,
    }));

    const posterPath = createMemo(() => showQuery.data?.posterPath ?? props.fallbackPosterPath);
    const displayTitle = createMemo(() => {
        const title = showQuery.data?.title ?? props.fallbackTitle;
        const year = showQuery.data?.year ?? props.fallbackYear;
        return year ? `${title} (${year})` : title;
    });
    const statusLabel = createMemo(() => {
        const status = showQuery.data?.status;
        if (!status || status.trim().length === 0) return null;
        return status.trim();
    });
    const genresLine = createMemo(() => {
        const genres = showQuery.data?.genres ?? [];
        if (genres.length === 0) return null;
        return genres.slice(0, 3).join(", ");
    });
    const coverage = createMemo(() => episodeCoverageDisplay(showQuery.data?.episodeCount, showQuery.data?.episodeCountScanned));

    return (
        <MediaShelfCard
            href={props.href}
            title={displayTitle()}
            posterPath={posterPath()}
            eyebrow="TV Show"
            subtitle={genresLine() ?? "Open the series to inspect seasons, files, and alternative episode orderings."}
            footer={`TMDb ${props.tmdbId}`}
            tone="tv"
            topRight={
                <Show
                    when={statusLabel()}
                    fallback={
                        <div class="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/30 px-3 py-1.5 text-[0.68rem] font-mono uppercase tracking-[0.14em] text-white/70">
                            <Signal size={13} />
                            <span>Cataloged</span>
                        </div>
                    }
                >
                    {(status) => <Pill variant={showStatusVariant(status())} solid>{status()}</Pill>}
                </Show>
            }
        >
            <Show
                when={coverage().available}
                fallback={<div class="flex items-center justify-between gap-3 text-xs text-white/70"><span>Metadata available</span><span class="rounded-full border border-white/12 bg-white/8 px-2 py-1">Open show</span></div>}
            >
                <div>
                    <div class="h-1.5 overflow-hidden rounded-full bg-white/15">
                        <div class={`h-full rounded-full transition-all duration-300 ${coverage().barClass}`} style={{ width: `${coverage().percent}%` }} />
                    </div>
                    <div class="mt-2 flex items-center justify-between gap-3">
                        <p class={`text-[0.72rem] font-semibold ${coverage().textClass}`}>{coverage().label}</p>
                        <span class="text-[0.68rem] font-mono uppercase tracking-[0.14em] text-white/58">Season view</span>
                    </div>
                </div>
            </Show>
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
                    {(item) => <TvShowPosterCard href={`/shows/${item.tmdbId}`} tmdbId={item.tmdbId} fallbackTitle={item.title ?? "Unknown title"} fallbackYear={item.year} fallbackPosterPath={item.posterPath} />}
                </For>
            </div>
        </section>
    );
}
