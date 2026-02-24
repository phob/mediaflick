import { A } from "@solidjs/router";
import { useQuery } from "@tanstack/solid-query";
import { For, Show } from "solid-js";
import { Pill, StatusBadge } from "@/components/common-ui";
import { mediaApi } from "@/lib/api";
import {
    countScannedFiles,
    formatLogTimestamp,
    primaryFileName,
    scannedFileHref,
} from "@/lib/media-helpers";

function DashboardMetricCard(props: {
    label: string;
    value: string | number;
    detail: string;
    href?: string;
    tone?: "default" | "warning" | "success" | "muted";
}) {
    const toneClasses = () => {
        if (props.tone === "warning") return "border-warning/45 bg-warning-muted/30 ring-1 ring-warning/20";
        if (props.tone === "success") return "border-success/30 bg-success-muted/20";
        if (props.tone === "muted") return "border-border-subtle/60 bg-surface-2/60 opacity-75";
        return "border-border-subtle bg-surface-2";
    };

    const valueClass = () => {
        if (props.tone === "warning") return "text-warning";
        if (props.tone === "success") return "text-success";
        return "text-text-primary";
    };

    const cardContent = () => (
        <>
            <p class="text-[0.68rem] uppercase tracking-[0.16em] text-text-tertiary font-mono">{props.label}</p>
            <p class={`text-2xl font-bold ${valueClass()}`}>{props.value}</p>
            <p class="text-sm text-text-secondary">{props.detail}</p>
        </>
    );

    return (
        <Show when={props.href} fallback={<article class={`rounded-xl border p-4 space-y-1.5 shadow-sm ${toneClasses()}`}>{cardContent()}</article>}>
            {(href) => <A href={href()} class={`rounded-xl border p-4 space-y-1.5 shadow-sm transition hover:border-border-hover hover:-translate-y-0.5 hover:shadow-md ${toneClasses()}`}>{cardContent()}</A>}
        </Show>
    );
}

export default function DashboardPage() {
    const dashboardQuery = useQuery(() => ({
        queryKey: ["dashboard"],
        queryFn: async () => {
            const [tvTitles, movieTitles, extrasCount, unknownCount, failedCount, duplicateCount, recent] = await Promise.all([
                mediaApi.listTitles("TvShows"),
                mediaApi.listTitles("Movies"),
                countScannedFiles({ mediaType: "Extras" }),
                countScannedFiles({ mediaType: "Unknown" }),
                countScannedFiles({ status: "Failed" }),
                countScannedFiles({ status: "Duplicate" }),
                mediaApi.listScannedFiles({ sortBy: "updatedAt", sortOrder: "desc", page: 1, pageSize: 10 }),
            ]);

            return {
                tvTitlesCount: tvTitles.length,
                movieTitlesCount: movieTitles.length,
                extrasCount,
                unknownCount,
                failedCount,
                duplicateCount,
                recentItems: recent.items,
            };
        },
    }));

    return (
        <section class="space-y-6">
            <div>
                <p class="section-kicker">Mission Control</p>
                <h1 class="section-title">Dashboard</h1>
                <p class="section-subtitle">Quick health view of your library, with direct paths into the messy areas.</p>
            </div>

            <Show when={dashboardQuery.isLoading}><div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5"><For each={Array(6)}>{() => <div class="skeleton h-28 rounded-xl" />}</For></div></Show>
            <Show when={dashboardQuery.isError}><p class="text-error text-sm">Unable to load dashboard metrics right now.</p></Show>

            <Show when={dashboardQuery.data}>
                {(dashboard) => (
                    <>
                        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                            <DashboardMetricCard label="TV Shows" value={dashboard().tvTitlesCount} detail="Tracked series in your catalog" href="/shows" />
                            <DashboardMetricCard label="Movies" value={dashboard().movieTitlesCount} detail="Tracked films in your catalog" href="/movies" />
                            <DashboardMetricCard label="Archive" value={dashboard().extrasCount} detail="Files tagged as extras" href="/archive" tone={dashboard().extrasCount > 0 ? "success" : "muted"} />
                            <DashboardMetricCard label="Unidentified" value={dashboard().unknownCount} detail="Rows still missing a media identity" href="/unidentified" tone={dashboard().unknownCount > 0 ? "warning" : "default"} />
                            <DashboardMetricCard label="Failed" value={dashboard().failedCount} detail="Processing failures requiring review" href="/unidentified" tone={dashboard().failedCount > 0 ? "warning" : "default"} />
                            <DashboardMetricCard label="Duplicates" value={dashboard().duplicateCount} detail="Duplicate detections in ingest" href="/unidentified" tone={dashboard().duplicateCount > 0 ? "warning" : "default"} />
                        </div>

                        <section class="space-y-3">
                            <div class="flex items-center justify-between gap-3"><h2 class="text-lg font-bold">Recent file activity</h2><Pill>{dashboard().recentItems.length} newest rows</Pill></div>
                            <Show when={dashboard().recentItems.length === 0}><p class="text-text-tertiary text-sm py-6 text-center">No recent file activity yet.</p></Show>
                            <div class="space-y-1.5">
                                <For each={dashboard().recentItems}>
                                    {(file) => {
                                        const href = scannedFileHref(file);
                                        return (
                                            <div class="flex items-start justify-between gap-4 bg-surface-2 border border-border-subtle rounded-lg px-4 py-3">
                                                <div class="min-w-0 flex-1">
                                                    <p class="font-semibold text-sm text-text-primary truncate">{primaryFileName(file)}</p>
                                                    <p class="text-xs text-text-tertiary mt-0.5 break-all line-clamp-1">{file.sourceFile}</p>
                                                    <p class="text-[0.72rem] text-text-tertiary mt-1">Updated {formatLogTimestamp(file.updatedAt ?? file.createdAt)}</p>
                                                </div>
                                                <div class="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                                                    <Pill>{file.mediaType ?? "No type"}</Pill>
                                                    <StatusBadge status={file.status} />
                                                    <Show when={href}>{(link) => <A href={link()} class="inline-flex items-center justify-center min-h-11 px-3 py-2 text-xs rounded-lg border border-border-default bg-surface-3 text-text-secondary hover:text-text-primary hover:border-border-hover transition">Open</A>}</Show>
                                                </div>
                                            </div>
                                        );
                                    }}
                                </For>
                            </div>
                        </section>
                    </>
                )}
            </Show>
        </section>
    );
}
