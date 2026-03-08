import { A } from "@solidjs/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import { Pill, RowSkeleton } from "@/components/common-ui";
import { IdentifyModal } from "@/components/identify-modal";
import {
    DiagnosticsDrawer,
    PriorityPill,
    SelectionActionTray,
    TriageIssuePill,
} from "@/components/operator-ui";
import { mediaApi } from "@/lib/api";
import { errorMessage, primaryFileName } from "@/lib/media-helpers";
import type { ScannedFile, TriageInboxItem } from "@/lib/types";

type SavedView = "all" | "new-failures" | "wanted-this-week" | "tv-identify" | "duplicates";

const searchStorageKey = "mediaflick.triage.search";
const viewStorageKey = "mediaflick.triage.view";

function initialStoredValue(key: string, fallback: string): string {
    if (typeof window === "undefined") return fallback;
    return window.localStorage.getItem(key) ?? fallback;
}

function savedViewLabel(view: SavedView): string {
    if (view === "new-failures") return "New failures";
    if (view === "wanted-this-week") return "Wanted";
    if (view === "tv-identify") return "TV identify";
    if (view === "duplicates") return "Duplicates";
    return "All work";
}

function formatLastActivity(value: string | null): string {
    if (!value) return "Unknown";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
}

function itemMatchesView(item: TriageInboxItem, view: SavedView): boolean {
    if (view === "new-failures") return item.kind === "failed-file";
    if (view === "wanted-this-week") return item.kind === "wanted-show" || item.kind === "episode-order";
    if (view === "tv-identify") return item.kind === "unidentified-tv";
    if (view === "duplicates") return item.kind === "duplicate-file";
    return true;
}

function triageSummaryLine(item: TriageInboxItem): string {
    if (item.kind === "wanted-show") {
        const seasonSummary = item.counts.missingSeasons?.length
            ? ` · ${item.counts.missingSeasons.map((season) => `S${String(season).padStart(2, "0")}`).join(", ")}`
            : "";
        return `${item.counts.missingEpisodes ?? 0} missing · ${item.counts.scannedEpisodes ?? 0}/${item.counts.airedEpisodes ?? 0} tracked${seasonSummary}`;
    }
    return `${item.counts.files} file${item.counts.files === 1 ? "" : "s"} in scope`;
}

function selectedDetail(items: TriageInboxItem[]): string {
    const fileCount = [...new Set(items.flatMap((item) => item.fileIds))].length;
    const folderCount = new Set(items.map((item) => item.sourceFolder).filter(Boolean)).size;
    if (folderCount > 0) {
        return `${fileCount} file${fileCount === 1 ? "" : "s"} across ${folderCount} source folder${folderCount === 1 ? "" : "s"}.`;
    }
    return `${fileCount} file${fileCount === 1 ? "" : "s"} selected.`;
}

function triageScope(item: TriageInboxItem): string {
    if (item.kind === "wanted-show" && (item.counts.missingSeasons?.length ?? 0) > 0) {
        return item.counts.missingSeasons!.map((season) => `Season ${String(season).padStart(2, "0")}`).join(", ");
    }
    return item.sourceFolder ?? item.deepLink;
}

