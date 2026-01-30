#!/bin/sh
set -e

# Run database migrations
echo "Running database migrations..."
cd /app/packages/db && bun run db:push

# Start the application
echo "Starting application..."
exec /app/"$1"
