import { A } from "@solidjs/router";
import { For, Show, createMemo } from "solid-js";
import { backdropUrl, posterUrl } from "@/lib/media-helpers";
import type { MediaCastMember } from "@/lib/types";

export function MediaSearchHeader(props: {
    title: string;
    subtitle: string;
    searchValue: string;
    onSearch: (next: string) => void;
}) {
    return (
        <div class="media-header flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
                <p class="section-kicker">Curation Desk</p>
                <h1 class="section-title">{props.title}</h1>
                <p class="section-subtitle">{props.subtitle}</p>
            </div>
            <div class="search-shell">
                <span class="search-icon" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-4 h-4">
                        <circle cx="11" cy="11" r="7" />
                        <path d="m20 20-3.8-3.8" />
                    </svg>
                </span>
                <input
                    value={props.searchValue}
                    onInput={(e) => props.onSearch(e.currentTarget.value)}
                    class="search-input"
                    placeholder="Search titles..."
                    aria-label={`Search ${props.title}`}
                />
            </div>
        </div>
    );
}

export function PosterCard(props: { href: string; title: string; posterPath: string | null | undefined; subtitle?: string }) {
    const url = () => posterUrl(props.posterPath);
    return (
        <A href={props.href} class="poster-card group block">
            <div class="aspect-2/3 relative">
                <Show when={url()} fallback={<div class="poster-fallback"><span>{props.title}</span></div>}>
                    {(src) => <img src={src()} alt={props.title} loading="lazy" class="absolute inset-0 w-full h-full object-cover transition-transform duration-300" />}
                </Show>
                <div class="poster-caption">
                    <p class="text-sm font-semibold text-white leading-tight line-clamp-2">{props.title}</p>
                    <Show when={props.subtitle}><p class="text-xs text-white/60 mt-0.5">{props.subtitle}</p></Show>
                </div>
            </div>
        </A>
    );
}

export function CastPanel(props: { cast: MediaCastMember[] | null | undefined }) {
    const cast = createMemo(() => (props.cast ?? []).slice(0, 14));

    return (
        <Show when={cast().length > 0}>
            <section class="space-y-3">
                <h2 class="text-lg font-bold">Cast</h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    <For each={cast()}>
                        {(member) => (
                            <article class="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-2 px-3 py-2.5">
                                <Show
                                    when={posterUrl(member.profilePath, "w185")}
                                    fallback={<div class="w-12 h-12 rounded-md bg-surface-3 border border-border-default flex items-center justify-center text-[0.62rem] text-text-tertiary font-mono uppercase tracking-wider">Cast</div>}
                                >
                                    {(url) => <img src={url()} alt={member.name} loading="lazy" class="w-12 h-12 rounded-md object-cover border border-border-default" />}
                                </Show>
                                <div class="min-w-0">
                                    <p class="text-sm font-semibold text-text-primary truncate">{member.name}</p>
                                    <p class="text-xs text-text-secondary truncate">{member.character ?? "Character unknown"}</p>
                                </div>
                            </article>
                        )}
                    </For>
                </div>
            </section>
        </Show>
    );
}

export function DetailPageBackdrop(props: { backdropPath: string | null | undefined }) {
    const url = createMemo(() => backdropUrl(props.backdropPath));

    return (
        <Show when={url()}>
            {(src) => (
                <div class="pointer-events-none fixed inset-0 overflow-hidden z-[1]">
                    <div class="absolute inset-0 bg-cover bg-center scale-110 opacity-32" style={{ "background-image": `url(${src()})` }} />
                    <div class="absolute inset-0 bg-linear-to-b from-surface-0/22 via-surface-1/72 to-surface-1" />
                    <div class="absolute inset-0 bg-[radial-gradient(circle_at_84%_10%,rgb(249_115_22_/_0.2),transparent_54%)]" />
                </div>
            )}
        </Show>
    );
}