export default function TriagePage() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = createSignal(initialStoredValue(searchStorageKey, ""));
    const [savedView, setSavedView] = createSignal<SavedView>(initialStoredValue(viewStorageKey, "all") as SavedView);
    const [selectedIds, setSelectedIds] = createSignal<Set<string>>(new Set());
    const [identifyModalOpen, setIdentifyModalOpen] = createSignal(false);
    const [identifyMode, setIdentifyMode] = createSignal<"TvShows" | "Movies">("TvShows");
    const [diagnosticsFileId, setDiagnosticsFileId] = createSignal<number | null>(null);

    createEffect(() => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(searchStorageKey, searchTerm());
        window.localStorage.setItem(viewStorageKey, savedView());
    });

    const inboxQuery = useQuery(() => ({
        queryKey: ["triage-inbox", searchTerm().trim().toLowerCase()],
        queryFn: () => mediaApi.getTriageInbox(searchTerm()),
        staleTime: 60 * 1000,
    }));

    const filteredItems = createMemo(() => {
        const items = inboxQuery.data?.items ?? [];
        return items.filter((item) => itemMatchesView(item, savedView()));
    });

    const actionableItems = createMemo(() => filteredItems().filter((item) =>
        item.kind === "unidentified-tv"
        || item.kind === "unidentified-movie"
        || item.kind === "failed-file"
        || item.kind === "duplicate-file",
    ));

    const selectedItems = createMemo(() => {
        const ids = selectedIds();
        return actionableItems().filter((item) => ids.has(item.id));
    });

    const selectedFileIds = createMemo(() => [...new Set(selectedItems().flatMap((item) => item.fileIds))]);
    const rebuildableFileIds = createMemo(() => [...new Set(selectedItems()
        .filter((item) => item.kind === "failed-file" || item.kind === "duplicate-file")
        .flatMap((item) => item.fileIds))]);
    const selectedKinds = createMemo(() => new Set(selectedItems().map((item) => item.kind)));

    const selectedFilesQuery = useQuery(() => ({
        queryKey: ["triage-selected-files", selectedFileIds().join(",")],
        queryFn: async () => {
            const ids = selectedFileIds();
            if (ids.length === 0) return [] as ScannedFile[];
            const result = await mediaApi.listScannedFiles({
                ids,
                page: 1,
                pageSize: Math.max(ids.length, 1),
            });
            return result.items;
        },
        enabled: identifyModalOpen() && selectedFileIds().length > 0,
    }));

    const toggleItem = (id: string) => {
        setSelectedIds((previous) => {
            const next = new Set(previous);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const invalidateOperatorQueries = async () => {
        for (const key of ["triage-inbox", "sidebar-badges", "wanted-shows", "unidentified-files", "titles", "show", "movie"]) {
            await queryClient.invalidateQueries({ queryKey: [key] });
        }
    };

    const markExtraMutation = useMutation(() => ({
        mutationFn: async () => mediaApi.batchUpdate({
            updates: selectedFileIds().map((id) => ({ id, mediaType: "Extras" as const })),
        }),
        onSuccess: async () => {
            setSelectedIds(new Set<string>());
            await invalidateOperatorQueries();
        },
    }));

    const rebuildMutation = useMutation(() => ({
        mutationFn: async () => {
            const ids = rebuildableFileIds();
            const results = await Promise.allSettled(ids.map((id) => mediaApi.recreateSymlink(id)));
            const failures = results.filter((result) => result.status === "rejected");
            if (failures.length > 0) {
                throw new Error(`${failures.length} rebuild request(s) failed`);
            }
            return results.length;
        },
        onSuccess: async () => {
            setSelectedIds(new Set<string>());
            await invalidateOperatorQueries();
        },
    }));

    const openIdentify = (mode: "TvShows" | "Movies") => {
        setIdentifyMode(mode);
        setIdentifyModalOpen(true);
    };

    return (
        <section class="space-y-5">
            <header class="rounded-2xl border border-border-subtle bg-surface-1 px-5 py-5 shadow-[0_18px_48px_rgba(0,0,0,0.22)]">
                <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 class="text-2xl font-semibold text-text-primary">Triage Inbox</h1>
                        <p class="mt-1 max-w-3xl text-sm text-text-secondary">
                            One operator queue for missing shows, unidentified files, failed ingest rows, duplicates, and episode-order overrides.
                        </p>
                    </div>
                    <label class="block w-full max-w-md">
                        <span class="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-text-tertiary">Search</span>
                        <input
                            value={searchTerm()}
                            onInput={(event) => setSearchTerm(event.currentTarget.value)}
                            placeholder="Filter titles, folders, and file paths"
                            class="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-tertiary focus:border-accent"
                        />
                    </label>
                </div>

                <div class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div class="rounded-xl border border-border-subtle bg-surface-2 px-4 py-3">
                        <p class="text-xs uppercase tracking-[0.14em] text-text-tertiary">Inbox</p>
                        <p class="mt-1 text-2xl font-semibold text-text-primary">{inboxQuery.data?.summary.totalItems ?? 0}</p>
                        <p class="text-sm text-text-secondary">Actionable groups</p>
                    </div>
                    <div class="rounded-xl border border-border-subtle bg-surface-2 px-4 py-3">
                        <p class="text-xs uppercase tracking-[0.14em] text-text-tertiary">Wanted</p>
                        <p class="mt-1 text-2xl font-semibold text-text-primary">{inboxQuery.data?.summary.missingEpisodes ?? 0}</p>
                        <p class="text-sm text-text-secondary">{inboxQuery.data?.summary.wantedShows ?? 0} shows missing aired episodes</p>
                    </div>
                    <div class="rounded-xl border border-border-subtle bg-surface-2 px-4 py-3">
                        <p class="text-xs uppercase tracking-[0.14em] text-text-tertiary">Identify</p>
                        <p class="mt-1 text-2xl font-semibold text-text-primary">{(inboxQuery.data?.summary.unidentifiedTv ?? 0) + (inboxQuery.data?.summary.unidentifiedMovies ?? 0)}</p>
                        <p class="text-sm text-text-secondary">{inboxQuery.data?.summary.unidentifiedTv ?? 0} TV · {inboxQuery.data?.summary.unidentifiedMovies ?? 0} movie files</p>
                    </div>
                    <div class="rounded-xl border border-border-subtle bg-surface-2 px-4 py-3">
                        <p class="text-xs uppercase tracking-[0.14em] text-text-tertiary">Failures</p>
                        <p class="mt-1 text-2xl font-semibold text-text-primary">{inboxQuery.data?.summary.failedFiles ?? 0}</p>
                        <p class="text-sm text-text-secondary">{inboxQuery.data?.summary.duplicateFiles ?? 0} duplicate rows also need review</p>
                    </div>
                    <div class="rounded-xl border border-border-subtle bg-surface-2 px-4 py-3">
                        <p class="text-xs uppercase tracking-[0.14em] text-text-tertiary">Ordering</p>
                        <p class="mt-1 text-2xl font-semibold text-text-primary">{inboxQuery.data?.summary.episodeOrderShows ?? 0}</p>
                        <p class="text-sm text-text-secondary">Shows using non-default episode order</p>
                    </div>
                </div>

                <div class="mt-5 flex flex-wrap gap-2">
                    <For each={["all", "new-failures", "wanted-this-week", "tv-identify", "duplicates"] as SavedView[]}>
                        {(view) => (
                            <button
                                type="button"
                                onClick={() => setSavedView(view)}
                                class="rounded-lg border px-3 py-2 text-sm transition"
                                classList={{
                                    "border-accent bg-accent-muted text-text-primary": savedView() === view,
                                    "border-border-default bg-surface-2 text-text-secondary hover:border-border-hover hover:text-text-primary": savedView() !== view,
                                }}
                            >
                                {savedViewLabel(view)}
                            </button>
                        )}
                    </For>
                </div>
            </header>

            <Show when={inboxQuery.isLoading}>
                <div class="space-y-3">
                    <For each={Array(6)}>{() => <RowSkeleton />}</For>
                </div>
            </Show>

            <Show when={inboxQuery.isError}>
                <div class="rounded-xl border border-error/30 bg-error-muted px-4 py-3 text-sm text-error">
                    {errorMessage(inboxQuery.error)}
                </div>
            </Show>

            <Show when={!inboxQuery.isLoading && !inboxQuery.isError && filteredItems().length === 0}>
                <div class="rounded-xl border border-border-subtle bg-surface-1 px-5 py-10 text-center text-sm text-text-secondary">
                    No triage rows match this view.
                </div>
            </Show>

            <div class="space-y-3">
                <For each={filteredItems()}>
                    {(item) => {
                        const selectable = item.kind === "unidentified-tv"
                            || item.kind === "unidentified-movie"
                            || item.kind === "failed-file"
                            || item.kind === "duplicate-file";
                        const selected = createMemo(() => selectedIds().has(item.id));

                        return (
                            <article
                                class="rounded-xl border border-border-subtle bg-surface-1 px-4 py-4 shadow-[0_14px_36px_rgba(0,0,0,0.18)] transition hover:border-border-hover"
                                classList={{ "border-accent/50": selected() }}
                            >
                                <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                                    <div class="min-w-0 flex-1">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <TriageIssuePill kind={item.kind} />
                                            <PriorityPill priority={item.priority} />
                                            <Pill>{triageSummaryLine(item)}</Pill>
                                        </div>
                                        <div class="mt-3">
                                            <div class="flex flex-wrap items-start gap-3">
                                                <Show when={selectable}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selected()}
                                                        onChange={() => toggleItem(item.id)}
                                                        class="mt-1 h-4 w-4 rounded border-border-default bg-surface-2"
                                                    />
                                                </Show>
                                                <div class="min-w-0 flex-1">
                                                    <h2 class="text-base font-semibold text-text-primary">{item.title}</h2>
                                                    <p class="mt-1 text-sm text-text-secondary">{item.subtitle}</p>
                                                    <Show when={item.diagnosticsSummary}>
                                                        {(summary) => <p class="mt-2 text-sm text-text-secondary">{summary()}</p>}
                                                    </Show>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="mt-3 grid gap-2 text-sm text-text-secondary md:grid-cols-3">
                                            <div>
                                                <span class="text-text-tertiary">Next action</span>
                                                <p class="mt-1 text-text-primary">{item.recommendedAction}</p>
                                            </div>
                                            <div>
                                                <span class="text-text-tertiary">Last activity</span>
                                                <p class="mt-1 text-text-primary">{formatLastActivity(item.lastActivityAt)}</p>
                                            </div>
                                            <div>
                                                <span class="text-text-tertiary">Scope</span>
                                                <p class="mt-1 text-text-primary">{triageScope(item)}</p>
                                            </div>
                                        </div>

                                        <Show when={item.sampleFiles.length > 0}>
                                            <div class="mt-3 rounded-xl border border-border-subtle bg-surface-2 px-3 py-3">
                                                <p class="text-xs uppercase tracking-[0.14em] text-text-tertiary">Examples</p>
                                                <div class="mt-2 space-y-2">
                                                    <For each={item.sampleFiles.slice(0, 2)}>
                                                        {(file) => (
                                                            <div class="flex items-center justify-between gap-3">
                                                                <div class="min-w-0">
                                                                    <p class="truncate text-sm font-medium text-text-primary">{primaryFileName(file)}</p>
                                                                    <p class="truncate text-xs text-text-tertiary">{file.sourceFile}</p>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setDiagnosticsFileId(file.id)}
                                                                    class="rounded-lg border border-border-default bg-surface-1 px-3 py-1.5 text-xs text-text-secondary transition hover:border-border-hover hover:text-text-primary"
                                                                >
                                                                    Why
                                                                </button>
                                                            </div>
                                                        )}
                                                    </For>
                                                </div>
                                            </div>
                                        </Show>
                                    </div>

                                    <div class="flex flex-wrap items-center gap-2 xl:w-[17rem] xl:justify-end">
                                        <A
                                            href={item.deepLink}
                                            class="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-surface-0 transition hover:bg-accent-hover"
                                        >
                                            Open
                                        </A>
                                        <Show when={selectable}>
                                            <button
                                                type="button"
                                                onClick={() => toggleItem(item.id)}
                                                class="rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-secondary transition hover:border-border-hover hover:text-text-primary"
                                            >
                                                {selected() ? "Deselect" : "Select"}
                                            </button>
                                        </Show>
                                    </div>
                                </div>
                            </article>
                        );
                    }}
                </For>
            </div>

            <SelectionActionTray
                selectedCount={selectedItems().length}
                summary={`${selectedItems().length} triage row${selectedItems().length === 1 ? "" : "s"} selected`}
                detail={selectedItems().length > 0 ? selectedDetail(selectedItems()) : null}
                onClear={() => setSelectedIds(new Set())}
            >
                <Show when={
                    selectedKinds().has("unidentified-tv")
                    || selectedKinds().has("failed-file")
                    || selectedKinds().has("duplicate-file")
                }>
                    <button
                        type="button"
                        onClick={() => openIdentify("TvShows")}
                        class="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-surface-0 transition hover:bg-accent-hover"
                    >
                        Identify as TV Show
                    </button>
                </Show>
                <Show when={
                    selectedKinds().has("unidentified-movie")
                    || selectedKinds().has("failed-file")
                    || selectedKinds().has("duplicate-file")
                }>
                    <button
                        type="button"
                        onClick={() => openIdentify("Movies")}
                        class="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-surface-0 transition hover:bg-accent-hover"
                    >
                        Identify as Movie
                    </button>
                </Show>
                <Show when={rebuildableFileIds().length > 0}>
                    <button
                        type="button"
                        disabled={rebuildMutation.isPending}
                        onClick={() => rebuildMutation.mutate()}
                        class="rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-secondary transition hover:border-border-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {rebuildMutation.isPending ? "Rebuilding..." : `Retry ${rebuildableFileIds().length} rebuild${rebuildableFileIds().length === 1 ? "" : "s"}`}
                    </button>
                </Show>
                <button
                    type="button"
                    disabled={markExtraMutation.isPending || selectedFileIds().length === 0}
                    onClick={() => markExtraMutation.mutate()}
                    class="rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-secondary transition hover:border-border-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {markExtraMutation.isPending ? "Marking..." : "Mark as Extra"}
                </button>
            </SelectionActionTray>

            <IdentifyModal
                open={identifyModalOpen()}
                onClose={() => setIdentifyModalOpen(false)}
                initialMode={identifyMode()}
                files={selectedFilesQuery.data ?? []}
            />

            <DiagnosticsDrawer
                open={diagnosticsFileId() !== null}
                fileId={diagnosticsFileId()}
                onClose={() => setDiagnosticsFileId(null)}
            />
        </section>
    );
}
