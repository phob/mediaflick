import { For, Show } from "solid-js";
import { JellyfinSyncPill, Pill } from "@/components/common-ui";
import type { JellyfinMatchSource, JellyfinSyncDetails } from "@/lib/types";

function formatDateTime(value: string | null | undefined): string {
    if (!value) return "Not checked yet";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function matchSourceLabel(value: JellyfinMatchSource | null | undefined): string {
    if (value === "providerId") return "Provider IDs";
    if (value === "path") return "Path";
    if (value === "title") return "Title";
    return "No match data";
}

function issueSummary(sync: JellyfinSyncDetails, mediaLabel: string): string {
    if (sync.issue === "pathMismatch") return `Jellyfin found the ${mediaLabel}, but it points at a different library path than Mediaflick.`;
    if (sync.issue === "episodeMismatch") return `Jellyfin found the ${mediaLabel}, but some Mediaflick episodes are still missing there.`;
    if (sync.issue === "pathAndEpisodeMismatch") return `Jellyfin found the ${mediaLabel}, but both the path and one or more episodes are out of alignment.`;
    if (sync.issue === "missingInJellyfin") return `Mediaflick has this ${mediaLabel}, but Jellyfin does not see it yet.`;
    if (sync.issue === "pendingJellyfin") return `Mediaflick recently changed this ${mediaLabel}; Jellyfin may still be catching up.`;
    if (sync.issue === "localMissing") return `Jellyfin still has this ${mediaLabel}, but Mediaflick no longer has local library files for it.`;
    if (sync.issue === "verificationError") return `Mediaflick could not finish the Jellyfin verification for this ${mediaLabel}.`;
    return `This ${mediaLabel} is aligned between Mediaflick and Jellyfin.`;
}

function issueAction(sync: JellyfinSyncDetails, mediaLabel: string): string {
    if (sync.issue === "pathMismatch") return "Check your destination folder mapping and the Jellyfin library path, then refresh the item in Jellyfin.";
    if (sync.issue === "episodeMismatch") return `Refresh the ${mediaLabel} in Jellyfin and verify the affected season folders are inside a watched library path.`;
    if (sync.issue === "pathAndEpisodeMismatch") return "Start with the path mismatch first, then refresh Jellyfin so it can pick up the missing episodes from the correct folder.";
    if (sync.issue === "missingInJellyfin") return `Confirm the ${mediaLabel} lives under a Jellyfin library folder, then run a Jellyfin rescan.`;
    if (sync.issue === "pendingJellyfin") return "Wait for Jellyfin to finish its scan or trigger a manual refresh if it stays in this state.";
    if (sync.issue === "localMissing") return "Either remove the stale Jellyfin entry or restore the local files so both systems point at the same library content.";
    if (sync.issue === "verificationError") return "Check the Jellyfin connection and retry the verification from the details page later.";
    return "No action needed.";
}

export function JellyfinSyncPanel(props: {
    sync: JellyfinSyncDetails | null | undefined;
    mediaLabel: string;
    onRecheck?: () => void;
    recheckBusy?: boolean;
}) {
    return (
        <Show when={props.sync}>
            {(sync) => (
                <section class="rounded-[1.6rem] border border-border-subtle bg-surface-1/88 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p class="text-[0.68rem] font-mono uppercase tracking-[0.18em] text-text-tertiary">Jellyfin</p>
                            <h2 class="mt-1 text-xl font-semibold text-text-primary">Sync status</h2>
                        </div>
                        <div class="inline-flex flex-wrap items-center gap-2">
                            <JellyfinSyncPill sync={sync()} />
                            <Show when={sync().matchedBy}><Pill>Matched by {matchSourceLabel(sync().matchedBy)}</Pill></Show>
                            <Show when={props.onRecheck}>
                                <button
                                    type="button"
                                    onClick={() => props.onRecheck?.()}
                                    disabled={props.recheckBusy}
                                    class="inline-flex min-h-11 items-center justify-center rounded-xl border border-border-default bg-surface-0/45 px-4 py-2 text-sm text-text-secondary transition hover:border-border-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {props.recheckBusy ? "Rechecking..." : "Recheck Jellyfin now"}
                                </button>
                            </Show>
                        </div>
                    </div>

                    <div class="mt-4 space-y-4">
                        <div class="rounded-[1.2rem] border border-border-subtle bg-surface-0/35 px-4 py-4">
                            <p class="text-sm text-text-primary">{issueSummary(sync(), props.mediaLabel)}</p>
                            <p class="mt-2 text-sm text-text-secondary">{sync().message ?? issueAction(sync(), props.mediaLabel)}</p>
                            <Show when={sync().issue !== "none"}><p class="mt-2 text-sm text-text-secondary">What to do: {issueAction(sync(), props.mediaLabel)}</p></Show>
                            <Show when={sync().lastError}><p class="mt-2 text-sm text-error">Last Jellyfin error: {sync().lastError}</p></Show>
                        </div>

                        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <div class="rounded-[1.2rem] border border-border-subtle bg-surface-0/30 px-4 py-4">
                                <p class="text-[0.64rem] font-mono uppercase tracking-[0.18em] text-text-tertiary">Last checked</p>
                                <p class="mt-2 text-sm font-medium text-text-primary">{formatDateTime(sync().lastCheckedAt)}</p>
                            </div>
                            <div class="rounded-[1.2rem] border border-border-subtle bg-surface-0/30 px-4 py-4">
                                <p class="text-[0.64rem] font-mono uppercase tracking-[0.18em] text-text-tertiary">Jellyfin item</p>
                                <p class="mt-2 text-sm font-medium text-text-primary break-all">{sync().jellyfinItemId ?? "Not matched"}</p>
                            </div>
                            <div class="rounded-[1.2rem] border border-border-subtle bg-surface-0/30 px-4 py-4">
                                <p class="text-[0.64rem] font-mono uppercase tracking-[0.18em] text-text-tertiary">Verified episodes</p>
                                <p class="mt-2 text-sm font-medium text-text-primary">{sync().verifiedEpisodes ?? 0}</p>
                            </div>
                            <div class="rounded-[1.2rem] border border-border-subtle bg-surface-0/30 px-4 py-4">
                                <p class="text-[0.64rem] font-mono uppercase tracking-[0.18em] text-text-tertiary">Missing episodes</p>
                                <p class="mt-2 text-sm font-medium text-text-primary">{sync().missingEpisodes ?? 0}</p>
                            </div>
                        </div>

                        <Show when={sync().jellyfinPath || (sync().localDirectories?.length ?? 0) > 0}>
                            <div class="grid gap-3 lg:grid-cols-2">
                                <div class="rounded-[1.2rem] border border-border-subtle bg-surface-0/30 px-4 py-4">
                                    <p class="text-[0.64rem] font-mono uppercase tracking-[0.18em] text-text-tertiary">Jellyfin path</p>
                                    <p class="mt-2 break-all text-sm text-text-primary">{sync().jellyfinPath ?? "No Jellyfin path recorded"}</p>
                                </div>
                                <div class="rounded-[1.2rem] border border-border-subtle bg-surface-0/30 px-4 py-4">
                                    <p class="text-[0.64rem] font-mono uppercase tracking-[0.18em] text-text-tertiary">Mediaflick folders</p>
                                    <div class="mt-2 space-y-2">
                                        <Show when={(sync().localDirectories?.length ?? 0) > 0} fallback={<p class="text-sm text-text-secondary">No local library folders recorded.</p>}>
                                            <For each={sync().localDirectories ?? []}>{(path) => <p class="break-all text-sm text-text-primary">{path}</p>}</For>
                                        </Show>
                                    </div>
                                </div>
                            </div>
                        </Show>

                        <Show when={(sync().seasonDiagnostics?.length ?? 0) > 0}>
                            <div class="rounded-[1.2rem] border border-border-subtle bg-surface-0/30 px-4 py-4">
                                <p class="text-[0.64rem] font-mono uppercase tracking-[0.18em] text-text-tertiary">Season breakdown</p>
                                <div class="mt-3 space-y-2">
                                    <For each={sync().seasonDiagnostics ?? []}>
                                        {(season) => (
                                            <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-0/35 px-3 py-3 text-sm">
                                                <div>
                                                    <p class="font-medium text-text-primary">Season {season.seasonNumber}</p>
                                                    <p class="text-text-secondary">{season.verifiedEpisodes}/{season.localEpisodeCount} Mediaflick episodes matched in Jellyfin</p>
                                                </div>
                                                <div class="text-right text-text-secondary">
                                                    <p>Jellyfin episodes: {season.jellyfinEpisodeCount}</p>
                                                    <p>Unmatched Mediaflick episodes: {season.missingEpisodes}</p>
                                                </div>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </div>
                        </Show>
                    </div>
                </section>
            )}
        </Show>
    );
}
