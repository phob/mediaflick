# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MediaFlick is a dual-stack media management application with a .NET 9 backend and Next.js 15 frontend. It automatically scans media libraries, identifies movies and TV shows using TMDb API, and organizes files with symlinks for Plex integration.

## Technology Stack

### Backend (.NET 9)
- **Main Project**: PlexLocalScan.Api - ASP.NET Core Web API with Minimal API
- **Database**: Entity Framework Core with SQLite
- **Logging**: Serilog
- **Real-time**: SignalR
- **Testing**: xUnit

### Frontend (Next.js 15)
- **Framework**: Next.js 15 with App Router
- **Package Manager**: Bun (migrated from pnpm)
- **Styling**: Tailwind CSS with tailwindcss-motion for animations
- **UI Components**: shadcn/ui
- **Theme**: next-themes with dark mode default
- **State Management**: React Query for data fetching and caching

## Essential Commands

### Development
```bash
# Start development environment (both backend and frontend)
./startdev.sh

# Frontend only (from frontend/ directory)
bun run dev

# Backend only (from backend/PlexLocalScan.Api/ directory)
dotnet run
```

### Building
```bash
# Frontend build
cd frontend && bun run build

# Backend build
cd backend && dotnet build

# Production build for distribution
cd frontend && bun run builddist
```

### Code Quality
```bash
# Frontend linting
cd frontend && bun run lint

# Frontend formatting
cd frontend && bun run format

# Backend tests
cd backend && dotnet test
```

## Project Architecture

### Backend Structure
The backend follows a clean architecture pattern:

- **PlexLocalScan.Api**: Web API layer with controllers and endpoints
- **PlexLocalScan.Shared**: Business logic and background services
- **PlexLocalScan.Data**: EF Core context and migrations
- **PlexLocalScan.Core**: Domain models and entities
- **PlexLocalScan.SignalR**: Real-time communication hubs
- **PlexLocalScan.Abstractions**: Interfaces and contracts

### Frontend Structure
The frontend uses Next.js App Router with organized components:

- **app/**: Next.js app router pages and layouts
- **components/**: Reusable UI components organized by feature
- **lib/api/**: API client and endpoint definitions
- **config/**: Site configuration and navigation
- **hooks/**: Custom React hooks

### Key Features
- **Media Detection**: Regex-based file parsing for movies/TV shows
- **TMDb Integration**: Automatic metadata fetching with intelligent sorting (ignores articles like "The", "A", "An")
- **Symlink Management**: Organized file structure for Plex
- **Real-time Updates**: SignalR for live status updates
- **Batch Operations**: Bulk file processing capabilities
- **Infinite Scroll**: Auto-pagination with Intersection Observer for media grids (loads 30 items initially)

## Development Guidelines

### Frontend (Next.js)
- Use shadcn/ui components: `bunx shadcn@latest add <component>`
- API endpoints are centralized in `src/lib/api/endpoints.ts`
- Follow existing component patterns in organized feature directories
- Use tailwindcss-motion for animations following existing patterns
- **React Best Practices**:
  - Avoid setState in useEffect - use lazy initialization or useMemo instead
  - Use lazy state initialization: `useState(() => initialValue)` when value comes from localStorage or external source
  - Use derived state pattern for state that depends on other state (compare during render, not in effect)
  - Prefer useMemo for computed values over useEffect + setState
- **Logging**: Keep console.error for error logging, avoid console.log/info/warn in production code

### Backend (.NET)
- Use Minimal API endpoints organized in separate routing files
- Follow dependency injection patterns established in `ServiceCollection/`
- Use Serilog for all logging
- EF Core migrations: `dotnet ef migrations add <name>` from PlexLocalScan.Data project

### Testing
- Backend tests located in `PlexLocalScan.Test/`
- Run tests with `dotnet test` from src/ directory
- Integration tests available for TMDb client

## Configuration
- Backend configuration in `appsettings.json` and `appsettings.Development.json`
- Frontend configuration managed through settings UI
- Environment-specific settings supported through standard ASP.NET Core configuration

## Common Development Patterns
- SignalR hubs for real-time updates between frontend and backend
- Scoped services for database operations
- Background services for file processing
- Regex patterns for media file detection
- Infinite scroll for large data sets (replaces traditional pagination in media grids)
- Article-aware sorting: Use regex `/^(the|a|an)\s+/i` to normalize titles before sorting
- State persistence: Store UI state (filters, pagination, media type) in localStorage and URL params

## Recent Migrations and Improvements
- **Package Manager**: Migrated from pnpm to Bun for faster builds and installs
- **Docker**: Updated Dockerfile to use `oven/bun:1-alpine` for frontend build stage
- **React Hooks**: Refactored to follow React best practices, eliminating setState in useEffect violations
- **UI/UX**: Implemented infinite scroll in media info view with Intersection Observer
- **Sorting**: Added intelligent title sorting that ignores leading articles