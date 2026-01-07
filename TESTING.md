# Testing Guide

This guide explains how to run tests for BuildLens locally, with automatic database setup.

## Quick Start

Simply run:
```bash
npm test
```

The test script will automatically:
1. ✅ Check if PostgreSQL is available (local or Docker)
2. 🚀 Start Docker test database if needed
3. 📦 Create test database if it doesn't exist
4. 🧪 Run all tests

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### Unit Tests Only
```bash
npm run test:unit
```

### Component Tests Only
```bash
npm run test:component
```

## Database Options

### Option 1: Local PostgreSQL (Recommended for Development)

If you have PostgreSQL installed locally:

```bash
# Create test database (one time)
createdb buildlens_test

# Run tests - will use local PostgreSQL automatically
npm test
```

The tests will automatically detect and use your local PostgreSQL on port 5432.

### Option 2: Docker (Automatic)

If you don't have PostgreSQL installed:

```bash
# Tests will automatically start Docker if needed
npm test
```

The test script will:
- Check if Docker test database is running
- Start it automatically if not running
- Use port 5433 to avoid conflicts

### Option 3: Manual Docker Control

If you want to manually control the Docker database:

```bash
# Start test database
npm run test:db:start

# Run tests
npm test

# Stop test database
npm run test:db:stop
```

## Test Database Configuration

### Default Settings
- **Host**: `localhost`
- **Port**: `5432` (local) or `5433` (Docker)
- **Database**: `buildlens_test`
- **User**: `postgres`
- **Password**: `postgres`

### Custom Configuration

Set environment variables to override defaults:

```bash
# Using local PostgreSQL
export TEST_DB_HOST=localhost
export TEST_DB_PORT=5432
export TEST_DB_NAME=buildlens_test
export TEST_DB_USER=postgres
export TEST_DB_PASSWORD=postgres

npm test
```

Or use a connection string:

```bash
export TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/buildlens_test
npm test
```

## Test Structure

```
src/__tests__/
├── setup.ts              # Global test setup
├── utils/
│   └── test-db.ts       # Database test utilities
├── unit/
│   ├── database.test.ts # Database factory tests
│   └── repository.test.ts # Repository CRUD tests
└── component/
    ├── learn.test.ts    # Learn command integration tests
    └── select.test.ts   # Select command integration tests
```

## Test Utilities

### `withTestDb` Helper

Automatically sets up and tears down the database for each test:

```typescript
import { withTestDb } from '../utils/test-db';

it('should do something', async () => {
  await withTestDb(async (testDb) => {
    const repo = testDb.getRepository();
    // Your test code here
    // Database is automatically cleaned up after test
  });
});
```

### TestDatabase Class

For more control:

```typescript
import { TestDatabase } from '../utils/test-db';

const testDb = new TestDatabase();
await testDb.setup();
// ... test code ...
await testDb.teardown();
```

## Writing Tests

### Unit Tests

Test individual components in isolation:

```typescript
describe('Repository', () => {
  it('should upsert a test', async () => {
    await withTestDb(async (testDb) => {
      const repo = testDb.getRepository();
      const test = await repo.upsertTest('test/file.spec.ts', 'test name');
      expect(test).toBeDefined();
    });
  });
});
```

### Component Tests

Test integration between components:

```typescript
describe('LearnCommand', () => {
  it('should store test-to-function mappings', async () => {
    await withTestDb(async (testDb) => {
      const db = testDb.getDatabase();
      const learnCommand = new LearnCommand(db);
      // Test the full learn workflow
    });
  });
});
```

## Automatic Database Creation

The test setup automatically:
1. **Detects** if database exists
2. **Creates** it if missing (requires access to `postgres` database)
3. **Initializes** schema automatically
4. **Cleans** data between tests
5. **Closes** connections after tests

## Troubleshooting

### "Connection Refused"

**Local PostgreSQL:**
```bash
# Check if PostgreSQL is running
pg_isready

# Start PostgreSQL (macOS)
brew services start postgresql

# Start PostgreSQL (Linux)
sudo systemctl start postgresql
```

**Docker:**
```bash
# Check Docker is running
docker ps

# Start test database manually
npm run test:db:start
```

### "Database does not exist"

The test setup should create it automatically. If it fails:

**Local PostgreSQL:**
```bash
createdb -U postgres buildlens_test
```

**Docker:**
The database is created automatically when the container starts.

### "Permission Denied"

Make sure your PostgreSQL user has permission to create databases:

```sql
-- Connect as postgres superuser
psql -U postgres

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE buildlens_test TO your_user;
```

### Port Conflicts

If port 5432 is in use, use Docker (port 5433) or change the port:

```bash
export TEST_DB_PORT=5434
npm test
```

### Slow Tests

First run may be slow due to:
- Database initialization
- Schema creation
- Connection pooling

Subsequent runs should be faster.

## Best Practices

1. **Use `withTestDb`** for automatic cleanup
2. **Mock external dependencies** in component tests
3. **Keep tests isolated** - each test should be independent
4. **Clean up data** between tests (automatic with `withTestDb`)
5. **Use descriptive test names**
6. **Test both success and failure cases**

## Continuous Integration

Tests run automatically in CI with Docker:

```yaml
services:
  postgres-test:
    image: postgres:15
    # ... configured automatically
```

## Next Steps

- Add more unit tests for edge cases
- Add integration tests for full workflows
- Add performance tests for large datasets
- Add tests for error handling
