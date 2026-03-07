import { useQuery } from "@tanstack/solid-query";
import { For, Show, createEffect, createSignal } from "solid-js";
import { mediaApi } from "@/lib/api";
import { posterUrl } from "@/lib/media-helpers";
import type { TvdbSearchResult } from "@/lib/types";

export function TvdbSearchInput(props: {
    tmdbId: number;
    onSelect: (result: TvdbSearchResult) => void;
    initialQuery?: string;
    placeholder?: string;
    class?: string;
}) {
    const [query, setQuery] = createSignal(props.initialQuery ?? "");
    const [open, setOpen] = createSignal(false);
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    createEffect(() => {
        setQuery(props.initialQuery ?? "");
    });

    const searchQuery = useQuery(() => ({
        queryKey: ["tvdb-search", props.tmdbId, query().trim().toLowerCase()],
        queryFn: () => mediaApi.searchTvdbShows(props.tmdbId, query()),
        enabled: props.tmdbId > 0 && query().trim().length >= 2 && open(),
    }));

    const handleInput = (value: string) => {
        setQuery(value);
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            if (value.trim().length >= 2) setOpen(true);
        }, 250);
    };

    const handleSelect = (result: TvdbSearchResult) => {
        setQuery(result.title);
        setOpen(false);
        props.onSelect(result);
    };

    return (
        <div class={`relative ${props.class ?? ""}`}>
            <input
                value={query()}
                onInput={(e) => handleInput(e.currentTarget.value)}
                onFocus={() => {
                    if (query().trim().length >= 2) setOpen(true);
                }}
                class="w-full bg-surface-3 border border-border-default rounded-lg px-3.5 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition"
                placeholder={props.placeholder ?? "Search TVDB series..."}
            />
            <Show when={open() && (searchQuery.data?.length ?? 0) > 0}>
                <div class="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto bg-surface-2 border border-border-default rounded-xl shadow-xl" onMouseDown={(e) => e.preventDefault()}>
                    <For each={searchQuery.data ?? []}>
                        {(result) => (
                            <button type="button" class="flex items-start gap-3 w-full px-3 py-2 text-left hover:bg-surface-3 transition text-sm" onClick={() => handleSelect(result)}>
                                <Show when={posterUrl(result.posterPath, "w92")} fallback={<div class="w-8 h-12 rounded bg-surface-3 shrink-0" />}>
                                    {(poster) => <img src={poster()} alt="" class="w-8 h-12 rounded object-cover shrink-0" />}
                                </Show>
                                <div class="min-w-0 flex-1">
                                    <p class="text-text-primary font-medium truncate">{result.title}</p>
                                    <p class="text-xs text-text-tertiary">TVDB #{result.tvdbId} · {result.year ?? "Year unknown"}</p>
                                    <Show when={result.overview}><p class="mt-1 line-clamp-2 text-xs text-text-secondary">{result.overview}</p></Show>
                                </div>
                            </button>
                        )}
                    </For>
                </div>
            </Show>
            <Show when={open() && searchQuery.isLoading}>
                <div class="absolute z-50 mt-1 w-full bg-surface-2 border border-border-default rounded-xl shadow-xl px-4 py-3">
                    <p class="text-sm text-text-secondary animate-pulse">Searching TVDB...</p>
                </div>
            </Show>
        </div>
    );
}
