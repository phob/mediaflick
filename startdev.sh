#!/bin/sh
cd src/PlexLocalScan.Api
dotnet build -c Debug
cd ../../mediaflick
bun run dev & dotnet run --project ../src/PlexLocalScan.Api --configuration Debug
