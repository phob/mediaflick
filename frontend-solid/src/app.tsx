import { A, Route, Router, useLocation, useParams } from "@solidjs/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import {
    For,
    Show,
    createEffect,
    createMemo,
    createSignal,
    onCleanup,
    onMount,
    type ParentComponent,
    type ParentProps,
} from "solid-js";
import { mediaApi } from "@/lib/api";
import { parseEpisodeInfo } from "@/lib/filename-parser";
import { createRealtimeSocket } from "@/lib/realtime";
import type {
    BulkUpdateApplyResponse,
    BulkUpdateItem,
    BulkUpdateRequest,
    ConfigurationPayload,
    FolderMappingConfig,
    LogEntry,
    LogLevel,
    MediaSearchResult,
    MediaStatus,
    MediaType,
    ScannedFile,
    SeasonInfo,
} from "@/lib/types";

const TMDB_IMG = "https://image.tmdb.org/t/p";
const mediaTypeOptions: MediaType[] = [
    "Movies",
    "TvShows",
    "Extras",
    "Unknown",
];

function cloneConfig(config: ConfigurationPayload): ConfigurationPayload {
    return {
        plex: {
            ...config.plex,
            folderMappings: config.plex.folderMappings.map((m) => ({ ...m })),
        },
        tmDb: { ...config.tmDb },
        mediaDetection: { ...config.mediaDetection },
        zurg: { ...config.zurg },
    };
}

function defaultFolderMapping(): FolderMappingConfig {
    return {
        sourceFolder: "/mnt/zurg/new-source",
        destinationFolder: "/mnt/organized/new-destination",
        mediaType: "TvShows",
    };
}

function fileName(path: string): string {
    const parts = path.split("/");
    return parts[parts.length - 1] ?? path;
}

function formatBytes(value: number | null): string {
    if (!value || value <= 0) return "Unknown size";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let current = value;
    let unit = 0;
    while (current >= 1024 && unit < units.length - 1) {
        current /= 1024;
        unit += 1;
    }
    return `${current.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatLogTimestamp(value: string | undefined): string {
    if (!value) return "Unknown";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
}

function logLevelColor(level: string | undefined): string {
    if (level === "Error" || level === "Fatal") return "text-error";
    if (level === "Warning") return "text-warning";
    if (level === "Debug" || level === "Verbose") return "text-text-tertiary";
    return "text-success";
}

function logLevelBg(level: string | undefined): string {
    if (level === "Error" || level === "Fatal")
        return "bg-error-muted border-error/30";
    if (level === "Warning") return "bg-warning-muted border-warning/30";
    if (level === "Debug" || level === "Verbose")
        return "bg-surface-3 border-border-default";
    return "bg-success-muted border-success/30";
}

function formatLogProperties(
    value: Record<string, unknown> | undefined,
): string {
    if (!value || Object.keys(value).length === 0) return "{}";
    return JSON.stringify(value, null, 2);
}

function formatAirDate(value: string | null): string {
    if (!value) return "Unknown";
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return "Unknown";
    return parsed.toLocaleDateString();
}

function parseIntOr(value: string, fallback: number): number {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function errorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message;
    }
    return "unknown error";
}

function sourceDirectory(path: string): string {
    const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
    const slashIndex = normalized.lastIndexOf("/");
    if (slashIndex < 0) return normalized;
    if (slashIndex === 0) return "/";
    return normalized.slice(0, slashIndex);
}

function sourceGroupLabel(path: string): string {
    const label = fileName(path);
    return label.length > 0 ? label : path;
}

function timestampValue(value: string | null | undefined): number {
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
}

function compareByRecency(left: ScannedFile, right: ScannedFile): number {
    return (
        timestampValue(right.updatedAt ?? right.createdAt) -
        timestampValue(left.updatedAt ?? left.createdAt)
    );
}

function compareBySourceDirectoryThenRecency(
    left: ScannedFile,
    right: ScannedFile,
): number {
    const byDir = sourceDirectory(left.sourceFile).localeCompare(
        sourceDirectory(right.sourceFile),
    );
    if (byDir !== 0) return byDir;
    const byRec = compareByRecency(left, right);
    if (byRec !== 0) return byRec;
    return left.sourceFile.localeCompare(right.sourceFile);
}

function annotateFilesWithSourceDividers(files: ScannedFile[]) {
    let previousDirectory: string | null = null;
    return files.map((file) => {
        const currentDirectory = sourceDirectory(file.sourceFile);
        const sourceDividerPath =
            previousDirectory !== null && previousDirectory !== currentDirectory
                ? currentDirectory
                : null;
        previousDirectory = currentDirectory;
        return { file, sourceDividerPath };
    });
}

function groupFilesBySourceDirectory(files: ScannedFile[]): { directory: string; label: string; files: ScannedFile[] }[] {
    const map = new Map<string, ScannedFile[]>()
    for (const f of files) {
        const dir = sourceDirectory(f.sourceFile)
        const existing = map.get(dir)
        if (existing) existing.push(f)
        else map.set(dir, [f])
    }
    return [...map.entries()].map(([directory, dirFiles]) => ({
        directory,
        label: sourceGroupLabel(directory),
        files: dirFiles,
    }))
}

function compareEpisodeFiles(left: ScannedFile, right: ScannedFile): number {
    const ls = left.seasonNumber ?? Number.MAX_SAFE_INTEGER;
    const rs = right.seasonNumber ?? Number.MAX_SAFE_INTEGER;
    if (ls !== rs) return ls - rs;
    const le = left.episodeNumber ?? Number.MAX_SAFE_INTEGER;
    const re = right.episodeNumber ?? Number.MAX_SAFE_INTEGER;
    if (le !== re) return le - re;
    return left.sourceFile.localeCompare(right.sourceFile);
}

function primaryFileName(file: ScannedFile): string {
    return fileName(file.destFile ?? file.sourceFile);
}

function posterUrl(
    path: string | null | undefined,
    size = "w342",
): string | null {
    if (!path) return null;
    return `${TMDB_IMG}/${size}${path}`;
}

function backdropUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    return `${TMDB_IMG}/w1280${path}`;
}

function StatusDot(props: { online: boolean }) {
    return (
        <span
            class={`inline-block w-2 h-2 rounded-full ${props.online ? "bg-success" : "bg-error"}`}
        />
    );
}

type PillVariant = "default" | "success" | "warning" | "error";

function Pill(props: ParentProps<{ variant?: PillVariant }>) {
    const colors = () => {
        if (props.variant === "success")
            return "bg-success-muted text-success border-success/20";
        if (props.variant === "warning")
            return "bg-warning-muted text-warning border-warning/20";
        if (props.variant === "error")
            return "bg-error-muted text-error border-error/20";
        return "bg-surface-3 text-text-secondary border-border-default";
    };
    return (
        <span
            class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors()}`}
        >
            {props.children}
        </span>
    );
}

function CardSkeleton() {
    return <div class="skeleton aspect-2/3 rounded-xl" />;
}

function RowSkeleton() {
    return <div class="skeleton h-16 rounded-lg" />;
}

function FileRowIdentity(props: { file: ScannedFile }) {
    return (
        <div class="min-w-0 flex-1">
            <p class="font-semibold text-sm text-text-primary truncate">
                {primaryFileName(props.file)}
            </p>
            <p class="text-xs text-text-tertiary mt-0.5 break-all line-clamp-1">
                {props.file.sourceFile}
            </p>
        </div>
    );
}

function SourceSubgroupSeparator(props: { sourcePath: string }) {
    return (
        <div
            class="flex items-center gap-3 mt-2 -mb-1"
            title={props.sourcePath}
        >
            <div class="h-px flex-1 bg-border-subtle" />
            <span class="text-[0.65rem] uppercase tracking-wider text-text-tertiary truncate max-w-[30ch]">
                {sourceGroupLabel(props.sourcePath)}
            </span>
        </div>
    );
}

function StatusBadge(props: { status: MediaStatus }) {
    const variant = (): PillVariant => {
        if (props.status === "Success") return "success";
        if (props.status === "Failed") return "error";
        if (props.status === "Duplicate") return "warning";
        return "default";
    };
    return <Pill variant={variant()}>{props.status}</Pill>;
}

async function listAllScannedFiles(params: {
    status?: MediaStatus;
    mediaType?: MediaType;
    searchTerm?: string;
}): Promise<ScannedFile[]> {
    const pageSize = 200;
    const first = await mediaApi.listScannedFiles({
        ...params,
        sortBy: "updatedAt",
        sortOrder: "desc",
        page: 1,
        pageSize,
    });
    const items = [...first.items];
    for (let page = 2; page <= first.totalPages; page += 1) {
        const next = await mediaApi.listScannedFiles({
            ...params,
            sortBy: "updatedAt",
            sortOrder: "desc",
            page,
            pageSize,
        });
        items.push(...next.items);
    }
    return items;
}

