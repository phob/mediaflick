import { A } from "@solidjs/router";
import { useQuery } from "@tanstack/solid-query";
import { Activity, AlertTriangle, Clock3, Database, Film, HardDriveDownload, Tv2 } from "lucide-solid";
import { For, Show } from "solid-js";
import { Pill } from "@/components/common-ui";
import { mediaApi } from "@/lib/api";
import {
    fileName,
    formatBytes,
    formatEpisodeCode,
    formatLogTimestamp,
    posterUrl,
} from "@/lib/media-helpers";
import type {
    DashboardRecentItem,
    MediaStatus,
    MediaType,
    MediaTypeCount,
    MediaTypeStorage,
    ScannedFilesDashboard,
    StatusCount,
} from "@/lib/types";

const STATUS_ORDER: MediaStatus[] = ["Success", "Processing", "Duplicate", "Failed"];
const MEDIA_ORDER: MediaType[] = ["TvShows", "Movies", "Extras", "Unknown"];

const STATUS_COLORS: Record<MediaStatus, string> = {
    Success: "#22c55e",
    Processing: "#22d3ee",
    Duplicate: "#facc15",
    Failed: "#fb7185",
};

const MEDIA_COLORS: Record<MediaType, string> = {
    TvShows: "#22d3ee",
    Movies: "#f97316",
    Extras: "#94a3b8",
    Unknown: "#fb7185",
};

function formatRelativeTime(value: string | null | undefined): string {
    if (!value) return "No activity yet";
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) return "Unknown";

    const diffMs = parsed - Date.now();
    const absMs = Math.abs(diffMs);
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

    if (absMs < 60 * 60 * 1000) {
        return rtf.format(Math.round(diffMs / (60 * 1000)), "minute");
    }
    if (absMs < 24 * 60 * 60 * 1000) {
        return rtf.format(Math.round(diffMs / (60 * 60 * 1000)), "hour");
    }
    if (absMs < 30 * 24 * 60 * 60 * 1000) {
        return rtf.format(Math.round(diffMs / (24 * 60 * 60 * 1000)), "day");
    }
    return rtf.format(Math.round(diffMs / (30 * 24 * 60 * 60 * 1000)), "month");
}

function statusCount(items: StatusCount[], status: MediaStatus): number {
    return items.find((item) => item.status === status)?.count ?? 0;
}

function mediaCount(items: MediaTypeCount[], mediaType: MediaType): number {
    return items.find((item) => item.mediaType === mediaType)?.count ?? 0;
}

function mediaStorage(items: MediaTypeStorage[], mediaType: MediaType): MediaTypeStorage {
    return items.find((item) => item.mediaType === mediaType) ?? { mediaType, count: 0, totalFileSize: 0 };
}

function percentage(part: number, total: number): string {
    if (total <= 0) return "0%";
    return `${((part / total) * 100).toFixed(part / total >= 0.995 ? 0 : 1)}%`;
}

function recentHref(item: DashboardRecentItem): string {
    return item.mediaType === "TvShows" ? `/shows/${item.tmdbId}` : `/movies/${item.tmdbId}`;
}

function recentImage(item: DashboardRecentItem): string | null {
    const path = item.imagePath ?? item.posterPath;
    if (!path) return null;
    return posterUrl(path, item.imageKind === "still" ? "w780" : "w500");
}

function recentMeta(item: DashboardRecentItem): string {
    if (item.mediaType === "TvShows") {
        const episodeCode = formatEpisodeCode(item.seasonNumber, item.episodeNumber, item.episodeNumber2);
        if (item.episodeTitle) return `${episodeCode} · ${item.episodeTitle}`;
        return episodeCode;
    }
    return item.year ? `${item.year}` : "Movie";
}

function recentCaption(item: DashboardRecentItem): string {
    return item.mediaType === "TvShows" ? "Episode captured" : "Movie filed";
}

function sliceGradient(slices: Array<{ value: number; color: string }>): string {
    const total = slices.reduce((sum, slice) => sum + slice.value, 0);
    if (total <= 0) {
        return "conic-gradient(from 210deg, rgba(255,255,255,0.12) 0deg 360deg)";
    }

    let cursor = 0;
    const segments = slices
        .filter((slice) => slice.value > 0)
        .map((slice) => {
            const start = cursor;
            cursor += (slice.value / total) * 360;
            return `${slice.color} ${start}deg ${cursor}deg`;
        });

    return `conic-gradient(from 210deg, ${segments.join(", ")})`;
}

