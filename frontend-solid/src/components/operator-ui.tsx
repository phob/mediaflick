import { useQuery } from "@tanstack/solid-query";
import { Show, type ParentProps } from "solid-js";
import { Pill, StatusBadge } from "@/components/common-ui";
import { mediaApi } from "@/lib/api";
import {
    errorMessage,
    formatEpisodeCode,
    primaryFileName,
} from "@/lib/media-helpers";
import type { TriageIssueKind, TriagePriority } from "@/lib/types";

function issueLabel(kind: TriageIssueKind): string {
    if (kind === "wanted-show") return "Wanted";
    if (kind === "unidentified-tv") return "TV identify";
    if (kind === "unidentified-movie") return "Movie identify";
    if (kind === "failed-file") return "Failed";
    if (kind === "duplicate-file") return "Duplicate";
    return "Episode order";
}

function issueVariant(kind: TriageIssueKind): "default" | "warning" | "error" | "info" {
    if (kind === "wanted-show" || kind === "episode-order") return "warning";
    if (kind === "failed-file") return "error";
    if (kind === "duplicate-file") return "warning";
    return "info";
}

function priorityVariant(priority: TriagePriority): "default" | "warning" | "error" {
    if (priority === "critical" || priority === "high") return "error";
    if (priority === "medium") return "warning";
    return "default";
}

function formatDateTime(value: string | null | undefined): string {
    if (!value) return "Unknown";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
}

export function TriageIssuePill(props: { kind: TriageIssueKind }) {
    return <Pill variant={issueVariant(props.kind)}>{issueLabel(props.kind)}</Pill>;
}

export function PriorityPill(props: { priority: TriagePriority }) {
    return <Pill variant={priorityVariant(props.priority)}>{props.priority}</Pill>;
}

export function SelectionActionTray(props: ParentProps<{
    selectedCount: number;
    summary: string;
    detail?: string | null;
    onClear: () => void;
}>) {
    return (
        <Show when={props.selectedCount > 0}>
            <div class="fixed inset-x-0 bottom-0 z-40 border-t border-border-default bg-surface-1/96 backdrop-blur-md shadow-[0_-16px_40px_rgba(0,0,0,0.28)]">
                <div class="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
                    <div class="min-w-0">
                        <p class="text-sm font-semibold text-text-primary">{props.summary}</p>
                        <Show when={props.detail}>
                            {(detail) => <p class="mt-0.5 text-xs text-text-secondary">{detail()}</p>}
                        </Show>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                        {props.children}
                        <button
                            type="button"
                            onClick={props.onClear}
                            class="rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-secondary transition hover:border-border-hover hover:text-text-primary"
                        >
                            Clear
                        </button>
                    </div>
                </div>
            </div>
        </Show>
    );
}

function DiagnosticsSection(props: ParentProps<{ title: string }>) {
    return (
        <section class="space-y-2 rounded-xl border border-border-subtle bg-surface-2 px-4 py-4">
            <h3 class="text-sm font-semibold text-text-primary">{props.title}</h3>
            <div class="space-y-2 text-sm text-text-secondary">{props.children}</div>
        </section>
    );
}

function MetaRow(props: { label: string; value: string | number | null | undefined }) {
    return (
        <div class="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3">
            <span class="text-text-tertiary">{props.label}</span>
            <span class="break-all text-text-primary">{props.value ?? "Unknown"}</span>
        </div>
    );
}

