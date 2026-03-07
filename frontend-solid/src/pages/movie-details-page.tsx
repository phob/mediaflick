import { A, useParams } from "@solidjs/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { Film, FolderTree, GalleryVerticalEnd, Star } from "lucide-solid";
import { For, Show, createMemo, createSignal, type ParentProps } from "solid-js";
import { IdentifyModal } from "@/components/identify-modal";
import { FileRowIdentity, Pill, RowSkeleton, SourceSubgroupSeparator, StatusBadge } from "@/components/common-ui";
import { CastPanel, DetailPageBackdrop } from "@/components/media-shared";
import { mediaApi } from "@/lib/api";
import {
    annotateFilesWithSourceDividers,
    backdropUrl,
    formatBytes,
    formatRating,
    formatReleaseDate,
    formatRuntime,
    posterUrl,
} from "@/lib/media-helpers";
import type { ScannedFile } from "@/lib/types";

function showStatusVariant(status: string | null | undefined): "default" | "success" | "info" | "warning" | "error" {
    const normalized = status?.trim().toLowerCase();
    if (normalized === "released") return "success";
    if (normalized === "post production") return "info";
    if (normalized === "planned" || normalized === "in production") return "warning";
    if (normalized === "canceled") return "error";
    return "default";
}

function sumFileSizes(files: ScannedFile[] | undefined): number {
    return (files ?? []).reduce((total, file) => total + (file.fileSize ?? 0), 0);
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

function MovieFileRow(props: {
    file: ScannedFile;
    showMarkExtra?: boolean;
    onMarkExtra?: (id: number) => void;
    disabled?: boolean;
    sourceDividerPath?: string | null;
}) {
    return (
        <>
            <Show when={props.sourceDividerPath}>{(p) => <SourceSubgroupSeparator sourcePath={p()} />}</Show>
            <div class="flex items-start justify-between gap-4 rounded-[1.1rem] border border-border-subtle bg-surface-0/35 px-4 py-3">
                <FileRowIdentity file={props.file} />
                <div class="flex shrink-0 flex-wrap items-center gap-1.5">
                    <Pill>{formatBytes(props.file.fileSize)}</Pill>
                    <StatusBadge status={props.file.status} />
                    <Show when={props.showMarkExtra}>
                        <button
                            disabled={props.disabled}
                            onClick={() => props.onMarkExtra?.(props.file.id)}
                            class="inline-flex min-h-11 items-center justify-center rounded-lg border border-border-default bg-surface-3 px-3 py-2 text-xs text-text-secondary transition hover:border-border-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Mark as extra
                        </button>
                    </Show>
                </div>
            </div>
        </>
    );
}

export default function MovieDetailsPage() {
    const params = useParams();
    const queryClient = useQueryClient();
    const tmdbId = createMemo(() => Number(params.tmdbId));
    const [reassignOpen, setReassignOpen] = createSignal(false);

    const movieQuery = useQuery(() => ({ queryKey: ["movie", tmdbId()], queryFn: () => mediaApi.getMovie(tmdbId()), enabled: Number.isInteger(tmdbId()) && tmdbId() > 0 }));
    const filesQuery = useQuery(() => ({ queryKey: ["movie-files", tmdbId()], queryFn: () => mediaApi.getMovieFiles(tmdbId()), enabled: Number.isInteger(tmdbId()) && tmdbId() > 0 }));
    const markExtraMutation = useMutation(() => ({
        mutationFn: (fileId: number) => mediaApi.markAsExtra(fileId),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["movie-files", tmdbId()] }),
                queryClient.invalidateQueries({ queryKey: ["titles"] }),
            ]);
        },
    }));

    const primaryFiles = createMemo(() => filesQuery.data?.primaryFiles ?? []);
    const extraFiles = createMemo(() => filesQuery.data?.extraFiles ?? []);
    const primarySize = createMemo(() => formatBytes(sumFileSizes(primaryFiles())));
    const relatedSize = createMemo(() => formatBytes(sumFileSizes(extraFiles())));

    return (
        <section class="relative isolate space-y-6">
            <DetailPageBackdrop backdropPath={movieQuery.data?.backdropPath} />
            <div class="relative z-10 space-y-6">
                <A href="/movies" class="inline-flex items-center gap-1 text-sm text-accent transition hover:text-accent-hover"><span>&larr;</span> Back to movies</A>
                <Show when={movieQuery.isLoading}><div class="space-y-4"><div class="skeleton h-56 rounded-[2rem]" /><div class="skeleton h-8 w-64 rounded-lg" /></div></Show>
                <Show when={movieQuery.isError}><p class="text-error text-sm">Unable to load movie details.</p></Show>

                <Show when={movieQuery.data}>
                    {(movie) => (
                        <>
                            <section class="relative overflow-hidden rounded-[2rem] border border-border-subtle bg-[linear-gradient(140deg,rgba(249,115,22,0.08),transparent_38%),linear-gradient(180deg,rgba(13,18,27,0.96),rgba(8,12,18,0.98))] shadow-[0_30px_90px_rgba(0,0,0,0.28)]">
                                <Show when={backdropUrl(movie().backdropPath)}>
                                    {(url) => <img src={url()} alt="" class="absolute inset-0 h-full w-full object-cover opacity-20" />}
                                </Show>
                                <div class="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,12,18,0.12),rgba(8,12,18,0.4)_38%,rgba(8,12,18,0.94)_100%)]" />
                                <div class="relative grid gap-6 px-5 py-5 md:px-7 md:py-7 xl:grid-cols-[15rem_1fr]">
                                    <div class="mx-auto w-full max-w-[15rem] xl:mx-0">
                                        <Show
                                            when={posterUrl(movie().posterPath, "w500")}
                                            fallback={<div class="flex aspect-[2/3] items-center justify-center rounded-[1.6rem] border border-border-default bg-surface-3 text-center text-sm uppercase tracking-[0.14em] text-text-tertiary">No poster</div>}
                                        >
                                            {(url) => <img src={url()} alt={movie().title} class="aspect-[2/3] w-full rounded-[1.6rem] border border-border-default object-cover shadow-[0_24px_60px_rgba(0,0,0,0.32)]" />}
                                        </Show>
                                    </div>

                                    <div class="space-y-5">
                                        <div class="flex flex-wrap items-center justify-between gap-3">
                                            <div class="inline-flex flex-wrap items-center gap-2">
                                                <Pill variant="success">Movie</Pill>
                                                <Pill variant={showStatusVariant(movie().status)}>Status: {movie().status ?? "Unknown"}</Pill>
                                                <Pill>TMDb {movie().tmdbId}</Pill>
                                                <Pill>IMDb {movie().imdbId ?? "n/a"}</Pill>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setReassignOpen(true)}
                                                class="inline-flex min-h-11 items-center justify-center rounded-xl border border-border-default bg-surface-0/45 px-4 py-2 text-sm text-text-secondary transition hover:border-border-hover hover:text-text-primary"
                                            >
                                                Reassign Movie
                                            </button>
                                        </div>

                                        <div>
                                            <p class="text-[0.72rem] font-mono uppercase tracking-[0.24em] text-text-tertiary">Film dossier</p>
                                            <h1 class="mt-2 text-4xl font-semibold leading-[0.94] text-text-primary md:text-5xl">{movie().title}</h1>
                                            <p class="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary">
                                                {movie().tagline ? `${movie().tagline} ` : ""}
                                                {movie().overview ?? "No TMDb overview is available for this movie yet."}
                                            </p>
                                        </div>

                                        <div class="flex flex-wrap gap-2">
                                            <For each={movie().genres}>
                                                {(genre) => <Pill>{genre}</Pill>}
                                            </For>
                                            <Show when={(movie().genres?.length ?? 0) === 0}><Pill>No genres</Pill></Show>
                                        </div>

                                        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                            <DetailMetricTile label="Release" value={formatReleaseDate(movie().releaseDate)} detail={movie().year ? `Year ${movie().year}` : "Year unknown"} accent="orange" />
                                            <DetailMetricTile label="Runtime" value={formatRuntime(movie().runtimeMinutes)} detail="Runtime from TMDb metadata." accent="cyan" />
                                            <DetailMetricTile label="Rating" value={formatRating(movie().voteAverage)} detail={`${movie().voteCount?.toLocaleString() ?? "0"} votes recorded.`} accent="lime" />
                                            <DetailMetricTile label="Library files" value={String(primaryFiles().length)} detail={`${extraFiles().length} related files beside the main title.`} accent="rose" />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <div class="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                                <DetailPanel eyebrow="Story" title="Overview">
                                    <div class="space-y-3">
                                        <Show when={movie().tagline}>
                                            {(tagline) => <p class="text-lg italic text-accent">{tagline()}</p>}
                                        </Show>
                                        <p class="text-sm leading-relaxed text-text-secondary">{movie().overview ?? "No TMDb overview is available for this movie yet."}</p>
                                    </div>
                                </DetailPanel>

                                <DetailPanel eyebrow="Signals" title="Catalog summary">
                                    <div class="grid gap-3 sm:grid-cols-2">
                                        <div class="rounded-[1.2rem] border border-border-subtle bg-surface-0/30 px-4 py-4">
                                            <div class="flex items-center gap-2 text-text-primary"><Star size={16} class="text-warning" /><span class="text-sm font-medium">Votes</span></div>
                                            <p class="mt-2 text-xl font-semibold text-text-primary">{movie().voteCount?.toLocaleString() ?? "N/A"}</p>
                                            <p class="mt-1 text-sm text-text-secondary">Audience vote count from TMDb.</p>
                                        </div>
                                        <div class="rounded-[1.2rem] border border-border-subtle bg-surface-0/30 px-4 py-4">
                                            <div class="flex items-center gap-2 text-text-primary"><Film size={16} class="text-accent" /><span class="text-sm font-medium">Language</span></div>
                                            <p class="mt-2 text-xl font-semibold text-text-primary">{movie().originalLanguage?.toUpperCase() ?? "N/A"}</p>
                                            <p class="mt-1 text-sm text-text-secondary">Original language recorded for the release.</p>
                                        </div>
                                        <div class="rounded-[1.2rem] border border-border-subtle bg-surface-0/30 px-4 py-4">
                                            <div class="flex items-center gap-2 text-text-primary"><FolderTree size={16} class="text-info" /><span class="text-sm font-medium">Primary files</span></div>
                                            <p class="mt-2 text-xl font-semibold text-text-primary">{primarySize()}</p>
                                            <p class="mt-1 text-sm text-text-secondary">Storage represented by directly mapped movie files.</p>
                                        </div>
                                        <div class="rounded-[1.2rem] border border-border-subtle bg-surface-0/30 px-4 py-4">
                                            <div class="flex items-center gap-2 text-text-primary"><GalleryVerticalEnd size={16} class="text-success" /><span class="text-sm font-medium">Related files</span></div>
                                            <p class="mt-2 text-xl font-semibold text-text-primary">{relatedSize()}</p>
                                            <p class="mt-1 text-sm text-text-secondary">Same-folder extras and adjacent files visible from this title.</p>
                                        </div>
                                    </div>
                                </DetailPanel>
                            </div>

                            <CastPanel cast={movie().cast} />

                            <div class="grid gap-5 xl:grid-cols-2">
                                <DetailPanel eyebrow="Library files" title="Main movie files" aside={`${primaryFiles().length} items`}>
                                    <Show when={filesQuery.isLoading}><div class="space-y-3"><For each={Array(2)}>{() => <RowSkeleton />}</For></div></Show>
                                    <Show when={primaryFiles().length === 0}><p class="py-6 text-center text-sm text-text-tertiary">No direct movie files are currently mapped.</p></Show>
                                    <div class="space-y-1.5">
                                        <For each={annotateFilesWithSourceDividers(primaryFiles())}>
                                            {(entry) => (
                                                <MovieFileRow
                                                    file={entry.file}
                                                    sourceDividerPath={entry.sourceDividerPath}
                                                    showMarkExtra
                                                    onMarkExtra={(id) => markExtraMutation.mutate(id)}
                                                    disabled={markExtraMutation.isPending}
                                                />
                                            )}
                                        </For>
                                    </div>
                                </DetailPanel>

                                <DetailPanel eyebrow="Adjacent media" title="Related files" aside={`${extraFiles().length} items`}>
                                    <p class="mb-3 text-sm text-text-secondary">Files visible under this movie because they share the same source folders.</p>
                                    <Show when={extraFiles().length === 0}><p class="py-6 text-center text-sm text-text-tertiary">No related files detected.</p></Show>
                                    <div class="space-y-1.5">
                                        <For each={annotateFilesWithSourceDividers(extraFiles())}>
                                            {(entry) => (
                                                <MovieFileRow
                                                    file={entry.file}
                                                    sourceDividerPath={entry.sourceDividerPath}
                                                    showMarkExtra={entry.file.mediaType !== "Extras"}
                                                    onMarkExtra={(id) => markExtraMutation.mutate(id)}
                                                    disabled={markExtraMutation.isPending}
                                                />
                                            )}
                                        </For>
                                    </div>
                                </DetailPanel>
                            </div>

                            <IdentifyModal
                                open={reassignOpen()}
                                onClose={() => {
                                    setReassignOpen(false);
                                    void queryClient.invalidateQueries({ queryKey: ["movie", tmdbId()] });
                                    void queryClient.invalidateQueries({ queryKey: ["movie-files", tmdbId()] });
                                    void queryClient.invalidateQueries({ queryKey: ["titles"] });
                                }}
                                initialMode="Movies"
                                files={primaryFiles()}
                            />
                        </>
                    )}
                </Show>
            </div>
        </section>
    );
}