function OverviewMetricCard(props: {
    label: string;
    value: string;
    detail: string;
    accent: "orange" | "cyan" | "lime" | "rose";
    icon: typeof Film;
}) {
    const accentClasses = () => {
        if (props.accent === "cyan") return "border-info/30 text-info";
        if (props.accent === "lime") return "border-success/30 text-success";
        if (props.accent === "rose") return "border-error/30 text-error";
        return "border-accent/30 text-accent";
    };

    const accentBackground = () => {
        if (props.accent === "cyan") {
            return "radial-gradient(circle at top right, rgb(34 211 238 / 0.18), transparent 42%), linear-gradient(180deg, rgb(11 24 34 / 0.96), rgb(11 18 29 / 0.92))";
        }
        if (props.accent === "lime") {
            return "radial-gradient(circle at top right, rgb(34 197 94 / 0.16), transparent 42%), linear-gradient(180deg, rgb(10 26 21 / 0.96), rgb(11 18 24 / 0.92))";
        }
        if (props.accent === "rose") {
            return "radial-gradient(circle at top right, rgb(251 113 133 / 0.16), transparent 42%), linear-gradient(180deg, rgb(30 15 23 / 0.96), rgb(16 13 24 / 0.92))";
        }
        return "radial-gradient(circle at top right, rgb(249 115 22 / 0.18), transparent 42%), linear-gradient(180deg, rgb(30 19 13 / 0.96), rgb(12 16 26 / 0.92))";
    };

    const Icon = props.icon;

    return (
        <article
            class="relative overflow-hidden rounded-[1.35rem] border border-border-subtle px-4 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.24)]"
            style={{ background: accentBackground() }}
        >
            <div class="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_36%,rgba(255,255,255,0.01)_100%)]" />
            <div class="relative flex items-start justify-between gap-3">
                <div class="space-y-1">
                    <p class="text-[0.68rem] font-mono uppercase tracking-[0.2em] text-text-tertiary">{props.label}</p>
                    <p class="text-[1.9rem] font-semibold leading-none text-text-primary">{props.value}</p>
                    <p class="text-sm leading-snug text-text-secondary">{props.detail}</p>
                </div>
                <div class={`rounded-2xl border bg-surface-0/50 p-3 ${accentClasses()}`}>
                    <Icon size={18} />
                </div>
            </div>
        </article>
    );
}

function SignalTile(props: { label: string; value: string; detail: string }) {
    return (
        <div class="rounded-[1.35rem] border border-border-subtle bg-surface-1/84 px-4 py-4">
            <p class="text-[0.65rem] font-mono uppercase tracking-[0.18em] text-text-tertiary">{props.label}</p>
            <p class="mt-2 text-xl font-semibold text-text-primary">{props.value}</p>
            <p class="mt-1 text-sm leading-snug text-text-secondary">{props.detail}</p>
        </div>
    );
}

