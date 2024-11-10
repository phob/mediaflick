FROM mcr.microsoft.com/dotnet/sdk:7.0 AS build
WORKDIR /src
COPY ["PlexLocalscan.csproj", "./"]
RUN dotnet restore "PlexLocalscan.csproj"
COPY . .
RUN dotnet publish "PlexLocalscan.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/runtime:7.0
WORKDIR /app
COPY --from=build /app/publish .

# Create config directory
RUN mkdir -p /config/logs

VOLUME ["/config"]
ENTRYPOINT ["dotnet", "PlexLocalscan.dll"] 