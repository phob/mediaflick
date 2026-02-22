# AGENT.md (frontend-solid)

Focused guidance for coding agents working in `frontend-solid/`.

## Scope

- This file is for the Solid frontend only.
- Prefer changing only files inside `frontend-solid/` unless user asks otherwise.
- Package manager: **Bun only**.

## Core Commands

Run from `/home/pho/mediaflick/frontend-solid`.

```bash
bun install
bun run dev
bun run typecheck
bun run build
bun run preview
bun run start
```

Notes:

- `dev` starts Vite dev server.
- `build` runs `tsc -b && vite build`.
- `start` serves built output through `server.ts`.
- There is currently no `lint` script and no test runner script.

## Single-Test Guidance

- No frontend test framework is configured yet.
- If the user asks for a single test, explain that it is not available in this workspace today.
- Use `bun run typecheck` as narrow validation and `bun run build` as runtime-safe compile validation.

## Runtime / Environment

- Build-time config (Vite):
  - `VITE_API_BASE_URL` (default `http://localhost:5000/api`)
  - `VITE_WS_URL` (default `ws://localhost:5000/ws/filetracking`)
- Runtime config (server/Docker):
  - `API_BASE_URL`
  - `WS_URL`

Important files:

- `src/lib/runtime-config.ts` (client config resolution)
- `public/runtime-config.js` (runtime injection target)
- `server.ts` (production static server + runtime config endpoint)

## Architecture Quick Map

- `src/app.tsx`: routes, page composition, most UI behavior
- `src/lib/api.ts`: centralized API client (`ApiError`, `mediaApi`)
- `src/lib/realtime.ts`: websocket wrapper
- `src/lib/types.ts`: shared frontend API/domain types
- `src/index.css`: global styles and design tokens

## Coding Style

### TypeScript

- Keep strict typing (project runs in `strict: true`).
- Avoid `any` unless unavoidable and very localized.
- Prefer `import type` for type-only imports.
- Handle `null`/`undefined` explicitly.

### Imports and paths

- Prefer alias imports from `@/*` over deep relative paths where practical.
- Keep imports clean and remove unused ones.

### Formatting and naming

- Match existing file style:
  - no semicolons
  - double quotes
  - concise helper functions
- Naming:
  - components/types/interfaces: `PascalCase`
  - functions/variables: `camelCase`
  - folders/files under `src/`: `kebab-case` where applicable

### Solid patterns

- Use `useQuery`/`useMutation` for server data.
- Use `createMemo` for derived state instead of effect-driven state sync.
- Use `Show` and `For` for conditional/list rendering.
- Avoid unnecessary signals when values can be computed.

## TanStack Query v5 Deprecations (Critical)

These are deprecated in `@tanstack/solid-query` v5 and should be treated as migration targets.

- **DO NOT** introduce `createQuery`; use `useQuery`.
- **DO NOT** introduce `createMutation`; use `useMutation`.
- **DO NOT** introduce `createInfiniteQuery`; use `useInfiniteQuery`.
- **DO NOT** introduce `createQueries`; use `useQueries`.
- **DO NOT** introduce compatibility `Create*` types; use `Use*` types (`UseQueryOptions`, `UseMutationOptions`, etc.).
- **DO NOT** use query option `suspense`; it is deprecated in v5 (Solid query resources already suspend).

When touching existing code that still uses deprecated TanStack APIs, prefer migrating that code in the same PR unless it would materially increase scope/risk.

## Data, Realtime, and Error Handling

- Keep network calls in `src/lib/api.ts` via `mediaApi`.
- Throw/propagate `ApiError` from API layer; show user-friendly error states in UI.
- For websocket updates, use `createRealtimeSocket` and invalidate relevant query keys.
- Keep event names aligned with backend contract (`file.added`, `file.updated`, `file.removed`, `heartbeat`, `zurg.version`).

## UI / CSS Guidance

- Reuse shared row/card patterns before creating new variants.
- Keep theme tokens and visual language consistent in `src/index.css`.
- Preserve responsive behavior (check mobile breakpoints after layout changes).
- The class `bg-gradient-to-r` can be written as `bg-linear-to-r`
- Use Tailwind CSS v4 when possible

## Validation Before Finishing

Run:

```bash
bun run typecheck
bun run build
```

If behavior changed significantly, also run:

```bash
bun run dev
```

and manually verify affected routes and realtime updates.
