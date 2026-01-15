# AGENTS.md - Development Guide for AI Coding Agents

## Quick Reference

| Task            | Command                                  | Directory               |
| --------------- | ---------------------------------------- | ----------------------- |
| Start dev       | `./startdev.sh`                          | `/home/pho/mediaflick/` |
| Frontend dev    | `bun run dev`                            | `frontend/`             |
| Backend dev     | `dotnet run --project PlexLocalScan.Api` | `backend/`              |
| Build frontend  | `bun run build`                          | `frontend/`             |
| Build backend   | `dotnet build`                           | `backend/`              |
| Lint frontend   | `bun run lint`                           | `frontend/`             |
| Format frontend | `bun run format`                         | `frontend/`             |
| Run all tests   | `dotnet test`                            | `backend/`              |

## Commands

### Frontend (from /home/pho/mediaflick/frontend/)

```bash
bun run dev          # Start dev server with proxy
bun run build        # Production build
bun run lint         # Run ESLint
bun run format       # Format with Prettier
```

### Backend (from /home/pho/mediaflick/backend/)

```bash
dotnet build                                    # Build all projects
dotnet run --project PlexLocalScan.Api          # Run API server

# Testing
dotnet test                                     # Run all tests
dotnet test --filter "FullyQualifiedName~MovieDetectionServiceTests"           # Single test class
dotnet test --filter "FullyQualifiedName~MovieDetectionServiceTests.TestName"  # Single test method

# Database migrations
dotnet ef migrations add <name> -p PlexLocalScan.Data -s PlexLocalScan.Api
dotnet ef database update -p PlexLocalScan.Data -s PlexLocalScan.Api
```

## Project Structure

```
mediaflick/
├── frontend/                    # Next.js 15 + React 19
│   └── src/
│       ├── app/                 # App Router pages
│       ├── components/          # Feature components + ui/
│       ├── hooks/               # Custom React hooks
│       └── lib/api/             # API client, types, SignalR
└── backend/                     # .NET 9 Minimal API
    ├── PlexLocalScan.Api/       # Web API (main project)
    ├── PlexLocalScan.Shared/    # Business logic, services
    ├── PlexLocalScan.Data/      # EF Core, migrations
    ├── PlexLocalScan.Core/      # Domain models
    ├── PlexLocalScan.SignalR/   # Real-time hubs
    └── PlexLocalScan.Test/      # xUnit tests
```

## Code Style - Frontend

### Formatting (Prettier)

- No semicolons, double quotes, 120 char width, 2 spaces
- Imports auto-sorted: React/Next -> third-party -> @/components/ui -> @/ -> relative

### Naming Conventions

- **Folders**: kebab-case (enforced by ESLint `check-file` plugin)
- **Files**: kebab-case (e.g., `scanned-files-table.tsx`)
- **Components**: PascalCase exports (e.g., `export function ScannedFilesTable`)
- **Hooks**: camelCase with `use` prefix (e.g., `usePageTitle`)

### TypeScript

- Strict mode enabled
- Path alias: `@/*` -> `./src/*`
- Types centralized in `src/lib/api/types.ts`

### React Patterns

- Use React Query for server state (avoid raw fetch)
- API calls via `mediaApi` helper in `src/lib/api/endpoints.ts`
- Avoid `setState` in `useEffect` - prefer lazy init or `useMemo`
- Use `useState(() => initialValue)` for localStorage-based state
- **Logging**: `console.error` only, no `console.log/info/warn` in production

### UI Components

- Use shadcn/ui: `bunx shadcn@latest add <component>`
- Prefer local `ui/` wrappers over raw Radix imports
- Don't modify `src/components/ui/` unless necessary (shadcn-managed)
- Animations: use `tailwindcss-motion` following existing patterns

### SignalR Events

- `OnFileAdded`, `OnFileUpdated`, `OnFileRemoved`, `OnHeartbeat`, `OnZurgVersion`

## Code Style - Backend

### Formatting (.editorconfig)

- Indent: 4 spaces
- File-scoped namespaces (enforced)
- `var` for built-in types when type is apparent
- System usings first, then grouped imports

### Naming Conventions

- **Classes/Methods/Properties**: PascalCase
- **Parameters/Locals**: camelCase
- **Interfaces**: `I` prefix (e.g., `INotificationService`)
- **Files**: PascalCase matching class name

### Architecture

- Minimal API with separate routing files (e.g., `ScannedFilesRouting.cs` + `ScannedFilesController.cs`)
- Static controller methods with DI
- DTOs for API responses
- Paged results for large datasets

### Logging

- **Serilog only** - never use `Console.WriteLine`
- Log errors with context

### Testing

- **Framework**: xUnit
- **Mocking**: NSubstitute
- Use `[Fact]` for single tests, `[Theory]` + `[MemberData]` for parameterized
- Arrange-Act-Assert pattern
- Integration tests in `Integration/` folder

### Error Handling

- Use Result pattern or throw specific exceptions
- Always log errors before propagating

## Key Files Reference

### Frontend

| File                       | Purpose                        |
| -------------------------- | ------------------------------ |
| `src/lib/api/endpoints.ts` | API client (`mediaApi` helper) |
| `src/lib/api/types.ts`     | TypeScript interfaces          |
| `src/lib/api/signalr.ts`   | SignalR client setup           |
| `src/lib/format-helper.ts` | `formatBytes()`, status labels |

### Backend

| File                                                    | Purpose                 |
| ------------------------------------------------------- | ----------------------- |
| `PlexLocalScan.Data/Data/PlexScanContext.cs`            | EF Core context         |
| `PlexLocalScan.Core/Tables/ScannedFile.cs`              | Main entity             |
| `PlexLocalScan.SignalR/Services/NotificationService.cs` | Real-time notifications |

## Common Patterns

### Article-Aware Sorting

Ignore leading articles ("The", "A", "An") when sorting titles:

```typescript
const normalized = title.replace(/^(the|a|an)\s+/i, "");
```

### Infinite Scroll

- Load 30 items initially, use Intersection Observer for pagination
- Replaces traditional pagination in media grids

### Real-time Updates

- SignalR for live file tracking
- Frontend invalidates React Query cache on SignalR events

## Project Notes

- **Package Manager**: Bun (not pnpm/npm) - package.json may reference pnpm but use Bun
- **Database**: EF Core + SQLite, migrations in PlexLocalScan.Data
- **Media Detection**: Regex-based parsing + TMDb API for metadata
- **.NET Version**: 9.0 (see global.json)
- **React Version**: 19.x with Next.js 15
