import { useQuery, useQueryClient } from "@tanstack/solid-query";
import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import { TmdbSearchInput } from "@/components/tmdb-search-input";
import { TvdbSearchInput } from "@/components/tvdb-search-input";
import { mediaApi } from "@/lib/api";
import { parseEpisodeInfo } from "@/lib/filename-parser";
import { fileName } from "@/lib/media-helpers";
import { pushAppNotification } from "@/lib/notifications";
import type {
    BulkUpdateApplyResponse,
    BulkUpdateItem,
    BulkUpdateRequest,
    MediaSearchResult,
    MediaStatus,
    MediaType,
    ScannedFile,
    TvEpisodeSourceType,
    TvdbSearchResult,
    TvdbSeasonType,
} from "@/lib/types";

const tvdbSeasonTypeOptions: Array<{ value: TvdbSeasonType; label: string }> = [
    { value: "default", label: "Default" },
    { value: "official", label: "Official" },
    { value: "dvd", label: "DVD" },
    { value: "absolute", label: "Absolute" },
    { value: "alternate", label: "Alternate" },
    { value: "regional", label: "Regional" },
];

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

function deriveInitialSelectedMedia(files: ScannedFile[], preselectedTmdbId?: number): MediaSearchResult | null {
    const explicitTmdbId = preselectedTmdbId ?? null;
    const existingTmdbIds = [...new Set(files.map((file) => file.tmdbId).filter((tmdbId): tmdbId is number => tmdbId !== null))];
    const tmdbId = explicitTmdbId ?? (existingTmdbIds.length === 1 ? existingTmdbIds[0] : null);
    if (!tmdbId) return null;

    const match = files.find((file) => file.tmdbId === tmdbId) ?? files.find((file) => file.title);
    return {
        tmdbId,
        title: match?.title ?? "Current selection",
        year: match?.year ?? null,
        posterPath: null,
    };
}

