import { useQuery } from "@tanstack/solid-query";
import { For, Show, createSignal } from "solid-js";
import { CardSkeleton } from "@/components/common-ui";
import { MediaSearchHeader, PosterCard } from "@/components/media-shared";
import { mediaApi } from "@/lib/api";

export default function MoviesPage() {
    const [searchTerm, setSearchTerm] = createSignal("");
    const titlesQuery = useQuery(() => ({
        queryKey: ["titles", "movies", searchTerm().trim().toLowerCase()],
        queryFn: () => mediaApi.listTitles("Movies", searchTerm()),
    }));

    return (
        <section>
            <MediaSearchHeader title="Movies" subtitle="Inspect each movie directly and reveal same-folder files that should be treated as extras." searchValue={searchTerm()} onSearch={setSearchTerm} />

            <Show when={titlesQuery.isLoading}><div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-5"><For each={Array(18)}>{() => <CardSkeleton />}</For></div></Show>
            <Show when={titlesQuery.isError}><p class="text-error text-sm">Unable to load movies right now.</p></Show>
            <Show when={!titlesQuery.isLoading && !titlesQuery.isError && (titlesQuery.data?.length ?? 0) === 0}><p class="text-text-tertiary text-sm py-12 text-center">No movies found for this filter.</p></Show>

            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-5">
                <For each={titlesQuery.data ?? []}>{(item) => <PosterCard href={`/movies/${item.tmdbId}`} title={item.title ?? "Unknown title"} posterPath={item.posterPath} />}</For>
            </div>
        </section>
    );
}
