# AGENTS.md

This file is for coding agents working in `frontend-solid/`.

## Scope

- Work in this directory unless the task explicitly requires another package.
- Use Bun for all package and script commands. Do not use npm or pnpm.
- Prefer the existing `@/` import alias for code under `src/`.
- Preserve existing product language, route structure, and visual tone.

## Repository Facts

- Stack: SolidJS + Vite + TypeScript + Tailwind CSS v4.
- Query/state layer: `@tanstack/solid-query` plus Solid signals/memos/effects.
- Entry points: `src/index.tsx`, `src/app.tsx`, `server.ts`.
- Runtime proxy server: `server.ts` serves `dist/` and proxies `/api` and `/ws`.
- TS config is strict and uses bundler module resolution.
- Path alias: `@/*` -> `src/*`.

## Local Commands

- Install deps: `bun install`
- Start Vite dev server: `bun run dev`
- Build production assets: `bun run build`
- Preview built app with Vite: `bun run preview`
- Start Bun production server: `bun run start`
- Run static typecheck: `bun run typecheck`

## Lint And Test Status

- There is currently no `lint` script in `package.json`.
- There is currently no `test` script in `package.json`.
- There are currently no `*.test.*` or `*.spec.*` files in this package.
- Do not claim lint or tests passed unless you actually add the tooling or files.
- The best built-in verification today is `bun run typecheck` and `bun run build`.

## Single-Test Guidance

- Today: no single-test command exists because this package has no configured test runner.
- If you are asked to run one test, report that there is no current test setup in `frontend-solid/`.
- If tests are added later with Bun's built-in runner, the expected file-level pattern would be:
- `bun test path/to/file.test.ts`
- A single named test would typically be:
- `bun test path/to/file.test.ts -t "case name"`
- Do not add or describe Jest/Vitest commands unless the repo is updated to use them.

## Recommended Verification Order

- For UI or logic changes: `bun run typecheck`
- For release-oriented changes: `bun run build`
- For proxy/server changes: `bun run build` then `bun run start`
- For changes that touch runtime config or API paths, verify `/api` and `/ws` assumptions in `server.ts` and `src/lib/runtime-config.ts`.

## Rule Files

- `.cursorrules`: not present in this directory.
- `.cursor/rules/`: not present in this directory.
- `.github/copilot-instructions.md`: not present in this directory.
- No additional Cursor or Copilot instruction files were found while analyzing `frontend-solid/`.

## Code Organization

- Put route/page components in `src/pages/`.
- Put reusable UI in `src/components/`.
- Put API, runtime, websocket, parsing, and helper logic in `src/lib/`.
- Keep app bootstrap code in `src/index.tsx` and routing in `src/app.tsx`.
- Keep shared theme and component-level CSS in `src/index.css` unless a new stylesheet is clearly warranted.

## Import Conventions

- Order imports as: framework/vendor -> app alias imports -> type-only imports when practical.
- Use `@/` for internal imports instead of long relative paths.
- Use `import type` for type-only imports.
- Import from Solid directly, for example `Show`, `For`, `createSignal`, `createMemo`, `createEffect`.
- Keep imports explicit; avoid wildcard imports.
- Match the surrounding file's semicolon style if you touch an older mixed-style file.

## Formatting Conventions

- There is no formatter config checked in for this package.
- Prefer 2-space indentation in new or heavily edited files.
- Prefer double quotes in TS, TSX, and CSS data strings.
- Prefer trailing commas where multiline structures already use them.
- Prefer no semicolons in new files, but preserve consistency within the file you edit.
- Keep JSX readable; split long props or nested conditions across lines.
- Avoid decorative comments; only add comments for genuinely non-obvious logic.

## TypeScript Guidelines

- Respect strict mode in `tsconfig.app.json`.
- Avoid `any`; use concrete interfaces, unions, `unknown`, or generics.
- Model API payloads in `src/lib/types.ts` or alongside closely related code.
- Use string-literal unions for fixed backend/domain states.
- Use nullable fields deliberately and handle them in rendering paths.
- Prefer small helper functions over deeply nested inline transformations.
- Use `Record<K, V>` for keyed lookups when the key space is known.
- Use non-null assertions only when the DOM or control flow truly guarantees presence.

## SolidJS Patterns

- Prefer `createSignal` for local mutable state.
- Prefer `createMemo` for derived values used multiple times.
- Use `createEffect` only for real side effects, not basic derivation.
- Use `Show` and `For` for conditional and list rendering.
- Keep page-level query orchestration near the page component.
- Extract repeated view fragments into small components when a page becomes dense.
- Avoid unnecessary context/providers; current code favors direct composition.

## Data Fetching Conventions

- Use `@tanstack/solid-query` for server-backed reads and mutations.
- Keep shared request logic in `src/lib/api.ts`.
- Reuse stable query keys such as `"dashboard"`, `"show"`, `"movie"`, `"logs"`, etc.
- Invalidate relevant query keys after mutations or realtime events.
- Build query strings with `URLSearchParams`.
- Return typed promises from API helpers.

## Error Handling

- API failures are normalized with `ApiError` in `src/lib/api.ts`.
- Prefer surfacing user-visible failures as concise UI copy or app notifications.
- Use helpers like `errorMessage()` when displaying unknown caught errors.
- Guard optional JSON parsing and fallback to status text where appropriate.
- Do not swallow errors silently unless the failure is intentionally non-fatal.
- When catching, keep the fallback path explicit.

## Naming Conventions

- Components: `PascalCase`.
- Functions and variables: `camelCase`.
- Constants with fixed semantic values: `UPPER_SNAKE_CASE`.
- Route/page filenames: kebab-case, for example `dashboard-page.tsx`.
- Helper/library filenames: kebab-case, for example `media-helpers.ts`.
- Interface and type names should describe domain concepts, not UI usage details.
- Prefer names that match backend vocabulary such as `ScannedFile`, `MediaInfo`, `TriageInboxItem`.

## UI And Styling Guidelines

- Preserve the existing cinematic dark theme and orange/cyan accent system.
- Reuse theme tokens from `src/index.css` before introducing raw colors.
- Prefer utility classes for local layout and component CSS classes for repeated patterns.
- Keep mobile behavior intentional; existing layout supports desktop and mobile navigation separately.
- Maintain accessible labels for buttons, dialogs, and icon-only controls.
- Keep empty, loading, and error states explicit.

## Working In Mixed-Style Files

- This codebase currently has mixed semicolon and indentation styles.
- When making a focused edit, prefer minimizing formatting churn.
- If you substantially refactor a file, normalize it to a consistent style within that file.
- Do not reformat unrelated files just to enforce style preferences.

## Agent Do And Don't

- Do run `bun run typecheck` after meaningful TS or TSX edits when feasible.
- Do run `bun run build` before handing off larger changes when feasible.
- Do keep API/client types in sync with backend responses.
- Do preserve the `@/` alias and existing folder layout.
- Don't introduce a new state library, CSS framework, test runner, or formatter without a clear request.
- Don't replace Bun-based flows with npm-, pnpm-, Jest-, or Vitest-specific guidance unless the repo changes.
