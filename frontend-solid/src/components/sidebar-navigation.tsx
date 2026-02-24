import { A, useLocation } from "@solidjs/router";
import { For, Show, createMemo } from "solid-js";
import { StatusDot } from "@/components/common-ui";

type AppNavIcon =
    | "dashboard"
    | "wanted"
    | "shows"
    | "movies"
    | "archive"
    | "unidentified"
    | "settings"
    | "logs";

function NavIcon(props: { icon: AppNavIcon }) {
    if (props.icon === "dashboard") return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-4 h-4"><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="5" rx="1.5" /><rect x="13" y="10" width="8" height="11" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /></svg>;
    if (props.icon === "wanted") return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-4 h-4"><path d="M12 3 4 7v6c0 4.2 3.1 7.8 8 8.9 4.9-1.1 8-4.7 8-8.9V7l-8-4Z" /><path d="m12 8.5 2.3 4.4h-4.6L12 8.5Z" /></svg>;
    if (props.icon === "shows") return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-4 h-4"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M8.5 3v2M15.5 3v2M8.5 19v2M15.5 19v2M3 9h18" /></svg>;
    if (props.icon === "movies") return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-4 h-4"><path d="M3 7.5 12 4l9 3.5v9L12 20l-9-3.5v-9Z" /><path d="M8.2 10.2h7.6v3.6H8.2z" /></svg>;
    if (props.icon === "archive") return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-4 h-4"><rect x="3" y="4" width="18" height="5" rx="1.5" /><path d="M5 9h14v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9Z" /><path d="M9 13h6" /></svg>;
    if (props.icon === "unidentified") return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-4 h-4"><circle cx="12" cy="12" r="9" /><path d="M9.4 9.2a2.7 2.7 0 0 1 5.1 1.2c0 1.7-2.1 2.3-2.1 3.8" /><circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" /></svg>;
    if (props.icon === "settings") return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-4 h-4"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.5 1.5 0 0 1-2.1 2.1l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V19a1.5 1.5 0 1 1-3 0v-.1a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.5 1.5 0 0 1-2.1-2.1l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H5a1.5 1.5 0 1 1 0-3h.1a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.5 1.5 0 0 1 2.1-2.1l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V5a1.5 1.5 0 1 1 3 0v.1a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1.5 1.5 0 0 1 2.1 2.1l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.1a1.5 1.5 0 1 1 0 3h-.1a1 1 0 0 0-.9.6Z" /></svg>;
    return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-4 h-4"><path d="M4 6h16M4 12h10M4 18h16" /><circle cx="17" cy="12" r="3" /></svg>;
}

function SideNavLink(props: {
    href: string;
    label: string;
    icon: AppNavIcon;
    badge?: number | null;
    hint?: string;
    onNavigate?: () => void;
}) {
    const location = useLocation();
    const active = createMemo(
        () =>
            location.pathname === props.href ||
            location.pathname.startsWith(`${props.href}/`),
    );
    const hasBadge = createMemo(
        () =>
            props.badge !== null &&
            props.badge !== undefined &&
            props.badge > 0,
    );
    return (
        <A
            href={props.href}
            onClick={() => props.onNavigate?.()}
            class="side-link"
            classList={{
                "is-active": active(),
                "has-badge": hasBadge(),
            }}
            data-label={props.label}
            title={props.label}
        >
            <span class="side-link-main">
                <span class="side-link-icon">
                    <NavIcon icon={props.icon} />
                </span>
                <span class="side-link-label">
                    {props.label}
                    <Show when={hasBadge()}>
                        <span class="side-link-badge">{props.badge}</span>
                    </Show>
                </span>
            </span>
            <Show when={props.hint}>
                {(hint) => <small class="side-link-hint">{hint()}</small>}
            </Show>
        </A>
    );
}

interface AppNavItem {
    href: string;
    label: string;
    hint: string;
    icon: AppNavIcon;
}

interface AppNavSection {
    title: string;
    items: AppNavItem[];
}

const appNavSections: AppNavSection[] = [
    {
        title: "Overview",
        items: [
            {
                href: "/",
                label: "Dashboard",
                hint: "Health + quick stats",
                icon: "dashboard",
            },
            {
                href: "/wanted",
                label: "Wanted Episodes",
                hint: "Released but missing",
                icon: "wanted",
            },
        ],
    },
    {
        title: "Library",
        items: [
            {
                href: "/shows",
                label: "TV Shows",
                hint: "Series catalog",
                icon: "shows",
            },
            {
                href: "/movies",
                label: "Movies",
                hint: "Film catalog",
                icon: "movies",
            },
            {
                href: "/archive",
                label: "Archive",
                hint: "Everything marked extra",
                icon: "archive",
            },
            {
                href: "/unidentified",
                label: "Unidentified",
                hint: "Needs manual identity",
                icon: "unidentified",
            },
        ],
    },
    {
        title: "System",
        items: [
            {
                href: "/settings",
                label: "Settings",
                hint: "Backend config",
                icon: "settings",
            },
            {
                href: "/logs",
                label: "Logs",
                hint: "Live backend feed",
                icon: "logs",
            },
        ],
    },
];

export function SidebarNavigation(props: {
    backendOnline: boolean;
    zurgOnline: boolean;
    wantedBadge?: number | null;
    unidentifiedBadge?: number | null;
    expanded: boolean;
    onToggle: () => void;
    onNavigate?: () => void;
}) {
    const badgeForHref = (href: string): number | null | undefined => {
        if (href === "/wanted") return props.wantedBadge;
        if (href === "/unidentified") return props.unidentifiedBadge;
        return undefined;
    };

    return (
        <>
            <A href="/" onClick={() => props.onNavigate?.()} class="brand-lockup side-brand" title="MediaFlick">
                <span class="brand-kicker">Library Console</span>
                <span class="brand-title">Media<span>Flick</span></span>
                <svg class="side-brand-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" fill-opacity="0.9" />
                    <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
            </A>

            <button
                type="button"
                class="sidebar-toggle"
                onClick={props.onToggle}
                title={props.expanded ? "Collapse sidebar" : "Expand sidebar"}
                aria-label={props.expanded ? "Collapse sidebar" : "Expand sidebar"}
            >
                <Show
                    when={props.expanded}
                    fallback={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path d="M13 5l6 7-6 7M5 5l6 7-6 7" /></svg>}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path d="M11 5l-6 7 6 7M19 5l-6 7 6 7" /></svg>
                </Show>
            </button>

            <For each={appNavSections}>
                {(section) => (
                    <section class="side-section">
                        <h2 class="side-section-title">{section.title}</h2>
                        <div class="space-y-1.5">
                            <For each={section.items}>
                                {(item) => (
                                    <SideNavLink
                                        href={item.href}
                                        label={item.label}
                                        hint={item.hint}
                                        icon={item.icon}
                                        badge={badgeForHref(item.href)}
                                        onNavigate={props.onNavigate}
                                    />
                                )}
                            </For>
                        </div>
                    </section>
                )}
            </For>

            <div class="side-status-row">
                <span class="side-status-chip" title={props.backendOnline ? "Backend API connected" : "Backend API disconnected"}>
                    <StatusDot online={props.backendOnline} /> API
                </span>
                <span class="side-status-chip" title={props.zurgOnline ? "Zurg storage online" : "Zurg storage offline"}>
                    <StatusDot online={props.zurgOnline} /> Storage
                </span>
            </div>
        </>
    );
}
