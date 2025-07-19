#!/bin/sh

# Default to running both services if SERVICE_MODE is not set
SERVICE_MODE=${SERVICE_MODE:-"full"}

case $SERVICE_MODE in
  "frontend")
    echo "Starting frontend only..."
    exec node server.js
    ;;
  "backend")
    echo "Starting backend only..."
    exec dotnet PlexLocalScan.Api.dll
    ;;
  "full")
    echo "Starting both frontend and backend..."
    dotnet PlexLocalScan.Api.dll & node server.js
    wait
    ;;
  *)
    echo "Invalid SERVICE_MODE: $SERVICE_MODE. Use 'frontend', 'backend', or 'full'"
    exit 1
    ;;
esac