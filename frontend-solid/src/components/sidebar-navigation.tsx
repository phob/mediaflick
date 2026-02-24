import { A, useLocation } from "@solidjs/router";
import {
    Archive,
    CircleHelp,
    Clapperboard,
    LayoutDashboard,
    Logs,
    Settings,
    ShieldAlert,
    Tv,
} from "lucide-solid";
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
    if (props.icon === "dashboard") return <LayoutDashboard class="w-4 h-4" strokeWidth={1.9} />;
    if (props.icon === "wanted") return <ShieldAlert class="w-4 h-4" strokeWidth={1.9} />;
    if (props.icon === "shows") return <Tv class="w-4 h-4" strokeWidth={1.9} />;
    if (props.icon === "movies") return <Clapperboard class="w-4 h-4" strokeWidth={1.9} />;
    if (props.icon === "archive") return <Archive class="w-4 h-4" strokeWidth={1.9} />;
    if (props.icon === "unidentified") return <CircleHelp class="w-4 h-4" strokeWidth={1.9} />;
    if (props.icon === "settings") return <Settings class="w-4 h-4" strokeWidth={1.9} />;
    return <Logs class="w-4 h-4" strokeWidth={1.9} />;
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
            title={props.hint ? `${props.label} — ${props.hint}` : props.label}
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
            <div class="side-brand-row">
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
                        fallback={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path d="M13 5l6 7-6 7M5 5l6 7-6 7" /></svg>}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path d="M11 5l-6 7 6 7M19 5l-6 7 6 7" /></svg>
                    </Show>
                </button>
            </div>

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
