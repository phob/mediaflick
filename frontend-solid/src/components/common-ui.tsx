import { Show, type ParentProps } from "solid-js";
import {
    formatEpisodeCode,
    primaryFileName,
    remapRangeSummary,
    sourceGroupLabel,
} from "@/lib/media-helpers";
import type { MediaStatus, ScannedFile } from "@/lib/types";

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
