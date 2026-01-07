#!/bin/bash

set -e

DB_HOST=${TEST_DB_HOST:-localhost}
DB_PORT=${TEST_DB_PORT:-5433}
DB_NAME=${TEST_DB_NAME:-buildlens_test}
DB_USER=${TEST_DB_USER:-postgres}
DB_PASSWORD=${TEST_DB_PASSWORD:-postgres}

echo "🔍 Checking test database connection..."

check_docker() {
    if command -v docker &> /dev/null; then
        if docker compose -f docker-compose.test.yml ps 2>/dev/null | grep -q "Up"; then
            return 0
        else
            return 1
        fi
    fi
    return 1
}

start_docker() {
    echo "🚀 Starting Docker test database..."
    docker compose -f docker-compose.test.yml up -d
    
    echo "⏳ Waiting for PostgreSQL to be ready..."
    MAX_RETRIES=30
    RETRY_COUNT=0
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if docker exec buildlens-postgres-test pg_isready -U postgres &> /dev/null; then
            echo "✅ Docker test database is ready!"
            export TEST_DB_PORT=5433
            return 0
        fi
        RETRY_COUNT=$((RETRY_COUNT + 1))
        sleep 1
    done
    
    echo "❌ Docker test database failed to start"
    return 1
}

if check_docker; then
    echo "✅ Docker test database is already running"
    export TEST_DB_PORT=5433
    exit 0
fi

if command -v psql &> /dev/null; then
    export PGPASSWORD=$DB_PASSWORD
    
    if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "SELECT 1" &> /dev/null 2>&1; then
        echo "✅ PostgreSQL is accessible on port $DB_PORT"
        
        if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1" &> /dev/null 2>&1; then
            echo "✅ Test database '$DB_NAME' exists"
            exit 0
        else
            echo "📦 Creating test database '$DB_NAME'..."
            psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME" 2>/dev/null || true
            echo "✅ Test database created"
            exit 0
        fi
    fi
fi

if start_docker; then
    exit 0
else
    echo "❌ Could not start test database. Please:"
    echo "   1. Install PostgreSQL locally, or"
    echo "   2. Install Docker and run: npm run test:db:start"
    exit 1
fi

