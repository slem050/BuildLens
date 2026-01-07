# BuildLens Setup Guide

## Prerequisites

1. **Node.js** (v16 or higher)
2. **PostgreSQL** (v12 or higher)
3. **Git**

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

This will install:
- TypeScript and type definitions
- PostgreSQL client (pg)
- ts-morph for TypeScript parsing
- Commander for CLI
- Other dependencies

### 2. Build the Project

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

### 3. Set Up PostgreSQL Database

#### Option A: Local PostgreSQL

```bash
# Create database
createdb buildlens

# Or using psql
psql -U postgres -c "CREATE DATABASE buildlens;"
```

#### Option B: Docker

```bash
docker run --name buildlens-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=buildlens \
  -p 5432:5432 \
  -d postgres:15
```

### 4. Configure Database Connection

Create a `.env` file in the project root:

```bash
# Option 1: Connection string
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/buildlens

# Option 2: Individual settings
DB_HOST=localhost
DB_PORT=5432
DB_NAME=buildlens
DB_USER=postgres
DB_PASSWORD=postgres
```

### 5. Initialize Database Schema

```bash
npm run build
./dist/cli.js init
```

Or if you've linked it globally:

```bash
buildlens init
```

### 6. Verify Installation

```bash
# Test the CLI
./dist/cli.js --help

# Should show:
# Usage: buildlens [options] [command]
# ...
```

## Usage in Your Project

### In Your Jest Project

1. **First, run learn mode** to build the initial mapping:

```bash
# From your project root
buildlens learn
```

2. **Then use select mode** for fast feedback:

```bash
buildlens select
```

### Add to package.json

```json
{
  "scripts": {
    "test:learn": "buildlens learn",
    "test:diff": "buildlens select"
  }
}
```

## Troubleshooting

### TypeScript Errors

If you see TypeScript errors about missing types, make sure:

1. Dependencies are installed: `npm install`
2. TypeScript can find node types: Check that `@types/node` is in `node_modules`

### Database Connection Errors

1. Verify PostgreSQL is running: `pg_isready`
2. Check connection string in `.env`
3. Test connection: `psql $DATABASE_URL`

### Jest Not Found

Make sure Jest is installed in your project:

```bash
npm install --save-dev jest @types/jest ts-jest
```

### Coverage File Not Found

Ensure Jest is configured to generate JSON coverage:

```javascript
// jest.config.js
module.exports = {
  collectCoverage: true,
  coverageReporters: ['json', 'text'],
  // ...
};
```

## Next Steps

1. Run `buildlens learn` in your project to build the initial mapping
2. Make a code change
3. Run `buildlens select` to see only impacted tests run
4. Set up CI/CD integration (see README.md)

