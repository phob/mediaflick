import { A, useParams } from "@solidjs/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { For, Show, createMemo, createSignal } from "solid-js";
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
    if (normalized === "returning series" || normalized === "in production") return "info";
    if (normalized === "canceled") return "error";
    if (normalized === "planned" || normalized === "pilot") return "warning";
    return "default";
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
            <div class="flex items-start justify-between gap-4 bg-surface-2 border border-border-subtle rounded-lg px-4 py-3">
                <FileRowIdentity file={props.file} />
                <div class="flex flex-wrap items-center gap-1.5 shrink-0">
                    <Pill>{formatBytes(props.file.fileSize)}</Pill>
                    <StatusBadge status={props.file.status} />
                    <Show when={props.showMarkExtra}>
                        <button disabled={props.disabled} onClick={() => props.onMarkExtra?.(props.file.id)} class="inline-flex items-center justify-center min-h-11 px-3 py-2 text-xs rounded-lg border border-border-default bg-surface-3 text-text-secondary hover:text-text-primary hover:border-border-hover disabled:opacity-40 disabled:cursor-not-allowed transition">Mark as extra</button>
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

    return (
        <section class="space-y-6 relative isolate">
            <DetailPageBackdrop backdropPath={movieQuery.data?.backdropPath} />
            <div class="relative z-10 space-y-6">
                <A href="/movies" class="inline-flex items-center gap-1 text-sm text-accent hover:text-accent-hover transition"><span>&larr;</span> Back to movies</A>
                <Show when={movieQuery.isLoading}><div class="space-y-4"><div class="skeleton h-48 rounded-2xl" /><div class="skeleton h-8 w-64 rounded-lg" /></div></Show>
                <Show when={movieQuery.isError}><p class="text-error text-sm">Unable to load movie details.</p></Show>

                <Show when={movieQuery.data}>
                    {(movie) => (
                        <>
                            <div class="relative rounded-2xl overflow-hidden bg-surface-2 border border-border-subtle">
                                <Show when={backdropUrl(movie().backdropPath)}>{(url) => <img src={url()} alt="" class="w-full h-48 sm:h-64 object-cover" />}</Show>
                                <div class="absolute inset-0 bg-linear-to-t from-surface-1 via-surface-1/60 to-transparent" />
                                <div class="relative px-5 pb-5 pt-4 flex flex-wrap items-end justify-between gap-4 -mt-20">
                                    <div class="flex items-end gap-4">
                                        <Show when={posterUrl(movie().posterPath, "w185")}>{(url) => <img src={url()} alt={movie().title} class="w-24 rounded-lg shadow-xl border-2 border-surface-1 hidden sm:block" />}</Show>
                                        <div><h1 class="text-2xl font-bold">{movie().title}</h1><p class="text-sm text-text-secondary mt-1">{movie().year ?? "Year unknown"} · {movie().genres.join(", ") || "No genres"}</p></div>
                                    </div>
                                    <div class="flex flex-wrap items-center gap-2">
                                        <Pill>TMDb {movie().tmdbId}</Pill>
                                        <Pill>IMDb {movie().imdbId ?? "n/a"}</Pill>
                                        <Pill>Runtime: {formatRuntime(movie().runtimeMinutes)}</Pill>
                                        <Pill>Rating: {formatRating(movie().voteAverage)}</Pill>
                                        <button type="button" onClick={() => setReassignOpen(true)} class="px-3 py-1.5 text-xs rounded-lg border border-border-default bg-surface-2/80 text-text-secondary hover:text-text-primary hover:border-border-hover transition">Reassign Movie</button>
                                    </div>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
                                <article class="bg-surface-2 border border-border-subtle rounded-xl p-4 space-y-2.5">
                                    <h2 class="text-base font-bold">Story</h2>
                                    <Show when={movie().tagline}>{(tagline) => <p class="text-sm text-accent italic">{tagline()}</p>}</Show>
                                    <p class="text-sm text-text-secondary leading-relaxed">{movie().overview ?? "No TMDb overview is available for this movie yet."}</p>
                                </article>
                                <article class="bg-surface-2 border border-border-subtle rounded-xl p-4 space-y-3">
                                    <h2 class="text-base font-bold">Movie Details</h2>
                                    <div class="grid grid-cols-2 gap-2 text-sm">
                                        <div class="rounded-lg border border-border-subtle bg-surface-1 px-3 py-2"><p class="text-[0.68rem] uppercase tracking-wide text-text-tertiary">Release Date</p><p class="text-text-primary font-semibold mt-1">{formatReleaseDate(movie().releaseDate)}</p></div>
                                        <div class="rounded-lg border border-border-subtle bg-surface-1 px-3 py-2"><p class="text-[0.68rem] uppercase tracking-wide text-text-tertiary">Runtime</p><p class="text-text-primary font-semibold mt-1">{formatRuntime(movie().runtimeMinutes)}</p></div>
                                        <div class="rounded-lg border border-border-subtle bg-surface-1 px-3 py-2"><p class="text-[0.68rem] uppercase tracking-wide text-text-tertiary">Rating</p><p class="text-text-primary font-semibold mt-1">{formatRating(movie().voteAverage)}</p></div>
                                        <div class="rounded-lg border border-border-subtle bg-surface-1 px-3 py-2"><p class="text-[0.68rem] uppercase tracking-wide text-text-tertiary">Language</p><p class="text-text-primary font-semibold mt-1">{movie().originalLanguage?.toUpperCase() ?? "N/A"}</p></div>
                                    </div>
                                    <div class="flex flex-wrap items-center gap-2"><Pill>Votes: {movie().voteCount?.toLocaleString() ?? "N/A"}</Pill><Pill variant={showStatusVariant(movie().status)}>Status: {movie().status ?? "Unknown"}</Pill></div>
                                </article>
                            </div>

                            <CastPanel cast={movie().cast} />

                            <div class="space-y-4">
                                <h2 class="text-lg font-bold">Main Movie Files</h2>
                                <Show when={filesQuery.isLoading}><div class="space-y-3"><For each={Array(2)}>{() => <RowSkeleton />}</For></div></Show>
                                <Show when={(filesQuery.data?.primaryFiles.length ?? 0) === 0}><p class="text-text-tertiary text-sm py-4 text-center">No direct movie files are currently mapped.</p></Show>
                                <div class="space-y-1.5">
                                    <For each={annotateFilesWithSourceDividers(filesQuery.data?.primaryFiles ?? [])}>{(entry) => <MovieFileRow file={entry.file} sourceDividerPath={entry.sourceDividerPath} showMarkExtra onMarkExtra={(id) => markExtraMutation.mutate(id)} disabled={markExtraMutation.isPending} />}</For>
                                </div>
                            </div>

                            <div class="space-y-4">
                                <h2 class="text-lg font-bold">Related Files</h2>
                                <p class="text-xs text-text-secondary">Files visible under this movie because they share source folders.</p>
                                <Show when={(filesQuery.data?.extraFiles.length ?? 0) === 0}><p class="text-text-tertiary text-sm py-4 text-center">No related files detected.</p></Show>
                                <div class="space-y-1.5">
                                    <For each={annotateFilesWithSourceDividers(filesQuery.data?.extraFiles ?? [])}>{(entry) => <MovieFileRow file={entry.file} sourceDividerPath={entry.sourceDividerPath} showMarkExtra={entry.file.mediaType !== "Extras"} onMarkExtra={(id) => markExtraMutation.mutate(id)} disabled={markExtraMutation.isPending} />}</For>
                                </div>
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
                                files={filesQuery.data?.primaryFiles ?? []}
                            />
                        </>
                    )}
                </Show>
            </div>
        </section>
    );
}
