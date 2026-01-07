#!/bin/bash

set -e

echo "🔄 Resetting BuildLens PostgreSQL database..."

if docker compose version &> /dev/null; then
    docker compose down -v
    docker compose up -d
else
    docker-compose down -v
    docker-compose up -d
fi

echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 3

MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker exec buildlens-postgres pg_isready -U postgres &> /dev/null; then
        echo "✅ Database reset complete!"
        echo ""
        echo "💡 Run 'buildlens init' to initialize the schema"
        exit 0
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    sleep 1
done

echo "❌ PostgreSQL failed to start after $MAX_RETRIES seconds"
exit 1

