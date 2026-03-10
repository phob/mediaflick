# AGENTS.md

Backend guidance for agentic coding tools working in `backend-bun/`.

## Stack And Entry Points

- Runtime: Bun.
- Language: TypeScript with `strict: true`.
- HTTP server: Hono.
- Database: SQLite via Drizzle ORM.
- Validation: Zod.
- Main server entrypoint: `src/app/server.ts`.
- Router composition: `src/app/router.ts`.
- DB schema: `src/db/schema.ts`.
- Runtime config schema/defaults: `src/config/runtime-config.ts`.
- Jellyfin integration reference: `https://api.jellyfin.org/`

## Non-Negotiable Rules

- Always use `bun`; do not use `npm` or `pnpm`.
- Keep edits inside `backend-bun/` unless the task explicitly spans other packages.
- Preserve nested AGENTS intent when making changes.
- There are no Cursor rules in `.cursor/rules/` or `.cursorrules`.
- There are no Copilot instructions in `.github/copilot-instructions.md`.

## Build, Run, And Test Commands

- Install deps: `bun install`
- Dev server with watch mode: `bun run dev`
- Start server once: `bun run start`
- Run all tests: `bun test`
- Run one test file: `bun test tests/media-lookup/tv-season-remapper.test.ts`
- Run multiple specific test files: `bun test tests/jellyfin/jellyfin-client.test.ts tests/realtime/ws-hub.test.ts`
- Run a single test by name: `bun test --test-name-pattern "skips compaction for sparse TMDb numbering like Enterprise season 1"`
- Run a single file and filter by test name: `bun test tests/media-lookup/tv-season-remapper.test.ts --test-name-pattern "DS9"`
- Typecheck: `bun run typecheck`
- Generate Drizzle migrations: `bun run db:generate`
- Apply DB migrations: `bun run db:migrate`

## Practical Validation Expectations

- For logic-only changes, run the smallest relevant `bun test` target.
- For route, DTO, or shared-type changes, run `bun run typecheck` too.
- For DB schema or repository changes, run relevant tests plus `bun run db:migrate` if migration behavior is part of the change.
- For ingest, Jellyfin sync, or remap changes, prefer targeted tests before full suite runs.

## Backend Architecture Notes

- `src/app/server.ts` wires the app manually and builds a single `AppContext` object.
- Dependencies are passed through context rather than imported as process-wide singletons.
- Routers are composed in `src/app/router.ts`; keep route setup centralized.
- Modules are grouped by feature under `src/modules/`.
- Shared cross-cutting helpers live under `src/shared/`.
- Config loading and YAML persistence live under `src/config/`.
- Drizzle schema and migrations live under `src/db/`.

## Imports And Module Boundaries

- Prefer `@/` path aliases for backend source imports.
- Use `import type` for type-only imports.
- Keep Node built-ins first when the file already does that.
- Avoid deep cross-module reach-ins when a local module API already exists.
- Prefer importing from the narrowest file that owns the behavior.

## Formatting And General Style

- There is no repo formatter config in this package; match the existing file style.
- Many backend files use no semicolons and two-space indentation.
- Some older files still use semicolons and four-space indentation; do not reformat unrelated code just to normalize style.
- Prefer early returns over nested conditionals.
- Use descriptive local variable names; avoid one-letter names except trivial indexes.
- Keep comments sparse; add them only for non-obvious intent.

## TypeScript Conventions

- Keep `strict`-mode compatibility.
- Prefer explicit interfaces and exported types for domain payloads.
- Use string literal unions and `as const` arrays for stable domain enums.
- Return `null` rather than `undefined` for persisted or serialized optional fields when the surrounding code does so.
- Narrow nullable values before use instead of casting.
- Avoid `any`; if unavoidable, isolate it at external boundaries.

## Naming Conventions

- Classes use `PascalCase`: `FilePoller`, `JellyfinClient`, `ScannedFilesRepo`.
- Functions and methods use `camelCase`: `buildSeasonRemapPlan`, `findBySource`.
- Constants use `camelCase` unless they are true top-level constants, then `UPPER_SNAKE_CASE` is acceptable.
- Types and interfaces are noun-based and descriptive.
- DB table objects mirror schema intent; SQL column names may preserve existing external casing.

