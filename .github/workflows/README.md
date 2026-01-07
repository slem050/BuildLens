# GitHub Actions Workflows

This directory contains GitHub Actions workflows for BuildLens.

## Workflows

### `ci.yml` - Continuous Integration
**Triggers:**
- Push to `main` or `master` branch
- Pull requests to `main` or `master`

**Jobs:**
- Lint and test
- Run test coverage
- Upload coverage to Codecov (optional)

### `test.yml` - Test Suite
**Triggers:**
- Push to `main` or `master` branch
- Pull requests to `main` or `master`
- Release events

**Jobs:**
- Run full test suite
- Upload coverage reports

### `publish.yml` - Publish to NPM
**Triggers:**
- Release published/created
- Manual workflow dispatch

**Jobs:**
1. **Test** - Runs tests before publishing (required)
2. **Publish** - Publishes to NPM (only if tests pass)

## Test Database

All workflows use a PostgreSQL service container:
- Image: `postgres:15`
- Port: `5433` (mapped from container's 5432)
- Database: `buildlens_test`
- User: `postgres`
- Password: `postgres`

## Required Secrets

For publishing to NPM, you need to set:
- `NPM_TOKEN` - NPM authentication token

To create an NPM token:
1. Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
2. Create a new "Automation" token
3. Add it as a secret in GitHub: Settings → Secrets → Actions

## Usage

### Automatic Testing
Tests run automatically on:
- Every push to main
- Every pull request

### Publishing a Release

**Option 1: GitHub Release**
1. Create a new release on GitHub
2. Tests run automatically
3. If tests pass, package is published to NPM

**Option 2: Manual Dispatch**
1. Go to Actions → Publish workflow
2. Click "Run workflow"
3. Enter version number
4. Tests run, then publish if successful

## Workflow Status

You can check workflow status:
- In the "Actions" tab on GitHub
- Via status badges (add to README):
  ```markdown
  ![Tests](https://github.com/YOUR_USERNAME/BuildLens/workflows/Tests/badge.svg)
  ![CI](https://github.com/YOUR_USERNAME/BuildLens/workflows/CI/badge.svg)
  ```

