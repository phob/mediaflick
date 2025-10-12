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

    # Start backend in background
    dotnet PlexLocalScan.Api.dll &
    BACKEND_PID=$!

    # Start frontend
    node server.js &
    FRONTEND_PID=$!

    # Wait for both processes
    wait $BACKEND_PID $FRONTEND_PID
    ;;
  *)
    echo "Invalid SERVICE_MODE: $SERVICE_MODE. Use 'frontend', 'backend', or 'full'"
    exit 1
    ;;
esac