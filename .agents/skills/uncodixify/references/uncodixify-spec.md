# Uncodixify Spec

Use this file as the strict design contract for anti-generic UI work.

## Keep It Normal

- Sidebars: 240-260px fixed width, solid background, simple border-right, no floating shell.
- Headers: plain h1/h2 hierarchy, no eyebrow labels, no gradient text.
- Sections: standard padding (20-30px), no decorative copy blocks.
- Navigation: simple links, subtle hover states, no transform animations, no decorative badges.
- Buttons: solid fill or simple outline, 8-10px radius, no pills, no gradient fills.
- Cards: simple containers, 8-12px radius, subtle border, restrained shadow only.
- Forms: label above field, clear input states, no floating labels.
- Inputs: solid border + simple focus ring, no animated underline/morphing shapes.
- Modals: centered overlay, simple backdrop, straightforward close action.
- Dropdowns: simple list, clear selected state, subtle shadow.
- Tables: clean rows, simple borders, left-aligned text, no decorative clutter.
- Lists: simple items, consistent spacing, clear hierarchy.
- Tabs: underline/border indicator, no animated pills.
- Badges: small and functional only, 6-8px radius.
- Avatars: plain circle/rounded square, no decorative rings.
- Icons: consistent 16-20px, simple and restrained.
- Typography: system/simple sans-serif, readable sizes, clear hierarchy.
- Spacing: consistent 4/8/12/16/24/32px scale.
- Borders: subtle 1px solid.
- Shadows: subtle only (max around `0 2px 8px rgba(0,0,0,0.1)`).
- Transitions: 100-200ms ease, opacity/color changes preferred.
- Layouts: predictable grid/flex, no asymmetry gimmicks.
- Containers: max width around 1200-1400px, centered, standard padding.
- Panels/Toolbars/Footers/Breadcrumbs: practical, low-decoration, functional-first.

## Hard No

- Oversized rounded corners and pill overload.
- Floating glassmorphism shells.
- Soft corporate gradients used as decoration.
- Generic dark SaaS "control room" composition.
- Decorative blobs, glows, haze, frosted cards, donut gimmicks.
- Dashboard hero strips without a real product reason.
- Fake charts and filler metrics.
- Random startup copy and ornamental labels.
- Default AI typography stacks and mixed serif/sans "premium shortcut."
- Sticky rails and right-rail clutter unless information architecture truly requires them.
- Overpadded layouts and dead-space alignment tricks.
- Mobile collapse patterns that become one long undifferentiated stack.

## Specifically Banned Patterns

- Border radii repeatedly in the 20-32px range.
- Same rounded rectangle style on sidebar/cards/buttons/panels.
- Detached floating sidebar shell.
- Glass card charts with no product reason.
- Donut charts with vague percentages.
- Glows used as hierarchy.
- Mixed alignment logic that feels inconsistent.
- Gray-blue low-contrast text overuse.
- Blue-black gradient "premium dark mode" with cyan accents by default.
- Eyebrow labels and uppercase letter-spaced section notes.
- Decorative "operational clarity" copy blocks.
- Transform hover behaviors on nav links.
- Dramatic shadows.
- Status dots created only for decoration.
- Gradient pipeline bars and decorative progress blocks.
- KPI-card-first dashboard as default.
- Decorative activity/focus panels.
- Over-tagged status tables.
- Sidebar workspace CTA blocks and brand gradient marks.
- Nav badges like count/live unless functionally required.
- Quota/usage panels as filler.
- Meta/footer filler lines.
- Right-rail "today schedule" filler panels.
- Too many nested panel variants (`panel`, `panel-2`, `rail-panel`, etc.).

## Banned Structure Snippets

Do not use decorative "headline" wrappers with `<small>` labels plus marketing text in internal UI.

Do not use decorative "team-note/focus" cards with mini headers and motivational copy.

## Color Rules

1. Highest priority: reuse existing project colors.
2. If project colors are absent, pick one palette from the approved lists below.
3. Do not invent random color combinations.
4. When requested, avoid blue-leaning palettes and prefer calm dark-muted tones.

## Approved Dark Palettes

| Palette | Background | Surface | Primary | Secondary | Accent | Text |
|--------|-----------|--------|--------|----------|--------|------|
| Midnight Canvas | `#0a0e27` | `#151b3d` | `#6c8eff` | `#a78bfa` | `#f472b6` | `#e2e8f0` |
| Obsidian Depth | `#0f0f0f` | `#1a1a1a` | `#00d4aa` | `#00a3cc` | `#ff6b9d` | `#f5f5f5` |
| Slate Noir | `#0f172a` | `#1e293b` | `#38bdf8` | `#818cf8` | `#fb923c` | `#f1f5f9` |
| Carbon Elegance | `#121212` | `#1e1e1e` | `#bb86fc` | `#03dac6` | `#cf6679` | `#e1e1e1` |
| Deep Ocean | `#001e3c` | `#0a2744` | `#4fc3f7` | `#29b6f6` | `#ffa726` | `#eceff1` |
| Charcoal Studio | `#1c1c1e` | `#2c2c2e` | `#0a84ff` | `#5e5ce6` | `#ff375f` | `#f2f2f7` |
| Graphite Pro | `#18181b` | `#27272a` | `#a855f7` | `#ec4899` | `#14b8a6` | `#fafafa` |
| Void Space | `#0d1117` | `#161b22` | `#58a6ff` | `#79c0ff` | `#f78166` | `#c9d1d9` |
| Twilight Mist | `#1a1625` | `#2d2438` | `#9d7cd8` | `#7aa2f7` | `#ff9e64` | `#dcd7e8` |
| Onyx Matrix | `#0e0e10` | `#1c1c21` | `#00ff9f` | `#00e0ff` | `#ff0080` | `#f0f0f0` |

## Approved Light Palettes

| Palette | Background | Surface | Primary | Secondary | Accent | Text |
|--------|-----------|--------|--------|----------|--------|------|
| Cloud Canvas | `#fafafa` | `#ffffff` | `#2563eb` | `#7c3aed` | `#dc2626` | `#0f172a` |
| Pearl Minimal | `#f8f9fa` | `#ffffff` | `#0066cc` | `#6610f2` | `#ff6b35` | `#212529` |
| Ivory Studio | `#f5f5f4` | `#fafaf9` | `#0891b2` | `#06b6d4` | `#f59e0b` | `#1c1917` |
| Linen Soft | `#fef7f0` | `#fffbf5` | `#d97706` | `#ea580c` | `#0284c7` | `#292524` |
| Porcelain Clean | `#f9fafb` | `#ffffff` | `#4f46e5` | `#8b5cf6` | `#ec4899` | `#111827` |
| Cream Elegance | `#fefce8` | `#fefce8` | `#65a30d` | `#84cc16` | `#f97316` | `#365314` |
| Arctic Breeze | `#f0f9ff` | `#f8fafc` | `#0284c7` | `#0ea5e9` | `#f43f5e` | `#0c4a6e` |
| Alabaster Pure | `#fcfcfc` | `#ffffff` | `#1d4ed8` | `#2563eb` | `#dc2626` | `#1e293b` |
| Sand Warm | `#faf8f5` | `#ffffff` | `#b45309` | `#d97706` | `#059669` | `#451a03` |
| Frost Bright | `#f1f5f9` | `#f8fafc` | `#0f766e` | `#14b8a6` | `#e11d48` | `#0f172a` |

## Final Rule

If a choice looks like default AI UI output, reject it and choose the cleaner functional option.
