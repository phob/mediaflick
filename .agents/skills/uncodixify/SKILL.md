---
name: uncodixify
description: Design or refactor frontend UI to remove generic AI-dashboard aesthetics and enforce practical, product-like interfaces. Use when users ask for "normal UI", "uncodixify", anti-glassmorphism, anti-hero dashboard styling, calmer dark-muted palettes, tighter visual hierarchy, or cleaner production-ready web layouts/components.
---

# Uncodixify

Use this skill to force restrained, utilitarian UI decisions and avoid default AI-generated styling.

## Workflow

1. Read `references/uncodixify-spec.md` before making UI changes.
2. Inspect existing project styles first; reuse current palette, spacing, and components when available.
3. Build with plain, stable layout primitives: predictable sidebars, headers, sections, forms, cards, tables, and tabs.
4. Apply hard bans from the spec (no hero-in-dashboard patterns, no decorative labels, no glassmorphism shells, no oversized radii, no fake metric-card theater).
5. Keep hierarchy functional: simple typography, clear labels, subtle borders/shadows, short transitions, no transform-heavy motion.
6. Validate desktop and mobile behavior; avoid collapse patterns that become one long stacked feed.

## Color Selection Order

1. Use project colors if present.
2. If absent, select one palette from the spec tables and stay consistent.
3. Do not invent new random color systems.
4. Prefer calm/dark-muted direction when requested; avoid blue-leaning palettes when explicitly banned by the task.

## Output Rules

- Implement real production UI code, not style moodboards.
- Prioritize usability and information hierarchy over visual novelty.
- Use only functional badges/labels/status markers.
- Keep radii mostly in 8-12px range unless existing design system dictates otherwise.
- Keep copy direct and product-specific; remove decorative "premium SaaS" filler.