function DonutPanel(props: {
    kicker: string;
    title: string;
    centerLabel: string;
    centerValue: string;
    slices: Array<{ label: string; value: number; color: string; note: string }>;
}) {
    const total = () => props.slices.reduce((sum, slice) => sum + slice.value, 0);

    return (
        <section class="rounded-[1.7rem] border border-border-subtle bg-surface-1/88 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
            <p class="text-[0.68rem] font-mono uppercase tracking-[0.2em] text-text-tertiary">{props.kicker}</p>
            <div class="mt-2 flex items-center justify-between gap-3">
                <h2 class="text-xl font-semibold text-text-primary">{props.title}</h2>
                <Pill>{total()} rows</Pill>
            </div>

            <div class="mt-6 grid gap-5 md:grid-cols-[13rem_1fr] md:items-center">
                <div class="relative mx-auto h-52 w-52">
                    <div
                        class="absolute inset-0 rounded-full border border-white/6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                        style={{ background: sliceGradient(props.slices) }}
                    />
                    <div class="absolute inset-[18%] rounded-full border border-border-subtle bg-surface-0/96 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]" />
                    <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <p class="text-[0.62rem] font-mono uppercase tracking-[0.2em] text-text-tertiary">{props.centerLabel}</p>
                        <p class="mt-2 text-3xl font-semibold leading-none text-text-primary">{props.centerValue}</p>
                    </div>
                </div>

                <div class="space-y-3">
                    <For each={props.slices}>
                        {(slice) => {
                            const share = total() > 0 ? percentage(slice.value, total()) : "0%";
                            return (
                                <div class="rounded-2xl border border-border-subtle/80 bg-surface-0/30 px-3 py-3">
                                    <div class="flex items-center justify-between gap-3">
                                        <div class="flex items-center gap-2.5">
                                            <span class="h-3 w-3 rounded-full" style={{ "background-color": slice.color }} />
                                            <p class="text-sm font-medium text-text-primary">{slice.label}</p>
                                        </div>
                                        <div class="text-right">
                                            <p class="text-sm font-semibold text-text-primary">{slice.value}</p>
                                            <p class="text-[0.72rem] text-text-tertiary">{share}</p>
                                        </div>
                                    </div>
                                    <p class="mt-1.5 text-sm text-text-secondary">{slice.note}</p>
                                </div>
                            );
                        }}
                    </For>
                </div>
            </div>
        </section>
    );
}

