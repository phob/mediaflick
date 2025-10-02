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

    # Wait for backend to be ready (check if port 5000 is accepting connections)
    echo "Waiting for backend to be ready..."
    for i in $(seq 1 30); do
      if wget -q -O /dev/null http://localhost:5000/api/health 2>/dev/null || nc -z localhost 5000 2>/dev/null; then
        echo "Backend is ready!"
        break
      fi
      if [ $i -eq 30 ]; then
        echo "Backend failed to start within 30 seconds"
        exit 1
      fi
      sleep 1
    done

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