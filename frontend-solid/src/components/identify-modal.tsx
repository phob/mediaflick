import { useQueryClient } from "@tanstack/solid-query";
import { For, Show, createEffect, createSignal } from "solid-js";
import { TmdbSearchInput } from "@/components/tmdb-search-input";
import { mediaApi } from "@/lib/api";
import { parseEpisodeInfo } from "@/lib/filename-parser";
import { fileName } from "@/lib/media-helpers";
import type {
    BulkUpdateApplyResponse,
    BulkUpdateItem,
    BulkUpdateRequest,
    MediaSearchResult,
    MediaStatus,
    MediaType,
    ScannedFile,
} from "@/lib/types";

interface EditableFile {
    id: number;
    sourceFile: string;
    status: MediaStatus;
    tmdbId: number | null;
    seasonNumber: number | null;
    episodeNumber: number | null;
    episodeNumber2: number | null;
    mediaType: MediaType | null;
    confidence: "high" | "medium" | "low";
    ignoreAutoIncrement: boolean;
}

export function IdentifyModal(props: {
    open: boolean;
    onClose: () => void;
    initialMode: "TvShows" | "Movies";
    files: ScannedFile[];
    preselectedTmdbId?: number;
    reassignOldTmdbId?: number;
}) {
    const queryClient = useQueryClient();
    const [mode, setMode] = createSignal<"TvShows" | "Movies">(props.initialMode);
    const [selectedMedia, setSelectedMedia] = createSignal<MediaSearchResult | null>(null);
    const [editableFiles, setEditableFiles] = createSignal<EditableFile[]>([]);
    const [saving, setSaving] = createSignal(false);
    const [saveResult, setSaveResult] = createSignal<string | null>(null);
    const [showDryRun, setShowDryRun] = createSignal(false);
    const [dryRunInfo, setDryRunInfo] = createSignal<string | null>(null);

    createEffect(() => {
        if (!props.open || props.files.length === 0) return;
        setMode(props.initialMode);
        setSaveResult(null);
        setShowDryRun(false);
        setDryRunInfo(null);

        const parsed = props.files
            .slice()
            .sort((a, b) => a.sourceFile.localeCompare(b.sourceFile))
            .map((file) => {
                const info = parseEpisodeInfo(file.sourceFile);
                return {
                    id: file.id,
                    sourceFile: file.sourceFile,
                    status: file.status,
                    tmdbId: file.tmdbId,
                    seasonNumber: file.seasonNumber ?? info.season ?? null,
                    episodeNumber: file.episodeNumber ?? info.episode ?? null,
                    episodeNumber2: file.episodeNumber2 ?? info.episode2 ?? null,
                    mediaType: file.mediaType,
                    confidence: file.seasonNumber || file.episodeNumber ? "high" as const : info.confidence,
                    ignoreAutoIncrement: false,
                };
            });
        setEditableFiles(parsed);

        if (props.preselectedTmdbId) setSelectedMedia(null);
    });

    const handleTvMediaSelect = (result: MediaSearchResult) => {
        setSelectedMedia(result);
        setEditableFiles((prev) => prev.map((f) => ({ ...f, tmdbId: result.tmdbId })));
    };

    const handleMovieMediaSelect = (index: number, result: MediaSearchResult) => {
        setEditableFiles((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], tmdbId: result.tmdbId };
            return next;
        });
    };

    const handleSeasonChange = (index: number, value: string) => {
        const seasonNumber = value === "" ? null : Number(value);
        setEditableFiles((prev) => {
            const next = [...prev];
            for (let i = index; i < next.length; i += 1) next[i] = { ...next[i], seasonNumber };
            return next;
        });
    };

    const handleEpisodeChange = (index: number, value: string) => {
        const episodeNumber = value === "" ? null : Number(value);
        setEditableFiles((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], episodeNumber };
            if (episodeNumber !== null) {
                const currentSeason = next[index].seasonNumber;
                let nextEp = episodeNumber + 1;
                for (let i = index + 1; i < next.length; i += 1) {
                    if (next[i].seasonNumber === currentSeason && !next[i].ignoreAutoIncrement) {
                        next[i] = { ...next[i], episodeNumber: nextEp };
                        nextEp += 1;
                    }
                }
            }
            return next;
        });
    };

    const handleEpisode2Change = (index: number, value: string) => {
        setEditableFiles((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], episodeNumber2: value === "" ? null : Number(value) };
            return next;
        });
    };

    const handleIgnoreChange = (index: number, checked: boolean) => {
        setEditableFiles((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], ignoreAutoIncrement: checked };
            return next;
        });
    };

    const buildRequest = (dryRun: boolean): BulkUpdateRequest => {
        const updates: BulkUpdateItem[] = editableFiles().map((f) => ({
            id: f.id,
            tmdbId: f.tmdbId ?? undefined,
            seasonNumber: mode() === "TvShows" ? (f.seasonNumber ?? undefined) : undefined,
            episodeNumber: mode() === "TvShows" ? (f.episodeNumber ?? undefined) : undefined,
            episodeNumber2: mode() === "TvShows" ? (f.episodeNumber2 ?? undefined) : undefined,
            mediaType: mode(),
        }));

        const req: BulkUpdateRequest = { dryRun, updates };
        const media = selectedMedia();
        if (mode() === "TvShows" && props.reassignOldTmdbId && media) {
            req.identityUpdate = {
                oldTmdbId: props.reassignOldTmdbId,
                newTmdbId: media.tmdbId,
                newCanonicalTitle: media.title,
                newYear: media.year,
                newImdbId: null,
            };
        }
        return req;
    };

    const handleDryRun = async () => {
        const req = buildRequest(true);
        try {
            const result = await mediaApi.batchUpdate(req);
            if ("willUpdate" in result) {
                let info = `Will update ${result.willUpdate} of ${result.totalFiles} files.`;
                if (result.conflicts.length > 0) info += ` ${result.conflicts.length} conflict(s): ${result.conflicts.map((c) => c.reason).join(", ")}`;
                if (result.identityUpdate) info += ` Identity: ${result.identityUpdate.identitiesWillUpdate} mapping(s), ${result.identityUpdate.aliasesWillRedirect} alias(es) will redirect.`;
                setDryRunInfo(info);
                setShowDryRun(true);
            }
        } catch (err) {
            setDryRunInfo(`Dry-run failed: ${err instanceof Error ? err.message : "Unknown error"}`);
            setShowDryRun(true);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setSaveResult(null);
        try {
            const req = buildRequest(false);
            const result = (await mediaApi.batchUpdate(req)) as BulkUpdateApplyResponse;
            const parts: string[] = [`Updated ${result.updated} file(s).`];
            if (result.symlinksRecreated > 0) parts.push(`${result.symlinksRecreated} symlink(s) recreated.`);
            if (result.symlinksFailed > 0) parts.push(`${result.symlinksFailed} symlink(s) failed.`);
            if (result.failed.length > 0) parts.push(`${result.failed.length} file(s) failed.`);
            if (result.identityUpdated) parts.push("Series identity updated.");
            setSaveResult(parts.join(" "));

            for (const key of ["titles", "show", "movie", "tv-files", "movie-files", "unidentified-files"]) {
                void queryClient.invalidateQueries({ queryKey: [key] });
            }

            if (result.failed.length === 0) setTimeout(() => props.onClose(), 1500);
        } catch (err) {
            setSaveResult(`Save failed: ${err instanceof Error ? err.message : "Unknown error"}`);
        } finally {
            setSaving(false);
        }
    };

    const confidenceColor = (c: "high" | "medium" | "low") => {
        if (c === "high") return "bg-success";
        if (c === "medium") return "bg-warning";
        return "bg-error";
    };

    return (
        <Show when={props.open}>
            <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={props.onClose}>
                <section class="w-full max-w-6xl max-h-[90vh] bg-surface-1 border border-border-default rounded-2xl shadow-2xl flex flex-col overflow-hidden" role="dialog" aria-modal="true" aria-label="Identify media files" onClick={(e) => e.stopPropagation()}>
                    <header class="flex items-start justify-between gap-4 p-5 border-b border-border-subtle">
                        <div>
                            <h3 class="text-lg font-bold">Identify as {mode() === "TvShows" ? "TV Show" : "Movie"}</h3>
                            <p class="text-sm text-text-secondary mt-0.5">{editableFiles().length} file(s) selected</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <select
                                class="bg-surface-2 border border-border-default rounded-lg px-3 py-1.5 text-sm text-text-primary"
                                value={mode()}
                                onChange={(e) => {
                                    const newMode = e.currentTarget.value as "TvShows" | "Movies";
                                    setMode(newMode);
                                    setSelectedMedia(null);
                                }}
                            >
                                <option value="TvShows">TV Show</option>
                                <option value="Movies">Movie</option>
                            </select>
                            <button type="button" onClick={props.onClose} class="px-3 py-1.5 text-sm rounded-lg border border-border-default bg-surface-2 text-text-secondary hover:text-text-primary hover:border-border-hover transition">Close</button>
                        </div>
                    </header>

                    <Show when={mode() === "TvShows"}>
                        <div class="p-4 border-b border-border-subtle flex items-center gap-4">
                            <TmdbSearchInput mediaType="TvShows" onSelect={handleTvMediaSelect} placeholder="Search for a TV show..." class="flex-1" />
                            <Show when={selectedMedia()}>
                                {(media) => (
                                    <div class="flex items-center gap-2 shrink-0">
                                        <Show when={media().posterPath}>{(poster) => <img src={`https://image.tmdb.org/t/p/w92${poster()}`} alt="" class="w-8 h-12 rounded object-cover" />}</Show>
                                        <div class="text-sm">
                                            <p class="font-medium text-text-primary">{media().title}</p>
                                            <p class="text-xs text-text-tertiary">#{media().tmdbId} · {media().year ?? "?"}</p>
                                        </div>
                                    </div>
                                )}
                            </Show>
                        </div>
                    </Show>

                    <div class="flex-1 overflow-auto min-h-0">
                        <Show when={mode() === "TvShows"}>
                            <table class="w-full text-sm">
                                <thead class="sticky top-0 bg-surface-1 border-b border-border-subtle">
                                    <tr>
                                        <th class="text-left px-4 py-2 text-text-secondary font-medium">File</th>
                                        <th class="text-left px-2 py-2 text-text-secondary font-medium w-16">S</th>
                                        <th class="text-left px-2 py-2 text-text-secondary font-medium w-16">E</th>
                                        <th class="text-left px-2 py-2 text-text-secondary font-medium w-16">E2</th>
                                        <th class="text-center px-2 py-2 text-text-secondary font-medium w-10" title="Skip auto-increment">Skip</th>
                                        <th class="text-center px-2 py-2 text-text-secondary font-medium w-8" title="Parse confidence">C</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <For each={editableFiles()}>
                                        {(file, index) => (
                                            <tr class="border-b border-border-subtle hover:bg-surface-2/50">
                                                <td class="px-4 py-2"><p class="truncate max-w-md" title={file.sourceFile}>{fileName(file.sourceFile)}</p></td>
                                                <td class="px-2 py-2"><input type="number" min="0" class="w-14 bg-surface-3 border border-border-default rounded px-2 py-1 text-sm text-text-primary" value={file.seasonNumber?.toString() ?? ""} onInput={(e) => handleSeasonChange(index(), e.currentTarget.value)} /></td>
                                                <td class="px-2 py-2"><input type="number" min="0" class="w-14 bg-surface-3 border border-border-default rounded px-2 py-1 text-sm text-text-primary" value={file.episodeNumber?.toString() ?? ""} onInput={(e) => handleEpisodeChange(index(), e.currentTarget.value)} /></td>
                                                <td class="px-2 py-2"><input type="number" min="0" class="w-14 bg-surface-3 border border-border-default rounded px-2 py-1 text-sm text-text-primary" value={file.episodeNumber2?.toString() ?? ""} onInput={(e) => handleEpisode2Change(index(), e.currentTarget.value)} /></td>
                                                <td class="px-2 py-2 text-center"><input type="checkbox" checked={file.ignoreAutoIncrement} onChange={(e) => handleIgnoreChange(index(), e.currentTarget.checked)} class="accent-accent" /></td>
                                                <td class="px-2 py-2 text-center"><span class={`inline-block w-2.5 h-2.5 rounded-full ${confidenceColor(file.confidence)}`} title={`${file.confidence} confidence`} /></td>
                                            </tr>
                                        )}
                                    </For>
                                </tbody>
                            </table>
                        </Show>

                        <Show when={mode() === "Movies"}>
                            <table class="w-full text-sm">
                                <thead class="sticky top-0 bg-surface-1 border-b border-border-subtle">
                                    <tr>
                                        <th class="text-left px-4 py-2 text-text-secondary font-medium">File</th>
                                        <th class="text-left px-2 py-2 text-text-secondary font-medium w-20">TMDb ID</th>
                                        <th class="text-left px-2 py-2 text-text-secondary font-medium w-64">Search</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <For each={editableFiles()}>
                                        {(file, index) => {
                                            const info = parseEpisodeInfo(file.sourceFile);
                                            return (
                                                <tr class="border-b border-border-subtle hover:bg-surface-2/50">
                                                    <td class="px-4 py-2"><p class="truncate max-w-sm" title={file.sourceFile}>{fileName(file.sourceFile)}</p></td>
                                                    <td class="px-2 py-2 text-text-tertiary">{file.tmdbId ?? "-"}</td>
                                                    <td class="px-2 py-2"><TmdbSearchInput mediaType="Movies" initialQuery={info.cleanTitle} onSelect={(r) => handleMovieMediaSelect(index(), r)} placeholder="Search movie..." class="w-full" /></td>
                                                </tr>
                                            );
                                        }}
                                    </For>
                                </tbody>
                            </table>
                        </Show>
                    </div>

                    <footer class="px-5 py-4 border-t border-border-subtle space-y-3">
                        <Show when={showDryRun() && dryRunInfo()}><p class="text-sm text-text-secondary bg-surface-2 border border-border-subtle rounded-lg px-3 py-2">{dryRunInfo()}</p></Show>
                        <Show when={saveResult()}>{(message) => <p class={`text-sm ${message().includes("failed") ? "text-error" : "text-success"}`}>{message()}</p>}</Show>
                        <div class="flex justify-end gap-2">
                            <button type="button" onClick={props.onClose} class="px-4 py-2 text-sm rounded-lg border border-border-default bg-surface-2 text-text-secondary hover:text-text-primary hover:border-border-hover transition">Cancel</button>
                            <button type="button" onClick={handleDryRun} disabled={saving()} class="px-4 py-2 text-sm rounded-lg border border-border-default bg-surface-2 text-text-secondary hover:text-text-primary hover:border-border-hover disabled:opacity-40 disabled:cursor-not-allowed transition">Preview</button>
                            <button type="button" onClick={handleSave} disabled={saving()} class="px-5 py-2 text-sm font-semibold rounded-lg bg-accent text-surface-0 hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition">{saving() ? "Saving..." : "Save Changes"}</button>
                        </div>
                    </footer>
                </section>
            </div>
        </Show>
    );
}
