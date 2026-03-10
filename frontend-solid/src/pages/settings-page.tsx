import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { Eye, EyeOff } from "lucide-solid";
import { For, Show, createEffect, createMemo, createSignal, type JSX } from "solid-js";
import { FolderPathInput } from "@/components/folder-path-input";
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

interface SecretInputProps {
    label: string;
    value: string;
    visible: boolean;
    onToggle: () => void;
    onInput: (value: string) => void;
    inputClass: string;
    labelClass: string;
}

function SectionCard(props: { title: string; description?: string; aside?: JSX.Element; children: JSX.Element }) {
    return (
        <section class="rounded-xl border border-border-default bg-surface-1 shadow-sm">
            <div class="flex flex-col gap-4 border-b border-border-subtle px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
                <div class="max-w-2xl">
                    <h2 class="text-lg font-semibold text-text-primary">{props.title}</h2>
                    <Show when={props.description}>
                        {(text) => <p class="mt-1 text-sm leading-6 text-text-secondary">{text()}</p>}
                    </Show>
                </div>
                <Show when={props.aside}>
                    {(aside) => <div class="flex items-center gap-2">{aside()}</div>}
                </Show>
            </div>
            <div class="px-6 py-5">{props.children}</div>
        </section>
    );
}

function Field(props: { label: string; labelClass: string; children: JSX.Element; helperText?: string }) {
    return (
        <label class="space-y-1.5">
            <div class="flex items-center justify-between gap-3">
                <span class={props.labelClass}>{props.label}</span>
                <Show when={props.helperText}>
                    {(text) => <span class="text-[0.72rem] text-text-tertiary">{text()}</span>}
                </Show>
            </div>
            {props.children}
        </label>
    );
}

