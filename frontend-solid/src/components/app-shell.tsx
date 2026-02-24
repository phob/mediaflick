import { useLocation } from "@solidjs/router";
import { useQuery, useQueryClient } from "@tanstack/solid-query";
import {
    Show,
    createEffect,
    createMemo,
    createSignal,
    onCleanup,
    onMount,
    type ParentComponent,
} from "solid-js";
import { SidebarNavigation } from "@/components/sidebar-navigation";
import { createRealtimeSocket } from "@/lib/realtime";
import { countScannedFiles, listWantedShows } from "@/lib/media-helpers";

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
                    "dashboard",
                    "sidebar-badges",
                    "titles",
                    "show",
                    "movie",
                    "tv-files",
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
            const [wantedItems, unidentifiedCount] = await Promise.all([
                listWantedShows(""),
                countScannedFiles({ mediaType: "Unknown" }),
            ]);
            return {
                wanted: wantedItems.length,
                unidentified: unidentifiedCount,
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
        </div>
    );
};
