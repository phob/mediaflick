import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import { IdentifyModal } from "@/components/identify-modal";
import {
    FileRowIdentity,
    Pill,
    RowSkeleton,
    StatusBadge,
} from "@/components/common-ui";
import { DiagnosticsDrawer, SelectionActionTray } from "@/components/operator-ui";
import { MediaSearchHeader } from "@/components/media-shared";
import {
    compareByRecency,
    errorMessage,
    fileName,
    formatBytes,
    groupFilesBySourceDirectory,
    listAllScannedFiles,
} from "@/lib/media-helpers";
import { mediaApi } from "@/lib/api";
import type { BulkUpdateRequest, ScannedFile } from "@/lib/types";

type GroupingMode = "folder" | "title" | "status";

const searchStorageKey = "mediaflick.unidentified.search";
const groupingStorageKey = "mediaflick.unidentified.grouping";

function initialStoredValue(key: string, fallback: string): string {
    if (typeof window === "undefined") return fallback;
    return window.localStorage.getItem(key) ?? fallback;
}

function inferredTitle(file: ScannedFile): string {
    if (file.title?.trim()) return file.title.trim();
    return fileName(file.sourceFile)
        .replace(/\.[^.]+$/, "")
        .replace(/[._]/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
}

function buildGroups(files: ScannedFile[], groupingMode: GroupingMode): Array<{ key: string; label: string; files: ScannedFile[] }> {
    if (groupingMode === "folder") {
        return groupFilesBySourceDirectory(files)
            .map((group) => ({ key: group.directory, label: group.label, files: [...group.files].sort(compareByRecency) }))
            .sort((left, right) => left.label.localeCompare(right.label));
    }

    const byKey = new Map<string, ScannedFile[]>();
    for (const file of files) {
        const key = groupingMode === "status" ? file.status : inferredTitle(file) || "Untitled";
        const existing = byKey.get(key);
        if (existing) existing.push(file);
        else byKey.set(key, [file]);
    }

    return [...byKey.entries()]
        .map(([key, groupFiles]) => ({
            key,
            label: key,
            files: [...groupFiles].sort(compareByRecency),
        }))
        .sort((left, right) => left.label.localeCompare(right.label));
}

function UnidentifiedFileRow(props: {
    file: ScannedFile;
    selected: boolean;
    onToggle: (id: number) => void;
    onExplain: (id: number) => void;
}) {
    return (
        <div
            class="flex items-center gap-3 rounded-lg border bg-surface-2 px-4 py-3 transition"
            classList={{
                "border-accent/50 bg-accent/5": props.selected,
                "border-border-subtle hover:border-border-hover": !props.selected,
            }}
        >
            <input
                type="checkbox"
                checked={props.selected}
                onChange={() => props.onToggle(props.file.id)}
                class="h-4 w-4 rounded border-border-default bg-surface-1"
            />
            <FileRowIdentity file={props.file} />
            <div class="flex flex-wrap items-center gap-1.5">
                <StatusBadge status={props.file.status} />
                <Pill>{props.file.mediaType ?? "No type"}</Pill>
                <Pill>{formatBytes(props.file.fileSize)}</Pill>
            </div>
            <button
                type="button"
                onClick={() => props.onExplain(props.file.id)}
                class="rounded-lg border border-border-default bg-surface-1 px-3 py-2 text-xs text-text-secondary transition hover:border-border-hover hover:text-text-primary"
            >
                Why
            </button>
        </div>
    );
}

export default function UnidentifiedPage() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = createSignal(initialStoredValue(searchStorageKey, ""));
    const [groupingMode, setGroupingMode] = createSignal<GroupingMode>(initialStoredValue(groupingStorageKey, "folder") as GroupingMode);
    const [selectedIds, setSelectedIds] = createSignal<Set<number>>(new Set());
    const [identifyModalOpen, setIdentifyModalOpen] = createSignal(false);
    const [identifyMode, setIdentifyMode] = createSignal<"TvShows" | "Movies">("TvShows");
    const [diagnosticsFileId, setDiagnosticsFileId] = createSignal<number | null>(null);

    createEffect(() => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(searchStorageKey, searchTerm());
        window.localStorage.setItem(groupingStorageKey, groupingMode());
    });

    const unidentifiedQuery = useQuery(() => ({
        queryKey: ["unidentified-files", searchTerm().trim().toLowerCase()],
        queryFn: async () => {
            const s = searchTerm().trim();
            const [failedFiles, duplicateFiles, unknownTypeFiles] = await Promise.all([
                listAllScannedFiles({ status: "Failed", searchTerm: s }),
                listAllScannedFiles({ status: "Duplicate", searchTerm: s }),
                listAllScannedFiles({ mediaType: "Unknown", searchTerm: s }),
            ]);

            const byId = new Map<number, ScannedFile>();
            for (const file of [...failedFiles, ...duplicateFiles, ...unknownTypeFiles]) {
                byId.set(file.id, file);
            }

            const files = [...byId.values()].sort(compareByRecency);
            return {
                files,
                total: files.length,
                failedCount: files.filter((file) => file.status === "Failed").length,
                duplicateCount: files.filter((file) => file.status === "Duplicate").length,
                unknownTypeCount: files.filter((file) => file.mediaType === "Unknown").length,
            };
        },
    }));

    const groups = createMemo(() => buildGroups(unidentifiedQuery.data?.files ?? [], groupingMode()));

    const toggleFile = (id: number) => {
        setSelectedIds((previous) => {
            const next = new Set(previous);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleGroup = (files: ScannedFile[]) => {
        const ids = files.map((file) => file.id);
        setSelectedIds((previous) => {
            const next = new Set(previous);
            const allSelected = ids.every((id) => next.has(id));
            if (allSelected) {
                for (const id of ids) next.delete(id);
            } else {
                for (const id of ids) next.add(id);
            }
            return next;
        });
    };

    const isGroupSelected = (files: ScannedFile[]) => {
        const ids = selectedIds();
        return files.length > 0 && files.every((file) => ids.has(file.id));
    };

    const selectedFiles = createMemo(() => {
        const ids = selectedIds();
        return (unidentifiedQuery.data?.files ?? []).filter((file) => ids.has(file.id));
    });

    const selectedTvCount = createMemo(() => selectedFiles().filter((file) => /s\d{1,2}e\d{1,3}/i.test(file.sourceFile)).length);
    const selectedMovieCount = createMemo(() => selectedFiles().length - selectedTvCount());

    const markExtraMutation = useMutation(() => ({
        mutationFn: async (ids: number[]) => {
            const request: BulkUpdateRequest = {
                updates: ids.map((id) => ({ id, mediaType: "Extras" as const })),
            };
            return mediaApi.batchUpdate(request);
        },
        onSuccess: async () => {
            setSelectedIds(new Set<number>());
            for (const key of ["titles", "unidentified-files", "triage-inbox", "sidebar-badges"]) {
                await queryClient.invalidateQueries({ queryKey: [key] });
            }
        },
    }));

    const selectionDetail = createMemo(() => {
        const files = selectedFiles();
        const folderCount = new Set(files.map((file) => file.sourceFile.split("/").slice(0, -1).join("/"))).size;
        return `${files.length} file${files.length === 1 ? "" : "s"} across ${folderCount} source folder${folderCount === 1 ? "" : "s"}.`;
    });

    return (
        <section>
            <MediaSearchHeader
                title="Unidentified Media"
                subtitle="Failed, duplicate, and still-unassigned files that need operator review."
                searchValue={searchTerm()}
                onSearch={setSearchTerm}
            />

            <div class="mb-4 flex flex-wrap items-center gap-2">
                <Pill>Total: {unidentifiedQuery.data?.total ?? 0}</Pill>
                <Pill variant="error">Failed: {unidentifiedQuery.data?.failedCount ?? 0}</Pill>
                <Pill variant="warning">Duplicate: {unidentifiedQuery.data?.duplicateCount ?? 0}</Pill>
                <Pill>Unknown type: {unidentifiedQuery.data?.unknownTypeCount ?? 0}</Pill>
            </div>

            <div class="mb-5 flex flex-wrap gap-2">
                <For each={["folder", "title", "status"] as GroupingMode[]}>
                    {(mode) => (
                        <button
                            type="button"
                            onClick={() => setGroupingMode(mode)}
                            class="rounded-lg border px-3 py-2 text-sm transition"
                            classList={{
                                "border-accent bg-accent-muted text-text-primary": groupingMode() === mode,
                                "border-border-default bg-surface-2 text-text-secondary hover:border-border-hover hover:text-text-primary": groupingMode() !== mode,
                            }}
                        >
                            Group by {mode}
                        </button>
                    )}
                </For>
            </div>

            <Show when={unidentifiedQuery.isLoading}>
                <div class="space-y-3">
                    <For each={Array(6)}>{() => <RowSkeleton />}</For>
                </div>
            </Show>

            <Show when={unidentifiedQuery.isError}>
                <p class="text-sm text-error">{errorMessage(unidentifiedQuery.error)}</p>
            </Show>

            <Show when={!unidentifiedQuery.isLoading && !unidentifiedQuery.isError && (unidentifiedQuery.data?.total ?? 0) === 0}>
                <p class="py-12 text-center text-sm text-text-tertiary">No unidentified files found for this filter.</p>
            </Show>

            <div class="space-y-5">
                <For each={groups()}>
                    {(group) => (
                        <section class="space-y-2">
                            <div class="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={isGroupSelected(group.files)}
                                    onChange={() => toggleGroup(group.files)}
                                    class="h-4 w-4 rounded border-border-default bg-surface-1"
                                />
                                <h2 class="text-sm font-semibold text-text-primary">{group.label}</h2>
                                <Pill>{group.files.length}</Pill>
                            </div>
                            <div class="space-y-2">
                                <For each={group.files}>
                                    {(file) => (
                                        <UnidentifiedFileRow
                                            file={file}
                                            selected={selectedIds().has(file.id)}
                                            onToggle={toggleFile}
                                            onExplain={setDiagnosticsFileId}
                                        />
                                    )}
                                </For>
                            </div>
                        </section>
                    )}
                </For>
            </div>

            <SelectionActionTray
                selectedCount={selectedIds().size}
                summary={`${selectedIds().size} file${selectedIds().size === 1 ? "" : "s"} selected`}
                detail={selectedIds().size > 0 ? selectionDetail() : null}
                onClear={() => setSelectedIds(new Set<number>())}
            >
                <button
                    type="button"
                    onClick={() => {
                        setIdentifyMode("TvShows");
                        setIdentifyModalOpen(true);
                    }}
                    class="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-surface-0 transition hover:bg-accent-hover"
                >
                    Identify as TV Show
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setIdentifyMode("Movies");
                        setIdentifyModalOpen(true);
                    }}
                    class="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-surface-0 transition hover:bg-accent-hover"
                >
                    Identify as Movie
                </button>
                <button
                    type="button"
                    disabled={markExtraMutation.isPending}
                    onClick={() => markExtraMutation.mutate([...selectedIds()])}
                    class="rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-secondary transition hover:border-border-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {markExtraMutation.isPending ? "Marking..." : "Mark as Extra"}
                </button>
                <div class="text-xs text-text-tertiary">
                    {selectedTvCount()} TV-like · {selectedMovieCount()} movie-like
                </div>
            </SelectionActionTray>

            <IdentifyModal
                open={identifyModalOpen()}
                onClose={() => setIdentifyModalOpen(false)}
                initialMode={identifyMode()}
                files={selectedFiles()}
            />

            <DiagnosticsDrawer
                open={diagnosticsFileId() !== null}
                fileId={diagnosticsFileId()}
                onClose={() => setDiagnosticsFileId(null)}
            />
        </section>
    );
}
