import { Show, type ParentProps } from "solid-js";
import {
    formatEpisodeCode,
    primaryFileName,
    remapRangeSummary,
    sourceGroupLabel,
} from "@/lib/media-helpers";
import type { JellyfinSyncDetails, JellyfinSyncState, JellyfinSyncSummary, MediaStatus, ScannedFile } from "@/lib/types";

export function StatusDot(props: { online: boolean }) {
    return <span class={`inline-block w-2 h-2 rounded-full ${props.online ? "bg-success" : "bg-error"}`} />;
}

type PillVariant = "default" | "success" | "info" | "warning" | "error";

export function Pill(props: ParentProps<{ variant?: PillVariant; solid?: boolean }>) {
    const colors = () => {
        if (props.variant === "success" && props.solid) return "bg-success text-surface-0 border-success/80";
        if (props.variant === "success") return "bg-success-muted text-success border-success/20";
        if (props.variant === "info" && props.solid) return "bg-info text-surface-0 border-info/80";
        if (props.variant === "info") return "bg-info/15 text-info border-info/30";
        if (props.variant === "warning" && props.solid) return "bg-warning text-surface-0 border-warning/80";
        if (props.variant === "warning") return "bg-warning-muted text-warning border-warning/20";
        if (props.variant === "error" && props.solid) return "bg-error text-surface-0 border-error/80";
        if (props.variant === "error") return "bg-error-muted text-error border-error/20";
        return "bg-surface-3 text-text-secondary border-border-default";
    };

    return <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors()}`}>{props.children}</span>;
}

export function CardSkeleton() {
    return <div class="skeleton aspect-2/3 rounded-xl" />;
}

export function RowSkeleton() {
    return <div class="skeleton h-16 rounded-lg" />;
}

export function FileRowIdentity(props: { file: ScannedFile }) {
    return (
        <div class="min-w-0 flex-1">
            <p class="font-semibold text-sm text-text-primary truncate">{primaryFileName(props.file)}</p>
            <p class="text-xs text-text-tertiary mt-0.5 break-all line-clamp-1">{props.file.sourceFile}</p>
            <Show when={props.file.episodeRemap}>
                {(remap) => (
                    <p class="text-[0.72rem] text-info mt-1">
                        Remapped {formatEpisodeCode(remap().sourceSeasonNumber, remap().sourceEpisodeNumber, remap().sourceEpisodeNumber2)} to{" "}
                        {formatEpisodeCode(remap().remappedSeasonNumber, remap().remappedEpisodeNumber, remap().remappedEpisodeNumber2)}
                        <Show when={remapRangeSummary(props.file)}>{(ranges) => ` · merged source ranges: ${ranges()}`}</Show>
                    </p>
                )}
            </Show>
        </div>
    );
}

export function SourceSubgroupSeparator(props: { sourcePath: string }) {
    return (
        <div class="flex items-center gap-3 mt-2 -mb-1" title={props.sourcePath}>
            <div class="h-px flex-1 bg-border-subtle" />
            <span class="text-[0.65rem] uppercase tracking-wider text-text-tertiary truncate max-w-[30ch]">{sourceGroupLabel(props.sourcePath)}</span>
        </div>
    );
}

export function StatusBadge(props: { status: MediaStatus }) {
    const variant = (): PillVariant => {
        if (props.status === "Success") return "success";
        if (props.status === "Failed") return "error";
        if (props.status === "Duplicate") return "warning";
        return "default";
    };

    return <Pill variant={variant()}>{props.status}</Pill>;
}

export function JellyfinIcon(props: { class?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" class={props.class ?? "h-4 w-4"}>
            <defs>
                <linearGradient id="jellyfin-outer" x1="4" y1="20" x2="20" y2="4" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stop-color="#25C6F7" />
                    <stop offset="0.5" stop-color="#7A5CFF" />
                    <stop offset="1" stop-color="#B06AFB" />
                </linearGradient>
                <linearGradient id="jellyfin-inner" x1="9" y1="16.5" x2="15.5" y2="9" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stop-color="#FF8A3D" />
                    <stop offset="1" stop-color="#A855F7" />
                </linearGradient>
            </defs>
            <path
                d="M12 4.2c.42 0 .82.22 1.03.59l6.58 11.39c.42.72-.1 1.62-.93 1.62H5.32c-.83 0-1.35-.9-.93-1.62l6.58-11.39c.21-.37.61-.59 1.03-.59Z"
                stroke="url(#jellyfin-outer)"
                stroke-width="2.2"
                stroke-linejoin="round"
            />
            <path
                d="M12 8.45c.26 0 .51.14.64.37l3.17 5.49c.26.45-.07 1.01-.58 1.01H8.77c-.51 0-.84-.56-.58-1.01l3.17-5.49c.13-.23.38-.37.64-.37Z"
                fill="url(#jellyfin-inner)"
            />
        </svg>
    );
}

function jellyfinVariant(state: JellyfinSyncState): PillVariant {
    if (state === "inSync") return "success";
    if (state === "pending") return "warning";
    if (state === "outOfSync" || state === "missing") return "error";
    if (state === "error") return "error";
    return "default";
}

function jellyfinLabel(state: JellyfinSyncState): string {
    if (state === "inSync") return "In Jellyfin";
    if (state === "pending") return "Waiting for Jellyfin";
    if (state === "outOfSync") return "Needs Jellyfin review";
    if (state === "missing") return "Not in Jellyfin";
    if (state === "error") return "Jellyfin check failed";
    return "Jellyfin status unknown";
}

export function JellyfinSyncPill(props: { sync: JellyfinSyncDetails | null | undefined }) {
    return (
        <Show when={props.sync}>
            {(sync) => (
                <Pill variant={jellyfinVariant(sync().state)}>
                    <span class="inline-flex items-center gap-1.5">
                        <JellyfinIcon class="h-3.5 w-3.5" />
                        <span>{jellyfinLabel(sync().state)}</span>
                    </span>
                </Pill>
            )}
        </Show>
    );
}

export function JellyfinSyncBadge(props: {
    sync: Pick<JellyfinSyncDetails, "state"> | Pick<JellyfinSyncSummary, "state"> | null | undefined;
    compact?: boolean;
}) {
    const badgeClass = (state: JellyfinSyncState) => (
        state === "inSync"
            ? "border-cyan-300/30 bg-cyan-300/12 text-cyan-100"
            : state === "pending"
                ? "border-yellow-300/30 bg-yellow-300/12 text-yellow-100"
                : state === "missing" || state === "outOfSync" || state === "error"
                    ? "border-rose-300/30 bg-rose-300/12 text-rose-100"
                    : "border-border-default bg-surface-3 text-text-secondary"
    );

    return (
        <Show when={props.sync}>
            {(sync) => (
                <span
                    class={`inline-flex items-center rounded-full border text-[0.68rem] font-mono uppercase tracking-[0.14em] ${props.compact ? "px-2 py-2" : "gap-1.5 px-2.5 py-1"} ${badgeClass(sync().state)}`}
                    title={jellyfinLabel(sync().state)}
                    aria-label={jellyfinLabel(sync().state)}
                >
                    <JellyfinIcon class="h-3.5 w-3.5" />
                    <Show when={!props.compact}>
                        <span>{jellyfinLabel(sync().state)}</span>
                    </Show>
                </span>
            )}
        </Show>
    );
}
