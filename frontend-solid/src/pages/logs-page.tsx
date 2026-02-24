import { useQuery } from "@tanstack/solid-query";
import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import { mediaApi } from "@/lib/api";
import type { LogEntry, LogLevel } from "@/lib/types";
import {
    formatLogProperties,
    formatLogTimestamp,
    logLevelBg,
    logLevelColor,
    logLevels,
    parseIntOr,
} from "@/lib/media-helpers";

interface LogListItem {
    id: string;
    entry: LogEntry;
}

function logEntryId(entry: LogEntry): string {
    return `${entry.Timestamp ?? ""}|${entry.Level ?? ""}|${entry.RenderedMessage ?? ""}|${JSON.stringify(entry.Properties ?? {})}`;
}

export default function LogsPage() {
    const [logsMinLevel, setLogsMinLevel] = createSignal<LogLevel>("Information");
    const [logsSearchTerm, setLogsSearchTerm] = createSignal("");
    const [logsRecentMinutes, setLogsRecentMinutes] = createSignal<number | null>(null);
    const [logsLimit, setLogsLimit] = createSignal(200);
    const [logItems, setLogItems] = createSignal<LogListItem[]>([]);
    const [expandedIds, setExpandedIds] = createSignal<Set<string>>(new Set());

    const logsFilterKey = createMemo(
        () => `${logsMinLevel()}|${logsSearchTerm().trim().toLowerCase()}|${logsLimit()}|${logsRecentMinutes() ?? "all"}`,
    );

    const logsQuery = useQuery(() => ({
        queryKey: ["logs", logsFilterKey()],
        queryFn: () =>
            mediaApi.getLogs({
                minLevel: logsMinLevel(),
                searchTerm: logsSearchTerm(),
                limit: logsLimit(),
                from: (() => {
                    const recentMinutes = logsRecentMinutes();
                    if (recentMinutes === null) return undefined;
                    return new Date(Date.now() - recentMinutes * 60_000).toISOString();
                })(),
            }),
        refetchInterval: 15000,
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

    createEffect(() => {
        const known = new Set(logItems().map((i) => i.id));
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

    const isExpanded = (id: string) => expandedIds().has(id);
    const setExpanded = (id: string, open: boolean) => {
        setExpandedIds((c) => {
            const n = new Set(c);
            if (open) n.add(id);
            else n.delete(id);
            return n;
        });
    };

    return (
        <section class="space-y-4">
            <div>
                <p class="section-kicker">Operations</p>
                <h1 class="section-title">Backend Logs</h1>
                <p class="section-subtitle">Live backend events and processing outcomes.</p>
            </div>

            <div class="bg-surface-2 border border-border-subtle rounded-xl p-4 space-y-3">
                <div class="grid grid-cols-1 md:grid-cols-[auto_1fr_auto_auto] gap-3 items-end">
                    <label class="text-xs text-text-secondary space-y-1">
                        <span>Min level</span>
                        <select
                            class="block w-full bg-surface-3 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary"
                            value={logsMinLevel()}
                            onChange={(e) => setLogsMinLevel(e.currentTarget.value as LogLevel)}
                        >
                            <For each={logLevels}>{(l) => <option value={l}>{l}</option>}</For>
                        </select>
                    </label>
                    <label class="text-xs text-text-secondary space-y-1">
                        <span>Search</span>
                        <input
                            class="block w-full bg-surface-3 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary"
                            value={logsSearchTerm()}
                            placeholder="Filter message text"
                            onInput={(e) => setLogsSearchTerm(e.currentTarget.value)}
                        />
                    </label>
                    <label class="text-xs text-text-secondary space-y-1">
                        <span>Limit</span>
                        <select
                            class="block w-full bg-surface-3 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary"
                            value={String(logsLimit())}
                            onChange={(e) => setLogsLimit(parseIntOr(e.currentTarget.value, 200))}
                        >
                            <option value="100">100</option>
                            <option value="200">200</option>
                            <option value="500">500</option>
                            <option value="1000">1000</option>
                        </select>
                    </label>
                    <button
                        type="button"
                        onClick={() => {
                            void logsQuery.refetch();
                        }}
                        class="px-3 py-2 text-sm rounded-lg border border-border-default bg-surface-3 text-text-secondary hover:text-text-primary hover:border-border-hover transition self-end"
                    >
                        Refresh
                    </button>
                </div>
                <div class="flex gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={() => {
                            setLogsMinLevel("Information");
                            setLogsSearchTerm("file");
                        }}
                        class="px-3 py-1 text-xs rounded-full border border-border-default bg-surface-3 text-text-secondary hover:text-text-primary hover:border-border-hover transition"
                    >
                        Ingest only
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setLogsMinLevel("Warning");
                            setLogsSearchTerm("File processed with issue");
                        }}
                        class="px-3 py-1 text-xs rounded-full border border-border-default bg-surface-3 text-text-secondary hover:text-text-primary hover:border-border-hover transition"
                    >
                        Failures only
                    </button>
                    <button
                        type="button"
                        onClick={() => setLogsRecentMinutes((c) => (c === 15 ? null : 15))}
                        class="px-3 py-1 text-xs rounded-full border transition"
                        classList={{
                            "bg-accent-muted text-accent border-accent/30": logsRecentMinutes() === 15,
                            "border-border-default bg-surface-3 text-text-secondary hover:text-text-primary hover:border-border-hover": logsRecentMinutes() !== 15,
                        }}
                    >
                        Last 15 min
                    </button>
                </div>
            </div>

            <Show when={logsQuery.isLoading}>
                <p class="p-6 text-text-secondary text-sm">Loading backend logs...</p>
            </Show>
            <Show when={logsQuery.isError}>
                <p class="p-6 text-error text-sm">Unable to load logs right now.</p>
            </Show>
            <Show when={!logsQuery.isLoading && !logsQuery.isError && logItems().length === 0}>
                <p class="p-6 text-text-tertiary text-sm">No logs match this filter.</p>
            </Show>

            <div class="space-y-2">
                <For each={logItems()}>
                    {(item) => (
                        <article class="bg-surface-2 border border-border-subtle rounded-lg p-3 space-y-2">
                            <div class="flex items-center justify-between gap-3">
                                <span
                                    class={`inline-flex px-2 py-0.5 rounded-full text-[0.7rem] font-medium border ${logLevelBg(item.entry.Level)} ${logLevelColor(item.entry.Level)}`}
                                >
                                    {item.entry.Level ?? "Information"}
                                </span>
                                <span class="text-xs text-text-tertiary">{formatLogTimestamp(item.entry.Timestamp)}</span>
                            </div>
                            <p class="text-sm text-text-primary">{item.entry.RenderedMessage ?? "(empty log message)"}</p>
                            <Show when={item.entry.Properties && Object.keys(item.entry.Properties).length > 0}>
                                <details
                                    open={isExpanded(item.id)}
                                    onToggle={(e) => setExpanded(item.id, e.currentTarget.open)}
                                >
                                    <summary class="cursor-pointer text-xs text-text-tertiary hover:text-text-secondary transition">
                                        Properties
                                    </summary>
                                    <pre class="mt-2 bg-surface-0 border border-border-subtle rounded-lg p-3 text-xs text-text-secondary overflow-auto max-h-44">
                                        {formatLogProperties(item.entry.Properties)}
                                    </pre>
                                </details>
                            </Show>
                        </article>
                    )}
                </For>
            </div>

            <footer class="px-1 py-2 text-xs text-text-tertiary">
                {logsQuery.isFetching && !logsQuery.isLoading
                    ? "Refreshing..."
                    : `Showing ${logItems().length} log entries`}
            </footer>
        </section>
    );
}
