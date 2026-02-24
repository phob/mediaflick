import { A } from "@solidjs/router";
import { useQuery } from "@tanstack/solid-query";
import { For, Show, createMemo, createSignal } from "solid-js";
import { Pill, RowSkeleton } from "@/components/common-ui";
import { MediaSearchHeader } from "@/components/media-shared";
import { formatReleaseDate, listWantedShows, posterUrl } from "@/lib/media-helpers";

export default function WantedPage() {
    const [searchTerm, setSearchTerm] = createSignal("");
    const wantedQuery = useQuery(() => ({
        queryKey: ["wanted-shows", searchTerm().trim().toLowerCase()],
        queryFn: () => listWantedShows(searchTerm()),
        staleTime: 2 * 60 * 1000,
    }));

    const missingTotal = createMemo(() => (wantedQuery.data ?? []).reduce((total, show) => total + show.missingEpisodes, 0));

    return (
        <section>
            <MediaSearchHeader title="Wanted Episodes" subtitle="Series with already aired episodes that are still missing in your library." searchValue={searchTerm()} onSearch={setSearchTerm} />

            <div class="flex flex-wrap gap-2 mb-4"><Pill variant="warning">Missing episodes: {missingTotal()}</Pill><Pill>Shows with gaps: {wantedQuery.data?.length ?? 0}</Pill></div>

            <Show when={wantedQuery.isLoading}><div class="space-y-3"><For each={Array(6)}>{() => <RowSkeleton />}</For></div></Show>
            <Show when={wantedQuery.isError}><p class="text-error text-sm">Unable to load wanted episodes right now.</p></Show>
            <Show when={!wantedQuery.isLoading && !wantedQuery.isError && (wantedQuery.data?.length ?? 0) === 0}><p class="text-text-tertiary text-sm py-12 text-center">No missing aired episodes found for this filter.</p></Show>

            <div class="space-y-2">
                <For each={wantedQuery.data ?? []}>
                    {(show) => (
                        <A href={`/shows/${show.tmdbId}`} class="flex items-center justify-between gap-4 bg-surface-2 border border-border-subtle rounded-lg px-4 py-3 transition hover:border-border-hover hover:bg-surface-3/65">
                            <div class="flex items-center gap-3 min-w-0">
                                <Show when={posterUrl(show.posterPath, "w185")} fallback={<div class="w-10 h-14 rounded-md bg-surface-3 border border-border-default shrink-0" />}>
                                    {(url) => <img src={url()} alt="" class="w-10 h-14 rounded-md object-cover border border-border-default shrink-0" />}
                                </Show>
                                <div class="min-w-0">
                                    <p class="font-semibold text-sm text-text-primary truncate">{show.title}</p>
                                    <p class="text-xs text-text-tertiary mt-0.5 truncate">{show.year ?? "Year unknown"} · Last aired {formatReleaseDate(show.lastAirDate)}</p>
                                </div>
                            </div>
                            <div class="flex flex-wrap justify-end items-center gap-1.5 shrink-0"><Pill variant="warning">Missing {show.missingEpisodes}</Pill><Pill>{show.scannedEpisodes} / {show.airedEpisodes} scanned</Pill></div>
                        </A>
                    )}
                </For>
            </div>
        </section>
    );
}
