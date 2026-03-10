import { useQuery } from "@tanstack/solid-query";
import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { mediaApi } from "@/lib/api";
import { errorMessage } from "@/lib/media-helpers";

interface FolderPathInputProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    inputClass: string;
    labelClass: string;
    helperText?: string;
}

function pathSegments(path: string) {
    if (path === "/") {
        return [{ label: "/", path: "/" }];
    }

    const parts = path.split("/").filter(Boolean);
    return [
        { label: "/", path: "/" },
        ...parts.map((part, index) => ({
            label: part,
            path: `/${parts.slice(0, index + 1).join("/")}`,
        })),
    ];
}

export function FolderPathInput(props: FolderPathInputProps) {
    const [open, setOpen] = createSignal(false);
    const [currentPath, setCurrentPath] = createSignal(props.value.trim() || "/");

    createEffect(() => {
        if (!open()) {
            setCurrentPath(props.value.trim() || "/");
        }
    });

    const browserQuery = useQuery(() => ({
        queryKey: ["directory-browser", currentPath()],
        queryFn: () => mediaApi.browseDirectory(currentPath()),
        enabled: open(),
    }));

    createEffect(() => {
        const data = browserQuery.data;
        if (!data) return;
        if (data.path !== currentPath()) {
            setCurrentPath(data.path);
        }
    });

    const openPath = (path: string) => {
        setCurrentPath(path || "/");
    };

    const breadcrumbs = createMemo(() => pathSegments(browserQuery.data?.path ?? currentPath()));

    onMount(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setOpen(false);
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        onCleanup(() => document.removeEventListener("keydown", handleKeyDown));
    });

    return (
        <div class="relative">
            <label class="space-y-1.5">
                <div class="flex items-center justify-between gap-3">
                    <span class={props.labelClass}>{props.label}</span>
                    <Show when={props.helperText}>
                        {(text) => <span class="text-[0.72rem] text-text-tertiary">{text()}</span>}
                    </Show>
                </div>
                <input
                    class={props.inputClass}
                    value={props.value}
                    onFocus={() => {
                        setCurrentPath(props.value.trim() || "/");
                        setOpen(true);
                    }}
                    onInput={(e) => {
                        const value = e.currentTarget.value;
                        props.onChange(value);
                        setCurrentPath(value.trim() || "/");
                    }}
                />
            </label>

            <Show when={open()}>
                <div class="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-border-default bg-surface-1 shadow-xl">
                    <div class="border-b border-border-subtle px-4 py-3">
                        <p class="text-xs font-medium text-text-secondary">Browse server folders</p>
                        <div class="mt-2 flex flex-wrap items-center gap-1 text-sm">
                            <For each={breadcrumbs()}>
                                {(segment, index) => (
                                    <>
                                        <button
                                            type="button"
                                            class={`rounded-md px-2 py-1 transition ${segment.path === (browserQuery.data?.path ?? currentPath()) ? "bg-surface-3 text-text-primary" : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"}`}
                                            onClick={() => openPath(segment.path)}
                                        >
                                            {segment.label}
                                        </button>
                                        <Show when={index() < breadcrumbs().length - 1}>
                                            <span class="text-text-tertiary">/</span>
                                        </Show>
                                    </>
                                )}
                            </For>
                        </div>
                    </div>

                    <div class="max-h-80 overflow-y-scroll px-2 py-2">
                        <Show when={browserQuery.isLoading}>
                            <div class="space-y-2 px-2 py-2">
                                <div class="skeleton h-9 rounded-lg" />
                                <div class="skeleton h-9 rounded-lg" />
                                <div class="skeleton h-9 rounded-lg" />
                            </div>
                        </Show>

                        <Show when={browserQuery.isError}>
                            <div class="rounded-lg border border-error/30 bg-error-muted px-3 py-3 text-sm text-error">
                                {errorMessage(browserQuery.error)}
                            </div>
                        </Show>

                        <Show when={browserQuery.data && !browserQuery.isLoading && !browserQuery.isError}>
                            <div class="space-y-1">
                                <button
                                    type="button"
                                    class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-text-primary transition hover:bg-surface-2"
                                    onClick={() => openPath(browserQuery.data?.path ?? currentPath())}
                                >
                                    <span>.</span>
                                    <span class="text-xs text-text-tertiary">Current folder</span>
                                </button>

                                <Show when={browserQuery.data?.parentPath}>
                                    {(parent) => (
                                        <button
                                            type="button"
                                            class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-text-primary transition hover:bg-surface-2"
                                            onClick={() => openPath(parent())}
                                        >
                                            <span>..</span>
                                            <span class="text-xs text-text-tertiary">Parent folder</span>
                                        </button>
                                    )}
                                </Show>

                                <For each={browserQuery.data?.directories ?? []}>
                                    {(entry) => (
                                        <button
                                            type="button"
                                            class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-text-primary transition hover:bg-surface-2"
                                            onClick={() => openPath(entry.path)}
                                        >
                                            <span class="truncate">{entry.name}</span>
                                            <span class="text-xs text-text-tertiary">Folder</span>
                                        </button>
                                    )}
                                </For>

                                <Show when={(browserQuery.data?.directories.length ?? 0) === 0 && (browserQuery.data?.files.length ?? 0) === 0}>
                                    <div class="rounded-lg px-3 py-2 text-sm text-text-secondary">This directory is empty.</div>
                                </Show>

                                <For each={browserQuery.data?.files ?? []}>
                                    {(entry) => (
                                        <div class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-text-secondary">
                                            <span class="truncate">{entry.name}</span>
                                            <span class="text-xs text-text-tertiary">File</span>
                                        </div>
                                    )}
                                </For>

                                <div class="sticky bottom-0 mt-2 border-t border-border-subtle bg-surface-1 px-2 pt-3">
                                    <button
                                        type="button"
                                        class="w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-surface-0 transition hover:bg-accent-hover"
                                        onClick={() => {
                                            props.onChange(browserQuery.data?.path ?? currentPath());
                                            setOpen(false);
                                        }}
                                    >
                                        Use directory
                                    </button>
                                </div>
                            </div>
                        </Show>
                    </div>
                </div>
            </Show>
        </div>
    );
}
