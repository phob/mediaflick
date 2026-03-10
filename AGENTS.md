# AGENTS.md

Repository-wide guidance for agentic coding tools working in `mediaflick`.

## Scope

- This file is the top-level router for agent behavior in this repository.
- Use `bun` for package management and scripts. Do not use `npm` or `pnpm`.
- Only write code in `backend-bun/` and `frontend-solid/` unless the user explicitly asks for something else.
- For package-specific commands, validation steps, style rules, and architecture notes, defer to the package AGENTS files instead of duplicating guidance here.

## Required Nested Instructions

- If you touch backend code, read and follow `backend-bun/AGENTS.md` before editing.
- If you touch frontend code, read and follow `frontend-solid/AGENTS.md` before editing.
- If a task spans both packages, follow both files and keep shared assumptions aligned.
- The nested AGENTS files are the source of truth for package-level build, test, and style guidance.

## Repository Layout

- `backend-bun/`: Bun + TypeScript backend, Hono server, Drizzle ORM, SQLite, Bun tests.
- `frontend-solid/`: SolidJS + Vite + TypeScript frontend.
- `AGENTS_OLD.md`: legacy notes; do not treat it as the primary instruction source.

## Where To Look For Commands

- Backend commands, including single-file and single-test-name examples, live in `backend-bun/AGENTS.md`.
- Frontend commands, including the current status of linting and tests, live in `frontend-solid/AGENTS.md`.
- Do not invent missing commands. If a package has no configured lint or test runner, say so plainly.

## Root-Level Facts

- No `.cursorrules` file was found at the repository root.
- No `.cursor/rules/` directory was found at the repository root.
- No `.github/copilot-instructions.md` file was found at the repository root.
- The backend and frontend AGENTS files also record the rule-file status for their own packages.

## Working Agreement

- Prefer small, localized changes that match the surrounding code.
- Preserve user changes you did not make.
- Do not reformat unrelated files just to normalize style.
- Verify the narrowest useful scope first, then run broader checks only when the change warrants it.
- Do not add new tooling, dependencies, or config unless the user asks for it or the task clearly requires it.

## Package Routing

### Backend Work

- Read `backend-bun/AGENTS.md` first.
- Use the backend file for:
- build, run, typecheck, migration, and test commands
- single-test-file and single-test-name examples
- backend architecture notes
- import, formatting, typing, naming, database, and error-handling conventions
- remap and Jellyfin-specific behavioral rules

### Frontend Work

- Read `frontend-solid/AGENTS.md` first.
- Use the frontend file for:
- build, preview, start, and typecheck commands
- current lint and test status
- single-test guidance for the current no-test-runner setup
- SolidJS, data-fetching, styling, and UI conventions
- import, formatting, typing, naming, and error-handling conventions

## Cross-Package Changes

- Keep backend response shapes and frontend API/client types in sync.
- If an API contract changes, update both packages in the same task when appropriate.
- Preserve existing route and config assumptions unless the user asked for a coordinated change.
- Call out any required follow-up if one package depends on work not yet done in the other.

## Validation Strategy

- For backend-only changes, run the smallest backend validation described in `backend-bun/AGENTS.md`.
- For frontend-only changes, run the smallest frontend validation described in `frontend-solid/AGENTS.md`.
- For full-stack changes, validate both packages with the narrowest relevant commands first.
- If a package currently lacks lint or test commands, do not imply those checks were run.

## Style Strategy

- This top-level file does not redefine detailed style rules.
- Use `backend-bun/AGENTS.md` for backend code style, imports, types, naming, and error handling.
- Use `frontend-solid/AGENTS.md` for frontend code style, imports, types, naming, error handling, and UI conventions.
- When a file has mixed historical style, follow the nearby code and avoid unnecessary churn.

## Editing Boundaries

- Keep backend-specific utilities, routes, services, and tests in `backend-bun/`.
- Keep frontend pages, components, client utilities, and styling in `frontend-solid/`.
- Avoid placing new application code at the repository root.
- If you must add repo-level documentation, keep it narrowly scoped and consistent with existing docs.

## Operational Notes For Agents

- Assume the working tree may already be dirty.
- Never discard or overwrite unrelated user changes.
- Prefer explicit, actionable handoff notes when you could not run a verification step.
- Mention which nested AGENTS file governed your work when that context matters.

## References

- Backend instructions: `backend-bun/AGENTS.md`
- Frontend instructions: `frontend-solid/AGENTS.md`
- Jellyfin API reference: `https://api.jellyfin.org/`
