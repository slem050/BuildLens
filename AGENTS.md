# AGENTS.md

## Cursor Cloud specific instructions

BuildLens is a TypeScript/Node CLI (`buildlens`) for Jest test impact analysis. It requires a
PostgreSQL database for both the app and the test suite. Standard commands live in `package.json`
scripts and the various `*.md` docs (`README.md`, `SETUP.md`, `TESTING.md`, `LOCAL_TESTING.md`);
prefer those. Notes below are the non-obvious, environment-specific gotchas.

### PostgreSQL (required, no Docker)

- Docker is **not** available in this environment. PostgreSQL 16 is installed natively via `apt`
  and is baked into the VM snapshot, so the `docker compose` flows in the docs do **not** apply here.
- The cluster's port is set to **5433** (not the PostgreSQL default 5432) so it matches the
  hard-coded `TEST_DB_PORT=5433` in the `package.json` test scripts. Both databases `buildlens`
  (app) and `buildlens_test` (tests) already exist with user/password `postgres`/`postgres`.
- The cluster is not auto-started on boot. Start it (idempotent) before running tests or the app:
  - `sudo pg_ctlcluster 16 main start` (check with `pg_lsclusters`)
- Connection string for the app: `postgresql://postgres:postgres@localhost:5433/buildlens`.

### Running tests

- `npm test` works as-is: `scripts/test-db-check.sh` connects to PostgreSQL on port 5433 and
  auto-creates `buildlens_test` if missing, then runs Jest. Requires the cluster to be started first.
- Jest may log "A worker process has failed to exit gracefully" — this is a pre-existing teardown
  quirk, not a failure; all suites still pass.

### Running the app (init / learn / select)

- Build first: `npm run build` (outputs to `dist/`). Run via `node dist/cli.js <cmd>` or `npm run dev`.
- Always export `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/buildlens` first; the
  documented `npm run db:init` uses port 5432 and will fail in this environment — override the port.
- `learn` shells out to `npx jest --coverage` (which itself uses the test DB on 5433), so a single
  `learn` run touches both `buildlens_test` (Jest) and `buildlens` (stored mappings).
- `learn` prints "Some tests failed, but continuing" because of the nested Jest run; coverage is
  still produced and mappings are stored. `select` falls back to running all tests when no impacted
  tests are found (documented safety behavior).
