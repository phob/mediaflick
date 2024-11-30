# Build Stage
FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS build
WORKDIR /src

# Copy solution and project files
COPY ["PlexLocalScan.Api/PlexLocalScan.Api.csproj", "PlexLocalScan.Api/"]
COPY ["PlexLocalScan.Shared/PlexLocalScan.Shared.csproj", "PlexLocalScan.Shared/"]
COPY ["PlexLocalScan.Data/PlexLocalScan.Data.csproj", "PlexLocalScan.Data/"]

# Restore dependencies
RUN dotnet restore "PlexLocalScan.Api/PlexLocalScan.Api.csproj"

# Copy the rest of the source code
COPY . .

# Build and publish
RUN dotnet publish "PlexLocalScan.Api/PlexLocalScan.Api.csproj" -c Release -o /app/publish

# Runtime Stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine
WORKDIR /app

# Install required dependencies
RUN apk add --no-cache icu-libs

# Create necessary directories
RUN mkdir -p /config/logs

# Copy the published app
COPY --from=build /app/publish .

# Set environment variable for timezone and globalization
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false

# Expose the API port
EXPOSE 5000

ENTRYPOINT ["dotnet", "PlexLocalScan.Api.dll"]