function NavLink(props: { href: string; children: string }) {
    const location = useLocation();
    const active = createMemo(
        () =>
            location.pathname === props.href ||
            location.pathname.startsWith(`${props.href}/`),
    );
    return (
        <A
            href={props.href}
            class={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                active()
                    ? "bg-accent text-surface-0"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-3"
            }`}
        >
            {props.children}
        </A>
    );
}

const logLevels: LogLevel[] = [
    "Verbose",
    "Debug",
    "Information",
    "Warning",
    "Error",
    "Fatal",
];

interface LogListItem {
    id: string;
    entry: LogEntry;
}

function logEntryId(entry: LogEntry): string {
    return `${entry.Timestamp ?? ""}|${entry.Level ?? ""}|${entry.RenderedMessage ?? ""}|${JSON.stringify(entry.Properties ?? {})}`;
}

function LogsViewer(props: {
    open: boolean;
    minLevel: LogLevel;
    searchTerm: string;
    recentMinutes: number | null;
    limit: number;
    logs: LogListItem[];
    isLoading: boolean;
    isError: boolean;
    isFetching: boolean;
    onClose: () => void;
    onRefresh: () => void;
    onMinLevelChange: (next: LogLevel) => void;
    onSearchTermChange: (next: string) => void;
    onApplyIngestPreset: () => void;
    onApplyFailuresPreset: () => void;
    onToggleLast15Minutes: () => void;
    onLimitChange: (next: number) => void;
}) {
    const [expandedIds, setExpandedIds] = createSignal<Set<string>>(new Set());

    createEffect(() => {
        const known = new Set(props.logs.map((i) => i.id));
        setExpandedIds((c) => {
            let changed = false;
            const n = new Set<string>();
            for (const id of c) {
                if (known.has(id)) n.add(id);
                else changed = true;
            }
            return changed ? n : c;
        });
    });

    createEffect(() => {
        if (!props.open) return;
        const h = (e: KeyboardEvent) => {
            if (e.key === "Escape") props.onClose();
        };
        window.addEventListener("keydown", h);
        onCleanup(() => window.removeEventListener("keydown", h));
    });

    const isExpanded = (id: string) => expandedIds().has(id);
    const setExpanded = (id: string, open: boolean) => {
        setExpandedIds((c) => {
            const n = new Set(c);
            open ? n.add(id) : n.delete(id);
            return n;
        });
    };

    return (
        <Show when={props.open}>
            <div
                class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                onClick={props.onClose}
            >
                <section
                    class="w-full max-w-4xl max-h-[90vh] bg-surface-1 border border-border-default rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Backend logs"
                    onClick={(e) => e.stopPropagation()}
                >
                    <header class="flex items-start justify-between gap-4 p-5 border-b border-border-subtle">
                        <div>
                            <h3 class="text-lg font-bold">Backend Logs</h3>
                            <p class="text-sm text-text-secondary mt-0.5">
                                Live backend events and processing outcomes.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={props.onClose}
                            class="px-3 py-1.5 text-sm rounded-lg border border-border-default bg-surface-2 text-text-secondary hover:text-text-primary hover:border-border-hover transition"
                        >
                            Close
                        </button>
                    </header>

                    <div class="p-4 border-b border-border-subtle space-y-3">
                        <div class="grid grid-cols-[auto_1fr_auto_auto] gap-3 items-end">
                            <label class="text-xs text-text-secondary space-y-1">
                                <span>Min level</span>
                                <select
                                    class="block w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary"
                                    value={props.minLevel}
                                    onChange={(e) =>
                                        props.onMinLevelChange(
                                            e.currentTarget.value as LogLevel,
                                        )
                                    }
                                >
                                    <For each={logLevels}>
                                        {(l) => <option value={l}>{l}</option>}
                                    </For>
                                </select>
                            </label>
                            <label class="text-xs text-text-secondary space-y-1">
                                <span>Search</span>
                                <input
                                    class="block w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary"
                                    value={props.searchTerm}
                                    placeholder="Filter message text"
                                    onInput={(e) =>
                                        props.onSearchTermChange(
                                            e.currentTarget.value,
                                        )
                                    }
                                />
                            </label>
                            <label class="text-xs text-text-secondary space-y-1">
                                <span>Limit</span>
                                <select
                                    class="block w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary"
                                    value={String(props.limit)}
                                    onChange={(e) =>
                                        props.onLimitChange(
                                            parseIntOr(
                                                e.currentTarget.value,
                                                200,
                                            ),
                                        )
                                    }
                                >
                                    <option value="100">100</option>
                                    <option value="200">200</option>
                                    <option value="500">500</option>
                                    <option value="1000">1000</option>
                                </select>
                            </label>
                            <button
                                type="button"
                                onClick={props.onRefresh}
                                class="px-3 py-2 text-sm rounded-lg border border-border-default bg-surface-2 text-text-secondary hover:text-text-primary hover:border-border-hover transition self-end"
                            >
                                Refresh
                            </button>
                        </div>
                        <div class="flex gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={props.onApplyIngestPreset}
                                class="px-3 py-1 text-xs rounded-full border border-border-default bg-surface-2 text-text-secondary hover:text-text-primary hover:border-border-hover transition"
                            >
                                Ingest only
                            </button>
                            <button
                                type="button"
                                onClick={props.onApplyFailuresPreset}
                                class="px-3 py-1 text-xs rounded-full border border-border-default bg-surface-2 text-text-secondary hover:text-text-primary hover:border-border-hover transition"
                            >
                                Failures only
                            </button>
                            <button
                                type="button"
                                onClick={props.onToggleLast15Minutes}
                                class={`px-3 py-1 text-xs rounded-full border transition ${props.recentMinutes === 15 ? "bg-accent-muted text-accent border-accent/30" : "border-border-default bg-surface-2 text-text-secondary hover:text-text-primary hover:border-border-hover"}`}
                            >
                                Last 15 min
                            </button>
                        </div>
                    </div>

                    <Show when={props.isLoading}>
                        <p class="p-6 text-text-secondary text-sm">
                            Loading backend logs...
                        </p>
                    </Show>
                    <Show when={props.isError}>
                        <p class="p-6 text-error text-sm">
                            Unable to load logs right now.
                        </p>
                    </Show>
                    <Show
                        when={
                            !props.isLoading &&
                            !props.isError &&
                            props.logs.length === 0
                        }
                    >
                        <p class="p-6 text-text-tertiary text-sm">
                            No logs match this filter.
                        </p>
                    </Show>

                    <div class="flex-1 overflow-auto p-4 space-y-2 min-h-0">
                        <For each={props.logs}>
                            {(item) => (
                                <article class="bg-surface-2 border border-border-subtle rounded-lg p-3 space-y-2">
                                    <div class="flex items-center justify-between gap-3">
                                        <span
                                            class={`inline-flex px-2 py-0.5 rounded-full text-[0.7rem] font-medium border ${logLevelBg(item.entry.Level)} ${logLevelColor(item.entry.Level)}`}
                                        >
                                            {item.entry.Level ?? "Information"}
                                        </span>
                                        <span class="text-xs text-text-tertiary">
                                            {formatLogTimestamp(
                                                item.entry.Timestamp,
                                            )}
                                        </span>
                                    </div>
                                    <p class="text-sm text-text-primary">
                                        {item.entry.RenderedMessage ??
                                            "(empty log message)"}
                                    </p>
                                    <Show
                                        when={
                                            item.entry.Properties &&
                                            Object.keys(item.entry.Properties)
                                                .length > 0
                                        }
                                    >
                                        <details
                                            open={isExpanded(item.id)}
                                            onToggle={(e) =>
                                                setExpanded(
                                                    item.id,
                                                    e.currentTarget.open,
                                                )
                                            }
                                        >
                                            <summary class="cursor-pointer text-xs text-text-tertiary hover:text-text-secondary transition">
                                                Properties
                                            </summary>
                                            <pre class="mt-2 bg-surface-0 border border-border-subtle rounded-lg p-3 text-xs text-text-secondary overflow-auto max-h-44">
                                                {formatLogProperties(
                                                    item.entry.Properties,
                                                )}
                                            </pre>
                                        </details>
                                    </Show>
                                </article>
                            )}
                        </For>
                    </div>

                    <footer class="px-5 py-3 border-t border-border-subtle text-xs text-text-tertiary">
                        {props.isFetching && !props.isLoading
                            ? "Refreshing..."
                            : `Showing ${props.logs.length} log entries`}
                    </footer>
                </section>
            </div>
        </Show>
    );
}

const AppShell: ParentComponent = (props) => {
    const queryClient = useQueryClient();
    const [lastHeartbeat, setLastHeartbeat] = createSignal<number>(0);
    const [lastZurgSignal, setLastZurgSignal] = createSignal<number>(0);
    const [logsOpen, setLogsOpen] = createSignal(false);
    const [logsMinLevel, setLogsMinLevel] =
        createSignal<LogLevel>("Information");
    const [logsSearchTerm, setLogsSearchTerm] = createSignal("");
    const [logsRecentMinutes, setLogsRecentMinutes] = createSignal<
        number | null
    >(null);
    const [logsLimit, setLogsLimit] = createSignal(200);
    const [logItems, setLogItems] = createSignal<LogListItem[]>([]);

    onMount(() => {
        const cleanupSocket = createRealtimeSocket((message) => {
            if (message.type === "heartbeat") {
                const ts = Number(message.payload);
                if (Number.isFinite(ts)) setLastHeartbeat(ts);
                return;
            }
            if (message.type === "zurg.version") {
                const ts = Number(message.payload);
                if (Number.isFinite(ts)) setLastZurgSignal(ts);
                return;
            }
            if (
                message.type === "file.added" ||
                message.type === "file.updated" ||
                message.type === "file.removed"
            ) {
                for (const key of [
                    "titles",
                    "show",
                    "movie",
                    "tv-files",
                    "movie-files",
                    "unidentified-files",
                    "logs",
                ]) {
                    void queryClient.invalidateQueries({ queryKey: [key] });
                }
            }
        });
        onCleanup(() => cleanupSocket());
    });

    const backendOnline = createMemo(
        () => lastHeartbeat() > 0 && Date.now() - lastHeartbeat() < 70_000,
    );
    const zurgOnline = createMemo(
        () => lastZurgSignal() > 0 && Date.now() - lastZurgSignal() < 70_000,
    );
    const logsFilterKey = createMemo(
        () =>
            `${logsMinLevel()}|${logsSearchTerm().trim().toLowerCase()}|${logsLimit()}|${logsRecentMinutes() ?? "all"}`,
    );

    const logsQuery = useQuery(() => ({
        queryKey: ["logs", logsFilterKey(), logsOpen()],
        queryFn: () =>
            mediaApi.getLogs({
                minLevel: logsMinLevel(),
                searchTerm: logsSearchTerm(),
                limit: logsLimit(),
                from: (() => {
                    const recentMinutes = logsRecentMinutes()
                    if (recentMinutes === null) return undefined
                    return new Date(
                        Date.now() - recentMinutes * 60_000,
                    ).toISOString()
                })(),
            }),
        enabled: logsOpen(),
        refetchInterval: logsOpen() ? 15000 : false,
    }));

    createEffect(() => {
        logsFilterKey();
        setLogItems([]);
    });
    createEffect(() => {
        const logs = logsQuery.data?.logs ?? [];
        if (logs.length === 0) return;
        setLogItems((current) => {
            const byId = new Map(current.map((i) => [i.id, i]));
            const adds: LogListItem[] = [];
            for (const entry of logs) {
                const id = logEntryId(entry);
                if (!byId.has(id)) adds.push({ id, entry });
            }
            if (adds.length === 0) return current;
            return [...adds, ...current].slice(0, logsLimit());
        });
    });

    return (
        <div class="min-h-screen flex flex-col">
            <header class="sticky top-0 z-30 bg-surface-1/80 backdrop-blur-xl border-b border-border-subtle">
                <div class="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
                    <A href="/" class="text-lg font-bold tracking-tight">
                        <span class="text-text-primary">Media</span>
                        <span class="text-accent">Flick</span>
                    </A>
                    <nav class="hidden sm:flex items-center gap-1">
                        <NavLink href="/shows">TV Shows</NavLink>
                        <NavLink href="/movies">Movies</NavLink>
                        <NavLink href="/unidentified">Unidentified</NavLink>
                        <NavLink href="/settings">Settings</NavLink>
                    </nav>
                    <div class="flex items-center gap-3 text-xs text-text-secondary">
                        <span class="hidden lg:flex items-center gap-1.5">
                            <StatusDot online={backendOnline()} /> Backend
                        </span>
                        <span class="hidden lg:flex items-center gap-1.5">
                            <StatusDot online={zurgOnline()} /> Zurg
                        </span>
                        <button
                            type="button"
                            onClick={() => setLogsOpen(true)}
                            class="px-3 py-1.5 rounded-lg border border-border-default bg-surface-2 text-text-secondary hover:text-text-primary hover:border-border-hover transition text-xs font-medium"
                        >
                            Logs
                        </button>
                    </div>
                </div>
                <nav class="sm:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto">
                    <NavLink href="/shows">TV Shows</NavLink>
                    <NavLink href="/movies">Movies</NavLink>
                    <NavLink href="/unidentified">Unidentified</NavLink>
                    <NavLink href="/settings">Settings</NavLink>
                </nav>
            </header>

            <main
                class="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6"
                style="animation: fade-in 250ms ease-out"
            >
                {props.children}
            </main>

            <LogsViewer
                open={logsOpen()}
                minLevel={logsMinLevel()}
                searchTerm={logsSearchTerm()}
                recentMinutes={logsRecentMinutes()}
                limit={logsLimit()}
                logs={logItems()}
                isLoading={logsQuery.isLoading}
                isError={logsQuery.isError}
                isFetching={logsQuery.isFetching}
                onClose={() => setLogsOpen(false)}
                onRefresh={() => {
                    void logsQuery.refetch();
                }}
                onMinLevelChange={setLogsMinLevel}
                onSearchTermChange={setLogsSearchTerm}
                onApplyIngestPreset={() => {
                    setLogsMinLevel("Information");
                    setLogsSearchTerm("file");
                }}
                onApplyFailuresPreset={() => {
                    setLogsMinLevel("Warning");
                    setLogsSearchTerm("File processed with issue");
                }}
                onToggleLast15Minutes={() =>
                    setLogsRecentMinutes((c) => (c === 15 ? null : 15))
                }
                onLimitChange={setLogsLimit}
            />
        </div>
    );
};

function MediaSearchHeader(props: {
    title: string;
    subtitle: string;
    searchValue: string;
    onSearch: (next: string) => void;
}) {
    return (
        <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
                <h1 class="text-2xl font-bold">{props.title}</h1>
                <p class="text-sm text-text-secondary mt-1">{props.subtitle}</p>
            </div>
            <input
                value={props.searchValue}
                onInput={(e) => props.onSearch(e.currentTarget.value)}
                class="w-full sm:w-72 bg-surface-2 border border-border-default rounded-lg px-3.5 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition"
                placeholder="Search titles..."
            />
        </div>
    );
}

function PosterCard(props: {
    href: string;
    title: string;
    posterPath: string | null | undefined;
    subtitle?: string;
}) {
    const url = () => posterUrl(props.posterPath);
    return (
        <A
            href={props.href}
            class="group relative block rounded-xl overflow-hidden bg-surface-2 border border-border-subtle hover:border-accent/40 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-accent/5"
        >
            <div class="aspect-2/3 relative">
                <Show
                    when={url()}
                    fallback={
                        <div class="absolute inset-0 flex items-center justify-center bg-linear-to-b from-surface-3 to-surface-2 p-4">
                            <span class="text-center text-sm font-semibold text-text-secondary">
                                {props.title}
                            </span>
                        </div>
                    }
                >
                    {(src) => (
                        <img
                            src={src()}
                            alt={props.title}
                            loading="lazy"
                            class="absolute inset-0 w-full h-full object-cover"
                        />
                    )}
                </Show>
                <div class="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/90 via-black/50 to-transparent pt-16 pb-3 px-3">
                    <p class="text-sm font-semibold text-white leading-tight line-clamp-2">
                        {props.title}
                    </p>
                    <Show when={props.subtitle}>
                        <p class="text-xs text-white/60 mt-0.5">
                            {props.subtitle}
                        </p>
                    </Show>
                </div>
            </div>
        </A>
    );
}

function TvShowsPage() {
    const [searchTerm, setSearchTerm] = createSignal("");
    const titlesQuery = useQuery(() => ({
        queryKey: ["titles", "tv", searchTerm().trim().toLowerCase()],
        queryFn: () => mediaApi.listTitles("TvShows", searchTerm()),
    }));

    return (
        <section>
            <MediaSearchHeader
                title="TV Shows"
                subtitle="Open any show and switch episode grouping when TMDb offers alternatives."
                searchValue={searchTerm()}
                onSearch={setSearchTerm}
            />

            <Show when={titlesQuery.isLoading}>
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    <For each={Array(12)}>{() => <CardSkeleton />}</For>
                </div>
            </Show>
            <Show when={titlesQuery.isError}>
                <p class="text-error text-sm">
                    Unable to load TV shows right now.
                </p>
            </Show>
            <Show
                when={
                    !titlesQuery.isLoading &&
                    !titlesQuery.isError &&
                    (titlesQuery.data?.length ?? 0) === 0
                }
            >
                <p class="text-text-tertiary text-sm py-12 text-center">
                    No TV shows found for this filter.
                </p>
            </Show>

            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                <For each={titlesQuery.data ?? []}>
                    {(item) => (
                        <PosterCard
                            href={`/shows/${item.tmdbId}`}
                            title={item.title ?? "Unknown title"}
                            posterPath={item.posterPath}
                        />
                    )}
                </For>
            </div>
        </section>
    );
}

function MoviesPage() {
    const [searchTerm, setSearchTerm] = createSignal("");
    const titlesQuery = useQuery(() => ({
        queryKey: ["titles", "movies", searchTerm().trim().toLowerCase()],
        queryFn: () => mediaApi.listTitles("Movies", searchTerm()),
    }));

    return (
        <section>
            <MediaSearchHeader
                title="Movies"
                subtitle="Inspect each movie directly and reveal same-folder files that should be treated as extras."
                searchValue={searchTerm()}
                onSearch={setSearchTerm}
            />

            <Show when={titlesQuery.isLoading}>
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    <For each={Array(18)}>{() => <CardSkeleton />}</For>
                </div>
            </Show>
            <Show when={titlesQuery.isError}>
                <p class="text-error text-sm">
                    Unable to load movies right now.
                </p>
            </Show>
            <Show
                when={
                    !titlesQuery.isLoading &&
                    !titlesQuery.isError &&
                    (titlesQuery.data?.length ?? 0) === 0
                }
            >
                <p class="text-text-tertiary text-sm py-12 text-center">
                    No movies found for this filter.
                </p>
            </Show>

            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                <For each={titlesQuery.data ?? []}>
                    {(item) => (
                        <PosterCard
                            href={`/movies/${item.tmdbId}`}
                            title={item.title ?? "Unknown title"}
                            posterPath={item.posterPath}
                        />
                    )}
                </For>
            </div>
        </section>
    );
}

function TmdbSearchInput(props: {
    mediaType: "Movies" | "TvShows"
    onSelect: (result: MediaSearchResult) => void
    initialQuery?: string
    placeholder?: string
    class?: string
}) {
    const [query, setQuery] = createSignal(props.initialQuery ?? "")
    const [open, setOpen] = createSignal(false)
    let debounceTimer: ReturnType<typeof setTimeout> | undefined

    const searchQuery = useQuery(() => ({
        queryKey: ["tmdb-search", props.mediaType, query().trim().toLowerCase()],
        queryFn: () =>
            props.mediaType === "Movies"
                ? mediaApi.searchMovies(query())
                : mediaApi.searchTvShows(query()),
        enabled: query().trim().length >= 2 && open(),
    }))

    const handleInput = (value: string) => {
        setQuery(value)
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
            if (value.trim().length >= 2) setOpen(true)
        }, 300)
    }

    const handleSelect = (result: MediaSearchResult) => {
        setQuery(result.title)
        setOpen(false)
        props.onSelect(result)
    }

    return (
        <div class={`relative ${props.class ?? ""}`}>
            <input
                value={query()}
                onInput={(e) => handleInput(e.currentTarget.value)}
                onFocus={() => { if (query().trim().length >= 2) setOpen(true) }}
                class="w-full bg-surface-3 border border-border-default rounded-lg px-3.5 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition"
                placeholder={props.placeholder ?? `Search ${props.mediaType === "Movies" ? "movies" : "TV shows"}...`}
            />
            <Show when={open() && (searchQuery.data?.length ?? 0) > 0}>
                <div
                    class="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto bg-surface-2 border border-border-default rounded-xl shadow-xl"
                    onMouseDown={(e) => e.preventDefault()}
                >
                    <For each={searchQuery.data ?? []}>
                        {(result) => (
                            <button
                                type="button"
                                class="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-surface-3 transition text-sm"
                                onClick={() => handleSelect(result)}
                            >
                                <Show
                                    when={result.posterPath}
                                    fallback={<div class="w-8 h-12 rounded bg-surface-3 shrink-0" />}
                                >
                                    {(poster) => (
                                        <img
                                            src={`${TMDB_IMG}/w92${poster()}`}
                                            alt=""
                                            class="w-8 h-12 rounded object-cover shrink-0"
                                        />
                                    )}
                                </Show>
                                <div class="min-w-0 flex-1">
                                    <p class="text-text-primary font-medium truncate">{result.title}</p>
                                    <p class="text-xs text-text-tertiary">{result.year ?? "Year unknown"}</p>
                                </div>
                                <span class="text-xs text-text-tertiary shrink-0">#{result.tmdbId}</span>
                            </button>
                        )}
                    </For>
                </div>
            </Show>
            <Show when={open() && searchQuery.isLoading}>
                <div class="absolute z-50 mt-1 w-full bg-surface-2 border border-border-default rounded-xl shadow-xl px-4 py-3">
                    <p class="text-sm text-text-secondary animate-pulse">Searching...</p>
                </div>
            </Show>
        </div>
    )
}

interface EditableFile {
    id: number
    sourceFile: string
    status: MediaStatus
    tmdbId: number | null
    seasonNumber: number | null
    episodeNumber: number | null
    episodeNumber2: number | null
    mediaType: MediaType | null
    confidence: "high" | "medium" | "low"
    ignoreAutoIncrement: boolean
}

function IdentifyModal(props: {
    open: boolean
    onClose: () => void
    initialMode: "TvShows" | "Movies"
    files: ScannedFile[]
    preselectedTmdbId?: number
    reassignOldTmdbId?: number
}) {
    const queryClient = useQueryClient()
    const [mode, setMode] = createSignal<"TvShows" | "Movies">(props.initialMode)
    const [selectedMedia, setSelectedMedia] = createSignal<MediaSearchResult | null>(null)
    const [editableFiles, setEditableFiles] = createSignal<EditableFile[]>([])
    const [saving, setSaving] = createSignal(false)
    const [saveResult, setSaveResult] = createSignal<string | null>(null)
    const [showDryRun, setShowDryRun] = createSignal(false)
    const [dryRunInfo, setDryRunInfo] = createSignal<string | null>(null)

    createEffect(() => {
        if (!props.open || props.files.length === 0) return
        setMode(props.initialMode)
        setSaveResult(null)
        setShowDryRun(false)
        setDryRunInfo(null)

        const parsed = props.files
            .slice()
            .sort((a, b) => a.sourceFile.localeCompare(b.sourceFile))
            .map((file) => {
                const info = parseEpisodeInfo(file.sourceFile)
                return {
                    id: file.id,
                    sourceFile: file.sourceFile,
                    status: file.status,
                    tmdbId: file.tmdbId,
                    seasonNumber: file.seasonNumber ?? info.season ?? null,
                    episodeNumber: file.episodeNumber ?? info.episode ?? null,
                    episodeNumber2: file.episodeNumber2 ?? info.episode2 ?? null,
                    mediaType: file.mediaType,
                    confidence: (file.seasonNumber || file.episodeNumber) ? "high" as const : info.confidence,
                    ignoreAutoIncrement: false,
                }
            })
        setEditableFiles(parsed)

        if (props.preselectedTmdbId) {
            setSelectedMedia(null)
        }
    })

    const handleTvMediaSelect = (result: MediaSearchResult) => {
        setSelectedMedia(result)
        setEditableFiles((prev) =>
            prev.map((f) => ({ ...f, tmdbId: result.tmdbId }))
        )
    }

    const handleMovieMediaSelect = (index: number, result: MediaSearchResult) => {
        setEditableFiles((prev) => {
            const next = [...prev]
            next[index] = { ...next[index], tmdbId: result.tmdbId }
            return next
        })
    }

    const handleSeasonChange = (index: number, value: string) => {
        const seasonNumber = value === "" ? null : Number(value)
        setEditableFiles((prev) => {
            const next = [...prev]
            for (let i = index; i < next.length; i++) {
                next[i] = { ...next[i], seasonNumber }
            }
            return next
        })
    }

    const handleEpisodeChange = (index: number, value: string) => {
        const episodeNumber = value === "" ? null : Number(value)
        setEditableFiles((prev) => {
            const next = [...prev]
            next[index] = { ...next[index], episodeNumber }
            if (episodeNumber !== null) {
                const currentSeason = next[index].seasonNumber
                let nextEp = episodeNumber + 1
                for (let i = index + 1; i < next.length; i++) {
                    if (next[i].seasonNumber === currentSeason && !next[i].ignoreAutoIncrement) {
                        next[i] = { ...next[i], episodeNumber: nextEp }
                        nextEp += 1
                    }
                }
            }
            return next
        })
    }

    const handleEpisode2Change = (index: number, value: string) => {
        setEditableFiles((prev) => {
            const next = [...prev]
            next[index] = { ...next[index], episodeNumber2: value === "" ? null : Number(value) }
            return next
        })
    }

    const handleIgnoreChange = (index: number, checked: boolean) => {
        setEditableFiles((prev) => {
            const next = [...prev]
            next[index] = { ...next[index], ignoreAutoIncrement: checked }
            return next
        })
    }

    const buildRequest = (dryRun: boolean): BulkUpdateRequest => {
        const updates: BulkUpdateItem[] = editableFiles().map((f) => ({
            id: f.id,
            tmdbId: f.tmdbId ?? undefined,
            seasonNumber: mode() === "TvShows" ? (f.seasonNumber ?? undefined) : undefined,
            episodeNumber: mode() === "TvShows" ? (f.episodeNumber ?? undefined) : undefined,
            episodeNumber2: mode() === "TvShows" ? (f.episodeNumber2 ?? undefined) : undefined,
            mediaType: mode(),
        }))

        const req: BulkUpdateRequest = { dryRun, updates }

        const media = selectedMedia()
        if (mode() === "TvShows" && props.reassignOldTmdbId && media) {
            req.identityUpdate = {
                oldTmdbId: props.reassignOldTmdbId,
                newTmdbId: media.tmdbId,
                newCanonicalTitle: media.title,
                newYear: media.year,
                newImdbId: null,
            }
        }

        return req
    }

    const handleDryRun = async () => {
        const req = buildRequest(true)
        try {
            const result = await mediaApi.batchUpdate(req)
            if ("willUpdate" in result) {
                let info = `Will update ${result.willUpdate} of ${result.totalFiles} files.`
                if (result.conflicts.length > 0) {
                    info += ` ${result.conflicts.length} conflict(s): ${result.conflicts.map(c => c.reason).join(", ")}`
                }
                if (result.identityUpdate) {
                    info += ` Identity: ${result.identityUpdate.identitiesWillUpdate} mapping(s), ${result.identityUpdate.aliasesWillRedirect} alias(es) will redirect.`
                }
                setDryRunInfo(info)
                setShowDryRun(true)
            }
        } catch (err) {
            setDryRunInfo(`Dry-run failed: ${err instanceof Error ? err.message : "Unknown error"}`)
            setShowDryRun(true)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        setSaveResult(null)
        try {
            const req = buildRequest(false)
            const result = await mediaApi.batchUpdate(req) as BulkUpdateApplyResponse
            const parts: string[] = [`Updated ${result.updated} file(s).`]
            if (result.symlinksRecreated > 0) parts.push(`${result.symlinksRecreated} symlink(s) recreated.`)
            if (result.symlinksFailed > 0) parts.push(`${result.symlinksFailed} symlink(s) failed.`)
            if (result.failed.length > 0) parts.push(`${result.failed.length} file(s) failed.`)
            if (result.identityUpdated) parts.push("Series identity updated.")
            setSaveResult(parts.join(" "))

            for (const key of ["titles", "show", "movie", "tv-files", "movie-files", "unidentified-files"]) {
                void queryClient.invalidateQueries({ queryKey: [key] })
            }

            if (result.failed.length === 0) {
                setTimeout(() => props.onClose(), 1500)
            }
        } catch (err) {
            setSaveResult(`Save failed: ${err instanceof Error ? err.message : "Unknown error"}`)
        } finally {
            setSaving(false)
        }
    }

    const confidenceColor = (c: "high" | "medium" | "low") => {
        if (c === "high") return "bg-success"
        if (c === "medium") return "bg-warning"
        return "bg-error"
    }

    return (
        <Show when={props.open}>
            <div
                class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                onClick={props.onClose}
            >
                <section
                    class="w-full max-w-6xl max-h-[90vh] bg-surface-1 border border-border-default rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Identify media files"
                    onClick={(e) => e.stopPropagation()}
                >
                    <header class="flex items-start justify-between gap-4 p-5 border-b border-border-subtle">
                        <div>
                            <h3 class="text-lg font-bold">
                                Identify as {mode() === "TvShows" ? "TV Show" : "Movie"}
                            </h3>
                            <p class="text-sm text-text-secondary mt-0.5">
                                {editableFiles().length} file(s) selected
                            </p>
                        </div>
                        <div class="flex items-center gap-2">
                            <select
                                class="bg-surface-2 border border-border-default rounded-lg px-3 py-1.5 text-sm text-text-primary"
                                value={mode()}
                                onChange={(e) => {
                                    const newMode = e.currentTarget.value as "TvShows" | "Movies"
                                    setMode(newMode)
                                    setSelectedMedia(null)
                                }}
                            >
                                <option value="TvShows">TV Show</option>
                                <option value="Movies">Movie</option>
                            </select>
                            <button
                                type="button"
                                onClick={props.onClose}
                                class="px-3 py-1.5 text-sm rounded-lg border border-border-default bg-surface-2 text-text-secondary hover:text-text-primary hover:border-border-hover transition"
                            >
                                Close
                            </button>
                        </div>
                    </header>

                    <Show when={mode() === "TvShows"}>
                        <div class="p-4 border-b border-border-subtle flex items-center gap-4">
                            <TmdbSearchInput
                                mediaType="TvShows"
                                onSelect={handleTvMediaSelect}
                                placeholder="Search for a TV show..."
                                class="flex-1"
                            />
                            <Show when={selectedMedia()}>
                                {(media) => (
                                    <div class="flex items-center gap-2 shrink-0">
                                        <Show when={media().posterPath}>
                                            {(poster) => (
                                                <img
                                                    src={`${TMDB_IMG}/w92${poster()}`}
                                                    alt=""
                                                    class="w-8 h-12 rounded object-cover"
                                                />
                                            )}
                                        </Show>
                                        <div class="text-sm">
                                            <p class="font-medium text-text-primary">{media().title}</p>
                                            <p class="text-xs text-text-tertiary">#{media().tmdbId} · {media().year ?? "?"}</p>
                                        </div>
                                    </div>
                                )}
                            </Show>
                        </div>
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
                                                <td class="px-4 py-2">
                                                    <p class="truncate max-w-md" title={file.sourceFile}>
                                                        {fileName(file.sourceFile)}
                                                    </p>
                                                </td>
                                                <td class="px-2 py-2">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        class="w-14 bg-surface-3 border border-border-default rounded px-2 py-1 text-sm text-text-primary"
                                                        value={file.seasonNumber?.toString() ?? ""}
                                                        onInput={(e) => handleSeasonChange(index(), e.currentTarget.value)}
                                                    />
                                                </td>
                                                <td class="px-2 py-2">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        class="w-14 bg-surface-3 border border-border-default rounded px-2 py-1 text-sm text-text-primary"
                                                        value={file.episodeNumber?.toString() ?? ""}
                                                        onInput={(e) => handleEpisodeChange(index(), e.currentTarget.value)}
                                                    />
                                                </td>
                                                <td class="px-2 py-2">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        class="w-14 bg-surface-3 border border-border-default rounded px-2 py-1 text-sm text-text-primary"
                                                        value={file.episodeNumber2?.toString() ?? ""}
                                                        onInput={(e) => handleEpisode2Change(index(), e.currentTarget.value)}
                                                    />
                                                </td>
                                                <td class="px-2 py-2 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={file.ignoreAutoIncrement}
                                                        onChange={(e) => handleIgnoreChange(index(), e.currentTarget.checked)}
                                                        class="accent-accent"
                                                    />
                                                </td>
                                                <td class="px-2 py-2 text-center">
                                                    <span
                                                        class={`inline-block w-2.5 h-2.5 rounded-full ${confidenceColor(file.confidence)}`}
                                                        title={`${file.confidence} confidence`}
                                                    />
                                                </td>
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
                                            const info = parseEpisodeInfo(file.sourceFile)
                                            return (
                                                <tr class="border-b border-border-subtle hover:bg-surface-2/50">
                                                    <td class="px-4 py-2">
                                                        <p class="truncate max-w-sm" title={file.sourceFile}>
                                                            {fileName(file.sourceFile)}
                                                        </p>
                                                    </td>
                                                    <td class="px-2 py-2 text-text-tertiary">
                                                        {file.tmdbId ?? "—"}
                                                    </td>
                                                    <td class="px-2 py-2">
                                                        <TmdbSearchInput
                                                            mediaType="Movies"
                                                            initialQuery={info.cleanTitle}
                                                            onSelect={(r) => handleMovieMediaSelect(index(), r)}
                                                            placeholder="Search movie..."
                                                            class="w-full"
                                                        />
                                                    </td>
                                                </tr>
                                            )
                                        }}
                                    </For>
                                </tbody>
                            </table>
                        </Show>
                    </div>

                    <footer class="px-5 py-4 border-t border-border-subtle space-y-3">
                        <Show when={showDryRun() && dryRunInfo()}>
                            <p class="text-sm text-text-secondary bg-surface-2 border border-border-subtle rounded-lg px-3 py-2">
                                {dryRunInfo()}
                            </p>
                        </Show>
                        <Show when={saveResult()}>
                            {(message) => (
                                <p class={`text-sm ${message().includes("failed") ? "text-error" : "text-success"}`}>
                                    {message()}
                                </p>
                            )}
                        </Show>
                        <div class="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={props.onClose}
                                class="px-4 py-2 text-sm rounded-lg border border-border-default bg-surface-2 text-text-secondary hover:text-text-primary hover:border-border-hover transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleDryRun}
                                disabled={saving()}
                                class="px-4 py-2 text-sm rounded-lg border border-border-default bg-surface-2 text-text-secondary hover:text-text-primary hover:border-border-hover disabled:opacity-40 disabled:cursor-not-allowed transition"
                            >
                                Preview
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving()}
                                class="px-5 py-2 text-sm font-semibold rounded-lg bg-accent text-surface-0 hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition"
                            >
                                {saving() ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </footer>
                </section>
            </div>
        </Show>
    )
}

function UnidentifiedFileRow(props: {
    file: ScannedFile;
    sourceDividerPath?: string | null;
    selected?: boolean;
    onToggle?: (id: number) => void;
}) {
    return (
        <>
            <Show when={props.sourceDividerPath}>
                {(p) => <SourceSubgroupSeparator sourcePath={p()} />}
            </Show>
            <div
                class={`flex items-center gap-3 bg-surface-2 border rounded-lg px-4 py-3 cursor-pointer transition ${props.selected ? "border-accent/50 bg-accent/5" : "border-border-subtle hover:border-border-hover"}`}
                onClick={() => props.onToggle?.(props.file.id)}
            >
                <input
                    type="checkbox"
                    checked={props.selected ?? false}
                    onChange={() => props.onToggle?.(props.file.id)}
                    class="unidentified-checkbox shrink-0"
                    onClick={(e) => e.stopPropagation()}
                />
                <FileRowIdentity file={props.file} />
                <div class="flex flex-wrap items-center gap-1.5 shrink-0">
                    <StatusBadge status={props.file.status} />
                    <Pill>{props.file.mediaType ?? "No type"}</Pill>
                    <Pill>{formatBytes(props.file.fileSize)}</Pill>
                </div>
            </div>
        </>
    );
}

function UnidentifiedPage() {
    const queryClient = useQueryClient()
    const [searchTerm, setSearchTerm] = createSignal("")
    const [selectedIds, setSelectedIds] = createSignal<Set<number>>(new Set())
    const [identifyModalOpen, setIdentifyModalOpen] = createSignal(false)
    const [identifyMode, setIdentifyMode] = createSignal<"TvShows" | "Movies">("TvShows")

    const unidentifiedQuery = useQuery(() => ({
        queryKey: ["unidentified-files", searchTerm().trim().toLowerCase()],
        queryFn: async () => {
            const s = searchTerm().trim();
            const [failedFiles, duplicateFiles, unknownTypeFiles] =
                await Promise.all([
                    listAllScannedFiles({ status: "Failed", searchTerm: s }),
                    listAllScannedFiles({ status: "Duplicate", searchTerm: s }),
                    listAllScannedFiles({
                        mediaType: "Unknown",
                        searchTerm: s,
                    }),
                ]);
            const byId = new Map<number, ScannedFile>();
            for (const f of [
                ...failedFiles,
                ...duplicateFiles,
                ...unknownTypeFiles,
            ])
                byId.set(f.id, f);
            const files = [...byId.values()].sort(compareByRecency);
            const groupedByType = new Map<string, ScannedFile[]>();
            for (const f of files) {
                const k = f.mediaType ?? "No media type";
                const existing = groupedByType.get(k)
                if (existing) existing.push(f)
                else groupedByType.set(k, [f])
            }
            const typeOrder: Record<string, number> = {
                "No media type": 0,
                Unknown: 1,
                TvShows: 2,
                Movies: 3,
                Extras: 4,
            };
            const typeGroups = [...groupedByType.entries()]
                .sort(
                    (a, b) =>
                        (typeOrder[a[0]] ?? 99) - (typeOrder[b[0]] ?? 99) ||
                        a[0].localeCompare(b[0]),
                )
                .map(([type, gf]) => ({
                    type,
                    count: gf.length,
                    files: [...gf].sort(compareBySourceDirectoryThenRecency),
                }));
            return {
                files,
                typeGroups,
                total: files.length,
                failedCount: files.filter((f) => f.status === "Failed").length,
                duplicateCount: files.filter((f) => f.status === "Duplicate")
                    .length,
                unknownTypeCount: files.filter((f) => f.mediaType === "Unknown")
                    .length,
            };
        },
    }))

    const toggleFile = (id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleGroup = (files: ScannedFile[]) => {
        const ids = files.map((f) => f.id)
        setSelectedIds((prev) => {
            const next = new Set(prev)
            const allSelected = ids.every((id) => next.has(id))
            if (allSelected) {
                for (const id of ids) next.delete(id)
            } else {
                for (const id of ids) next.add(id)
            }
            return next
        })
    }

    const selectedFiles = createMemo(() => {
        const ids = selectedIds()
        const all = unidentifiedQuery.data?.files ?? []
        return all.filter((f) => ids.has(f.id))
    })

    const isGroupFullySelected = (files: ScannedFile[]) => {
        const ids = selectedIds()
        return files.length > 0 && files.every((f) => ids.has(f.id))
    }

    const handleIdentify = (mode: "TvShows" | "Movies") => {
        setIdentifyMode(mode)
        setIdentifyModalOpen(true)
    }

    const markExtraMutation = useMutation(() => ({
        mutationFn: async (ids: number[]) => {
            const req: BulkUpdateRequest = {
                updates: ids.map((id) => ({ id, mediaType: "Extras" as const })),
            }
            return mediaApi.batchUpdate(req)
        },
        onSuccess: async () => {
            setSelectedIds(new Set<number>())
            for (const key of ["titles", "unidentified-files"]) {
                void queryClient.invalidateQueries({ queryKey: [key] })
            }
        },
    }))

    return (
        <section>
            <MediaSearchHeader
                title="Unidentified Media"
                subtitle="Files that still need identity work before they can be organized."
                searchValue={searchTerm()}
                onSearch={setSearchTerm}
            />

            <Show when={unidentifiedQuery.isLoading}>
                <div class="space-y-3">
                    <For each={Array(6)}>{() => <RowSkeleton />}</For>
                </div>
            </Show>
            <Show when={unidentifiedQuery.isError}>
                <p class="text-error text-sm">
                    Unable to load unidentified files right now.
                </p>
            </Show>

            <Show when={(unidentifiedQuery.data?.total ?? 0) > 0}>
                <div class="space-y-6">
                    <div class="flex flex-wrap gap-2">
                        <Pill>Total: {unidentifiedQuery.data?.total ?? 0}</Pill>
                        <Pill variant="error">
                            Failed: {unidentifiedQuery.data?.failedCount ?? 0}
                        </Pill>
                        <Pill variant="warning">
                            Duplicate:{" "}
                            {unidentifiedQuery.data?.duplicateCount ?? 0}
                        </Pill>
                        <Pill>
                            Unknown type:{" "}
                            {unidentifiedQuery.data?.unknownTypeCount ?? 0}
                        </Pill>
                    </div>
                    <For each={unidentifiedQuery.data?.typeGroups ?? []}>
                        {(group) => {
                            const subgroups = groupFilesBySourceDirectory(group.files)
                            return (
                                <div class="space-y-2">
                                    <div class="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={isGroupFullySelected(group.files)}
                                            onChange={() => toggleGroup(group.files)}
                                            class="unidentified-checkbox"
                                        />
                                        <h3 class="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                                            {group.type} ({group.count})
                                        </h3>
                                    </div>
                                    <div class="space-y-3">
                                        <For each={subgroups}>
                                            {(sub) => (
                                                <div class="space-y-1.5">
                                                    <Show when={subgroups.length > 1}>
                                                        <div class="flex items-center gap-3 mt-1" title={sub.directory}>
                                                            <input
                                                                type="checkbox"
                                                                checked={isGroupFullySelected(sub.files)}
                                                                onChange={() => toggleGroup(sub.files)}
                                                                class="unidentified-checkbox"
                                                            />
                                                            <div class="h-px flex-1 bg-border-subtle" />
                                                            <span class="text-[0.65rem] uppercase tracking-wider text-text-tertiary truncate max-w-[30ch]">
                                                                {sub.label} ({sub.files.length})
                                                            </span>
                                                        </div>
                                                    </Show>
                                                    <For each={sub.files}>
                                                        {(file) => (
                                                            <UnidentifiedFileRow
                                                                file={file}
                                                                selected={selectedIds().has(file.id)}
                                                                onToggle={toggleFile}
                                                            />
                                                        )}
                                                    </For>
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                </div>
                            )
                        }}
                    </For>
                </div>
            </Show>

            <Show
                when={
                    !unidentifiedQuery.isLoading &&
                    !unidentifiedQuery.isError &&
                    (unidentifiedQuery.data?.total ?? 0) === 0
                }
            >
                <p class="text-text-tertiary text-sm py-12 text-center">
                    No unidentified files found for this filter.
                </p>
            </Show>

            <Show when={selectedIds().size > 0}>
                <div class="fixed bottom-0 left-0 right-0 z-40 bg-surface-1/95 backdrop-blur-xl border-t border-border-default shadow-xl">
                    <div class="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
                        <span class="text-sm font-medium text-text-primary">
                            {selectedIds().size} file(s) selected
                        </span>
                        <div class="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => handleIdentify("TvShows")}
                                class="px-4 py-2 text-sm font-semibold rounded-lg bg-accent text-surface-0 hover:bg-accent-hover transition"
                            >
                                Identify as TV Show
                            </button>
                            <button
                                type="button"
                                onClick={() => handleIdentify("Movies")}
                                class="px-4 py-2 text-sm font-semibold rounded-lg bg-accent text-surface-0 hover:bg-accent-hover transition"
                            >
                                Identify as Movie
                            </button>
                            <button
                                type="button"
                                disabled={markExtraMutation.isPending}
                                onClick={() => markExtraMutation.mutate([...selectedIds()])}
                                class="px-4 py-2 text-sm rounded-lg border border-border-default bg-surface-2 text-text-secondary hover:text-text-primary hover:border-border-hover disabled:opacity-40 disabled:cursor-not-allowed transition"
                            >
                                {markExtraMutation.isPending ? "Marking..." : "Mark as Extra"}
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedIds(new Set<number>())}
                                class="px-4 py-2 text-sm rounded-lg border border-border-default bg-surface-2 text-text-secondary hover:text-text-primary hover:border-border-hover transition"
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                </div>
            </Show>

            <IdentifyModal
                open={identifyModalOpen()}
                onClose={() => {
                    setIdentifyModalOpen(false)
                    setSelectedIds(new Set<number>())
                }}
                initialMode={identifyMode()}
                files={selectedFiles()}
            />
        </section>
    );
}

interface ScannedEpisodeCard {
    kind: "file";
    episodeNumber: number;
    file: ScannedFile;
}
interface MissingEpisodeCard {
    kind: "missing";
    episodeNumber: number;
    episodeName: string | null;
    airDate: string | null;
}
type SeasonEpisodeCard = ScannedEpisodeCard | MissingEpisodeCard;

function annotateSeasonCardsWithSourceDividers(cards: SeasonEpisodeCard[]) {
    let prev: string | null = null;
    return cards.map((card) => {
        if (card.kind !== "file") return { card, sourceDividerPath: null };
        const cur = sourceDirectory(card.file.sourceFile);
        const divider = prev !== null && prev !== cur ? cur : null;
        prev = cur;
        return { card, sourceDividerPath: divider };
    });
}

interface SeasonCoverageGroup {
    seasonNumber: number;
    episodeCount: number;
    episodeCountScanned: number;
    cards: SeasonEpisodeCard[];
}

function EpisodeFileRow(props: {
    file: ScannedFile;
    sourceDividerPath?: string | null;
}) {
    return (
        <>
            <Show when={props.sourceDividerPath}>
                {(p) => <SourceSubgroupSeparator sourcePath={p()} />}
            </Show>
            <div class="flex items-start justify-between gap-4 bg-surface-2 border border-border-subtle rounded-lg px-4 py-3">
                <FileRowIdentity file={props.file} />
                <div class="flex flex-wrap items-center gap-1.5 shrink-0">
                    <Pill variant="success">
                        {props.file.seasonNumber
                            ? `S${String(props.file.seasonNumber).padStart(2, "0")}`
                            : "S??"}
                        {props.file.episodeNumber
                            ? `E${String(props.file.episodeNumber).padStart(2, "0")}`
                            : "E??"}
                    </Pill>
                    <StatusBadge status={props.file.status} />
                </div>
            </div>
        </>
    );
}

function MissingEpisodeRow(props: {
    seasonNumber: number;
    episodeNumber: number;
    episodeName: string | null;
    airDate: string | null;
}) {
    return (
        <div class="flex items-start justify-between gap-4 bg-warning-muted border border-warning/20 rounded-lg px-4 py-3">
            <div class="min-w-0 flex-1">
                <p class="font-semibold text-sm text-warning">
                    Missing S{String(props.seasonNumber).padStart(2, "0")}E
                    {String(props.episodeNumber).padStart(2, "0")}
                    <Show when={props.episodeName}>
                        <span class="font-normal text-text-secondary">
                            {" "}
                            · {props.episodeName}
                        </span>
                    </Show>
                </p>
                <p class="text-xs text-text-tertiary mt-0.5">
                    Aired: {formatAirDate(props.airDate)}
                </p>
            </div>
            <Pill variant="warning">Missing</Pill>
        </div>
    );
}

function TvShowDetailsPage() {
    const params = useParams();
    const queryClient = useQueryClient();
    const tmdbId = createMemo(() => Number(params.tmdbId));
    const [reassignOpen, setReassignOpen] = createSignal(false);

    const showQuery = useQuery(() => ({
        queryKey: ["show", tmdbId()],
        queryFn: () => mediaApi.getShow(tmdbId()),
        enabled: Number.isInteger(tmdbId()) && tmdbId() > 0,
    }));
    const episodeGroupsQuery = useQuery(() => ({
        queryKey: ["tv-episode-groups", tmdbId()],
        queryFn: () => mediaApi.getShowEpisodeGroups(tmdbId()),
        enabled: Number.isInteger(tmdbId()) && tmdbId() > 0,
    }));
    const tvFilesQuery = useQuery(() => ({
        queryKey: ["tv-files", tmdbId()],
        queryFn: () => mediaApi.getShowFiles(tmdbId()),
        enabled: Number.isInteger(tmdbId()) && tmdbId() > 0,
    }));
    const seasonDetailsQuery = useQuery(() => ({
        queryKey: ["tv-seasons", tmdbId(), showQuery.data?.seasonCount ?? 0],
        queryFn: async () => {
            const count = showQuery.data?.seasonCount ?? 0;
            const reqs: Promise<SeasonInfo>[] = [];
            for (let s = 1; s <= count; s += 1)
                reqs.push(mediaApi.getShowSeason(tmdbId(), s));
            return (await Promise.all(reqs)).sort(
                (a, b) => a.seasonNumber - b.seasonNumber,
            );
        },
        enabled:
            Number.isInteger(tmdbId()) &&
            tmdbId() > 0 &&
            (showQuery.data?.seasonCount ?? 0) > 0,
    }));

    const episodeGroupMutation = useMutation(() => ({
        mutationFn: (episodeGroupId: string | null) =>
            mediaApi.setShowEpisodeGroup(tmdbId(), episodeGroupId),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["show", tmdbId()] }),
                queryClient.invalidateQueries({
                    queryKey: ["tv-files", tmdbId()],
                }),
                queryClient.invalidateQueries({
                    queryKey: ["tv-episode-groups", tmdbId()],
                }),
            ]);
        },
    }));

    const categorizedBySeason = createMemo(() => {
        const seasons = new Map<number, ScannedFile[]>();
        for (const item of tvFilesQuery.data?.categorizedFiles ?? []) {
            const s = item.seasonNumber ?? 0;
            const existing = seasons.get(s)
            if (existing) existing.push(item)
            else seasons.set(s, [item])
        }
        return [...seasons.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(
                ([sn, files]) =>
                    [sn, [...files].sort(compareEpisodeFiles)] as const,
            );
    });

    const seasonCoverageBySeason = createMemo<SeasonCoverageGroup[]>(() => {
        const sd = seasonDetailsQuery.data;
        if (!sd || sd.length === 0) return [];
        const scannedBySeason = new Map<number, Map<number, ScannedFile>>();
        for (const file of tvFilesQuery.data?.categorizedFiles ?? []) {
            if (!file.seasonNumber || !file.episodeNumber) continue;
            const sm =
                scannedBySeason.get(file.seasonNumber) ??
                new Map<number, ScannedFile>();
            sm.set(file.episodeNumber, file);
            if (file.episodeNumber2 && file.episodeNumber2 > file.episodeNumber)
                sm.set(file.episodeNumber2, file);
            scannedBySeason.set(file.seasonNumber, sm);
        }
        const knownSeasons = new Set<number>();
        const groups: SeasonCoverageGroup[] = [];
        for (const season of sd) {
            knownSeasons.add(season.seasonNumber);
            const sm =
                scannedBySeason.get(season.seasonNumber) ??
                new Map<number, ScannedFile>();
            const tmdbEps = new Set<number>();
            const cards: SeasonEpisodeCard[] = [];
            for (const ep of season.episodes) {
                tmdbEps.add(ep.episodeNumber);
                const sf = sm.get(ep.episodeNumber);
                cards.push(
                    sf
                        ? {
                              kind: "file",
                              episodeNumber: ep.episodeNumber,
                              file: sf,
                          }
                        : {
                              kind: "missing",
                              episodeNumber: ep.episodeNumber,
                              episodeName: ep.name,
                              airDate: ep.airDate,
                          },
                );
            }
            for (const [en, f] of [...sm.entries()]
                .filter(([n]) => !tmdbEps.has(n))
                .sort((a, b) => a[0] - b[0]))
                cards.push({ kind: "file", episodeNumber: en, file: f });
            groups.push({
                seasonNumber: season.seasonNumber,
                episodeCount: season.episodes.length,
                episodeCountScanned: season.episodes.filter((e) =>
                    sm.has(e.episodeNumber),
                ).length,
                cards,
            });
        }
        for (const [sn, sm] of [...scannedBySeason.entries()]
            .filter(([s]) => !knownSeasons.has(s))
            .sort((a, b) => a[0] - b[0])) {
            const cards = [...sm.entries()]
                .sort((a, b) => a[0] - b[0])
                .map(([en, f]) => ({
                    kind: "file" as const,
                    episodeNumber: en,
                    file: f,
                }));
            groups.push({
                seasonNumber: sn,
                episodeCount: cards.length,
                episodeCountScanned: cards.length,
                cards,
            });
        }
        return groups.sort((a, b) => a.seasonNumber - b.seasonNumber);
    });

    const seasonGroupsToRender = createMemo<SeasonCoverageGroup[]>(() => {
        const cg = seasonCoverageBySeason();
        if (cg.length > 0) return cg;
        return categorizedBySeason().map(([sn, files]) => ({
            seasonNumber: sn,
            episodeCount: files.length,
            episodeCountScanned: files.length,
            cards: files.map((f) => ({
                kind: "file" as const,
                episodeNumber: f.episodeNumber ?? Number.MAX_SAFE_INTEGER,
                file: f,
            })),
        }));
    });

    const selectedEpisodeGroup = createMemo(() => {
        const id = episodeGroupsQuery.data?.selectedEpisodeGroupId;
        if (!id) return null;
        return (
            (episodeGroupsQuery.data?.groups ?? []).find((g) => g.id === id) ??
            null
        );
    });
    const displayedEpisodeTotal = createMemo(
        () =>
            selectedEpisodeGroup()?.episodeCount ??
            showQuery.data?.episodeCount ??
            0,
    );
    const scannedSeasonCount = createMemo(
        () =>
            new Set(
                seasonGroupsToRender()
                    .filter(
                        (g) =>
                            g.seasonNumber > 0 &&
                            g.cards.some((c) => c.kind === "file"),
                    )
                    .map((g) => g.seasonNumber),
            ).size,
    );
    const missingEpisodeCount = createMemo(() =>
        seasonCoverageBySeason().reduce(
            (t, g) => t + g.cards.filter((c) => c.kind === "missing").length,
            0,
        ),
    );

    const handleEpisodeGroupChange = (v: string) => {
        const cur = episodeGroupsQuery.data?.selectedEpisodeGroupId ?? "";
        const n = v.length > 0 ? v : null;
        if ((n ?? "") === cur) return;
        if (
            !window.confirm(
                "Changing episode grouping will remove and recreate this show's episodes and symlinks. Continue?",
            )
        )
            return;
        episodeGroupMutation.mutate(n);
    };

    return (
        <section class="space-y-6">
            <A
                href="/shows"
                class="inline-flex items-center gap-1 text-sm text-accent hover:text-accent-hover transition"
            >
                <span>&larr;</span> Back to TV shows
            </A>

            <Show when={showQuery.isLoading}>
                <div class="space-y-4">
                    <div class="skeleton h-48 rounded-2xl" />
                    <div class="skeleton h-8 w-64 rounded-lg" />
                </div>
            </Show>
            <Show when={showQuery.isError}>
                <p class="text-error text-sm">Unable to load show details.</p>
            </Show>

            <Show when={showQuery.data}>
                {(show) => (
                    <>
                        <div class="relative rounded-2xl overflow-hidden bg-surface-2 border border-border-subtle">
                            <Show when={backdropUrl(show().backdropPath)}>
                                {(url) => (
                                    <img
                                        src={url()}
                                        alt=""
                                        class="w-full h-48 sm:h-64 object-cover"
                                    />
                                )}
                            </Show>
                            <div class="absolute inset-0 bg-linear-to-t from-surface-1 via-surface-1/60 to-transparent" />
                            <div class="relative px-5 pb-5 pt-4 flex flex-wrap items-end justify-between gap-4 -mt-20">
                                <div class="flex items-end gap-4">
                                    <Show
                                        when={posterUrl(
                                            show().posterPath,
                                            "w185",
                                        )}
                                    >
                                        {(url) => (
                                            <img
                                                src={url()}
                                                alt={show().title}
                                                class="w-24 rounded-lg shadow-xl border-2 border-surface-1 hidden sm:block"
                                            />
                                        )}
                                    </Show>
                                    <div>
                                        <h1 class="text-2xl font-bold">
                                            {show().title}
                                        </h1>
                                        <p class="text-sm text-text-secondary mt-1">
                                            {show().year ?? "Year unknown"} ·{" "}
                                            {show().genres.join(", ") ||
                                                "No genres"}
                                        </p>
                                    </div>
                                </div>
                                <div class="flex flex-wrap items-center gap-2">
                                    <Pill variant="success">
                                        Scanned:{" "}
                                        {show().episodeCountScanned ?? 0}
                                    </Pill>
                                    <Pill>
                                        Total: {displayedEpisodeTotal()}
                                    </Pill>
                                    <Pill>
                                        Seasons: {scannedSeasonCount()} /{" "}
                                        {show().seasonCount ?? 0}
                                    </Pill>
                                    <button
                                        type="button"
                                        onClick={() => setReassignOpen(true)}
                                        class="px-3 py-1.5 text-xs rounded-lg border border-border-default bg-surface-2/80 text-text-secondary hover:text-text-primary hover:border-border-hover transition"
                                    >
                                        Reassign Show
                                    </button>
                                </div>
                            </div>
                        </div>

                        <Show
                            when={
                                (episodeGroupsQuery.data?.groups.length ?? 0) >
                                1
                            }
                        >
                            <div class="bg-surface-2 border border-border-subtle rounded-xl p-4 space-y-3">
                                <label class="text-sm font-semibold">
                                    Episode grouping
                                </label>
                                <select
                                    class="block w-full max-w-md bg-surface-3 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary"
                                    value={
                                        episodeGroupsQuery.data
                                            ?.selectedEpisodeGroupId ?? ""
                                    }
                                    disabled={episodeGroupMutation.isPending}
                                    onChange={(e) =>
                                        handleEpisodeGroupChange(
                                            e.currentTarget.value,
                                        )
                                    }
                                >
                                    <option value="">Default TMDb order</option>
                                    <For
                                        each={
                                            episodeGroupsQuery.data?.groups ??
                                            []
                                        }
                                    >
                                        {(g) => (
                                            <option value={g.id}>
                                                {g.name}
                                            </option>
                                        )}
                                    </For>
                                </select>
                                <Show when={episodeGroupMutation.isPending}>
                                    <p class="text-xs text-text-secondary animate-pulse">
                                        Rebuilding episodes and symlinks...
                                    </p>
                                </Show>
                                <Show when={selectedEpisodeGroup()}>
                                    {(g) => (
                                        <Pill>
                                            Active: {g().name} (
                                            {g().episodeCount} episodes)
                                        </Pill>
                                    )}
                                </Show>
                            </div>
                        </Show>

                        <div class="space-y-4">
                            <h2 class="text-lg font-bold">
                                Categorized Episodes
                            </h2>
                            <Show
                                when={
                                    seasonDetailsQuery.isLoading &&
                                    (tvFilesQuery.data?.categorizedFiles
                                        .length ?? 0) === 0
                                }
                            >
                                <div class="space-y-3">
                                    <For each={Array(4)}>
                                        {() => <RowSkeleton />}
                                    </For>
                                </div>
                            </Show>
                            <Show when={missingEpisodeCount() > 0}>
                                <p class="text-xs text-warning">
                                    {missingEpisodeCount()} episodes missing
                                    from TMDb season order
                                </p>
                            </Show>
                            <Show when={seasonGroupsToRender().length === 0}>
                                <p class="text-text-tertiary text-sm py-8 text-center">
                                    No categorized episodes found for this show
                                    yet.
                                </p>
                            </Show>
                            <For each={seasonGroupsToRender()}>
                                {(group) => (
                                    <div class="space-y-2">
                                        <h3 class="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                                            Season{" "}
                                            {group.seasonNumber > 0
                                                ? String(
                                                      group.seasonNumber,
                                                  ).padStart(2, "0")
                                                : "Unassigned"}
                                            {group.episodeCount > 0
                                                ? ` · ${group.episodeCountScanned}/${group.episodeCount} scanned`
                                                : ""}
                                        </h3>
                                        <div class="space-y-1.5">
                                            <For
                                                each={annotateSeasonCardsWithSourceDividers(
                                                    group.cards,
                                                )}
                                            >
                                                {(entry) =>
                                                    entry.card.kind ===
                                                    "file" ? (
                                                        <EpisodeFileRow
                                                            file={
                                                                entry.card.file
                                                            }
                                                            sourceDividerPath={
                                                                entry.sourceDividerPath
                                                            }
                                                        />
                                                    ) : (
                                                        <MissingEpisodeRow
                                                            seasonNumber={
                                                                group.seasonNumber
                                                            }
                                                            episodeNumber={
                                                                entry.card
                                                                    .episodeNumber
                                                            }
                                                            episodeName={
                                                                entry.card
                                                                    .episodeName
                                                            }
                                                            airDate={
                                                                entry.card
                                                                    .airDate
                                                            }
                                                        />
                                                    )
                                                }
                                            </For>
                                        </div>
                                    </div>
                                )}
                            </For>
                        </div>

                        <div class="space-y-4">
                            <h2 class="text-lg font-bold">
                                Uncategorized Related Files
                            </h2>
                            <p class="text-xs text-text-secondary">
                                Alias-linked rows from this show's identity map.
                            </p>
                            <Show when={tvFilesQuery.isLoading}>
                                <div class="space-y-3">
                                    <For each={Array(3)}>
                                        {() => <RowSkeleton />}
                                    </For>
                                </div>
                            </Show>
                            <Show
                                when={
                                    (tvFilesQuery.data?.uncategorizedFiles
                                        .length ?? 0) === 0
                                }
                            >
                                <p class="text-text-tertiary text-sm py-4 text-center">
                                    No uncategorized files connected to this
                                    show.
                                </p>
                            </Show>
                            <div class="space-y-1.5">
                                <For
                                    each={annotateFilesWithSourceDividers(
                                        tvFilesQuery.data?.uncategorizedFiles ??
                                            [],
                                    )}
                                >
                                    {(entry) => (
                                        <EpisodeFileRow
                                            file={entry.file}
                                            sourceDividerPath={
                                                entry.sourceDividerPath
                                            }
                                        />
                                    )}
                                </For>
                            </div>
                        </div>

                        <IdentifyModal
                            open={reassignOpen()}
                            onClose={() => {
                                setReassignOpen(false)
                                void queryClient.invalidateQueries({ queryKey: ["show", tmdbId()] })
                                void queryClient.invalidateQueries({ queryKey: ["tv-files", tmdbId()] })
                                void queryClient.invalidateQueries({ queryKey: ["titles"] })
                            }}
                            initialMode="TvShows"
                            files={[
                                ...(tvFilesQuery.data?.categorizedFiles ?? []),
                                ...(tvFilesQuery.data?.uncategorizedFiles ?? []),
                            ]}
                            preselectedTmdbId={tmdbId()}
                            reassignOldTmdbId={tmdbId()}
                        />
                    </>
                )}
            </Show>
        </section>
    );
}

function MovieFileRow(props: {
    file: ScannedFile;
    showMarkExtra?: boolean;
    onMarkExtra?: (id: number) => void;
    disabled?: boolean;
    sourceDividerPath?: string | null;
}) {
    return (
        <>
            <Show when={props.sourceDividerPath}>
                {(p) => <SourceSubgroupSeparator sourcePath={p()} />}
            </Show>
            <div class="flex items-start justify-between gap-4 bg-surface-2 border border-border-subtle rounded-lg px-4 py-3">
                <FileRowIdentity file={props.file} />
                <div class="flex flex-wrap items-center gap-1.5 shrink-0">
                    <Pill>{formatBytes(props.file.fileSize)}</Pill>
                    <StatusBadge status={props.file.status} />
                    <Show when={props.showMarkExtra}>
                        <button
                            disabled={props.disabled}
                            onClick={() => props.onMarkExtra?.(props.file.id)}
                            class="px-2.5 py-1 text-xs rounded-lg border border-border-default bg-surface-3 text-text-secondary hover:text-text-primary hover:border-border-hover disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                            Mark as extra
                        </button>
                    </Show>
                </div>
            </div>
        </>
    );
}

function MovieDetailsPage() {
    const params = useParams();
    const queryClient = useQueryClient();
    const tmdbId = createMemo(() => Number(params.tmdbId));
    const [reassignOpen, setReassignOpen] = createSignal(false);

    const movieQuery = useQuery(() => ({
        queryKey: ["movie", tmdbId()],
        queryFn: () => mediaApi.getMovie(tmdbId()),
        enabled: Number.isInteger(tmdbId()) && tmdbId() > 0,
    }));
    const filesQuery = useQuery(() => ({
        queryKey: ["movie-files", tmdbId()],
        queryFn: () => mediaApi.getMovieFiles(tmdbId()),
        enabled: Number.isInteger(tmdbId()) && tmdbId() > 0,
    }));
    const markExtraMutation = useMutation(() => ({
        mutationFn: (fileId: number) => mediaApi.markAsExtra(fileId),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: ["movie-files", tmdbId()],
                }),
                queryClient.invalidateQueries({ queryKey: ["titles"] }),
            ]);
        },
    }));

    return (
        <section class="space-y-6">
            <A
                href="/movies"
                class="inline-flex items-center gap-1 text-sm text-accent hover:text-accent-hover transition"
            >
                <span>&larr;</span> Back to movies
            </A>

            <Show when={movieQuery.isLoading}>
                <div class="space-y-4">
                    <div class="skeleton h-48 rounded-2xl" />
                    <div class="skeleton h-8 w-64 rounded-lg" />
                </div>
            </Show>
            <Show when={movieQuery.isError}>
                <p class="text-error text-sm">Unable to load movie details.</p>
            </Show>

            <Show when={movieQuery.data}>
                {(movie) => (
                    <>
                        <div class="relative rounded-2xl overflow-hidden bg-surface-2 border border-border-subtle">
                            <Show when={backdropUrl(movie().backdropPath)}>
                                {(url) => (
                                    <img
                                        src={url()}
                                        alt=""
                                        class="w-full h-48 sm:h-64 object-cover"
                                    />
                                )}
                            </Show>
                            <div class="absolute inset-0 bg-linear-to-t from-surface-1 via-surface-1/60 to-transparent" />
                            <div class="relative px-5 pb-5 pt-4 flex flex-wrap items-end justify-between gap-4 -mt-20">
                                <div class="flex items-end gap-4">
                                    <Show
                                        when={posterUrl(
                                            movie().posterPath,
                                            "w185",
                                        )}
                                    >
                                        {(url) => (
                                            <img
                                                src={url()}
                                                alt={movie().title}
                                                class="w-24 rounded-lg shadow-xl border-2 border-surface-1 hidden sm:block"
                                            />
                                        )}
                                    </Show>
                                    <div>
                                        <h1 class="text-2xl font-bold">
                                            {movie().title}
                                        </h1>
                                        <p class="text-sm text-text-secondary mt-1">
                                            {movie().year ?? "Year unknown"} ·{" "}
                                            {movie().genres.join(", ") ||
                                                "No genres"}
                                        </p>
                                    </div>
                                </div>
                                <div class="flex flex-wrap items-center gap-2">
                                    <Pill>TMDb {movie().tmdbId}</Pill>
                                    <Pill>IMDb {movie().imdbId ?? "n/a"}</Pill>
                                    <button
                                        type="button"
                                        onClick={() => setReassignOpen(true)}
                                        class="px-3 py-1.5 text-xs rounded-lg border border-border-default bg-surface-2/80 text-text-secondary hover:text-text-primary hover:border-border-hover transition"
                                    >
                                        Reassign Movie
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="space-y-4">
                            <h2 class="text-lg font-bold">Main Movie Files</h2>
                            <Show when={filesQuery.isLoading}>
                                <div class="space-y-3">
                                    <For each={Array(2)}>
                                        {() => <RowSkeleton />}
                                    </For>
                                </div>
                            </Show>
                            <Show
                                when={
                                    (filesQuery.data?.primaryFiles.length ??
                                        0) === 0
                                }
                            >
                                <p class="text-text-tertiary text-sm py-4 text-center">
                                    No direct movie files are currently mapped.
                                </p>
                            </Show>
                            <div class="space-y-1.5">
                                <For
                                    each={annotateFilesWithSourceDividers(
                                        filesQuery.data?.primaryFiles ?? [],
                                    )}
                                >
                                    {(entry) => (
                                        <MovieFileRow
                                            file={entry.file}
                                            sourceDividerPath={
                                                entry.sourceDividerPath
                                            }
                                            showMarkExtra
                                            onMarkExtra={(id) =>
                                                markExtraMutation.mutate(id)
                                            }
                                            disabled={
                                                markExtraMutation.isPending
                                            }
                                        />
                                    )}
                                </For>
                            </div>
                        </div>

                        <div class="space-y-4">
                            <h2 class="text-lg font-bold">Related Files</h2>
                            <p class="text-xs text-text-secondary">
                                Files visible under this movie because they
                                share source folders.
                            </p>
                            <Show
                                when={
                                    (filesQuery.data?.extraFiles.length ??
                                        0) === 0
                                }
                            >
                                <p class="text-text-tertiary text-sm py-4 text-center">
                                    No related files detected.
                                </p>
                            </Show>
                            <div class="space-y-1.5">
                                <For
                                    each={annotateFilesWithSourceDividers(
                                        filesQuery.data?.extraFiles ?? [],
                                    )}
                                >
                                    {(entry) => (
                                        <MovieFileRow
                                            file={entry.file}
                                            sourceDividerPath={
                                                entry.sourceDividerPath
                                            }
                                            showMarkExtra={
                                                entry.file.mediaType !==
                                                "Extras"
                                            }
                                            onMarkExtra={(id) =>
                                                markExtraMutation.mutate(id)
                                            }
                                            disabled={
                                                markExtraMutation.isPending
                                            }
                                        />
                                    )}
                                </For>
                            </div>
                        </div>

                        <IdentifyModal
                            open={reassignOpen()}
                            onClose={() => {
                                setReassignOpen(false)
                                void queryClient.invalidateQueries({ queryKey: ["movie", tmdbId()] })
                                void queryClient.invalidateQueries({ queryKey: ["movie-files", tmdbId()] })
                                void queryClient.invalidateQueries({ queryKey: ["titles"] })
                            }}
                            initialMode="Movies"
                            files={filesQuery.data?.primaryFiles ?? []}
                        />
                    </>
                )}
            </Show>
        </section>
    );
}

function SettingsPage() {
    const queryClient = useQueryClient();
    const configQuery = useQuery(() => ({
        queryKey: ["config"],
        queryFn: () => mediaApi.getConfig(),
    }));
    const [draft, setDraft] = createSignal<ConfigurationPayload | null>(null);
    createEffect(() => {
        if (configQuery.data && !draft())
            setDraft(cloneConfig(configQuery.data));
    });
    const saveMutation = useMutation(() => ({
        mutationFn: (p: ConfigurationPayload) => mediaApi.updateConfig(p),
        onSuccess: async (u) => {
            setDraft(cloneConfig(u));
            await queryClient.invalidateQueries({ queryKey: ["config"] });
        },
    }));
    const isDirty = createMemo(() => {
        const l = draft();
        const r = configQuery.data;
        if (!l || !r) return false;
        return JSON.stringify(l) !== JSON.stringify(r);
    });
    const patchDraft = (
        fn: (c: ConfigurationPayload) => ConfigurationPayload,
    ) => {
        setDraft((c) => (c ? fn(cloneConfig(c)) : c));
    };
    const updateMappingField = (
        idx: number,
        field: keyof FolderMappingConfig,
        val: string,
    ) => {
        patchDraft((c) => {
            const n = cloneConfig(c);
            const m = n.plex.folderMappings[idx];
            if (!m) return n;
            if (field === "mediaType") m.mediaType = val as MediaType;
            else if (field === "sourceFolder") m.sourceFolder = val;
            else m.destinationFolder = val;
            return n;
        });
    };

    const inputCls =
        "w-full bg-surface-3 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition";
    const labelCls = "block text-xs font-medium text-text-secondary mb-1";

    return (
        <section class="space-y-6">
            <div class="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 class="text-2xl font-bold">Settings</h1>
                    <p class="text-sm text-text-secondary mt-1">
                        Edit backend settings and save to restart the poller.
                    </p>
                </div>
                <div class="flex gap-2">
                    <Pill>Endpoint: /api/config</Pill>
                    <Pill>
                        {configQuery.isFetching ? "Refreshing" : "Idle"}
                    </Pill>
                </div>
            </div>

            <Show when={configQuery.isLoading}>
                <div class="space-y-4">
                    <For each={Array(3)}>
                        {() => <div class="skeleton h-32 rounded-xl" />}
                    </For>
                </div>
            </Show>
            <Show when={configQuery.isError}>
                <p class="text-error text-sm">
                    Unable to load configuration from backend.
                </p>
            </Show>

            <Show when={draft()}>
                {(config) => (
                    <form
                        class="space-y-5"
                        onSubmit={(e) => {
                            e.preventDefault();
                            const p = draft();
                            if (p) saveMutation.mutate(p);
                        }}
                    >
                        <div class="bg-surface-2 border border-border-subtle rounded-xl p-5 space-y-4">
                            <h3 class="text-base font-bold">Plex</h3>
                            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <label>
                                    <span class={labelCls}>Host</span>
                                    <input
                                        class={inputCls}
                                        value={config().plex.host}
                                        onInput={(e) =>
                                            patchDraft((c) => ({
                                                ...c,
                                                plex: {
                                                    ...c.plex,
                                                    host: e.currentTarget.value,
                                                },
                                            }))
                                        }
                                    />
                                </label>
                                <label>
                                    <span class={labelCls}>Port</span>
                                    <input
                                        type="number"
                                        min="1"
                                        class={inputCls}
                                        value={String(config().plex.port)}
                                        onInput={(e) =>
                                            patchDraft((c) => ({
                                                ...c,
                                                plex: {
                                                    ...c.plex,
                                                    port: parseIntOr(
                                                        e.currentTarget.value,
                                                        c.plex.port,
                                                    ),
                                                },
                                            }))
                                        }
                                    />
                                </label>
                                <label>
                                    <span class={labelCls}>
                                        Polling interval (s)
                                    </span>
                                    <input
                                        type="number"
                                        min="1"
                                        class={inputCls}
                                        value={String(
                                            config().plex.pollingInterval,
                                        )}
                                        onInput={(e) =>
                                            patchDraft((c) => ({
                                                ...c,
                                                plex: {
                                                    ...c.plex,
                                                    pollingInterval: parseIntOr(
                                                        e.currentTarget.value,
                                                        c.plex.pollingInterval,
                                                    ),
                                                },
                                            }))
                                        }
                                    />
                                </label>
                                <label>
                                    <span class={labelCls}>
                                        Folder delay (s)
                                    </span>
                                    <input
                                        type="number"
                                        min="0"
                                        class={inputCls}
                                        value={String(
                                            config().plex.processNewFolderDelay,
                                        )}
                                        onInput={(e) =>
                                            patchDraft((c) => ({
                                                ...c,
                                                plex: {
                                                    ...c.plex,
                                                    processNewFolderDelay:
                                                        parseIntOr(
                                                            e.currentTarget
                                                                .value,
                                                            c.plex
                                                                .processNewFolderDelay,
                                                        ),
                                                },
                                            }))
                                        }
                                    />
                                </label>
                            </div>
                            <label>
                                <span class={labelCls}>Plex token</span>
                                <input
                                    type="password"
                                    class={inputCls}
                                    value={config().plex.plexToken}
                                    onInput={(e) =>
                                        patchDraft((c) => ({
                                            ...c,
                                            plex: {
                                                ...c.plex,
                                                plexToken:
                                                    e.currentTarget.value,
                                            },
                                        }))
                                    }
                                />
                            </label>
                        </div>

                        <div class="bg-surface-2 border border-border-subtle rounded-xl p-5 space-y-4">
                            <h3 class="text-base font-bold">
                                TMDb + Detection + Zurg
                            </h3>
                            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <label>
                                    <span class={labelCls}>TMDb API key</span>
                                    <input
                                        type="password"
                                        class={inputCls}
                                        value={config().tmDb.apiKey}
                                        onInput={(e) =>
                                            patchDraft((c) => ({
                                                ...c,
                                                tmDb: {
                                                    ...c.tmDb,
                                                    apiKey: e.currentTarget
                                                        .value,
                                                },
                                            }))
                                        }
                                    />
                                </label>
                                <label>
                                    <span class={labelCls}>
                                        Cache duration (s)
                                    </span>
                                    <input
                                        type="number"
                                        min="1"
                                        class={inputCls}
                                        value={String(
                                            config().mediaDetection
                                                .cacheDuration,
                                        )}
                                        onInput={(e) =>
                                            patchDraft((c) => ({
                                                ...c,
                                                mediaDetection: {
                                                    ...c.mediaDetection,
                                                    cacheDuration: parseIntOr(
                                                        e.currentTarget.value,
                                                        c.mediaDetection
                                                            .cacheDuration,
                                                    ),
                                                },
                                            }))
                                        }
                                    />
                                </label>
                                <label>
                                    <span class={labelCls}>
                                        Extras threshold (bytes)
                                    </span>
                                    <input
                                        type="number"
                                        min="0"
                                        class={inputCls}
                                        value={String(
                                            config().mediaDetection
                                                .autoExtrasThresholdBytes,
                                        )}
                                        onInput={(e) =>
                                            patchDraft((c) => ({
                                                ...c,
                                                mediaDetection: {
                                                    ...c.mediaDetection,
                                                    autoExtrasThresholdBytes:
                                                        parseIntOr(
                                                            e.currentTarget
                                                                .value,
                                                            c.mediaDetection
                                                                .autoExtrasThresholdBytes,
                                                        ),
                                                },
                                            }))
                                        }
                                    />
                                </label>
                                <label>
                                    <span class={labelCls}>
                                        Zurg version file
                                    </span>
                                    <input
                                        class={inputCls}
                                        value={config().zurg.versionLocation}
                                        onInput={(e) =>
                                            patchDraft((c) => ({
                                                ...c,
                                                zurg: {
                                                    ...c.zurg,
                                                    versionLocation:
                                                        e.currentTarget.value,
                                                },
                                            }))
                                        }
                                    />
                                </label>
                            </div>
                        </div>

                        <div class="bg-surface-2 border border-border-subtle rounded-xl p-5 space-y-4">
                            <div class="flex items-center justify-between">
                                <h3 class="text-base font-bold">
                                    Folder Mappings
                                </h3>
                                <button
                                    type="button"
                                    onClick={() =>
                                        patchDraft((c) => {
                                            const n = cloneConfig(c);
                                            n.plex.folderMappings.push(
                                                defaultFolderMapping(),
                                            );
                                            return n;
                                        })
                                    }
                                    class="px-3 py-1.5 text-xs rounded-lg border border-border-default bg-surface-3 text-text-secondary hover:text-text-primary hover:border-border-hover transition"
                                >
                                    Add mapping
                                </button>
                            </div>
                            <div class="space-y-3">
                                <For each={config().plex.folderMappings}>
                                    {(mapping, index) => (
                                        <div class="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-3 items-end bg-surface-3 border border-border-subtle rounded-lg p-4">
                                            <label>
                                                <span class={labelCls}>
                                                    Source folder
                                                </span>
                                                <input
                                                    class={inputCls}
                                                    value={mapping.sourceFolder}
                                                    onInput={(e) =>
                                                        updateMappingField(
                                                            index(),
                                                            "sourceFolder",
                                                            e.currentTarget
                                                                .value,
                                                        )
                                                    }
                                                />
                                            </label>
                                            <label>
                                                <span class={labelCls}>
                                                    Destination folder
                                                </span>
                                                <input
                                                    class={inputCls}
                                                    value={
                                                        mapping.destinationFolder
                                                    }
                                                    onInput={(e) =>
                                                        updateMappingField(
                                                            index(),
                                                            "destinationFolder",
                                                            e.currentTarget
                                                                .value,
                                                        )
                                                    }
                                                />
                                            </label>
                                            <label>
                                                <span class={labelCls}>
                                                    Media type
                                                </span>
                                                <select
                                                    class={inputCls}
                                                    value={mapping.mediaType}
                                                    onChange={(e) =>
                                                        updateMappingField(
                                                            index(),
                                                            "mediaType",
                                                            e.currentTarget
                                                                .value,
                                                        )
                                                    }
                                                >
                                                    <For
                                                        each={mediaTypeOptions}
                                                    >
                                                        {(t) => (
                                                            <option value={t}>
                                                                {t}
                                                            </option>
                                                        )}
                                                    </For>
                                                </select>
                                            </label>
                                            <button
                                                type="button"
                                                disabled={
                                                    config().plex.folderMappings
                                                        .length <= 1
                                                }
                                                onClick={() =>
                                                    patchDraft((c) => {
                                                        const n =
                                                            cloneConfig(c);
                                                        if (
                                                            n.plex
                                                                .folderMappings
                                                                .length <= 1
                                                        )
                                                            return n;
                                                        n.plex.folderMappings =
                                                            n.plex.folderMappings.filter(
                                                                (_, i) =>
                                                                    i !==
                                                                    index(),
                                                            );
                                                        return n;
                                                    })
                                                }
                                                class="px-3 py-2 text-xs rounded-lg border border-error/30 bg-error-muted text-error hover:bg-error/20 disabled:opacity-40 disabled:cursor-not-allowed transition self-end"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </div>

                        <div class="flex justify-end gap-3">
                            <button
                                type="button"
                                disabled={!isDirty() || saveMutation.isPending}
                                onClick={() => {
                                    if (configQuery.data)
                                        setDraft(cloneConfig(configQuery.data));
                                }}
                                class="px-4 py-2 text-sm rounded-lg border border-border-default bg-surface-2 text-text-secondary hover:text-text-primary hover:border-border-hover disabled:opacity-40 disabled:cursor-not-allowed transition"
                            >
                                Reset changes
                            </button>
                            <button
                                type="submit"
                                disabled={!isDirty() || saveMutation.isPending}
                                class="px-5 py-2 text-sm font-semibold rounded-lg bg-accent text-surface-0 hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition"
                            >
                                {saveMutation.isPending
                                    ? "Saving..."
                                    : "Save configuration"}
                            </button>
                        </div>

                        <Show when={saveMutation.isError}>
                            <p class="text-error text-sm">
                                Save failed:{" "}
                                {errorMessage(saveMutation.error)}
                            </p>
                        </Show>
                        <Show
                            when={
                                saveMutation.isSuccess &&
                                !saveMutation.isPending
                            }
                        >
                            <p class="text-success text-sm">
                                Configuration saved. Backend poller restarted
                                with your new settings.
                            </p>
                        </Show>
                    </form>
                )}
            </Show>
        </section>
    );
}

function NotFoundPage() {
    return (
        <section class="py-20 text-center space-y-4">
            <h2 class="text-3xl font-bold">404</h2>
            <p class="text-text-secondary">This route does not exist.</p>
            <div class="flex justify-center gap-4">
                <A
                    href="/shows"
                    class="text-accent hover:text-accent-hover transition text-sm"
                >
                    TV Shows
                </A>
                <A
                    href="/movies"
                    class="text-accent hover:text-accent-hover transition text-sm"
                >
                    Movies
                </A>
                <A
                    href="/unidentified"
                    class="text-accent hover:text-accent-hover transition text-sm"
                >
                    Unidentified
                </A>
                <A
                    href="/settings"
                    class="text-accent hover:text-accent-hover transition text-sm"
                >
                    Settings
                </A>
            </div>
        </section>
    );
}

export default function App() {
    return (
        <Router root={AppShell}>
            <Route path="/" component={TvShowsPage} />
            <Route path="/shows" component={TvShowsPage} />
            <Route path="/shows/:tmdbId" component={TvShowDetailsPage} />
            <Route path="/movies" component={MoviesPage} />
            <Route path="/movies/:tmdbId" component={MovieDetailsPage} />
            <Route path="/unidentified" component={UnidentifiedPage} />
            <Route path="/settings" component={SettingsPage} />
            <Route path="*" component={NotFoundPage} />
        </Router>
    );
}
