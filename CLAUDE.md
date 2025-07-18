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
- **Package Manager**: pnpm
- **Styling**: Tailwind CSS with tailwindcss-motion for animations
- **UI Components**: shadcn/ui
- **Theme**: next-themes with dark mode default

## Essential Commands

### Development
```bash
# Start development environment (both backend and frontend)
./startdev.sh

# Frontend only (from mediaflick/ directory)
pnpm run dev

# Backend only (from src/PlexLocalScan.Api/ directory)
dotnet run
```

### Building
```bash
# Frontend build
cd mediaflick && pnpm run build

# Backend build
cd src && dotnet build

# Production build for distribution
cd mediaflick && pnpm run builddist
```

### Code Quality
```bash
# Frontend linting
cd mediaflick && pnpm run lint

# Frontend formatting
cd mediaflick && pnpm run format

# Backend tests
cd src && dotnet test
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
- **TMDb Integration**: Automatic metadata fetching
- **Symlink Management**: Organized file structure for Plex
- **Real-time Updates**: SignalR for live status updates
- **Batch Operations**: Bulk file processing capabilities

## Development Guidelines

### Frontend (Next.js)
- Use shadcn/ui components: `pnpm dlx shadcn@latest add <component>`
- API endpoints are centralized in `src/lib/api/endpoints.ts`
- Follow existing component patterns in organized feature directories
- Use tailwindcss-motion for animations following existing patterns

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
- Pagination for large data sets