export function IdentifyModal(props: {
    open: boolean;
    onClose: () => void;
    initialMode: "TvShows" | "Movies";
    files: ScannedFile[];
    preselectedTmdbId?: number;
    reassignOldTmdbId?: number;
    backgroundOnSave?: boolean;
}) {
    const queryClient = useQueryClient();
    const [mode, setMode] = createSignal<"TvShows" | "Movies">(props.initialMode);
    const [selectedMedia, setSelectedMedia] = createSignal<MediaSearchResult | null>(null);
    const [editableFiles, setEditableFiles] = createSignal<EditableFile[]>([]);
    const [saving, setSaving] = createSignal(false);
    const [saveResult, setSaveResult] = createSignal<string | null>(null);
    const [showDryRun, setShowDryRun] = createSignal(false);
    const [dryRunInfo, setDryRunInfo] = createSignal<string | null>(null);
    const [applyShowToAllCompatible, setApplyShowToAllCompatible] = createSignal(true);
    const [episodeSource, setEpisodeSource] = createSignal<TvEpisodeSourceType>("tmdb");
    const [selectedTvdbSeries, setSelectedTvdbSeries] = createSignal<TvdbSearchResult | null>(null);
    const [tvdbSeasonType, setTvdbSeasonType] = createSignal<TvdbSeasonType>("default");
    const [hydratedEpisodeSourceTmdbId, setHydratedEpisodeSourceTmdbId] = createSignal<number | null>(null);

    const resetTvEpisodeSourceState = () => {
        setEpisodeSource("tmdb");
        setSelectedTvdbSeries(null);
        setTvdbSeasonType("default");
        setHydratedEpisodeSourceTmdbId(null);
    };

    createEffect(() => {
        if (!props.open || props.files.length === 0) return;
        setMode(props.initialMode);
        setSaveResult(null);
        setShowDryRun(false);
        setDryRunInfo(null);
        setApplyShowToAllCompatible(true);
        resetTvEpisodeSourceState();

        const parsed = props.files
            .slice()
            .sort((a, b) => a.sourceFile.localeCompare(b.sourceFile))
            .map((file) => {
                const info = parseEpisodeInfo(file.sourceFile);
                return {
                    id: file.id,
                    sourceFile: file.sourceFile,
                    status: file.status,
                    tmdbId: file.tmdbId ?? (props.initialMode === "TvShows" ? (props.preselectedTmdbId ?? null) : null),
                    seasonNumber: file.seasonNumber ?? info.season ?? null,
                    episodeNumber: file.episodeNumber ?? info.episode ?? null,
                    episodeNumber2: file.episodeNumber2 ?? info.episode2 ?? null,
                    mediaType: file.mediaType,
                    confidence: file.seasonNumber || file.episodeNumber ? "high" as const : info.confidence,
                    ignoreAutoIncrement: false,
                };
            });
        setEditableFiles(parsed);
        setSelectedMedia(props.initialMode === "TvShows" ? deriveInitialSelectedMedia(props.files, props.preselectedTmdbId) : null);
    });

    const selectedTvShowTmdbId = createMemo(() => mode() === "TvShows" ? (selectedMedia()?.tmdbId ?? null) : null);
    const episodeSourceQuery = useQuery(() => ({
        queryKey: ["tv-episode-source", selectedTvShowTmdbId()],
        queryFn: () => mediaApi.getShowEpisodeSource(selectedTvShowTmdbId()!),
        enabled: props.open && mode() === "TvShows" && selectedTvShowTmdbId() !== null,
    }));
    const selectedTvdbSeriesLabel = createMemo(() => {
        const match = selectedTvdbSeries();
        if (!match) return null;
        return `${match.title} #${match.tvdbId}`;
    });

    createEffect(() => {
        if (!props.open || mode() !== "TvShows") return;
        const tmdbId = selectedTvShowTmdbId();
        if (!tmdbId) {
            resetTvEpisodeSourceState();
            return;
        }
        if (hydratedEpisodeSourceTmdbId() === tmdbId || !episodeSourceQuery.isFetched) return;

        const selection = episodeSourceQuery.data;
        if (!selection || selection.tmdbId !== tmdbId) {
            setEpisodeSource("tmdb");
            setSelectedTvdbSeries(null);
            setTvdbSeasonType("default");
            setHydratedEpisodeSourceTmdbId(tmdbId);
            return;
        }

        if (selection.source === "tmdb" || !selection.tvdbId) {
            setEpisodeSource("tmdb");
            setSelectedTvdbSeries(selection.suggestedTvdbSeries ?? null);
            setTvdbSeasonType("default");
            setHydratedEpisodeSourceTmdbId(tmdbId);
            return;
        }

        setEpisodeSource("tvdb");
        setSelectedTvdbSeries({
            tvdbId: selection.tvdbId,
            title: selection.tvdbSeriesName ?? `TVDB #${selection.tvdbId}`,
            year: null,
            posterPath: null,
            overview: null,
        });
        setTvdbSeasonType(selection.tvdbSeasonType ?? "default");
        setHydratedEpisodeSourceTmdbId(tmdbId);
    });

    const handleTvMediaSelect = (result: MediaSearchResult) => {
        const currentTmdbId = selectedTvShowTmdbId();
        setSelectedMedia(result);
        setEditableFiles((prev) => prev.map((f) => ({
            ...f,
            tmdbId: applyShowToAllCompatible() ? result.tmdbId : (f.tmdbId ?? result.tmdbId),
        })));
        if (currentTmdbId !== result.tmdbId) {
            resetTvEpisodeSourceState();
        }
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
        if (mode() === "TvShows" && props.reassignOldTmdbId && media && media.tmdbId !== props.reassignOldTmdbId) {
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

    const validateBeforeSubmit = (): string | null => {
        if (mode() !== "TvShows") return null;
        if (!selectedMedia()) return "Select a TMDb show first.";
        if (episodeSource() === "tvdb" && !selectedTvdbSeries() && !episodeSourceQuery.data?.suggestedTvdbSeries) return "Select a TVDB series before saving.";
        return null;
    };

    const handleDryRun = async () => {
        const validationError = validateBeforeSubmit();
        if (validationError) {
            setDryRunInfo(validationError);
            setShowDryRun(true);
            return;
        }
        const req = buildRequest(true);
        try {
            const result = await mediaApi.batchUpdate(req);
            if ("willUpdate" in result) {
                let info = `Will update ${result.willUpdate} of ${result.totalFiles} files.`;
                if (result.conflicts.length > 0) info += ` ${result.conflicts.length} conflict(s): ${result.conflicts.map((c) => c.reason).join(", ")}`;
                if (result.identityUpdate) info += ` Identity: ${result.identityUpdate.identitiesWillUpdate} mapping(s), ${result.identityUpdate.aliasesWillRedirect} alias(es) will redirect.`;
                if (mode() === "TvShows" && selectedTvShowTmdbId() && episodeSourceQuery.data?.tmdbId === selectedTvShowTmdbId()) {
                    const sourceChanged = episodeSource() !== episodeSourceQuery.data.source
                        || (episodeSource() === "tvdb" && (selectedTvdbSeries()?.tvdbId ?? null) !== (episodeSourceQuery.data.tvdbId ?? null))
                        || (episodeSource() === "tvdb" && tvdbSeasonType() !== (episodeSourceQuery.data.tvdbSeasonType ?? "default"));
                    if (sourceChanged) info += " Preview uses the currently saved episode source. Save to apply the new ordering selection first.";
                }
                setDryRunInfo(info);
                setShowDryRun(true);
            }
        } catch (err) {
            setDryRunInfo(`Dry-run failed: ${err instanceof Error ? err.message : "Unknown error"}`);
            setShowDryRun(true);
        }
    };

    const handleSave = async () => {
        const validationError = validateBeforeSubmit();
        if (validationError) {
            setSaveResult(validationError);
            return;
        }

        const runSave = async () => {
            let episodeSourceUpdated = false;
            if (mode() === "TvShows" && selectedTvShowTmdbId()) {
                const tmdbId = selectedTvShowTmdbId()!;
                const existing = episodeSourceQuery.data?.tmdbId === tmdbId ? episodeSourceQuery.data : null;
                const desiredTvdbSeries = selectedTvdbSeries() ?? existing?.suggestedTvdbSeries ?? null;
                const sourceChanged = existing?.source !== episodeSource()
                    || (episodeSource() === "tvdb" && (existing?.tvdbId ?? null) !== (desiredTvdbSeries?.tvdbId ?? null))
                    || (episodeSource() === "tvdb" && (existing?.tvdbSeriesName ?? null) !== (desiredTvdbSeries?.title ?? null))
                    || (episodeSource() === "tvdb" && (existing?.tvdbSeasonType ?? "default") !== tvdbSeasonType());

                if (sourceChanged) {
                    await mediaApi.setShowEpisodeSource(tmdbId, episodeSource() === "tvdb" && desiredTvdbSeries
                        ? {
                            source: "tvdb",
                            tvdbId: desiredTvdbSeries.tvdbId,
                            tvdbSeriesName: desiredTvdbSeries.title,
                            tvdbSeasonType: tvdbSeasonType(),
                        }
                        : episodeSource() === "tvdb"
                            ? { source: "tvdb", tvdbSeasonType: tvdbSeasonType() }
                            : { source: "tmdb" });
                    episodeSourceUpdated = true;
                }
            }

            const req = buildRequest(false);
            const result = (await mediaApi.batchUpdate(req)) as BulkUpdateApplyResponse;
            const parts: string[] = [`Updated ${result.updated} file(s).`];
            if (result.symlinksRecreated > 0) parts.push(`${result.symlinksRecreated} symlink(s) recreated.`);
            if (result.symlinksFailed > 0) parts.push(`${result.symlinksFailed} symlink(s) failed.`);
            if (result.failed.length > 0) parts.push(`${result.failed.length} file(s) failed.`);
            if (result.identityUpdated) parts.push("Series identity updated.");
            if (episodeSourceUpdated) parts.push("Episode source updated.");

            for (const key of ["titles", "show", "movie", "tv-files", "movie-files", "unidentified-files", "tv-seasons", "tv-episode-source", "triage-inbox", "wanted-shows", "sidebar-badges"]) {
                void queryClient.invalidateQueries({ queryKey: [key] });
            }

            return { result, message: parts.join(" ") };
        };

        if (props.backgroundOnSave) {
            pushAppNotification({
                title: mode() === "TvShows" ? "Show reassignment started" : "Movie reassignment started",
                message: "MediaFlick is updating files and Jellyfin in the background.",
                tone: "info",
            });
            const task = runSave()
                .then(({ result, message }) => {
                    pushAppNotification({
                        title: result.failed.length === 0 ? "Reassignment finished" : "Reassignment finished with issues",
                        message,
                        tone: result.failed.length === 0 ? "success" : "error",
                    });
                })
                .catch((err) => {
                    pushAppNotification({
                        title: "Reassignment failed",
                        message: err instanceof Error ? err.message : "Unknown error",
                        tone: "error",
                    });
                    console.error("Background identify save failed", err);
                });
            props.onClose();
            void task;
            return;
        }

        setSaving(true);
        setSaveResult(null);
        try {
            const { result, message } = await runSave();
            setSaveResult(message);

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
                        <div class="p-4 border-b border-border-subtle space-y-4">
                            <div class="flex flex-col gap-4 xl:flex-row xl:items-center">
                                <TmdbSearchInput mediaType="TvShows" onSelect={handleTvMediaSelect} placeholder="Search for a TV show..." class="flex-1" />
                                <Show when={selectedMedia()}>
                                    {(media) => (
                                        <div class="flex items-center gap-2 shrink-0">
                                            <Show when={media().posterPath}>{(poster) => <img src={`https://image.tmdb.org/t/p/w92${poster()}`} alt="" class="w-8 h-12 rounded object-cover" />}</Show>
                                            <div class="text-sm">
                                                <p class="font-medium text-text-primary">{media().title}</p>
                                                <p class="text-xs text-text-tertiary">TMDb #{media().tmdbId} · {media().year ?? "?"}</p>
                                            </div>
                                        </div>
                                    )}
                                </Show>
                            </div>
                            <label class="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface-1/80 px-3 py-3 text-sm text-text-secondary">
                                <input
                                    type="checkbox"
                                    checked={applyShowToAllCompatible()}
                                    onChange={(e) => setApplyShowToAllCompatible(e.currentTarget.checked)}
                                    class="mt-0.5 accent-accent"
                                />
                                <span>
                                    Apply the selected TMDb show to all compatible rows in this batch.
                                    <span class="mt-1 block text-xs text-text-tertiary">
                                        When disabled, existing TMDb assignments stay in place and only unassigned rows inherit the selected show.
                                    </span>
                                </span>
                            </label>
                            <div class="rounded-xl border border-border-subtle bg-surface-2/70 p-4 space-y-4">
                                <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div>
                                        <p class="text-sm font-medium text-text-primary">Episode source</p>
                                        <p class="mt-1 text-xs text-text-secondary">TMDb stays canonical for the show match. TVDB only changes episode ordering for this identify action and the saved show preference.</p>
                                    </div>
                                    <div class="inline-flex rounded-xl border border-border-default bg-surface-1 p-1">
                                        <button
                                            type="button"
                                            onClick={() => setEpisodeSource("tmdb")}
                                            class={`rounded-lg px-3 py-2 text-sm transition ${episodeSource() === "tmdb" ? "bg-info/10 text-info" : "text-text-secondary hover:text-text-primary"}`}
                                        >
                                            TMDb
                                        </button>
                                        <button
                                            type="button"
                                            disabled={!selectedTvShowTmdbId()}
                                            onClick={() => setEpisodeSource("tvdb")}
                                            class={`rounded-lg px-3 py-2 text-sm transition ${episodeSource() === "tvdb" ? "bg-warning-muted/20 text-warning" : "text-text-secondary hover:text-text-primary"} disabled:opacity-50 disabled:cursor-not-allowed`}
                                        >
                                            TVDB
                                        </button>
                                    </div>
                                </div>

                                <Show when={episodeSource() === "tvdb"}>
                                    <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem]">
                                        <Show
                                            when={selectedTvShowTmdbId()}
                                            fallback={
                                                <div class="rounded-xl border border-dashed border-border-default bg-surface-1/80 px-4 py-3 text-sm text-text-secondary lg:col-span-2">
                                                    Select the TMDb show first, then choose the matching TVDB series and season type.
                                                </div>
                                            }
                                        >
                                            {(tmdbId) => (
                                                <>
                                                    <div>
                                                        <p class="mb-1 text-xs font-medium text-text-secondary">TVDB series search</p>
                                                        <TvdbSearchInput
                                                            tmdbId={tmdbId()}
                                                            initialQuery={selectedTvdbSeries()?.title ?? selectedMedia()?.title ?? ""}
                                                            onSelect={(result) => setSelectedTvdbSeries(result)}
                                                            placeholder="Search TVDB for the episode ordering..."
                                                        />
                                                    </div>
                                                    <label>
                                                        <span class="mb-1 block text-xs font-medium text-text-secondary">TVDB season type</span>
                                                        <select
                                                            class="block w-full rounded-xl border border-border-default bg-surface-3 px-4 py-3 text-sm text-text-primary"
                                                            value={tvdbSeasonType()}
                                                            onChange={(e) => setTvdbSeasonType(e.currentTarget.value as TvdbSeasonType)}
                                                        >
                                                            <For each={tvdbSeasonTypeOptions}>{(option) => <option value={option.value}>{option.label}</option>}</For>
                                                        </select>
                                                    </label>
                                                </>
                                            )}
                                        </Show>
                                    </div>
                                    <div class="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
                                        <Show when={selectedTvdbSeriesLabel()} fallback={<p>No TVDB series selected yet.</p>}>
                                            {(label) => <p>Selected TVDB series: {label()}</p>}
                                        </Show>
                                        <Show when={episodeSourceQuery.data?.tmdbId === selectedTvShowTmdbId() && episodeSourceQuery.data?.source === "tvdb" && episodeSourceQuery.data?.tvdbSeriesName}>
                                            {(name) => <span class="text-text-tertiary">Saved source: {name()}</span>}
                                        </Show>
                                    </div>
                                </Show>
                            </div>
                        </div>
                        <Show when={selectedMedia() && editableFiles().some((file) => file.tmdbId === null)}>
                            <p class="px-4 pb-4 -mt-2 text-xs text-text-tertiary">Using the current TMDb match for rows without a TMDb ID. Search only if you want to replace it.</p>
                        </Show>
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
