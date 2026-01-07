# BuildLens

**Function-Level Test Impact Analysis for Jest**

BuildLens is a smart Test Impact Analysis (TIA) tool designed for JavaScript / TypeScript projects that use Jest — including NestJS apps.

Instead of always running the entire test suite, BuildLens:

- Tracks which tests execute which functions
- Stores this mapping in a PostgreSQL database
- Detects which functions changed in the latest commit
- Automatically runs only the tests linked to those functions

This gives you faster builds and quicker feedback, while still maintaining correctness.

Think of it as a lightweight, open-source alternative to enterprise tools like Launchable, Datadog ITR, or SeaLights — but focused on Node + Jest.

## 🎯 Goals

- Reduce unnecessary test execution
- Speed up local development + CI pipelines
- Work with existing Jest + NestJS projects
- Persist test-to-code relationships using PostgreSQL
- Be simple, transparent, and easy to extend

## 🧠 How It Works

### Phase 1 — Learning Mode (Full Test Runs)

When the full suite runs (e.g., nightly or on main branch):

1. Jest runs with coverage enabled
2. The tool parses coverage output to extract:
   - Test identifier (file + test name)
   - Functions executed
   - File paths & line numbers
3. This mapping is stored in PostgreSQL

**Example concept:**
```
function src/users/user.service.ts#createUser
  ↳ test/users/user.service.spec.ts::"should create a user"
```

### Phase 2 — Selection Mode (PR / Commit Testing)

On each new commit or PR:

1. The tool reads the git diff
2. Detects which functions changed
3. Queries PostgreSQL for tests that previously executed those functions
4. Runs only those tests via Jest

If no mapping exists → the system falls back to broader test execution to stay safe.

## 📦 Installation

```bash
npm install
npm run build
```

## 🗄 Database Setup

BuildLens requires a PostgreSQL database. You can set it up locally or use a remote instance.

### Local PostgreSQL Setup

```bash
# Create database
createdb buildlens

# Or using psql
psql -U postgres -c "CREATE DATABASE buildlens;"
```

### Configuration

Set environment variables or create a `.env` file:

```bash
# Option 1: Connection string
DATABASE_URL=postgresql://localhost:5432/buildlens

# Option 2: Individual settings
DB_HOST=localhost
DB_PORT=5432
DB_NAME=buildlens
DB_USER=postgres
DB_PASSWORD=postgres
```

## 🚀 Usage

### Initialize Database Schema

```bash
npm run build
./dist/cli.js init
# or
buildlens init
```

### Learn Mode (Store Test-to-Function Mappings)

Run the full test suite and store mappings:

```bash
buildlens learn
```

This will:
1. Run Jest with coverage enabled
2. Parse the coverage JSON
3. Extract test-to-function relationships
4. Store everything in PostgreSQL

**Options:**
- `-c, --coverage-path <path>`: Path to existing coverage JSON file
- `-b, --base-branch <branch>`: Base branch for comparison (default: main)

### Select Mode (Run Impacted Tests)

Detect changed functions and run only impacted tests:

```bash
buildlens select
```

This will:
1. Analyze git diff vs base branch
2. Detect changed functions
3. Query database for impacted tests
4. Run only those tests

**Options:**
- `-b, --base-branch <branch>`: Base branch for comparison (default: main)
- `--no-fallback`: Do not fallback to all tests if no matches found
- `--dry-run`: Show what tests would be run without executing them

### Example Workflows

#### Local Development

```bash
# Once per day or when needed
npm run test:learn   # or: buildlens learn

# Fast feedback on changes
npm run test:diff    # or: buildlens select
```

#### CI Pipeline

```yaml
# .github/workflows/test.yml
name: Tests

on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # Nightly at 2 AM

jobs:
  learn:
    if: github.event_name == 'schedule'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: buildlens learn

  test:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: buildlens select
```

## 🔐 Safety Rules

- **If DB has no entry → run all tests**
- **If mapping incomplete → expand selection**
- **Always allow manual full test override**
- **Log what tests were selected & why**

## 🧩 Architecture

### Components

- **Node.js / TypeScript selector service**
- **PostgreSQL DB** (local or remote)
- **Jest coverage JSON parser**
- **Git diff analyzer**
- **Function-aware TypeScript parser** (ts-morph)

### Database Schema

```sql
tests
  id
  file_path
  test_name

functions
  id
  file_path
  function_name
  start_line
  end_line
  commit_hash

test_function_links
  test_id
  function_id
```

## 📝 Project Structure

```
BuildLens/
├── src/
│   ├── cli.ts                 # CLI entry point
│   ├── commands/
│   │   ├── learn.ts          # Learn command
│   │   └── select.ts         # Select command
│   ├── db/
│   │   ├── database.ts       # Database connection
│   │   ├── repository.ts    # Data access layer
│   │   └── schema.sql        # Database schema
│   ├── coverage/
│   │   └── parser.ts         # Coverage JSON parser
│   ├── parser/
│   │   └── function-parser.ts # TypeScript function parser
│   ├── git/
│   │   └── diff-analyzer.ts  # Git diff analyzer
│   └── utils/
│       ├── logger.ts          # Logging utility
│       └── jest-runner.ts    # Jest execution wrapper
├── package.json
├── tsconfig.json
└── README.md
```

## 🚀 Future Enhancements (Phase 2+)

- 🔹 Per-test-case coverage
- 🔹 Confidence scoring
- 🔹 UI dashboard
- 🔹 ML-ranking
- 🔹 Language-agnostic support
- 🔹 Coverage history
- 🔹 Test grouping for parallel CI
- 🔹 SQLite local mode (no Postgres required)

## 🧪 Supported Stack

- Node.js / TypeScript
- Jest
- NestJS (optional)
- PostgreSQL
- Git

## 📄 License

MIT

## 🤝 Contributing

Contributions welcome! Please open an issue or submit a pull request.