export function DiagnosticsDrawer(props: { fileId: number | null; open: boolean; onClose: () => void }) {
    const diagnosticsQuery = useQuery(() => ({
        queryKey: ["file-diagnostics", props.fileId],
        queryFn: () => mediaApi.getScannedFileDiagnostics(props.fileId!),
        enabled: props.open && props.fileId !== null,
    }));

    return (
        <Show when={props.open}>
            <div class="fixed inset-0 z-50 bg-black/55" onClick={props.onClose}>
                <aside
                    class="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-border-default bg-surface-1 shadow-[0_20px_60px_rgba(0,0,0,0.42)]"
                    onClick={(event) => event.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-label="File diagnostics"
                >
                    <div class="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4">
                        <div class="min-w-0">
                            <h2 class="text-lg font-semibold text-text-primary">Why this row looks wrong</h2>
                            <p class="mt-1 text-sm text-text-secondary">
                                Parse, identity, ordering, and processing state for the selected file.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={props.onClose}
                            class="rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-secondary transition hover:border-border-hover hover:text-text-primary"
                        >
                            Close
                        </button>
                    </div>

                    <div class="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                        <Show when={diagnosticsQuery.isLoading}>
                            <div class="space-y-3">
                                <div class="skeleton h-24 rounded-xl" />
                                <div class="skeleton h-32 rounded-xl" />
                                <div class="skeleton h-32 rounded-xl" />
                            </div>
                        </Show>

                        <Show when={diagnosticsQuery.isError}>
                            <div class="rounded-xl border border-error/30 bg-error-muted px-4 py-3 text-sm text-error">
                                {errorMessage(diagnosticsQuery.error)}
                            </div>
                        </Show>

                        <Show when={diagnosticsQuery.data}>
                            {(diagnostics) => (
                                <>
                                    <DiagnosticsSection title="File">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <StatusBadge status={diagnostics().processingSnapshot.status} />
                                            <Pill>{diagnostics().inferredMediaKind}</Pill>
                                        </div>
                                        <MetaRow label="Name" value={primaryFileName(diagnostics().file)} />
                                        <MetaRow label="Source" value={diagnostics().file.sourceFile} />
                                        <MetaRow label="Destination" value={diagnostics().processingSnapshot.destinationFile} />
                                        <MetaRow label="Updated" value={formatDateTime(diagnostics().processingSnapshot.updatedAt ?? diagnostics().processingSnapshot.createdAt)} />
                                    </DiagnosticsSection>

                                    <DiagnosticsSection title="Parse">
                                        <MetaRow label="Title hint" value={diagnostics().parseSnapshot.rawTitleHint} />
                                        <MetaRow label="Normalized" value={diagnostics().parseSnapshot.normalizedTitleHint} />
                                        <MetaRow label="Year hint" value={diagnostics().parseSnapshot.yearHint} />
                                        <MetaRow
                                            label="Episode guess"
                                            value={diagnostics().parseSnapshot.seasonNumber && diagnostics().parseSnapshot.episodeNumber
                                                ? formatEpisodeCode(
                                                    diagnostics().parseSnapshot.seasonNumber,
                                                    diagnostics().parseSnapshot.episodeNumber,
                                                    diagnostics().parseSnapshot.episodeNumber2,
                                                )
                                                : "No TV episode match"}
                                        />
                                    </DiagnosticsSection>

                                    <DiagnosticsSection title="Identity">
                                        <MetaRow label="Media type" value={diagnostics().identitySnapshot.mediaType} />
                                        <MetaRow label="TMDb" value={diagnostics().identitySnapshot.tmdbId} />
                                        <MetaRow label="IMDb" value={diagnostics().identitySnapshot.imdbId} />
                                        <MetaRow label="Stored title" value={diagnostics().identitySnapshot.storedTitle} />
                                        <MetaRow label="Canonical" value={diagnostics().identitySnapshot.canonicalTitle} />
                                        <MetaRow
                                            label="Aliases"
                                            value={diagnostics().identitySnapshot.aliases.length > 0
                                                ? diagnostics().identitySnapshot.aliases.join(", ")
                                                : "No aliases"}
                                        />
                                    </DiagnosticsSection>

                                    <DiagnosticsSection title="Ordering">
                                        <MetaRow label="Episode source" value={diagnostics().orderingSnapshot.episodeSource} />
                                        <MetaRow label="TVDB series" value={diagnostics().orderingSnapshot.tvdbSeriesName} />
                                        <MetaRow label="TVDB season type" value={diagnostics().orderingSnapshot.tvdbSeasonType} />
                                        <MetaRow label="TMDb group" value={diagnostics().orderingSnapshot.episodeGroupName} />
                                        <MetaRow
                                            label="Stored episode"
                                            value={diagnostics().orderingSnapshot.storedSeasonNumber && diagnostics().orderingSnapshot.storedEpisodeNumber
                                                ? formatEpisodeCode(
                                                    diagnostics().orderingSnapshot.storedSeasonNumber,
                                                    diagnostics().orderingSnapshot.storedEpisodeNumber,
                                                    diagnostics().orderingSnapshot.storedEpisodeNumber2,
                                                )
                                                : "No stored episode"}
                                        />
                                        <MetaRow
                                            label="Resolved episode"
                                            value={diagnostics().orderingSnapshot.resolvedSeasonNumber && diagnostics().orderingSnapshot.resolvedEpisodeNumber
                                                ? formatEpisodeCode(
                                                    diagnostics().orderingSnapshot.resolvedSeasonNumber,
                                                    diagnostics().orderingSnapshot.resolvedEpisodeNumber,
                                                    diagnostics().orderingSnapshot.resolvedEpisodeNumber2,
                                                )
                                                : "No remap"}
                                        />
                                    </DiagnosticsSection>

                                    <DiagnosticsSection title="Explanation">
                                        <Show
                                            when={diagnostics().explanations.length > 0}
                                            fallback={<p class="text-sm text-text-secondary">No additional explanation is available for this row.</p>}
                                        >
                                            <div class="space-y-2">
                                                {diagnostics().explanations.map((line) => (
                                                    <p class="rounded-lg border border-border-default bg-surface-1 px-3 py-2 text-sm text-text-primary">
                                                        {line}
                                                    </p>
                                                ))}
                                            </div>
                                        </Show>
                                    </DiagnosticsSection>
                                </>
                            )}
                        </Show>
                    </div>
                </aside>
            </div>
        </Show>
    );
}