function SecretInput(props: SecretInputProps) {
    return (
        <Field label={props.label} labelClass={props.labelClass}>
            <div class="relative">
                <input
                    type={props.visible ? "text" : "password"}
                    class={`${props.inputClass} pr-11`}
                    value={props.value}
                    onInput={(e) => props.onInput(e.currentTarget.value)}
                />
                <button
                    type="button"
                    aria-label={props.visible ? `Hide ${props.label}` : `Show ${props.label}`}
                    class="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-text-tertiary transition hover:bg-surface-2 hover:text-text-primary"
                    onClick={props.onToggle}
                >
                    {props.visible ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
            </div>
        </Field>
    );
}

function MappingCard(props: {
    mapping: FolderMappingConfig;
    index: number;
    inputClass: string;
    labelClass: string;
    canRemove: boolean;
    onChange: (field: keyof FolderMappingConfig, value: string) => void;
    onRemove: () => void;
}) {
    return (
        <div class="rounded-xl border border-border-subtle bg-surface-2 p-4">
            <div class="mb-4 flex items-center justify-between gap-3">
                <div>
                    <h3 class="text-sm font-semibold text-text-primary">Mapping {props.index + 1}</h3>
                    <p class="mt-1 text-xs text-text-tertiary">Choose the ingest source, target library folder, and media type.</p>
                </div>
                <button
                    type="button"
                    disabled={!props.canRemove}
                    onClick={props.onRemove}
                    class="rounded-lg border border-error/30 bg-error-muted px-3 py-2 text-xs font-medium text-error transition hover:bg-error/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    Remove
                </button>
            </div>

            <div class="grid gap-4 xl:grid-cols-[1fr_1fr_180px]">
                <FolderPathInput
                    label="Source folder"
                    value={props.mapping.sourceFolder}
                    onChange={(value) => props.onChange("sourceFolder", value)}
                    inputClass={props.inputClass}
                    labelClass={props.labelClass}
                    helperText="Type a path or browse"
                />
                <FolderPathInput
                    label="Destination folder"
                    value={props.mapping.destinationFolder}
                    onChange={(value) => props.onChange("destinationFolder", value)}
                    inputClass={props.inputClass}
                    labelClass={props.labelClass}
                    helperText="Type a path or browse"
                />
                <Field label="Media type" labelClass={props.labelClass}>
                    <select class={props.inputClass} value={props.mapping.mediaType} onChange={(e) => props.onChange("mediaType", e.currentTarget.value)}>
                        <For each={mediaTypeOptions}>{(type) => <option value={type}>{type}</option>}</For>
                    </select>
                </Field>
            </div>
        </div>
    );
}

export default function SettingsPage() {
    const queryClient = useQueryClient();
    const configQuery = useQuery(() => ({ queryKey: ["config"], queryFn: () => mediaApi.getConfig() }));
    const [draft, setDraft] = createSignal<ConfigurationPayload | null>(null);
    const [showPlexToken, setShowPlexToken] = createSignal(false);
    const [showJellyfinApiKey, setShowJellyfinApiKey] = createSignal(false);
    const [showTmdbApiKey, setShowTmdbApiKey] = createSignal(false);

    createEffect(() => {
        if (configQuery.data && !draft()) setDraft(cloneConfig(configQuery.data));
    });

    const saveMutation = useMutation(() => ({
        mutationFn: (payload: ConfigurationPayload) => mediaApi.updateConfig(payload),
        onSuccess: async (updated) => {
            setDraft(cloneConfig(updated));
            await queryClient.invalidateQueries({ queryKey: ["config"] });
        },
    }));

    const isDirty = createMemo(() => {
        const local = draft();
        const remote = configQuery.data;
        if (!local || !remote) return false;
        return JSON.stringify(local) !== JSON.stringify(remote);
    });

    const patchDraft = (fn: (config: ConfigurationPayload) => ConfigurationPayload) => {
        setDraft((config) => (config ? fn(cloneConfig(config)) : config));
    };

    const updateMappingField = (index: number, field: keyof FolderMappingConfig, value: string) => {
        patchDraft((config) => {
            const next = cloneConfig(config);
            const mapping = next.plex.folderMappings[index];
            if (!mapping) return next;
            if (field === "mediaType") mapping.mediaType = value as MediaType;
            else if (field === "sourceFolder") mapping.sourceFolder = value;
            else mapping.destinationFolder = value;
            return next;
        });
    };

    const inputCls = "w-full rounded-lg border border-border-default bg-surface-3 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition";
    const labelCls = "text-xs font-medium text-text-secondary";

    return (
        <section class="mx-auto flex w-full max-w-[1240px] flex-col gap-6 px-4 pb-10 pt-1 lg:px-6">
            <div class="flex flex-col gap-4 rounded-xl border border-border-default bg-surface-1 px-6 py-5 shadow-sm lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h1 class="text-2xl font-semibold text-text-primary">Settings</h1>
                    <p class="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">
                        Keep connection settings, ingest timing, and folder mappings in one place. Save applies the new configuration and restarts the backend poller.
                    </p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <Pill>Endpoint: /api/config</Pill>
                    <Pill>{configQuery.isFetching ? "Refreshing" : "Idle"}</Pill>
                </div>
            </div>

            <Show when={configQuery.isLoading}>
                <div class="space-y-4">
                    <div class="skeleton h-44 rounded-xl" />
                    <div class="skeleton h-44 rounded-xl" />
                    <div class="skeleton h-52 rounded-xl" />
                </div>
            </Show>

            <Show when={configQuery.isError}>
                <div class="rounded-xl border border-error/30 bg-error-muted px-4 py-3 text-sm text-error">
                    Unable to load configuration from backend.
                </div>
            </Show>

            <Show when={draft()}>
                {(config) => (
                    <form
                        class="space-y-6"
                        onSubmit={(e) => {
                            e.preventDefault();
                            const payload = draft();
                            if (payload) saveMutation.mutate(payload);
                        }}
                    >
                        <SectionCard
                            title="Connections"
                            description="Server targets and credentials for Plex, Jellyfin, and TMDb. Each secret field can be revealed individually from the icon inside the input."
                        >
                            <div class="grid gap-6 xl:grid-cols-3">
                                <div class="rounded-xl border border-border-subtle bg-surface-2 p-4">
                                    <div class="mb-4">
                                        <h3 class="text-sm font-semibold text-text-primary">Plex</h3>
                                        <p class="mt-1 text-xs leading-5 text-text-tertiary">Connection info for status checks and token-based access.</p>
                                    </div>
                                    <div class="grid gap-4 sm:grid-cols-2">
                                        <Field label="Host" labelClass={labelCls}>
                                            <input class={inputCls} value={config().plex.host} onInput={(e) => patchDraft((c) => ({ ...c, plex: { ...c.plex, host: e.currentTarget.value } }))} />
                                        </Field>
                                        <Field label="Port" labelClass={labelCls}>
                                            <input type="number" min="1" class={inputCls} value={String(config().plex.port)} onInput={(e) => patchDraft((c) => ({ ...c, plex: { ...c.plex, port: parseIntOr(e.currentTarget.value, c.plex.port) } }))} />
                                        </Field>
                                        <div class="sm:col-span-2">
                                            <SecretInput
                                                label="Plex token"
                                                value={config().plex.plexToken}
                                                visible={showPlexToken()}
                                                onToggle={() => setShowPlexToken((value) => !value)}
                                                onInput={(value) => patchDraft((c) => ({ ...c, plex: { ...c.plex, plexToken: value } }))}
                                                inputClass={inputCls}
                                                labelClass={labelCls}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div class="rounded-xl border border-border-subtle bg-surface-2 p-4">
                                    <div class="mb-4">
                                        <h3 class="text-sm font-semibold text-text-primary">Jellyfin</h3>
                                        <p class="mt-1 text-xs leading-5 text-text-tertiary">Optional sync feedback after Mediaflick changes local symlinks.</p>
                                    </div>
                                    <div class="grid gap-4">
                                        <label class="flex items-center gap-3 rounded-lg border border-border-default bg-surface-3 px-3 py-2.5 text-sm text-text-primary">
                                            <input
                                                type="checkbox"
                                                checked={config().jellyfin.enabled}
                                                onChange={(e) => patchDraft((c) => ({ ...c, jellyfin: { ...c.jellyfin, enabled: e.currentTarget.checked } }))}
                                            />
                                            <span>Enable Jellyfin sync</span>
                                        </label>
                                        <Field label="Base URL" labelClass={labelCls}>
                                            <input class={inputCls} value={config().jellyfin.baseUrl} onInput={(e) => patchDraft((c) => ({ ...c, jellyfin: { ...c.jellyfin, baseUrl: e.currentTarget.value } }))} />
                                        </Field>
                                        <SecretInput
                                            label="API key"
                                            value={config().jellyfin.apiKey}
                                            visible={showJellyfinApiKey()}
                                            onToggle={() => setShowJellyfinApiKey((value) => !value)}
                                            onInput={(value) => patchDraft((c) => ({ ...c, jellyfin: { ...c.jellyfin, apiKey: value } }))}
                                            inputClass={inputCls}
                                            labelClass={labelCls}
                                        />
                                        <Field label="Timeout (ms)" labelClass={labelCls}>
                                            <input type="number" min="1000" class={inputCls} value={String(config().jellyfin.requestTimeoutMs)} onInput={(e) => patchDraft((c) => ({ ...c, jellyfin: { ...c.jellyfin, requestTimeoutMs: parseIntOr(e.currentTarget.value, c.jellyfin.requestTimeoutMs) } }))} />
                                        </Field>
                                    </div>
                                </div>

                                <div class="rounded-xl border border-border-subtle bg-surface-2 p-4">
                                    <div class="mb-4">
                                        <h3 class="text-sm font-semibold text-text-primary">TMDb</h3>
                                        <p class="mt-1 text-xs leading-5 text-text-tertiary">Metadata lookup settings. The TVDB key stays backend-managed and is not editable here.</p>
                                    </div>
                                    <div class="grid gap-4">
                                        <SecretInput
                                            label="TMDb API key"
                                            value={config().tmDb.apiKey}
                                            visible={showTmdbApiKey()}
                                            onToggle={() => setShowTmdbApiKey((value) => !value)}
                                            onInput={(value) => patchDraft((c) => ({ ...c, tmDb: { ...c.tmDb, apiKey: value } }))}
                                            inputClass={inputCls}
                                            labelClass={labelCls}
                                        />
                                    </div>
                                </div>
                            </div>
                        </SectionCard>

                        <SectionCard
                            title="Ingest behavior"
                            description="Control polling cadence, folder delay, metadata cache duration, extras detection, and the Zurg version file location."
                        >
                            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                                <Field label="Polling interval (s)" labelClass={labelCls}>
                                    <input type="number" min="1" class={inputCls} value={String(config().plex.pollingInterval)} onInput={(e) => patchDraft((c) => ({ ...c, plex: { ...c.plex, pollingInterval: parseIntOr(e.currentTarget.value, c.plex.pollingInterval) } }))} />
                                </Field>
                                <Field label="Folder delay (s)" labelClass={labelCls}>
                                    <input type="number" min="0" class={inputCls} value={String(config().plex.processNewFolderDelay)} onInput={(e) => patchDraft((c) => ({ ...c, plex: { ...c.plex, processNewFolderDelay: parseIntOr(e.currentTarget.value, c.plex.processNewFolderDelay) } }))} />
                                </Field>
                                <Field label="Cache duration (s)" labelClass={labelCls}>
                                    <input type="number" min="1" class={inputCls} value={String(config().mediaDetection.cacheDuration)} onInput={(e) => patchDraft((c) => ({ ...c, mediaDetection: { ...c.mediaDetection, cacheDuration: parseIntOr(e.currentTarget.value, c.mediaDetection.cacheDuration) } }))} />
                                </Field>
                                <Field label="Extras threshold (bytes)" labelClass={labelCls}>
                                    <input type="number" min="0" class={inputCls} value={String(config().mediaDetection.autoExtrasThresholdBytes)} onInput={(e) => patchDraft((c) => ({ ...c, mediaDetection: { ...c.mediaDetection, autoExtrasThresholdBytes: parseIntOr(e.currentTarget.value, c.mediaDetection.autoExtrasThresholdBytes) } }))} />
                                </Field>
                                <Field label="Zurg version file" labelClass={labelCls}>
                                    <input class={inputCls} value={config().zurg.versionLocation} onInput={(e) => patchDraft((c) => ({ ...c, zurg: { ...c.zurg, versionLocation: e.currentTarget.value } }))} />
                                </Field>
                            </div>
                        </SectionCard>

                        <SectionCard
                            title="Folder mappings"
                            description="Each mapping defines where Mediaflick reads files from and where it creates organized symlinks. Use the folder browser to walk the filesystem instead of typing every path manually."
                            aside={
                                <button
                                    type="button"
                                    onClick={() => patchDraft((c) => {
                                        const next = cloneConfig(c);
                                        next.plex.folderMappings.push(defaultFolderMapping());
                                        return next;
                                    })}
                                    class="rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm font-medium text-text-secondary transition hover:border-border-hover hover:text-text-primary"
                                >
                                    Add mapping
                                </button>
                            }
                        >
                            <div class="space-y-4">
                                <For each={config().plex.folderMappings}>
                                    {(mapping, index) => (
                                        <MappingCard
                                            mapping={mapping}
                                            index={index()}
                                            inputClass={inputCls}
                                            labelClass={labelCls}
                                            canRemove={config().plex.folderMappings.length > 1}
                                            onChange={(field, value) => updateMappingField(index(), field, value)}
                                            onRemove={() => patchDraft((c) => {
                                                const next = cloneConfig(c);
                                                if (next.plex.folderMappings.length <= 1) return next;
                                                next.plex.folderMappings = next.plex.folderMappings.filter((_, itemIndex) => itemIndex !== index());
                                                return next;
                                            })}
                                        />
                                    )}
                                </For>
                            </div>
                        </SectionCard>

                        <div class="sticky bottom-0 z-10 -mx-4 border-t border-border-default bg-surface-0/92 px-4 py-4 backdrop-blur md:-mx-6 md:px-6">
                            <div class="mx-auto flex max-w-[1240px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div class="space-y-1">
                                    <Show when={saveMutation.isError}>
                                        <p class="text-sm text-error">Save failed: {errorMessage(saveMutation.error)}</p>
                                    </Show>
                                    <Show when={saveMutation.isSuccess && !saveMutation.isPending}>
                                        <p class="text-sm text-success">Configuration saved. Backend poller restarted with your new settings.</p>
                                    </Show>
                                    <Show when={!saveMutation.isError && !(saveMutation.isSuccess && !saveMutation.isPending)}>
                                        <p class="text-sm text-text-secondary">Review your changes, then save to apply them.</p>
                                    </Show>
                                </div>
                                <div class="flex gap-3">
                                    <button
                                        type="button"
                                        disabled={!isDirty() || saveMutation.isPending}
                                        onClick={() => {
                                            if (configQuery.data) setDraft(cloneConfig(configQuery.data));
                                        }}
                                        class="rounded-lg border border-border-default bg-surface-2 px-4 py-2 text-sm font-medium text-text-secondary transition hover:border-border-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        Reset changes
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!isDirty() || saveMutation.isPending}
                                        class="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-surface-0 transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        {saveMutation.isPending ? "Saving..." : "Save configuration"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </form>
                )}
            </Show>
        </section>
    );
}
