#!/bin/sh
cd src/PlexLocalScan.Api
dotnet build -c Debug
cd ../../mediaflick
pnpm run dev & dotnet run --project ../src/PlexLocalScan.Api --configuration Debug