export default function DashboardPage() {
    const dashboardQuery = useQuery(() => ({
        queryKey: ["dashboard"],
        queryFn: () => mediaApi.getDashboard(),
    }));

    return (
        <section class="space-y-6">
            <div>
                <p class="section-kicker">Mission Control</p>
                <h1 class="section-title">Dashboard</h1>
                <p class="section-subtitle">Recent arrivals, ingest health, storage weight, and the exact places where the library needs attention.</p>
            </div>

            <Show when={dashboardQuery.isLoading}>
                <div class="grid grid-cols-1 gap-4 xl:grid-cols-5">
                    <div class="skeleton h-[25rem] rounded-[2rem] xl:col-span-3" />
                    <div class="skeleton h-[25rem] rounded-[2rem] xl:col-span-2" />
                    <For each={Array.from({ length: 4 })}>{() => <div class="skeleton h-36 rounded-[1.5rem]" />}</For>
                </div>
            </Show>

            <Show when={dashboardQuery.isError}>
                <div class="rounded-[1.6rem] border border-error/30 bg-error-muted/15 px-5 py-4 text-sm text-error">
                    Unable to load dashboard metrics right now.
                </div>
            </Show>

            <Show when={dashboardQuery.data}>
                {(dashboard) => {
                    const data = (): ScannedFilesDashboard => dashboard();
                    const totalTitles = () => data().distinctMovies + data().distinctTvShows;
                    const unknownCount = () => mediaCount(data().byMediaType, "Unknown");
                    const duplicateCount = () => statusCount(data().byStatus, "Duplicate");
                    const failedCount = () => statusCount(data().byStatus, "Failed");
                    const processingCount = () => statusCount(data().byStatus, "Processing");
                    const successRate = () => percentage(data().totalSuccessfulFiles, data().totalFiles);
                    const largestStorage = () => Math.max(1, ...data().storageByMediaType.map((item) => item.totalFileSize));

                    const statusSlices = () =>
                        STATUS_ORDER.map((status) => ({
                            label: status,
                            value: statusCount(data().byStatus, status),
                            color: STATUS_COLORS[status],
                            note:
                                status === "Success"
                                    ? "Items already organized into the library."
                                    : status === "Processing"
                                        ? "Rows currently being identified or moved."
                                        : status === "Duplicate"
                                            ? "Conflicts caught during ingest."
                                            : "Files that need manual intervention.",
                        }));

                    const mediaSlices = () =>
                        MEDIA_ORDER.map((mediaType) => ({
                            label: mediaType === "TvShows" ? "TV Shows" : mediaType,
                            value: mediaCount(data().byMediaType, mediaType),
                            color: MEDIA_COLORS[mediaType],
                            note:
                                mediaType === "TvShows"
                                    ? "Episode files mapped to shows."
                                    : mediaType === "Movies"
                                        ? "Movies ready in the library."
                                        : mediaType === "Extras"
                                            ? "Archive and extras held outside the core catalog."
                                            : "Rows still missing a media identity.",
                        }));

                    return (
                        <>
                            <section class="relative overflow-hidden rounded-[2rem] border border-border-subtle bg-[linear-gradient(145deg,rgba(249,115,22,0.12),transparent_42%),linear-gradient(180deg,rgba(13,18,27,0.96),rgba(8,12,18,0.98))] px-5 py-6 shadow-[0_26px_80px_rgba(0,0,0,0.28)] md:px-7 md:py-7">
                                <div class="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />
                                <div class="pointer-events-none absolute bottom-0 left-[-3rem] h-44 w-44 rounded-full bg-info/10 blur-3xl" />

                                <div class="relative grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
                                    <div class="space-y-5">
                                        <div class="flex flex-wrap items-center gap-3">
                                            <Pill variant="info">Live ingest view</Pill>
                                            <Pill>{data().recentItems.length} recent cards</Pill>
                                        </div>

                                        <div class="space-y-3">
                                            <p class="text-[0.72rem] font-mono uppercase tracking-[0.28em] text-text-tertiary">Library pulse</p>
                                            <h2 class="max-w-3xl text-4xl font-semibold leading-[0.95] text-text-primary md:text-5xl">
                                                See what landed last, how the ingest is behaving, and where storage is drifting.
                                            </h2>
                                            <p class="max-w-2xl text-base leading-relaxed text-text-secondary">
                                                This board now comes from a dedicated backend summary, so card art, throughput, and chart data stay in sync with the actual ingest state.
                                            </p>
                                        </div>

                                        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                            <OverviewMetricCard
                                                label="Catalog titles"
                                                value={String(totalTitles())}
                                                detail={`${data().distinctTvShows} shows and ${data().distinctMovies} movies with TMDb identity.`}
                                                accent="orange"
                                                icon={Database}
                                            />
                                            <OverviewMetricCard
                                                label="Success rate"
                                                value={successRate()}
                                                detail={`${data().totalSuccessfulFiles} of ${data().totalFiles} rows are organized cleanly.`}
                                                accent="lime"
                                                icon={HardDriveDownload}
                                            />
                                            <OverviewMetricCard
                                                label="Recent ingest"
                                                value={String(data().addedLast7Days)}
                                                detail={`${data().addedLast30Days} rows arrived in the last 30 days.`}
                                                accent="cyan"
                                                icon={Activity}
                                            />
                                            <OverviewMetricCard
                                                label="Needs review"
                                                value={String(data().attentionCount)}
                                                detail={`${failedCount()} failed, ${duplicateCount()} duplicate, ${unknownCount()} unidentified.`}
                                                accent="rose"
                                                icon={AlertTriangle}
                                            />
                                        </div>
                                    </div>

                                    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                                        <SignalTile
                                            label="Last library item"
                                            value={formatRelativeTime(data().lastLibraryItemAt)}
                                            detail={data().lastLibraryItemAt ? formatLogTimestamp(data().lastLibraryItemAt ?? undefined) : "No successful movie or TV item yet."}
                                        />
                                        <SignalTile
                                            label="Last ingest hit"
                                            value={formatRelativeTime(data().lastIngestedAt)}
                                            detail={data().lastIngestedAt ? formatLogTimestamp(data().lastIngestedAt ?? undefined) : "No scanned rows have been ingested yet."}
                                        />
                                        <SignalTile
                                            label="Storage tracked"
                                            value={formatBytes(data().totalFileSize)}
                                            detail={`${formatBytes(data().totalSuccessfulFileSize)} already sits in successful rows.`}
                                        />
                                        <SignalTile
                                            label="Processing now"
                                            value={String(processingCount())}
                                            detail="Rows actively moving through detection and organization."
                                        />
                                    </div>
                                </div>
                            </section>

                            <div class="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
                                <section class="rounded-[1.8rem] border border-border-subtle bg-surface-1/90 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
                                    <div class="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <p class="text-[0.68rem] font-mono uppercase tracking-[0.2em] text-text-tertiary">Latest arrivals</p>
                                            <h2 class="mt-2 text-2xl font-semibold text-text-primary">Recently added media</h2>
                                        </div>
                                        <Pill variant="info">{data().recentItems.length} newest successes</Pill>
                                    </div>

                                    <Show
                                        when={data().recentItems.length > 0}
                                        fallback={<p class="mt-6 rounded-2xl border border-border-subtle bg-surface-0/30 px-4 py-8 text-center text-sm text-text-tertiary">No recent successful movie or TV additions yet.</p>}
                                    >
                                        <div class="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                                            <For each={data().recentItems}>
                                                {(item) => (
                                                    <A
                                                        href={recentHref(item)}
                                                        class="group relative flex min-h-[19rem] flex-col justify-end overflow-hidden rounded-[1.5rem] border border-border-subtle bg-surface-0 transition duration-200 hover:-translate-y-1 hover:border-border-hover hover:shadow-[0_22px_60px_rgba(0,0,0,0.32)]"
                                                    >
                                                        <Show when={recentImage(item)}>
                                                            {(image) => (
                                                                <img
                                                                    src={image()}
                                                                    alt={item.title ?? "Recent media"}
                                                                    class="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                                                                />
                                                            )}
                                                        </Show>
                                                        <div class="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,9,13,0.08),rgba(7,9,13,0.18)_35%,rgba(7,9,13,0.94)_100%)]" />
                                                        <div class="absolute inset-x-0 top-0 flex items-center justify-between gap-2 px-4 py-4">
                                                            <Pill variant={item.mediaType === "TvShows" ? "info" : "default"}>{item.mediaType === "TvShows" ? "TV" : "Movie"}</Pill>
                                                            <Pill>{formatRelativeTime(item.createdAt)}</Pill>
                                                        </div>

                                                        <div class="relative space-y-3 px-4 pb-4 pt-24">
                                                            <div>
                                                                <p class="text-[0.68rem] font-mono uppercase tracking-[0.22em] text-text-secondary">{recentCaption(item)}</p>
                                                                <h3 class="mt-2 line-clamp-2 text-xl font-semibold leading-tight text-text-primary">
                                                                    {item.title ?? fileName(item.destFile ?? item.sourceFile)}
                                                                </h3>
                                                                <p class="mt-1 text-sm text-text-secondary">{recentMeta(item)}</p>
                                                            </div>

                                                            <div class="flex items-center justify-between gap-3 text-xs text-text-tertiary">
                                                                <span class="truncate">{fileName(item.destFile ?? item.sourceFile)}</span>
                                                                <span>{formatBytes(item.fileSize)}</span>
                                                            </div>
                                                        </div>
                                                    </A>
                                                )}
                                            </For>
                                        </div>
                                    </Show>
                                </section>

                                <section class="rounded-[1.8rem] border border-border-subtle bg-surface-1/90 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
                                    <div class="flex items-center justify-between gap-3">
                                        <div>
                                            <p class="text-[0.68rem] font-mono uppercase tracking-[0.2em] text-text-tertiary">Signal board</p>
                                            <h2 class="mt-2 text-2xl font-semibold text-text-primary">Cadence and pressure</h2>
                                        </div>
                                        <Clock3 class="text-info" size={20} />
                                    </div>

                                    <div class="mt-5 space-y-3">
                                        <div class="rounded-[1.3rem] border border-border-subtle bg-surface-0/30 px-4 py-4">
                                            <div class="flex items-center justify-between gap-3">
                                                <div class="flex items-center gap-2.5">
                                                    <Tv2 size={18} class="text-info" />
                                                    <p class="text-sm font-medium text-text-primary">TV share</p>
                                                </div>
                                                <p class="text-lg font-semibold text-text-primary">{data().distinctTvShows}</p>
                                            </div>
                                            <p class="mt-1.5 text-sm text-text-secondary">Distinct series currently tracked in the organized catalog.</p>
                                        </div>

                                        <div class="rounded-[1.3rem] border border-border-subtle bg-surface-0/30 px-4 py-4">
                                            <div class="flex items-center justify-between gap-3">
                                                <div class="flex items-center gap-2.5">
                                                    <Film size={18} class="text-accent" />
                                                    <p class="text-sm font-medium text-text-primary">Movie share</p>
                                                </div>
                                                <p class="text-lg font-semibold text-text-primary">{data().distinctMovies}</p>
                                            </div>
                                            <p class="mt-1.5 text-sm text-text-secondary">Distinct films with successful TMDb identity and library placement.</p>
                                        </div>

                                        <div class="rounded-[1.3rem] border border-border-subtle bg-surface-0/30 px-4 py-4">
                                            <div class="flex items-center justify-between gap-3">
                                                <p class="text-sm font-medium text-text-primary">Review queue</p>
                                                <p class="text-lg font-semibold text-text-primary">{data().attentionCount}</p>
                                            </div>
                                            <div class="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                                                <div class="rounded-xl border border-border-subtle bg-surface-1/70 px-2 py-2">
                                                    <p class="text-text-tertiary">Failed</p>
                                                    <p class="mt-1 text-sm font-semibold text-error">{failedCount()}</p>
                                                </div>
                                                <div class="rounded-xl border border-border-subtle bg-surface-1/70 px-2 py-2">
                                                    <p class="text-text-tertiary">Duplicate</p>
                                                    <p class="mt-1 text-sm font-semibold text-warning">{duplicateCount()}</p>
                                                </div>
                                                <div class="rounded-xl border border-border-subtle bg-surface-1/70 px-2 py-2">
                                                    <p class="text-text-tertiary">Unknown</p>
                                                    <p class="mt-1 text-sm font-semibold text-error">{unknownCount()}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="rounded-[1.3rem] border border-border-subtle bg-surface-0/30 px-4 py-4">
                                            <div class="flex items-center justify-between gap-3">
                                                <p class="text-sm font-medium text-text-primary">Tracked rows</p>
                                                <p class="text-lg font-semibold text-text-primary">{data().totalFiles}</p>
                                            </div>
                                            <p class="mt-1.5 text-sm text-text-secondary">Every scan row, including archive, duplicates, and unresolved items.</p>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            <div class="grid gap-6 xl:grid-cols-2">
                                <DonutPanel
                                    kicker="Composition"
                                    title="Media type breakdown"
                                    centerLabel="All rows"
                                    centerValue={String(data().totalFiles)}
                                    slices={mediaSlices()}
                                />
                                <DonutPanel
                                    kicker="Health"
                                    title="Ingest status split"
                                    centerLabel="Successful"
                                    centerValue={successRate()}
                                    slices={statusSlices()}
                                />
                            </div>

                            <section class="rounded-[1.8rem] border border-border-subtle bg-surface-1/90 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
                                <div class="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p class="text-[0.68rem] font-mono uppercase tracking-[0.2em] text-text-tertiary">Weight distribution</p>
                                        <h2 class="mt-2 text-2xl font-semibold text-text-primary">Storage by media type</h2>
                                    </div>
                                    <Pill>{formatBytes(data().totalFileSize)} total</Pill>
                                </div>

                                <div class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                    <For each={MEDIA_ORDER}>
                                        {(mediaType) => {
                                            const bucket = () => mediaStorage(data().storageByMediaType, mediaType);
                                            const ratio = () => (bucket().totalFileSize > 0 ? Math.max(8, (bucket().totalFileSize / largestStorage()) * 100) : 0);
                                            return (
                                                <div class="rounded-[1.35rem] border border-border-subtle bg-surface-0/30 px-4 py-4">
                                                    <div class="flex items-center justify-between gap-3">
                                                        <p class="text-sm font-medium text-text-primary">{mediaType === "TvShows" ? "TV Shows" : mediaType}</p>
                                                        <span class="h-3 w-3 rounded-full" style={{ "background-color": MEDIA_COLORS[mediaType] }} />
                                                    </div>
                                                    <p class="mt-3 text-2xl font-semibold text-text-primary">{formatBytes(bucket().totalFileSize)}</p>
                                                    <p class="mt-1 text-sm text-text-secondary">{bucket().count} rows in this bucket.</p>
                                                    <div class="mt-4 h-2.5 rounded-full bg-surface-3">
                                                        <div
                                                            class="h-full rounded-full"
                                                            style={{
                                                                width: `${ratio()}%`,
                                                                "background-color": MEDIA_COLORS[mediaType],
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        }}
                                    </For>
                                </div>
                            </section>
                        </>
                    );
                }}
            </Show>
        </section>
    );
}
