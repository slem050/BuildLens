#!/bin/bash

set -e

echo "🛑 Stopping BuildLens PostgreSQL database..."

if docker compose version &> /dev/null; then
    docker compose down
else
    docker-compose down
fi

echo "✅ PostgreSQL stopped"

