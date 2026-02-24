import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { For, Show, createMemo, createSignal } from "solid-js";
import { IdentifyModal } from "@/components/identify-modal";
import {
    FileRowIdentity,
    Pill,
    RowSkeleton,
    SourceSubgroupSeparator,
    StatusBadge,
} from "@/components/common-ui";
import { MediaSearchHeader } from "@/components/media-shared";
import {
    compareByRecency,
    compareBySourceDirectoryThenRecency,
    formatBytes,
    groupFilesBySourceDirectory,
    listAllScannedFiles,
} from "@/lib/media-helpers";
import { mediaApi } from "@/lib/api";
import type { BulkUpdateRequest, ScannedFile } from "@/lib/types";

function UnidentifiedFileRow(props: {
    file: ScannedFile;
    sourceDividerPath?: string | null;
    selected?: boolean;
    onToggle?: (id: number) => void;
}) {
    return (
        <>
            <Show when={props.sourceDividerPath}>{(p) => <SourceSubgroupSeparator sourcePath={p()} />}</Show>
            <div class={`flex items-center gap-3 bg-surface-2 border rounded-lg px-4 py-3 cursor-pointer transition ${props.selected ? "border-accent/50 bg-accent/5" : "border-border-subtle hover:border-border-hover"}`} onClick={() => props.onToggle?.(props.file.id)}>
                <input type="checkbox" checked={props.selected ?? false} onChange={() => props.onToggle?.(props.file.id)} class="unidentified-checkbox shrink-0" onClick={(e) => e.stopPropagation()} />
                <FileRowIdentity file={props.file} />
                <div class="flex flex-wrap items-center gap-1.5 shrink-0"><StatusBadge status={props.file.status} /><Pill>{props.file.mediaType ?? "No type"}</Pill><Pill>{formatBytes(props.file.fileSize)}</Pill></div>
            </div>
        </>
    );
}

