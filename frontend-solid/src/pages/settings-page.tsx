import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import { Pill } from "@/components/common-ui";
import { mediaApi } from "@/lib/api";
import {
    cloneConfig,
    defaultFolderMapping,
    errorMessage,
    mediaTypeOptions,
    parseIntOr,
} from "@/lib/media-helpers";
import type { ConfigurationPayload, FolderMappingConfig, MediaType } from "@/lib/types";

export default function SettingsPage() {
    const queryClient = useQueryClient();
    const configQuery = useQuery(() => ({ queryKey: ["config"], queryFn: () => mediaApi.getConfig() }));
    const [draft, setDraft] = createSignal<ConfigurationPayload | null>(null);

    createEffect(() => {
        if (configQuery.data && !draft()) setDraft(cloneConfig(configQuery.data));
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

    const patchDraft = (fn: (c: ConfigurationPayload) => ConfigurationPayload) => {
        setDraft((c) => (c ? fn(cloneConfig(c)) : c));
    };

    const updateMappingField = (idx: number, field: keyof FolderMappingConfig, val: string) => {
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

    const inputCls = "w-full bg-surface-3 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition";
    const labelCls = "block text-xs font-medium text-text-secondary mb-1";

    return (
        <section class="space-y-6">
            <div class="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 class="text-2xl font-bold">Settings</h1>
                    <p class="text-sm text-text-secondary mt-1">Edit backend settings and save to restart the poller.</p>
                </div>
                <div class="flex gap-2"><Pill>Endpoint: /api/config</Pill><Pill>{configQuery.isFetching ? "Refreshing" : "Idle"}</Pill></div>
            </div>

            <Show when={configQuery.isLoading}><div class="space-y-4"><For each={Array(3)}>{() => <div class="skeleton h-32 rounded-xl" />}</For></div></Show>
            <Show when={configQuery.isError}><p class="text-error text-sm">Unable to load configuration from backend.</p></Show>

            <Show when={draft()}>
                {(config) => (
                    <form class="space-y-5" onSubmit={(e) => {
                        e.preventDefault();
                        const p = draft();
                        if (p) saveMutation.mutate(p);
                    }}>
                        <div class="bg-surface-2 border border-border-subtle rounded-xl p-5 space-y-4">
                            <h3 class="text-base font-bold">Plex</h3>
                            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <label><span class={labelCls}>Host</span><input class={inputCls} value={config().plex.host} onInput={(e) => patchDraft((c) => ({ ...c, plex: { ...c.plex, host: e.currentTarget.value } }))} /></label>
                                <label><span class={labelCls}>Port</span><input type="number" min="1" class={inputCls} value={String(config().plex.port)} onInput={(e) => patchDraft((c) => ({ ...c, plex: { ...c.plex, port: parseIntOr(e.currentTarget.value, c.plex.port) } }))} /></label>
                                <label><span class={labelCls}>Polling interval (s)</span><input type="number" min="1" class={inputCls} value={String(config().plex.pollingInterval)} onInput={(e) => patchDraft((c) => ({ ...c, plex: { ...c.plex, pollingInterval: parseIntOr(e.currentTarget.value, c.plex.pollingInterval) } }))} /></label>
                                <label><span class={labelCls}>Folder delay (s)</span><input type="number" min="0" class={inputCls} value={String(config().plex.processNewFolderDelay)} onInput={(e) => patchDraft((c) => ({ ...c, plex: { ...c.plex, processNewFolderDelay: parseIntOr(e.currentTarget.value, c.plex.processNewFolderDelay) } }))} /></label>
                            </div>
                            <label><span class={labelCls}>Plex token</span><input type="password" class={inputCls} value={config().plex.plexToken} onInput={(e) => patchDraft((c) => ({ ...c, plex: { ...c.plex, plexToken: e.currentTarget.value } }))} /></label>
                        </div>

                        <div class="bg-surface-2 border border-border-subtle rounded-xl p-5 space-y-4">
                            <h3 class="text-base font-bold">TMDb + Detection + Zurg</h3>
                            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <label><span class={labelCls}>TMDb API key</span><input type="password" class={inputCls} value={config().tmDb.apiKey} onInput={(e) => patchDraft((c) => ({ ...c, tmDb: { ...c.tmDb, apiKey: e.currentTarget.value } }))} /></label>
                                <label><span class={labelCls}>Cache duration (s)</span><input type="number" min="1" class={inputCls} value={String(config().mediaDetection.cacheDuration)} onInput={(e) => patchDraft((c) => ({ ...c, mediaDetection: { ...c.mediaDetection, cacheDuration: parseIntOr(e.currentTarget.value, c.mediaDetection.cacheDuration) } }))} /></label>
                                <label><span class={labelCls}>Extras threshold (bytes)</span><input type="number" min="0" class={inputCls} value={String(config().mediaDetection.autoExtrasThresholdBytes)} onInput={(e) => patchDraft((c) => ({ ...c, mediaDetection: { ...c.mediaDetection, autoExtrasThresholdBytes: parseIntOr(e.currentTarget.value, c.mediaDetection.autoExtrasThresholdBytes) } }))} /></label>
                                <label><span class={labelCls}>Zurg version file</span><input class={inputCls} value={config().zurg.versionLocation} onInput={(e) => patchDraft((c) => ({ ...c, zurg: { ...c.zurg, versionLocation: e.currentTarget.value } }))} /></label>
                            </div>
                        </div>

                        <div class="bg-surface-2 border border-border-subtle rounded-xl p-5 space-y-4">
                            <div class="flex items-center justify-between">
                                <h3 class="text-base font-bold">Folder Mappings</h3>
                                <button type="button" onClick={() => patchDraft((c) => { const n = cloneConfig(c); n.plex.folderMappings.push(defaultFolderMapping()); return n; })} class="px-3 py-1.5 text-xs rounded-lg border border-border-default bg-surface-3 text-text-secondary hover:text-text-primary hover:border-border-hover transition">Add mapping</button>
                            </div>
                            <div class="space-y-3">
                                <For each={config().plex.folderMappings}>
                                    {(mapping, index) => (
                                        <div class="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-3 items-end bg-surface-3 border border-border-subtle rounded-lg p-4">
                                            <label><span class={labelCls}>Source folder</span><input class={inputCls} value={mapping.sourceFolder} onInput={(e) => updateMappingField(index(), "sourceFolder", e.currentTarget.value)} /></label>
                                            <label><span class={labelCls}>Destination folder</span><input class={inputCls} value={mapping.destinationFolder} onInput={(e) => updateMappingField(index(), "destinationFolder", e.currentTarget.value)} /></label>
                                            <label>
                                                <span class={labelCls}>Media type</span>
                                                <select class={inputCls} value={mapping.mediaType} onChange={(e) => updateMappingField(index(), "mediaType", e.currentTarget.value)}>
                                                    <For each={mediaTypeOptions}>{(t) => <option value={t}>{t}</option>}</For>
                                                </select>
                                            </label>
                                            <button
                                                type="button"
                                                disabled={config().plex.folderMappings.length <= 1}
                                                onClick={() => patchDraft((c) => {
                                                    const n = cloneConfig(c);
                                                    if (n.plex.folderMappings.length <= 1) return n;
                                                    n.plex.folderMappings = n.plex.folderMappings.filter((_, i) => i !== index());
                                                    return n;
                                                })}
                                                class="px-3 py-2 text-xs rounded-lg border border-error/30 bg-error-muted text-error hover:bg-error/20 disabled:opacity-40 disabled:cursor-not-allowed transition self-end"
                                            >Remove</button>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </div>

                        <div class="flex justify-end gap-3">
                            <button type="button" disabled={!isDirty() || saveMutation.isPending} onClick={() => { if (configQuery.data) setDraft(cloneConfig(configQuery.data)); }} class="px-4 py-2 text-sm rounded-lg border border-border-default bg-surface-2 text-text-secondary hover:text-text-primary hover:border-border-hover disabled:opacity-40 disabled:cursor-not-allowed transition">Reset changes</button>
                            <button type="submit" disabled={!isDirty() || saveMutation.isPending} class="px-5 py-2 text-sm font-semibold rounded-lg bg-accent text-surface-0 hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition">{saveMutation.isPending ? "Saving..." : "Save configuration"}</button>
                        </div>

                        <Show when={saveMutation.isError}><p class="text-error text-sm">Save failed: {errorMessage(saveMutation.error)}</p></Show>
                        <Show when={saveMutation.isSuccess && !saveMutation.isPending}><p class="text-success text-sm">Configuration saved. Backend poller restarted with your new settings.</p></Show>
                    </form>
                )}
            </Show>
        </section>
    );
}
