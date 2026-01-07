# BuildLens GitHub Actions Integration

BuildLens is fully compatible with GitHub Actions. This guide shows you how to set it up.

## Quick Start

### 1. Add PostgreSQL Service

GitHub Actions requires a PostgreSQL service container. Add this to your workflow:

```yaml
services:
  postgres:
    image: postgres:15
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: buildlens
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
    ports:
      - 5432:5432
```

### 2. Set Environment Variables

```yaml
env:
  DATABASE_URL: postgresql://postgres:postgres@localhost:5432/buildlens
```

### 3. Complete Workflow Example

```yaml
name: Tests with BuildLens

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

env:
  DATABASE_URL: postgresql://postgres:postgres@localhost:5432/buildlens

jobs:
  learn:
    name: Build Test Mappings
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: buildlens
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Install BuildLens
        run: npm install -g buildlens

      - name: Initialize database
        run: buildlens init

      - name: Run learn mode
        run: buildlens learn

  test:
    name: Run Impacted Tests
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: buildlens
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Install BuildLens
        run: npm install -g buildlens

      - name: Initialize database
        run: buildlens init

      - name: Run select mode
        run: buildlens select
        env:
          GITHUB_BASE_REF: ${{ github.base_ref }}
          GITHUB_SHA: ${{ github.sha }}
```

## GitHub Actions Features

### Automatic Branch Detection

BuildLens automatically detects:
- `GITHUB_BASE_REF` - Base branch for PRs (e.g., `main`)
- `GITHUB_SHA` - Current commit SHA
- `GITHUB_ACTIONS` - Detects if running in GitHub Actions

### Git Fetch Depth

**Important**: Use `fetch-depth: 0` to get full git history:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
```

This ensures BuildLens can compare branches properly.

## Using External PostgreSQL

If you prefer an external PostgreSQL database (e.g., managed service):

```yaml
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

Set `DATABASE_URL` as a GitHub secret with your connection string.

## Persisting Test Mappings

For better performance, you can persist the database between runs:

```yaml
- name: Save database
  if: always()
  run: |
    pg_dump -h localhost -U postgres buildlens > mappings.sql
    
- name: Upload database
  uses: actions/upload-artifact@v3
  with:
    name: buildlens-mappings
    path: mappings.sql

- name: Restore database
  if: github.event_name == 'pull_request'
  run: |
    psql -h localhost -U postgres buildlens < mappings.sql
```

Or use a shared database service for your organization.

## Troubleshooting

### "Could not determine current git reference"

Make sure you:
1. Use `fetch-depth: 0` in checkout
2. Set `GITHUB_SHA` environment variable for PRs

### "Database connection failed"

1. Check PostgreSQL service is running
2. Verify `DATABASE_URL` is correct
3. Ensure health checks pass before running BuildLens

### "No files changed"

This is normal if:
- PR has no code changes
- Base branch comparison finds no differences
- BuildLens will fallback to running all tests

## Best Practices

1. **Run learn mode on main branch pushes** - Keeps mappings up to date
2. **Run select mode on PRs** - Fast feedback
3. **Use scheduled jobs** - Nightly learn mode to refresh mappings
4. **Cache database** - For faster startup (optional)
5. **Monitor test coverage** - Ensure learn mode runs regularly

## Example: Full CI/CD Pipeline

```yaml
name: CI/CD

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'

jobs:
  learn:
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule' || (github.event_name == 'push' && github.ref == 'refs/heads/main')
    # ... learn job steps

  test:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    needs: []  # Can run in parallel
    # ... test job steps

  build:
    runs-on: ubuntu-latest
    needs: [test]
    # ... build job steps
```

## Support

For issues or questions, please open an issue on GitHub.