export default function UnidentifiedPage() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = createSignal("");
    const [selectedIds, setSelectedIds] = createSignal<Set<number>>(new Set());
    const [identifyModalOpen, setIdentifyModalOpen] = createSignal(false);
    const [identifyMode, setIdentifyMode] = createSignal<"TvShows" | "Movies">("TvShows");

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
            for (const f of [...failedFiles, ...duplicateFiles, ...unknownTypeFiles]) byId.set(f.id, f);
            const files = [...byId.values()].sort(compareByRecency);
            const groupedByType = new Map<string, ScannedFile[]>();
            for (const f of files) {
                const k = f.mediaType ?? "No media type";
                const existing = groupedByType.get(k);
                if (existing) existing.push(f);
                else groupedByType.set(k, [f]);
            }
            const typeOrder: Record<string, number> = { "No media type": 0, Unknown: 1, TvShows: 2, Movies: 3, Extras: 4 };
            const typeGroups = [...groupedByType.entries()]
                .sort((a, b) => (typeOrder[a[0]] ?? 99) - (typeOrder[b[0]] ?? 99) || a[0].localeCompare(b[0]))
                .map(([type, gf]) => ({ type, count: gf.length, files: [...gf].sort(compareBySourceDirectoryThenRecency) }));
            return {
                files,
                typeGroups,
                total: files.length,
                failedCount: files.filter((f) => f.status === "Failed").length,
                duplicateCount: files.filter((f) => f.status === "Duplicate").length,
                unknownTypeCount: files.filter((f) => f.mediaType === "Unknown").length,
            };
        },
    }));

    const toggleFile = (id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleGroup = (files: ScannedFile[]) => {
        const ids = files.map((f) => f.id);
        setSelectedIds((prev) => {
            const next = new Set(prev);
            const allSelected = ids.every((id) => next.has(id));
            if (allSelected) for (const id of ids) next.delete(id);
            else for (const id of ids) next.add(id);
            return next;
        });
    };

    const selectedFiles = createMemo(() => {
        const ids = selectedIds();
        const all = unidentifiedQuery.data?.files ?? [];
        return all.filter((f) => ids.has(f.id));
    });

    const isGroupFullySelected = (files: ScannedFile[]) => {
        const ids = selectedIds();
        return files.length > 0 && files.every((f) => ids.has(f.id));
    };

    const handleIdentify = (mode: "TvShows" | "Movies") => {
        setIdentifyMode(mode);
        setIdentifyModalOpen(true);
    };

    const markExtraMutation = useMutation(() => ({
        mutationFn: async (ids: number[]) => {
            const req: BulkUpdateRequest = { updates: ids.map((id) => ({ id, mediaType: "Extras" as const })) };
            return mediaApi.batchUpdate(req);
        },
        onSuccess: async () => {
            setSelectedIds(new Set<number>());
            for (const key of ["titles", "unidentified-files"]) void queryClient.invalidateQueries({ queryKey: [key] });
        },
    }));

    return (
        <section>
            <MediaSearchHeader title="Unidentified Media" subtitle="Files that still need identity work before they can be organized." searchValue={searchTerm()} onSearch={setSearchTerm} />

            <Show when={unidentifiedQuery.isLoading}><div class="space-y-3"><For each={Array(6)}>{() => <RowSkeleton />}</For></div></Show>
            <Show when={unidentifiedQuery.isError}><p class="text-error text-sm">Unable to load unidentified files right now.</p></Show>

            <Show when={(unidentifiedQuery.data?.total ?? 0) > 0}>
                <div class="space-y-6">
                    <div class="flex flex-wrap gap-2"><Pill>Total: {unidentifiedQuery.data?.total ?? 0}</Pill><Pill variant="error">Failed: {unidentifiedQuery.data?.failedCount ?? 0}</Pill><Pill variant="warning">Duplicate: {unidentifiedQuery.data?.duplicateCount ?? 0}</Pill><Pill>Unknown type: {unidentifiedQuery.data?.unknownTypeCount ?? 0}</Pill></div>
                    <For each={unidentifiedQuery.data?.typeGroups ?? []}>
                        {(group) => {
                            const subgroups = groupFilesBySourceDirectory(group.files);
                            return (
                                <div class="space-y-2">
                                    <div class="flex items-center gap-3"><input type="checkbox" checked={isGroupFullySelected(group.files)} onChange={() => toggleGroup(group.files)} class="unidentified-checkbox" /><h3 class="text-xs font-semibold uppercase tracking-wider text-text-tertiary">{group.type} ({group.count})</h3></div>
                                    <div class="space-y-3">
                                        <For each={subgroups}>
                                            {(sub) => (
                                                <div class="space-y-1.5">
                                                    <Show when={subgroups.length > 1}>
                                                        <div class="flex items-center gap-3 mt-1" title={sub.directory}>
                                                            <input type="checkbox" checked={isGroupFullySelected(sub.files)} onChange={() => toggleGroup(sub.files)} class="unidentified-checkbox" />
                                                            <div class="h-px flex-1 bg-border-subtle" />
                                                            <span class="text-[0.65rem] uppercase tracking-wider text-text-tertiary truncate max-w-[30ch]">{sub.label} ({sub.files.length})</span>
                                                        </div>
                                                    </Show>
                                                    <For each={sub.files}>{(file) => <UnidentifiedFileRow file={file} selected={selectedIds().has(file.id)} onToggle={toggleFile} />}</For>
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                </div>
                            );
                        }}
                    </For>
                </div>
            </Show>

            <Show when={!unidentifiedQuery.isLoading && !unidentifiedQuery.isError && (unidentifiedQuery.data?.total ?? 0) === 0}><p class="text-text-tertiary text-sm py-12 text-center">No unidentified files found for this filter.</p></Show>

            <Show when={selectedIds().size > 0}>
                <div class="fixed bottom-0 left-0 right-0 z-40 bg-surface-1/95 backdrop-blur-xl border-t border-border-default shadow-xl">
                    <div class="px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
                        <span class="text-sm font-medium text-text-primary">{selectedIds().size} file(s) selected</span>
                        <div class="flex flex-wrap gap-2">
                            <button type="button" onClick={() => handleIdentify("TvShows")} class="px-4 py-2 text-sm font-semibold rounded-lg bg-accent text-surface-0 hover:bg-accent-hover transition">Identify as TV Show</button>
                            <button type="button" onClick={() => handleIdentify("Movies")} class="px-4 py-2 text-sm font-semibold rounded-lg bg-accent text-surface-0 hover:bg-accent-hover transition">Identify as Movie</button>
                            <button type="button" disabled={markExtraMutation.isPending} onClick={() => markExtraMutation.mutate([...selectedIds()])} class="px-4 py-2 text-sm rounded-lg border border-border-default bg-surface-2 text-text-secondary hover:text-text-primary hover:border-border-hover disabled:opacity-40 disabled:cursor-not-allowed transition">{markExtraMutation.isPending ? "Marking..." : "Mark as Extra"}</button>
                            <button type="button" onClick={() => setSelectedIds(new Set<number>())} class="px-4 py-2 text-sm rounded-lg border border-border-default bg-surface-2 text-text-secondary hover:text-text-primary hover:border-border-hover transition">Clear</button>
                        </div>
                    </div>
                </div>
            </Show>

            <IdentifyModal
                open={identifyModalOpen()}
                onClose={() => {
                    setIdentifyModalOpen(false);
                    setSelectedIds(new Set<number>());
                }}
                initialMode={identifyMode()}
                files={selectedFiles()}
            />
        </section>
    );
}
