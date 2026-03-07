import { A } from "@solidjs/router";
import { For, Show, createMemo, type JSXElement, type ParentProps } from "solid-js";
import { Pill } from "@/components/common-ui";
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

type HeroAccent = "orange" | "cyan" | "lime" | "rose";

function accentStyles(accent: HeroAccent | undefined): { shell: string; background: string } {
    if (accent === "cyan") {
        return {
            shell: "border-info/28",
            background: "radial-gradient(circle at top right, rgb(34 211 238 / 0.18), transparent 42%), linear-gradient(180deg, rgb(10 22 31 / 0.96), rgb(8 12 18 / 0.92))",
        };
    }
    if (accent === "lime") {
        return {
            shell: "border-success/28",
            background: "radial-gradient(circle at top right, rgb(34 197 94 / 0.16), transparent 42%), linear-gradient(180deg, rgb(9 24 20 / 0.96), rgb(8 12 18 / 0.92))",
        };
    }
    if (accent === "rose") {
        return {
            shell: "border-error/28",
            background: "radial-gradient(circle at top right, rgb(251 113 133 / 0.16), transparent 42%), linear-gradient(180deg, rgb(27 14 22 / 0.96), rgb(8 12 18 / 0.92))",
        };
    }
    return {
        shell: "border-accent/28",
        background: "radial-gradient(circle at top right, rgb(249 115 22 / 0.18), transparent 42%), linear-gradient(180deg, rgb(29 18 12 / 0.96), rgb(8 12 18 / 0.92))",
    };
}

