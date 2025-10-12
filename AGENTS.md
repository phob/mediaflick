# AGENTS.md - Development Guide for AI Coding Agents

## Commands

### Frontend (from /home/pho/mediaflick/frontend/)
- `bun run dev` - Start dev server with proxy
- `bun run build` - Production build
- `bun run lint` - Run ESLint
- `bun run format` - Format with Prettier

### Backend (from /home/pho/mediaflick/backend/)
- `dotnet build` - Build all projects
- `dotnet test` - Run all tests
- `dotnet test --filter "FullyQualifiedName~MovieDetectionServiceTests"` - Run single test class
- `dotnet test --filter "FullyQualifiedName~MovieDetectionServiceTests.TestMethodName"` - Run single test method
- `dotnet ef migrations add <name> -p PlexLocalScan.Data -s PlexLocalScan.Api` - Add migration
- `dotnet run --project PlexLocalScan.Api` - Run API

## Code Style

### Frontend (Next.js 15 + React 19 + Bun)
- **Imports**: Auto-sorted by Prettier (React/Next → third-party → @/components/ui → @/ → relative)
- **Formatting**: Prettier (no semis, double quotes, 120 print width, 2 spaces)
- **Naming**: kebab-case for folders (enforced by eslint-plugin-check-file)
- **Components**: Use shadcn/ui (`bunx shadcn@latest add <component>`), prefer local ui wrappers over raw Radix
- **API**: Centralize in `src/lib/api/endpoints.ts`, use `mediaApi` helper
- **State**: React Query for server state, avoid setState in useEffect (use lazy init or useMemo)
- **Logging**: console.error only, no console.log/info/warn in production
- **Types**: Strict TypeScript, types in `src/lib/api/types.ts`

### Backend (.NET 9)
- **Style**: Follow .editorconfig (spaces, System usings first, var for built-in types, file-scoped namespaces)
- **Architecture**: Minimal API with separate routing files, DI pattern
- **Logging**: Serilog only (never Console.WriteLine)
- **Naming**: PascalCase classes/methods/properties, camelCase parameters/locals, kebab-case files
- **Tests**: xUnit with NSubstitute for mocks, integration tests for external APIs
- **Error Handling**: Use Result pattern or throw specific exceptions, log errors

## Project Notes
- **Package Manager**: Bun (not pnpm/npm) - package.json still references pnpm but use Bun
- **Database**: EF Core + SQLite, migrations in PlexLocalScan.Data
- **Real-time**: SignalR for live updates (OnFileAdded, OnFileUpdated, OnFileRemoved)
- **Media Detection**: Regex-based parsing, TMDb API for metadata
- **UI Patterns**: Infinite scroll (30 items/load), article-aware sorting (ignore "The"/"A"/"An")
