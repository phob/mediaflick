FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["PlexLocalScan.csproj", "./"]
RUN dotnet restore "PlexLocalScan.csproj"
COPY . .
RUN dotnet publish "PlexLocalScan.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/runtime:8.0
WORKDIR /app
COPY --from=build /app/publish .

# Create config directory
RUN mkdir -p /config/logs

VOLUME ["/config"]
ENTRYPOINT ["dotnet", "PlexLocalScan.dll"] 