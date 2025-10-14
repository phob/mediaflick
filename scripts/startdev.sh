#!/bin/sh
cd backend/PlexLocalScan.Api
dotnet build -c Debug
cd ../../frontend
bun run dev & dotnet run --project ../backend/PlexLocalScan.Api/PlexLocalScan.Api.csproj
