# AGENTS.md - Mediaflick Bun Workspace Guide

This guide is for coding agents working in the Bun-first workspace:
- `backend-bun/` (Bun + Hono + Drizzle + SQLite)
- `frontend-bun/` (Next.js 15 + React 19 + Tailwind + React Query)

If guidance conflicts, follow this order:
1. Direct user instruction
2. This file
3. Existing code patterns in touched files
4. Legacy docs in `backend/` and `frontend/` (reference only)

## Scope and Status

- `backend/` and `frontend/` are legacy/reference projects.
- Prefer editing only `backend-bun/` and `frontend-bun/` unless asked otherwise.
- Bun API/realtime contract docs:
  - `backend-bun/docs/API.md`
  - `backend-bun/docs/FRONTEND_ENDPOINT_MATRIX.md`
- Route constants are centralized in `backend-bun/src/app/entrypoints.ts`.

## Build, Lint, and Test Commands

### Backend-bun (`/home/pho/mediaflick/backend-bun`)

```bash
bun install
bun run dev
bun run start
bun run typecheck
bun run db:generate
bun run db:migrate
```

### Frontend-bun (`/home/pho/mediaflick/frontend-bun`)

```bash
bun install
bun run dev
bun run build
bun run lint
bun run format
```

Run both apps from repo root:

```bash
./scripts/startdev-bun.sh
```

Default ports used by the combined script:
- backend-bun: `5000`
- frontend-bun: `3001`

## Single-test Commands (Important)

There is no dedicated `backend-bun` test script yet.
Minimum backend quality gate: `bun run typecheck`.

For single-test workflows, use legacy .NET tests in `/backend`:

```bash
cd /home/pho/mediaflick/backend
dotnet test
dotnet test --filter "FullyQualifiedName~MovieDetectionServiceTests"
dotnet test --filter "FullyQualifiedName~MovieDetectionServiceTests.TestName"
```

Use the filtered commands above for single class/method execution.

## Environment and Runtime Notes

Backend-bun environment variables:
- `PORT` (default `5000`)
- `BACKEND_BUN_ROOT_DIR`
- `BACKEND_BUN_CONFIG_PATH`
- `BACKEND_BUN_LOGS_DIR`
- `BACKEND_BUN_DB_PATH`

Frontend-bun environment variables:
- `NEXT_PUBLIC_API_BASE_URL` (example: `http://localhost:5000/api`)
- `NEXT_PUBLIC_WS_URL` (example: `ws://localhost:5000/ws/filetracking`)

Realtime contract (backend-bun):
- WebSocket endpoint: `/ws/filetracking`
- Envelope: `{ "type": "...", "payload": ... }`
- Events: `file.added`, `file.updated`, `file.removed`, `heartbeat`, `zurg.version`

## General Code Standards

- Keep edits minimal and consistent with nearby patterns.
- Prefer strict typing; avoid `any` unless truly necessary and localized.
- Preserve module boundaries and existing folder structure.
- Never hardcode secrets, tokens, or machine-specific values.
- Favor self-explanatory names; add comments only for non-obvious logic.

## Backend-bun Style Guidelines

- Runtime/language: TypeScript ESM on Bun (`type: module`).
- Imports: use `@/*` aliases for app modules; remove unused imports.
- Naming:
  - files/folders: `kebab-case`
  - types/interfaces/classes: `PascalCase`
  - functions/locals: `camelCase`
- Routing:
  - create module routers as `createXRouter(context)`
  - mount routers in `src/app/router.ts`
  - use `ENTRYPOINTS` constants, do not inline route strings
- Validation and parsing:
  - parse IDs/query params defensively
  - return `400` for invalid input, `404` for missing entities
- Error handling:
  - throw `HttpError` for expected request/domain failures
  - return JSON errors shaped like `{ error: "message" }`
  - rely on global `app.onError` for unexpected exceptions
- Logging: use shared logger/context logger with structured props.

## Frontend-bun Style Guidelines

- Formatting (Prettier): no semicolons, double quotes, width 120, tab width 2.
- Import ordering is enforced via `.prettierrc.json` plugin config.
- Linting: follow `eslint.config.mjs` and Next core-web-vitals rules.
- Naming: folder names under `src/` must be kebab-case.
- TypeScript: `strict` mode; handle null/undefined explicitly.
- Data fetching: prefer React Query; use `mediaApi` in `src/lib/api/endpoints.ts`.
- Realtime: use `src/lib/api/signalr.ts` (WebSocket transport) and bun event names.
- UI: prefer local shadcn wrappers in `src/components/ui/`; avoid unnecessary edits there.
- React: avoid hydration-mismatch patterns and effect-driven derived state.
- Client logging: use `console.error` for failures; avoid noisy `console.log`.

## Cursor and Copilot Rules

Detected Cursor rule files:
- `.cursor/rules/backend.mdc`
- `.cursor/rules/nextjs.mdc`

How to apply them here:
- `backend.mdc` targets legacy C# in `backend/`; treat as reference-only for bun work.
- `nextjs.mdc` is useful for structure/shadcn conventions, but package-manager notes may be stale.
- In this workspace, use Bun commands for `backend-bun` and `frontend-bun`.
- No `.cursorrules` file found.
- No `.github/copilot-instructions.md` file found.

## Practical Validation Checklist

Backend-bun changes:
1. `bun run typecheck`
2. `bun run start` (basic startup smoke)
3. Verify contract-sensitive changes against `backend-bun/docs/FRONTEND_ENDPOINT_MATRIX.md`

Frontend-bun changes:
1. `bun run lint`
2. `bun run build`
3. Manually verify affected routes and realtime behavior

Cross-cutting changes:
1. `./scripts/startdev-bun.sh`
2. Smoke-test REST + WebSocket end-to-end
3. Update `backend-bun/docs/` when API behavior changes
