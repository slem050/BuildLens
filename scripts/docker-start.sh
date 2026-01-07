#!/bin/bash

set -e

echo "🐘 Starting BuildLens PostgreSQL database..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

if docker compose version &> /dev/null; then
    docker compose up -d
else
    docker-compose up -d
fi

echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 3

MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker exec buildlens-postgres pg_isready -U postgres &> /dev/null; then
        echo "✅ PostgreSQL is ready!"
        echo ""
        echo "📊 Connection details:"
        echo "   Host: localhost"
        echo "   Port: 5432"
        echo "   Database: buildlens"
        echo "   User: postgres"
        echo "   Password: postgres"
        echo ""
        echo "🔗 Connection string:"
        echo "   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/buildlens"
        echo ""
        echo "💡 To stop: npm run docker:stop"
        exit 0
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    sleep 1
done

echo "❌ PostgreSQL failed to start after $MAX_RETRIES seconds"
exit 1

