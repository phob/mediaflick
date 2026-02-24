import { A } from "@solidjs/router";
import { useQuery } from "@tanstack/solid-query";
import { For, Show, createMemo, createSignal } from "solid-js";
import { FileRowIdentity, Pill, RowSkeleton, StatusBadge } from "@/components/common-ui";
import { MediaSearchHeader } from "@/components/media-shared";
import {
    compareBySourceDirectoryThenRecency,
    formatBytes,
    groupFilesBySourceDirectory,
    listAllScannedFiles,
    scannedFileHref,
} from "@/lib/media-helpers";
import type { MediaStatus } from "@/lib/types";

export default function ArchivePage() {
    const [searchTerm, setSearchTerm] = createSignal("");
    const [statusFilter, setStatusFilter] = createSignal<"all" | MediaStatus>("all");

    const archiveQuery = useQuery(() => ({
        queryKey: ["archive-files", searchTerm().trim().toLowerCase(), statusFilter()],
        queryFn: async () => {
            const currentStatusFilter = statusFilter();
            const status: MediaStatus | undefined = currentStatusFilter === "all" ? undefined : currentStatusFilter;
            const files = await listAllScannedFiles({ mediaType: "Extras", searchTerm: searchTerm(), status });
            return files.sort(compareBySourceDirectoryThenRecency);
        },
    }));

    const groupedFiles = createMemo(() => groupFilesBySourceDirectory(archiveQuery.data ?? []));

    return (
        <section>
            <MediaSearchHeader title="Archive" subtitle="Everything marked as extras lives here, grouped by source folder for fast clean-up." searchValue={searchTerm()} onSearch={setSearchTerm} />

            <div class="flex flex-wrap items-end justify-between gap-3 mb-4">
                <div class="flex items-center gap-2"><Pill>Files: {archiveQuery.data?.length ?? 0}</Pill><Pill variant="success">Type: Extras</Pill></div>
                <label class="text-xs text-text-secondary space-y-1">
                    <span>Status filter</span>
                    <select class="block bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary" value={statusFilter()} onChange={(e) => setStatusFilter(e.currentTarget.value as "all" | MediaStatus)}>
                        <option value="all">All statuses</option>
                        <option value="Success">Success</option>
                        <option value="Processing">Processing</option>
                        <option value="Duplicate">Duplicate</option>
                        <option value="Failed">Failed</option>
                    </select>
                </label>
            </div>

            <Show when={archiveQuery.isLoading}><div class="space-y-3"><For each={Array(6)}>{() => <RowSkeleton />}</For></div></Show>
            <Show when={archiveQuery.isError}><p class="text-error text-sm">Unable to load archived extras right now.</p></Show>
            <Show when={!archiveQuery.isLoading && !archiveQuery.isError && groupedFiles().length === 0}><p class="text-text-tertiary text-sm py-12 text-center">No archived extras match this filter.</p></Show>

            <div class="space-y-5">
                <For each={groupedFiles()}>
                    {(group) => (
                        <section class="space-y-2">
                            <div class="flex items-center justify-between gap-3">
                                <h2 class="text-xs font-semibold uppercase tracking-[0.15em] text-text-tertiary truncate" title={group.directory}>{group.label}</h2>
                                <Pill>{group.files.length} files</Pill>
                            </div>
                            <div class="space-y-1.5">
                                <For each={group.files}>
                                    {(file) => (
                                        <div class="flex items-start justify-between gap-4 bg-surface-2 border border-border-subtle rounded-lg px-4 py-3">
                                            <FileRowIdentity file={file} />
                                            <div class="flex flex-wrap items-center gap-1.5 shrink-0">
                                                <Pill>{formatBytes(file.fileSize)}</Pill>
                                                <StatusBadge status={file.status} />
                                                <Show when={scannedFileHref(file)}>{(href) => <A href={href()} class="inline-flex items-center justify-center min-h-11 px-3 py-2 text-xs rounded-lg border border-border-default bg-surface-3 text-text-secondary hover:text-text-primary hover:border-border-hover transition">Open title</A>}</Show>
                                            </div>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </section>
                    )}
                </For>
            </div>
        </section>
    );
}