export function CollectionHero(props: {
    eyebrow?: string;
    title: string;
    subtitle: string;
    searchValue: string;
    onSearch: (next: string) => void;
    searchPlaceholder?: string;
    statusLabel?: string;
    stats?: Array<{ label: string; value: string; detail: string; accent?: HeroAccent }>;
}) {
    return (
        <section class="relative mb-6 overflow-hidden rounded-[2rem] border border-border-subtle bg-[linear-gradient(140deg,rgba(249,115,22,0.1),transparent_42%),linear-gradient(180deg,rgba(13,18,27,0.95),rgba(7,11,18,0.98))] px-5 py-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] md:px-7 md:py-6">
            <div class="pointer-events-none absolute -right-14 top-0 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />
            <div class="pointer-events-none absolute bottom-[-3rem] left-[-2rem] h-36 w-36 rounded-full bg-info/10 blur-3xl" />
            <div class="relative grid gap-5 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
                <div>
                    <p class="section-kicker">{props.eyebrow ?? "Curation Desk"}</p>
                    <h1 class="section-title">{props.title}</h1>
                    <p class="section-subtitle max-w-3xl">{props.subtitle}</p>
                </div>
                <div class="grid gap-3 md:grid-cols-[1fr_auto] xl:justify-items-end">
                    <div class="search-shell max-w-full xl:min-w-[22rem]">
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
                            placeholder={props.searchPlaceholder ?? "Search titles..."}
                            aria-label={`Search ${props.title}`}
                        />
                    </div>
                    <Show when={props.statusLabel}>
                        {(label) => <div class="inline-flex items-center justify-center rounded-full border border-border-default bg-surface-0/55 px-3 py-2 text-xs font-mono uppercase tracking-[0.16em] text-text-secondary">{label()}</div>}
                    </Show>
                </div>
            </div>

            <Show when={(props.stats?.length ?? 0) > 0}>
                <div class="relative mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <For each={props.stats ?? []}>
                        {(stat) => {
                            const styles = accentStyles(stat.accent);
                            return (
                                <article
                                    class={`relative overflow-hidden rounded-[1.35rem] border px-4 py-4 backdrop-blur-sm ${styles.shell}`}
                                    style={{ background: styles.background }}
                                >
                                    <div class="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_36%,rgba(255,255,255,0.01)_100%)]" />
                                    <div class="relative space-y-1.5">
                                        <p class="text-[0.64rem] font-mono uppercase tracking-[0.18em] text-text-tertiary">{stat.label}</p>
                                        <p class="text-2xl font-semibold leading-none text-text-primary">{stat.value}</p>
                                        <p class="text-sm leading-snug text-text-secondary">{stat.detail}</p>
                                    </div>
                                </article>
                            );
                        }}
                    </For>
                </div>
            </Show>
        </section>
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

export function MediaShelfCard(props: ParentProps<{
    href: string;
    title: string;
    posterPath: string | null | undefined;
    eyebrow?: string;
    subtitle?: string | null;
    footer?: string | null;
    topRight?: JSXElement;
    tone?: "movie" | "tv";
}>) {
    const url = () => posterUrl(props.posterPath);
    const toneGlow = () => (props.tone === "tv" ? "bg-info/14" : "bg-accent/14");

    return (
        <A
            href={props.href}
            class="group relative block overflow-hidden rounded-[1.55rem] border border-border-subtle bg-surface-2 shadow-[0_18px_48px_rgba(0,0,0,0.18)] transition duration-200 hover:-translate-y-1 hover:border-border-hover hover:shadow-[0_24px_60px_rgba(0,0,0,0.32)]"
        >
            <div class="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_26%,rgba(255,255,255,0.02)_100%)] opacity-0 transition duration-300 group-hover:opacity-100" />
            <div class={`absolute inset-x-0 top-0 h-24 ${toneGlow()}`} />
            <div class="relative aspect-[0.76]">
                <Show when={url()} fallback={<div class="poster-fallback"><span>{props.title}</span></div>}>
                    {(src) => <img src={src()} alt={props.title} loading="lazy" class="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />}
                </Show>
                <div class="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,8,11,0.08),rgba(6,8,11,0.12)_28%,rgba(6,8,11,0.92)_100%)]" />
                <div class="absolute inset-x-0 top-0 z-2 flex items-start justify-between gap-3 px-4 py-4">
                    <Show when={props.eyebrow}>
                        {(eyebrow) => <Pill variant={props.tone === "tv" ? "info" : "default"}>{eyebrow()}</Pill>}
                    </Show>
                    <Show when={props.topRight}>{(slot) => <div>{slot()}</div>}</Show>
                </div>
                <div class="absolute inset-x-0 bottom-0 z-2 space-y-3 px-4 pb-4 pt-20">
                    <div>
                        <h3 class="line-clamp-2 text-lg font-semibold leading-tight text-white">{props.title}</h3>
                        <Show when={props.subtitle}><p class="mt-1 text-sm text-white/72 line-clamp-2">{props.subtitle}</p></Show>
                    </div>
                    <Show when={props.children}>
                        <div class="rounded-[1rem] border border-white/10 bg-black/28 p-3 backdrop-blur-sm">{props.children}</div>
                    </Show>
                    <Show when={props.footer}><p class="text-[0.72rem] font-mono uppercase tracking-[0.14em] text-white/58">{props.footer}</p></Show>
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
                <div class="flex items-center justify-between gap-3">
                    <div>
                        <p class="text-[0.68rem] font-mono uppercase tracking-[0.18em] text-text-tertiary">Ensemble</p>
                        <h2 class="text-xl font-semibold text-text-primary">Cast</h2>
                    </div>
                    <Pill>{cast().length} featured</Pill>
                </div>
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <For each={cast()}>
                        {(member) => (
                            <article class="flex items-center gap-3 rounded-[1.1rem] border border-border-subtle bg-surface-1/88 px-3.5 py-3 shadow-[0_12px_34px_rgba(0,0,0,0.18)]">
                                <Show
                                    when={posterUrl(member.profilePath, "w185")}
                                    fallback={<div class="flex h-14 w-14 items-center justify-center rounded-xl border border-border-default bg-surface-3 text-[0.62rem] font-mono uppercase tracking-wider text-text-tertiary">Cast</div>}
                                >
                                    {(url) => <img src={url()} alt={member.name} loading="lazy" class="h-14 w-14 rounded-xl border border-border-default object-cover" />}
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
                <div class="pointer-events-none fixed inset-0 overflow-hidden z-1">
                    <div class="absolute inset-0 bg-cover bg-center scale-110 opacity-30" style={{ "background-image": `url(${src()})` }} />
                    <div class="absolute inset-0 bg-linear-to-b from-surface-0/14 via-surface-1/78 to-surface-1" />
                    <div class="absolute inset-0 bg-[radial-gradient(circle_at_84%_10%,rgb(249_115_22/0.2),transparent_52%),radial-gradient(circle_at_16%_84%,rgb(34_211_238/0.14),transparent_44%)]" />
                </div>
            )}
        </Show>
    );
}
