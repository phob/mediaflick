import { A } from "@solidjs/router";
import { useQuery } from "@tanstack/solid-query";
import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import { Pill, RowSkeleton } from "@/components/common-ui";
import { SelectionActionTray, TriageIssuePill } from "@/components/operator-ui";
import { MediaSearchHeader } from "@/components/media-shared";
import { mediaApi } from "@/lib/api";
import { errorMessage } from "@/lib/media-helpers";
import type { TriageInboxItem } from "@/lib/types";

const searchStorageKey = "mediaflick.wanted.search";

function initialSearchValue(): string {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(searchStorageKey) ?? "";
}

function wantedItems(items: TriageInboxItem[]): TriageInboxItem[] {
    return items.filter((item) => item.kind === "wanted-show" || item.kind === "episode-order");
}

function formatLastActivity(value: string | null): string {
    if (!value) return "Unknown";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
}

export default function WantedPage() {
    const [searchTerm, setSearchTerm] = createSignal(initialSearchValue());
    const [selectedIds, setSelectedIds] = createSignal<Set<string>>(new Set());

    createEffect(() => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(searchStorageKey, searchTerm());
    });

    const wantedQuery = useQuery(() => ({
        queryKey: ["wanted-shows", searchTerm().trim().toLowerCase()],
        queryFn: async () => wantedItems((await mediaApi.getTriageInbox(searchTerm())).items),
        staleTime: 2 * 60 * 1000,
    }));

    const missingTotal = createMemo(() => (wantedQuery.data ?? []).reduce((total, item) => total + (item.counts.missingEpisodes ?? 0), 0));
    const selectedItems = createMemo(() => {
        const ids = selectedIds();
        return (wantedQuery.data ?? []).filter((item) => ids.has(item.id));
    });

    const toggleItem = (id: string) => {
        setSelectedIds((previous) => {
            const next = new Set(previous);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const openSelected = () => {
        if (typeof window === "undefined") return;
        const items = selectedItems().slice(0, 5);
        for (const item of items) {
            window.open(item.deepLink, "_blank", "noopener,noreferrer");
        }
    };

    return (
        <section>
            <MediaSearchHeader
                title="Wanted Episodes"
                subtitle="Ended shows with aired gaps, plus rows where non-default episode ordering could be causing the mismatch."
                searchValue={searchTerm()}
                onSearch={setSearchTerm}
            />

            <div class="mb-4 flex flex-wrap gap-2">
                <Pill variant="warning">Missing episodes: {missingTotal()}</Pill>
                <Pill>Rows: {wantedQuery.data?.length ?? 0}</Pill>
            </div>

            <Show when={wantedQuery.isLoading}>
                <div class="space-y-3">
                    <For each={Array(6)}>{() => <RowSkeleton />}</For>
                </div>
            </Show>

            <Show when={wantedQuery.isError}>
                <p class="text-sm text-error">{errorMessage(wantedQuery.error)}</p>
            </Show>

            <Show when={!wantedQuery.isLoading && !wantedQuery.isError && (wantedQuery.data?.length ?? 0) === 0}>
                <p class="py-12 text-center text-sm text-text-tertiary">No missing aired episodes found for this filter.</p>
            </Show>

            <div class="space-y-3">
                <For each={wantedQuery.data ?? []}>
                    {(item) => (
                        <article class="rounded-xl border border-border-subtle bg-surface-1 px-4 py-4 shadow-[0_14px_36px_rgba(0,0,0,0.18)]">
                            <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                                <div class="min-w-0 flex-1">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds().has(item.id)}
                                            onChange={() => toggleItem(item.id)}
                                            class="h-4 w-4 rounded border-border-default bg-surface-1"
                                        />
                                        <TriageIssuePill kind={item.kind} />
                                        <Pill variant="warning">
                                            {item.kind === "wanted-show"
                                                ? `Missing ${item.counts.missingEpisodes ?? 0}`
                                                : "Ordering override"}
                                        </Pill>
                                    </div>
                                    <h2 class="mt-3 text-base font-semibold text-text-primary">{item.title}</h2>
                                    <p class="mt-1 text-sm text-text-secondary">{item.subtitle}</p>
                                    <Show when={item.diagnosticsSummary}>
                                        {(summary) => <p class="mt-2 text-sm text-text-secondary">{summary()}</p>}
                                    </Show>
                                    <div class="mt-3 grid gap-2 text-sm text-text-secondary md:grid-cols-3">
                                        <div>
                                            <span class="text-text-tertiary">Tracked</span>
                                            <p class="mt-1 text-text-primary">{item.counts.scannedEpisodes ?? 0} / {item.counts.airedEpisodes ?? 0}</p>
                                        </div>
                                        <div>
                                            <span class="text-text-tertiary">Last activity</span>
                                            <p class="mt-1 text-text-primary">{formatLastActivity(item.lastActivityAt)}</p>
                                        </div>
                                        <div>
                                            <span class="text-text-tertiary">Next action</span>
                                            <p class="mt-1 text-text-primary">{item.recommendedAction}</p>
                                        </div>
                                    </div>
                                </div>

                                <div class="flex flex-wrap items-center gap-2">
                                    <A
                                        href={item.deepLink}
                                        class="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-surface-0 transition hover:bg-accent-hover"
                                    >
                                        Open show
                                    </A>
                                </div>
                            </div>
                        </article>
                    )}
                </For>
            </div>

            <SelectionActionTray
                selectedCount={selectedItems().length}
                summary={`${selectedItems().length} wanted row${selectedItems().length === 1 ? "" : "s"} selected`}
                detail={selectedItems().length > 0 ? `Review opens up to ${Math.min(selectedItems().length, 5)} show workspace${selectedItems().length === 1 ? "" : "s"} in new tabs.` : null}
                onClear={() => setSelectedIds(new Set())}
            >
                <button
                    type="button"
                    onClick={openSelected}
                    class="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-surface-0 transition hover:bg-accent-hover"
                >
                    Review selected
                </button>
            </SelectionActionTray>
        </section>
    );
}
