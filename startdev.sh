#!/bin/sh
cd src/PlexLocalScan.Api
dotnet build -c Debug
cd ../../mediaflick
pnpm run dev & dotnet ../src/PlexLocalScan.Api/bin/Debug/net9.0/PlexLocalScan.Api.dll
