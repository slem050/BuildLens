# Local Testing with Docker PostgreSQL

This guide shows you how to test BuildLens locally using Docker PostgreSQL.

## Quick Start

### 1. Start PostgreSQL

```bash
npm run docker:start
```

This will:
- Start a PostgreSQL 15 container
- Create the `buildlens` database
- Expose it on port 5432
- Persist data in a Docker volume

### 2. Initialize Database Schema

```bash
npm run db:init
```

Or manually:
```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/buildlens
buildlens init
```

### 3. Test BuildLens

```bash
# Set database URL
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/buildlens

# Run learn mode
buildlens learn

# Run select mode
buildlens select
```

## Available Commands

### Docker Management

```bash
# Start PostgreSQL
npm run docker:start

# Stop PostgreSQL
npm run docker:stop

# Reset database (removes all data)
npm run docker:reset

# View logs
npm run docker:logs
```

### Database Operations

```bash
# Initialize schema
npm run db:init

# Or with explicit DATABASE_URL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/buildlens buildlens init
```

## Manual Docker Commands

If you prefer using Docker directly:

```bash
# Start
docker compose up -d

# Stop
docker compose down

# Stop and remove volumes (reset)
docker compose down -v

# View logs
docker compose logs -f postgres

# Check status
docker compose ps
```

## Connection Details

Default connection settings:
- **Host**: `localhost`
- **Port**: `5432`
- **Database**: `buildlens`
- **User**: `postgres`
- **Password**: `postgres`

Connection string:
```
postgresql://postgres:postgres@localhost:5432/buildlens
```

## Using .env File

Create a `.env.local` file (or copy from `.env.local.example`):

```bash
cp .env.local.example .env.local
```

Then source it:
```bash
source .env.local
export $(cat .env.local | xargs)
```

Or use it directly:
```bash
DATABASE_URL=$(grep DATABASE_URL .env.local | cut -d '=' -f2) buildlens init
```

## Testing Workflow

### 1. Start Database
```bash
npm run docker:start
```

### 2. Initialize Schema
```bash
npm run db:init
```

### 3. Run Learn Mode
```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/buildlens
buildlens learn
```

### 4. Make Code Changes
```bash
# Edit some source files
vim src/some-file.ts
```

### 5. Run Select Mode
```bash
buildlens select
```

### 6. Verify Results
```bash
# Connect to database to inspect
docker exec -it buildlens-postgres psql -U postgres -d buildlens

# Then run SQL queries:
# SELECT * FROM tests;
# SELECT * FROM functions;
# SELECT * FROM test_function_links;
```

## Troubleshooting

### Port Already in Use

If port 5432 is already in use:

1. **Option 1**: Stop existing PostgreSQL
```bash
# macOS
brew services stop postgresql

# Linux
sudo systemctl stop postgresql
```

2. **Option 2**: Change port in docker-compose.yml
```yaml
ports:
  - "5433:5432"  # Use 5433 instead
```

Then update connection:
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/buildlens
```

### Container Won't Start

Check logs:
```bash
npm run docker:logs
```

Or:
```bash
docker compose logs postgres
```

### Reset Everything

```bash
npm run docker:reset
npm run db:init
```

### Connection Refused

1. Check container is running:
```bash
docker compose ps
```

2. Check health:
```bash
docker exec buildlens-postgres pg_isready -U postgres
```

3. Wait a few seconds after starting (PostgreSQL needs time to initialize)

## Data Persistence

Data is stored in a Docker volume named `buildlens-data`. It persists even after stopping the container.

To completely remove data:
```bash
docker compose down -v
```

## Using Different PostgreSQL Version

Edit `docker-compose.yml`:
```yaml
services:
  postgres:
    image: postgres:14  # Change version here
```

## Integration with Your Project

To test BuildLens with your actual project:

1. Start BuildLens database:
```bash
cd /path/to/BuildLens
npm run docker:start
```

2. In your project directory:
```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/buildlens
buildlens learn
```

## Next Steps

- See [README.md](./README.md) for usage instructions
- See [GITHUB_ACTIONS.md](./GITHUB_ACTIONS.md) for CI/CD setup
- See [SETUP.md](./SETUP.md) for general setup