## Error Handling And Logging

- Throw `HttpError` for expected request-layer failures.
- In Hono handlers, let `app.onError` convert thrown `HttpError` values into JSON responses.
- For unexpected failures, log through `context.logger` with structured props.
- Prefer logging context objects like `{ sourceFile, mediaType, error: String(error) }`.
- External API clients should surface actionable error messages including status when possible.
- Silent catches are rare; if used, they should be for intentionally skipped best-effort work.

## HTTP And Route Patterns

- Return JSON consistently.
- Keep route modules thin; move business logic into services, repos, or module classes.
- Parse request bodies through helpers such as `parseJson<T>()` when appropriate.
- Maintain consistent error payload shape: `{ error: string }`.

## Database And Persistence Patterns

- Use Drizzle query builders directly in repository classes.
- Keep row-to-domain mapping centralized in helpers like `mapRow()`.
- Serialize list-like DB fields consistently; this codebase stores genres as pipe-delimited strings.
- Update timestamps with `new Date().toISOString()`.
- When incrementing counters/version fields, use SQL expressions instead of read-modify-write in userland.
- Prefer repository methods over ad hoc DB queries from unrelated modules.

## Config And Environment Rules

- Environment loading is centralized in `src/config/env.ts`.
- Config file persistence and defaults are centralized in `src/config/yaml-config.ts` and `src/config/runtime-config.ts`.
- Preserve current env variable names such as `BACKEND_BUN_ROOT_DIR`, `BACKEND_BUN_CONFIG_PATH`, `BACKEND_BUN_LOGS_DIR`, and `BACKEND_BUN_DB_PATH`.

## Testing Conventions

- Use `bun:test` APIs: `describe`, `test`, `expect`, `beforeEach`, `afterEach`.
- Prefer focused unit tests near the behavior under change.
- Existing tests rely heavily on small stubs and harnesses rather than heavy mocking frameworks.
- Reuse helpers in `tests/helpers/` when exercising the poller, DB, or app context.
- For integration-style ingest tests, assert both DB state and filesystem side effects.
- When changing sync flows, assert emitted websocket events and Jellyfin calls where relevant.

## Jellyfin Integration Notes

- `JellyfinClient` normalizes DTO casing because Jellyfin responses may vary in field capitalization.
- Preserve provider-id based matching behavior where possible.
- Keep request logging structured and avoid leaking secrets.
- Use Jellyfin DTO shapes already present in the codebase when posting updates.
- Prefer adding narrow client methods over scattering raw Jellyfin fetch logic across modules.

## TV Remapping Rules

- Treat source filenames as the source numbering.
- Only apply season compaction when TMDb season numbering is contiguous and starts at `1` with no gaps.
- The common trigger is a source double-episode file such as `S01E01-E02` or `S01E01E02` that causes source episode numbers to run one higher than TMDb after the opener.
- If TMDb numbering is contiguous, compaction is allowed.
- Example allowed behavior: `E01-E02`, then `E03`, `E04`, `E05` can map to TMDb `1`, `2`, `3`, `4`.
- `Star Trek: Deep Space Nine` season 1 behaves this way.
- If TMDb numbering is sparse or preserves gaps, compaction is forbidden even when `E01-E02` exists in the source.
- Example forbidden behavior: TMDb episode numbers `1, 3, 4, 5, ...` must stay `1, 3, 4, 5, ...`.
- `Star Trek: Enterprise` season 1 behaves this way.
- Never infer compaction from counts alone.
- A source max episode of `26` versus a TMDb count of `25` is not enough by itself.
- When changing remap logic, verify both cases in tests.
- DS9 season 1 should still compact after `E01-E02`.
- Enterprise season 1 should not compact after `E01-E02`.

## Change Strategy

- Prefer surgical edits over broad rewrites.
- Preserve API shapes consumed by the frontend unless the task explicitly includes coordinated frontend work.
- Avoid introducing new dependencies for simple utilities.
- If you touch a mixed-style file, keep your edits consistent with nearby code rather than reformatting the whole file.
