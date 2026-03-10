import { useLocation } from "@solidjs/router";
import { useQuery, useQueryClient } from "@tanstack/solid-query";
import {
    For,
    Show,
    createEffect,
    createMemo,
    createSignal,
    onCleanup,
    onMount,
    type ParentComponent,
} from "solid-js";
import { SidebarNavigation } from "@/components/sidebar-navigation";
import { mediaApi } from "@/lib/api";
import { onAppNotification, type AppNotification, type AppNotificationTone } from "@/lib/notifications";
import { createRealtimeSocket } from "@/lib/realtime";

interface ToastItem extends AppNotification {
    id: number;
}

function toastToneClass(tone: AppNotificationTone | undefined): string {
    if (tone === "success") return "border-success/30 bg-success/14 text-text-primary";
    if (tone === "error") return "border-error/30 bg-error/14 text-text-primary";
    return "border-info/30 bg-info/14 text-text-primary";
}

export const AppShell: ParentComponent = (props) => {
    const sidebarExpandedKey = "mediaflick.sidebar.expanded";
    const sidebarPreferenceVersionKey = "mediaflick.sidebar.pref-version";
    const location = useLocation();
    const queryClient = useQueryClient();
    const [lastHeartbeat, setLastHeartbeat] = createSignal<number>(0);
    const [lastZurgSignal, setLastZurgSignal] = createSignal<number>(0);
    const [mobileNavOpen, setMobileNavOpen] = createSignal(false);
    const [mobileTriggerVisible, setMobileTriggerVisible] = createSignal(true);
    const [sidebarExpanded, setSidebarExpanded] = createSignal(true);
    const [toasts, setToasts] = createSignal<ToastItem[]>([]);

    onMount(() => {
        const savedSidebarState = window.localStorage.getItem(
            sidebarExpandedKey,
        );
        const sidebarPreferenceVersion = window.localStorage.getItem(
            sidebarPreferenceVersionKey,
        );
        if (savedSidebarState === "1") setSidebarExpanded(true);
        else if (savedSidebarState === "0" && sidebarPreferenceVersion === "2") {
            setSidebarExpanded(false);
        }

        let lastY = window.scrollY;
        const dismissToast = (id: number) => {
            setToasts((items) => items.filter((item) => item.id !== id));
        };
        const handleScroll = () => {
            const currentY = window.scrollY;
            if (mobileNavOpen()) {
                setMobileTriggerVisible(false);
            } else if (currentY < 48 || currentY < lastY - 8) {
                setMobileTriggerVisible(true);
            } else if (currentY > lastY + 8) {
                setMobileTriggerVisible(false);
            }
            lastY = currentY;
        };
        window.addEventListener("scroll", handleScroll, { passive: true });

        const cleanupNotifications = onAppNotification((notification) => {
            const id = Date.now() + Math.floor(Math.random() * 1000);
            setToasts((items) => [...items, { id, ...notification }]);
            window.setTimeout(() => dismissToast(id), notification.tone === "error" ? 7000 : 4500);
        });

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
                message.type === "library.changed" ||
                message.type === "file.added" ||
                message.type === "file.updated" ||
                message.type === "file.removed"
            ) {
                for (const key of [
                    "dashboard",
                    "triage-inbox",
                    "sidebar-badges",
                    "titles",
                    "show",
                    "movie",
                    "tv-files",
                    "tv-seasons",
                    "tv-episode-source",
                    "tv-episode-groups",
                    "movie-files",
                    "archive-files",
                    "wanted-shows",
                    "unidentified-files",
                    "logs",
                ]) {
                    void queryClient.invalidateQueries({ queryKey: [key] });
                }
            }
        });

        onCleanup(() => {
            cleanupNotifications();
            cleanupSocket();
            window.removeEventListener("scroll", handleScroll);
        });
    });

    createEffect(() => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(sidebarExpandedKey, sidebarExpanded() ? "1" : "0");
        window.localStorage.setItem(sidebarPreferenceVersionKey, "2");
    });

    const backendOnline = createMemo(
        () => lastHeartbeat() > 0 && Date.now() - lastHeartbeat() < 70_000,
    );
    const zurgOnline = createMemo(
        () => lastZurgSignal() > 0 && Date.now() - lastZurgSignal() < 70_000,
    );

    const sidebarBadgesQuery = useQuery(() => ({
        queryKey: ["sidebar-badges"],
        queryFn: async () => {
            const triageInbox = await mediaApi.getTriageInbox();
            return {
                triage: triageInbox.summary.totalItems,
                wanted: triageInbox.summary.wantedShows,
                unidentified: triageInbox.summary.unidentifiedTv
                    + triageInbox.summary.unidentifiedMovies
                    + triageInbox.summary.failedFiles
                    + triageInbox.summary.duplicateFiles,
            };
        },
        staleTime: 60 * 1000,
    }));

    createEffect(() => {
        location.pathname;
        setMobileNavOpen(false);
        setMobileTriggerVisible(true);
    });

    return (
        <div class="app-shell min-h-screen flex flex-col">
            <div class="workspace-shell flex-1">
                <aside
                    class="side-rail hidden lg:flex"
                    classList={{ "is-expanded": sidebarExpanded() }}
                >
                    <SidebarNavigation
                        backendOnline={backendOnline()}
                        zurgOnline={zurgOnline()}
                        triageBadge={sidebarBadgesQuery.data?.triage}
                        wantedBadge={sidebarBadgesQuery.data?.wanted}
                        unidentifiedBadge={sidebarBadgesQuery.data?.unidentified}
                        expanded={sidebarExpanded()}
                        onToggle={() => setSidebarExpanded((v) => !v)}
                    />
                </aside>

                <main class="content-stage flex-1">{props.children}</main>
            </div>

            <button
                type="button"
                class="mobile-menu-trigger lg:hidden"
                classList={{ "is-hidden": !mobileTriggerVisible() }}
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation"
                aria-expanded={mobileNavOpen()}
            >
                <span class="mobile-menu-icon" aria-hidden="true">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        class="w-4 h-4"
                    >
                        <path d="M4 7h16M4 12h16M4 17h16" />
                    </svg>
                </span>
                <span class="mobile-menu-label">Menu</span>
            </button>

            <Show when={mobileNavOpen()}>
                <div
                    class="mobile-nav-backdrop lg:hidden"
                    onClick={() => setMobileNavOpen(false)}
                >
                    <aside
                        class="mobile-nav-panel"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            class="menu-toggle mobile-nav-close"
                            onClick={() => setMobileNavOpen(false)}
                            aria-label="Close navigation"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                class="w-4 h-4"
                            >
                                <path d="M18 6 6 18M6 6l12 12" />
                            </svg>
                        </button>
                        <div class="mobile-nav-scroll">
                            <SidebarNavigation
                                backendOnline={backendOnline()}
                                zurgOnline={zurgOnline()}
                                triageBadge={sidebarBadgesQuery.data?.triage}
                                wantedBadge={sidebarBadgesQuery.data?.wanted}
                                unidentifiedBadge={sidebarBadgesQuery.data?.unidentified}
                                expanded={true}
                                onToggle={() => undefined}
                                onNavigate={() => setMobileNavOpen(false)}
                            />
                        </div>
                    </aside>
                </div>
            </Show>

            <div class="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-full max-w-sm flex-col gap-3 px-4">
                <For each={toasts()}>
                    {(toast) => (
                        <div class={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-[0_18px_48px_rgba(0,0,0,0.28)] backdrop-blur-sm ${toastToneClass(toast.tone)}`}>
                            <p class="text-sm font-semibold">{toast.title}</p>
                            <Show when={toast.message}><p class="mt-1 text-sm text-text-secondary">{toast.message}</p></Show>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
};
