#!/bin/sh
cd src/PlexLocalScan.Api
dotnet build -c Debug
cd ../../frontend
npm run dev & dotnet ../src/PlexLocalScan.Api/bin/Debug/net8.0/PlexLocalScan.Api.dll
