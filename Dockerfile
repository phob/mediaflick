# Build Stage
FROM mcr.microsoft.com/dotnet/sdk:9.0-alpine AS backend-build
WORKDIR /src

# Copy the rest of the source code
COPY src/ .

# Restore dependencies
RUN dotnet restore "PlexLocalScan.Api/PlexLocalScan.Api.csproj" && \
dotnet publish "PlexLocalScan.Api/PlexLocalScan.Api.csproj" -c Release -o /app/publish

# Frontend Build Stage
FROM node:20-slim AS frontend-build
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN corepack prepare pnpm@10.0.0 --activate
WORKDIR /mediaflick

# Copy frontend files
COPY mediaflick/package*.json mediaflick/pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY mediaflick .
RUN pnpm run build

# Runtime Stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0-alpine
WORKDIR /app

RUN apk add --no-cache icu-libs nodejs

# Create necessary directories
RUN mkdir -p config/logs && mkdir -p /mnt/zurg/tvseries && mkdir -p /mnt/zurg/movies \
&& mkdir -p /mnt/organized/tvseries && mkdir -p /mnt/organized/movies

# Copy the published backend app
COPY --from=backend-build /app/publish .

# Copy the built frontend app
COPY --from=frontend-build /mediaflick/.next/standalone ./
COPY --from=frontend-build /mediaflick/.next/static ./.next/static

# Set environment variable for timezone and globalization
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false
ENV NODE_ENV=production

# Expose only the frontend port
EXPOSE 3000
EXPOSE 5000

RUN rm -rf ./node_modules

# Start both services using a shell script
COPY start.sh .

RUN chmod +x start.sh
ENTRYPOINT ["./start.sh"]
