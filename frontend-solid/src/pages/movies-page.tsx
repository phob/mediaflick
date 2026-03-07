import { useQuery } from "@tanstack/solid-query";
import { For, Show, createMemo, createSignal } from "solid-js";
import { Film, Image as ImageIcon } from "lucide-solid";
import { CardSkeleton } from "@/components/common-ui";
import { CollectionHero, MediaShelfCard } from "@/components/media-shared";
import { mediaApi } from "@/lib/api";

export default function MoviesPage() {
    const [searchTerm, setSearchTerm] = createSignal("");
    const titlesQuery = useQuery(() => ({
        queryKey: ["titles", "movies", searchTerm().trim().toLowerCase()],
        queryFn: () => mediaApi.listTitles("Movies", searchTerm()),
    }));
    const filteredTitles = createMemo(() => titlesQuery.data ?? []);
    const titlesWithPosters = createMemo(() => filteredTitles().filter((item) => !!item.posterPath).length);
    const filterLabel = createMemo(() => {
        const value = searchTerm().trim();
        return value.length > 0 ? `Filter: ${value}` : "Browse all movies";
    });

    return (
        <section>
            <CollectionHero
                eyebrow="Library Wing"
                title="Movies"
                subtitle="Browse the film catalog like a proper collection wall, then jump straight into extras cleanup, metadata, and file grouping."
                searchValue={searchTerm()}
                onSearch={setSearchTerm}
                statusLabel={filterLabel()}
                stats={[
                    {
                        label: "Visible titles",
                        value: String(filteredTitles().length),
                        detail: searchTerm().trim() ? "Movies matching the current filter." : "Movies with a successful TMDb identity.",
                        accent: "orange",
                    },
                    {
                        label: "Artwork ready",
                        value: String(titlesWithPosters()),
                        detail: "Posters already cached for this slice of the library.",
                        accent: "cyan",
                    },
                    {
                        label: "Browse mode",
                        value: searchTerm().trim() ? "Focused" : "Open",
                        detail: searchTerm().trim() ? "You are looking at a narrowed subset." : "Full-catalog browsing with no search filter applied.",
                        accent: "lime",
                    },
                    {
                        label: "Workflow",
                        value: "Files + extras",
                        detail: "Each title opens into direct files and same-folder related media.",
                        accent: "rose",
                    },
                ]}
            />

            <Show when={titlesQuery.isLoading}><div class="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5"><For each={Array(15)}>{() => <CardSkeleton />}</For></div></Show>
            <Show when={titlesQuery.isError}><p class="text-error text-sm">Unable to load movies right now.</p></Show>
            <Show when={!titlesQuery.isLoading && !titlesQuery.isError && (titlesQuery.data?.length ?? 0) === 0}><p class="text-text-tertiary text-sm py-12 text-center">No movies found for this filter.</p></Show>

            <div class="mb-4 flex items-center justify-between gap-3">
                <div>
                    <p class="text-[0.68rem] font-mono uppercase tracking-[0.18em] text-text-tertiary">Collection wall</p>
                    <h2 class="mt-1 text-2xl font-semibold text-text-primary">Film library</h2>
                </div>
                <div class="rounded-full border border-border-default bg-surface-1/80 px-3 py-2 text-xs font-mono uppercase tracking-[0.14em] text-text-secondary">
                    {filteredTitles().length} results
                </div>
            </div>

            <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
                <For each={filteredTitles()}>
                    {(item) => (
                        <MediaShelfCard
                            href={`/movies/${item.tmdbId}`}
                            title={item.title ?? "Unknown title"}
                            posterPath={item.posterPath}
                            eyebrow="Movie"
                            subtitle={item.year ? `Released ${item.year}` : "Release year not available"}
                            footer={`TMDb ${item.tmdbId}`}
                            tone="movie"
                            topRight={
                                <div class="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/30 px-3 py-1.5 text-[0.68rem] font-mono uppercase tracking-[0.14em] text-white/70">
                                    {item.posterPath ? <ImageIcon size={13} /> : <Film size={13} />}
                                    <span>{item.posterPath ? "Art ready" : "Fallback"}</span>
                                </div>
                            }
                        >
                            <div class="flex items-center justify-between gap-3 text-xs text-white/70">
                                <span>Open title details</span>
                                <span class="rounded-full border border-white/12 bg-white/8 px-2 py-1">Extras review</span>
                            </div>
                        </MediaShelfCard>
                    )}
                </For>
            </div>
        </section>
    );
}
