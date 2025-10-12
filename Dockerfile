# Build Stage
FROM mcr.microsoft.com/dotnet/sdk:9.0-alpine AS backend-build
WORKDIR /src

# Copy the rest of the source code
COPY backend/ .

# Restore dependencies
RUN dotnet restore "PlexLocalScan.Api/PlexLocalScan.Api.csproj" && \
dotnet publish "PlexLocalScan.Api/PlexLocalScan.Api.csproj" -c Release -o /app/publish

# Frontend Build Stage
FROM oven/bun:1-alpine AS frontend-build
WORKDIR /frontend

# Copy frontend files
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile

COPY frontend .
RUN bun run build

# Runtime Stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0-alpine
WORKDIR /app

RUN apk add --no-cache icu-libs nodejs wget

# Create necessary directories
RUN mkdir -p config/logs && mkdir -p /mnt/zurg/tvseries && mkdir -p /mnt/zurg/movies \
&& mkdir -p /mnt/organized/tvseries && mkdir -p /mnt/organized/movies

# Copy the published backend app
COPY --from=backend-build /app/publish .

# Copy the built frontend app
COPY --from=frontend-build /frontend/.next/standalone ./
COPY --from=frontend-build /frontend/.next/static ./.next/static
COPY --from=frontend-build /frontend/server.js ./server.js
COPY --from=frontend-build /frontend/node_modules ./node_modules

RUN mkdir -p ./.next/cache

# Set environment variable for timezone and globalization
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false
ENV NODE_ENV=production

# Expose only the frontend port (backend is internal only)
EXPOSE 3000

# Set environment variables for PUID and PGID
ENV PUID=1000
ENV PGID=1000
ENV TZ=UTC

# Start both services using a shell script
COPY scripts/start.sh .

RUN chmod +x start.sh
ENTRYPOINT ["./start.sh"]
