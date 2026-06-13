# BuildLens — Repository & Infrastructure Overview

> **Automations: read this file at the start of every run** (Ticket Manager, PR Reviewer,
> on-ticket Engineer). It is the shared source of truth for what this project is, how it is
> built/tested/run, the data model, the house coding standards, and the known backlog.
> Pair it with `AGENTS.md` (environment/runtime caveats).

## 1. What BuildLens is

BuildLens is a TypeScript/Node **CLI** (`buildlens`) that does **function-level Test Impact
Analysis (TIA)** for Jest projects. Instead of always running the whole suite, it:

1. `learn` — runs the full suite with coverage, extracts which tests executed which functions,
   and stores the mapping in **PostgreSQL**.
2. `select` — reads the git diff vs a base branch, detects changed functions, queries the DB
   for the tests that previously hit those functions, and runs only those.
3. `init` — creates the database schema.

It also ships as a **GitHub Action** (`action.yml` → `dist/action.js`).

## 2. Architecture & key modules

| Path | Responsibility |
| --- | --- |
| `src/cli.ts` | CLI entry (commander); wires `init` / `learn` / `select`. |
| `src/commands/learn.ts` | Learn flow: run Jest w/ coverage, parse, store mappings. |
| `src/commands/select.ts` | Select flow: diff → changed functions → impacted tests → run. |
| `src/db/interface.ts` | `DatabaseAdapter` / `DatabaseConfig` contracts. |
| `src/db/database.ts` | `DatabaseFactory` + `Database` wrapper (adapter selection). |
| `src/db/postgres-database.ts` | PostgreSQL adapter (`pg` Pool), schema init. |
| `src/db/repository.ts` | Typed data-access layer over `SqlQueries`. |
| `src/db/queries.ts` | **All** SQL, parameterized, centralized. |
| `src/coverage/parser.ts` | Parse Jest coverage JSON → covered functions. |
| `src/parser/function-parser.ts` | ts-morph function/method extraction + line ranges. |
| `src/git/diff-analyzer.ts` | simple-git diff → changed files/line ranges. |
| `src/utils/jest-runner.ts` | Wraps `npx jest` execution. |
| `src/utils/logger.ts` | Centralized, colored logging. |
| `src/action.ts` | GitHub Action wrapper around learn/select. |

## 3. Data model (PostgreSQL)

- `tests (id, file_path, test_name, ...)` — unique `(file_path, test_name)`.
- `functions (id, file_path, function_name, start_line, end_line, commit_hash, ...)` —
  unique `(file_path, function_name, start_line, end_line)`.
- `test_function_links (id, test_id, function_id, ...)` — unique `(test_id, function_id)`,
  FKs cascade on delete.

## 4. Infrastructure

- **Runtime:** Node + TypeScript 5.x (strict). Build: `tsc` → `dist/`.
- **Database:** PostgreSQL. Docs default to port **5432**; the test scripts hard-code
  **`TEST_DB_PORT=5433`**. See `AGENTS.md` for the cloud environment (native PG on **5433**,
  no Docker).
- **Local DB options:** `docker-compose.yml` (app, 5432) and `docker-compose.test.yml`
  (tests, 5433); helper scripts in `scripts/`.
- **CI:** `.github/workflows/ci.yml` and `test.yml` spin up `postgres:15` as a service on
  5433 and run build + tests + coverage on Node 20.

## 5. Build / test / lint / run

```bash
npm install            # deps
npm run build          # tsc -> dist/
npm run lint           # NOTE: currently a stub ("No linter configured yet")
npm test               # starts/locates PG, runs Jest (TEST_DB_PORT=5433)

# Run the CLI (point DATABASE_URL at your PG; cloud env uses port 5433):
export DATABASE_URL=postgresql://postgres:postgres@localhost:5433/buildlens
node dist/cli.js init
node dist/cli.js learn
node dist/cli.js select --base-branch main --dry-run
```

## 6. House coding standards (follow the repo's own best patterns)

When writing or reviewing code, match these existing patterns and cite the exemplar file:

- **DB access via the adapter pattern** — `src/db/interface.ts` + `src/db/database.ts`. Add new
  backends (e.g., SQLite) as adapters; no inline DB conditionals.
- **Parameterized SQL only, centralized in `SqlQueries`** — `src/db/queries.ts`. Never
  string-concatenate SQL.
- **All output through `Logger`** — `src/utils/logger.ts`. No raw `console.log`.
- **CLI features as command classes** with a typed `Options` interface + `execute()` —
  `src/commands/learn.ts`, `src/commands/select.ts`.
- **Strong typing**: explicit domain interfaces and return types; no unjustified `any`; no empty
  catch blocks that swallow errors; idempotent, conflict-aware schema ops.
- **Tests proportional to risk**: behavior changes in the core flow need an end-to-end /
  integration test; pure logic needs a focused unit test; docs/config need none. Avoid redundant
  or brittle over-testing.

## 7. Known limitations / backlog (priority order)

- **P0 – path mismatch breaks `select`:** `learn` stores absolute coverage paths
  (`/abs/.../src/x.ts`) while `select`/diff use repo-relative paths (`src/x.ts`), so impacted-test
  lookup matches nothing and `select` always falls back to running ALL tests.
- **P0 – mapping is a cartesian product:** `learn` links every covered function to every test in
  a test file (file granularity, not per test case) → massive over-selection. Needs per-test
  coverage.
- **P0 – brittle function identity:** keyed on exact `(file, name, start_line, end_line)` and many
  are `(anonymous_N)`; line shifts break matches.
- **P1:** `select` ignores the working tree (committed diff only); SQLite local mode unimplemented;
  GitHub Action reports hardcoded `0/0`; no `prune`/`stats` command or stale-data cleanup.
- **P2:** no real linter (ESLint/Prettier); dead code (`coverage/parser.ts#parseTestNames`,
  `extractFunctionMappings`); no end-to-end `learn→select` test; CI lacks Node/PG matrix and a real
  lint/coverage gate; `ci.yml`/`test.yml` duplicated; stale-`dist/` risk for the published Action.

## 8. How automations should use this doc

- **At the start of every run, read this file and `AGENTS.md`** before acting.
- Ground every issue/review in real files/symbols listed here; cite the exemplar file for any
  standard you enforce.
- Prioritize correctness of the core `learn → select` promise first, then roadmap, then hygiene.
- Use technical effort descriptions (files touched, risk), never calendar estimates.
