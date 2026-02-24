import { A } from "@solidjs/router";
import { useQuery } from "@tanstack/solid-query";
import { For, Show, createMemo, createSignal } from "solid-js";
import { CardSkeleton, Pill } from "@/components/common-ui";
import { MediaSearchHeader } from "@/components/media-shared";
import { mediaApi } from "@/lib/api";
import { posterUrl } from "@/lib/media-helpers";

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
        <A href={props.href} class="poster-card group block">
            <div class="aspect-2/3 relative">
                <Show when={posterUrl(posterPath())} fallback={<div class="poster-fallback"><span>{displayTitle()}</span></div>}>
                    {(src) => <img src={src()} alt={displayTitle()} loading="lazy" class="absolute inset-0 w-full h-full object-cover transition-transform duration-300" />}
                </Show>
                <Show when={statusLabel()}>{(status) => <div class="absolute top-2 left-2 z-4"><Pill variant={showStatusVariant(status())} solid>{status()}</Pill></div>}</Show>
                <div class="poster-caption pb-0">
                    <p class="text-sm font-semibold text-white leading-tight line-clamp-2">{displayTitle()}</p>
                    <Show when={genresLine()}>{(genres) => <p class="text-xs text-white/70 mt-0.5 line-clamp-1">{genres()}</p>}</Show>
                    <Show when={coverage().available}>
                        <div class="mt-2 -mx-3 px-3 pt-2 pb-2 bg-black/70 border-t border-white/12">
                            <div class="h-1.5 rounded-full bg-white/18 overflow-hidden"><div class={`h-full rounded-full transition-all duration-300 ${coverage().barClass}`} style={{ width: `${coverage().percent}%` }} /></div>
                            <p class={`mt-1 text-[0.72rem] font-semibold text-center ${coverage().textClass}`}>{coverage().label}</p>
                        </div>
                    </Show>
                </div>
            </div>
        </A>
    );
}

export default function TvShowsPage() {
    const [searchTerm, setSearchTerm] = createSignal("");
    const titlesQuery = useQuery(() => ({
        queryKey: ["titles", "tv", searchTerm().trim().toLowerCase()],
        queryFn: () => mediaApi.listTitles("TvShows", searchTerm()),
    }));

    return (
        <section>
            <MediaSearchHeader title="TV Shows" subtitle="Open any show and switch episode grouping when TMDb offers alternatives." searchValue={searchTerm()} onSearch={setSearchTerm} />
            <Show when={titlesQuery.isLoading}><div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-5"><For each={Array(12)}>{() => <CardSkeleton />}</For></div></Show>
            <Show when={titlesQuery.isError}><p class="text-error text-sm">Unable to load TV shows right now.</p></Show>
            <Show when={!titlesQuery.isLoading && !titlesQuery.isError && (titlesQuery.data?.length ?? 0) === 0}><p class="text-text-tertiary text-sm py-12 text-center">No TV shows found for this filter.</p></Show>
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-5">
                <For each={titlesQuery.data ?? []}>{(item) => <TvShowPosterCard href={`/shows/${item.tmdbId}`} tmdbId={item.tmdbId} fallbackTitle={item.title ?? "Unknown title"} fallbackYear={item.year} fallbackPosterPath={item.posterPath} />}</For>
            </div>
        </section>
    );
}
