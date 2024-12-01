# Build Stage
FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS backend-build
WORKDIR /src

# Copy solution and project files
COPY ["src/PlexLocalScan.Api/PlexLocalScan.Api.csproj", "PlexLocalScan.Api/"]
COPY ["src/PlexLocalScan.Shared/PlexLocalScan.Shared.csproj", "PlexLocalScan.Shared/"]
COPY ["src/PlexLocalScan.Data/PlexLocalScan.Data.csproj", "PlexLocalScan.Data/"]

# Restore dependencies
RUN dotnet restore "PlexLocalScan.Api/PlexLocalScan.Api.csproj"

# Copy the rest of the source code
COPY src/ .

# Build and publish
RUN dotnet publish "PlexLocalScan.Api/PlexLocalScan.Api.csproj" -c Release -o /app/publish

# Frontend Build Stage
FROM node:18-alpine AS frontend-build
WORKDIR /frontend

# Copy frontend files
COPY frontend/package*.json ./
RUN npm install

COPY frontend .
RUN npm run build

# Runtime Stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine
WORKDIR /app

# Install required dependencies
RUN apk add --no-cache icu-libs nodejs npm

# Create necessary directories
RUN mkdir -p config/logs
RUN mkdir -p /mnt/zurg/tvseries
RUN mkdir -p /mnt/zurg/movies
RUN mkdir -p /mnt/organized/tvseries
RUN mkdir -p /mnt/organized/movies

# Copy the published backend app
COPY --from=backend-build /app/publish .

# Copy the built frontend app
COPY --from=frontend-build /frontend/.next ./.next
COPY --from=frontend-build /frontend/public ./public
COPY --from=frontend-build /frontend/package*.json ./
COPY --from=frontend-build /frontend/next.config.js ./

# Install production dependencies for frontend
RUN npm install --production

# Set environment variable for timezone and globalization
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false
ENV NODE_ENV=production

# Expose only the frontend port
EXPOSE 3000

# Start both services using a shell script
COPY start.sh .

RUN chmod +x start.sh
ENTRYPOINT ["./start.sh"]