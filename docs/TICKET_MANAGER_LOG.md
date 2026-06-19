# BuildLens — Ticket Manager Log & Backlog State

> **Read this file at the start of every Ticket Manager run.** It is the persistent
> progress/flow record (the automation also keeps a private memory, but this file is the
> human-readable source of truth on `main`). Update it and push to `main` every run.

## What the Ticket Manager does
Maintains a healthy, deduplicated, prioritized GitHub issue backlog for BuildLens (a TS/Node CLI
for function-level Test Impact Analysis on Jest, backed by PostgreSQL). It **only manages issues** —
never opens PRs or changes product code.

## Standing constraints
- **Hard cap: ≤ 15 OPEN tickets total** (explicit user instruction 2026-06-14: *"make sure we got 15
  tickets maximum, don't create more if we already have open"*). Count OPEN issues first; if at the cap,
  **create nothing** this run.
- **≤ 2 new *work* issues per run** (quality over volume). Skip a run if the backlog is healthy.
- Keep **one** pinned tracking/digest issue updated each run (currently **#6**) — don't open new ones.
  (Bot can't comment/edit it, so the live digest lives in this file; see run log.)
- Bias order: (1) correctness bugs that break the core promise, (2) roadmap gaps, (3) hygiene.
- **This file is the persistent progress/flow record** — update it and push to `main` every run, and
  read it first next run.

## ⚙️ Tooling / integration constraints (IMPORTANT — learned the hard way)
The `gh`/GitHub integration token in this environment can **only CREATE issues**. It **cannot**:
- apply labels (the `--label` flag is silently dropped — issues end up unlabeled),
- comment on issues (`addComment` → "Resource not accessible by integration"),
- edit issue bodies (`updateIssue` → same error),
- close/reopen issues, or open PRs.

**Run 9 update (2026-06-19):** the comment block is **not** just a `gh`/GraphQL quirk — the **REST**
path is blocked too. `gh api -X POST repos/slem050/BuildLens/issues/4/comments -f body=…` returns
**HTTP 403 "Resource not accessible by integration"** (same as GraphQL `addComment` and
`addLabelsToLabelable`). So there is **no** token-side workaround for step 6's `@cursor` handoff
comment — it must come from a maintainer or a comment-scoped token. (Verified live this run, three
ways: REST comment 403, GraphQL `addComment` 403, label apply 403.)

**Consequences / workarounds:**
- Put **intended labels** as a line at the top of the issue **body** (can't be applied as real labels).
- Embed the **`@cursor` engineering-agent handoff inside the issue body at creation time**
  (we cannot add it as a comment afterward). The maintainer can also comment `@cursor please
  implement` manually to trigger the agent.
- No MCP servers are available.

## ⚠️ Repo discrepancies / gaps (cite when relevant; don't invent busywork)
- **`REPO_OVERVIEW.md` and `AGENTS.md` do NOT exist**, although the process treats them as the
  shared source of truth and handoffs ask agents to read them. Today the source of truth is
  **`README.md`** + the actual `src/` tree. *Recommended follow-up:* add both files.
- `README.md` **"Project Structure" is stale**: lists `src/db/schema.sql` and only
  `src/db/repository.ts`; the real DB layer is
  `src/db/{interface,database,postgres-database,queries,repository}.ts`, plus `src/action.ts`.
- No `.eslintrc` / `.prettierrc` / `.editorconfig`, no `.nvmrc`, no `engines` field in `package.json`.
- `.github/workflows/ci.yml` and `test.yml` largely **duplicate** each other; both test only
  Node 20 × `postgres:15`. Lint step is a no-op (`npm run lint || echo ...`). `jest.config.js`
  has **no `coverageThreshold`**. `dist/` is **not committed** (stale published-Action risk).

## Verified core bug (so future runs needn't re-derive it)
`select` almost always falls back to running the full suite because `learn` and `select` disagree
on function identity on three axes:
1. **Path:** `learn` stores the Istanbul `coverage-final.json` key (absolute path) via
   `learn.ts:137-143` + `jest-runner.ts:25-28,67-69`; `coverage/parser.ts:160-163 normalizePath`
   never relativizes. `select` queries **repo-relative** git paths
   (`diff-analyzer.ts:43-56,229-231` → `select.ts:60-64,126-141`).
2. **Name:** Istanbul name (`createUser`, `learn.ts:131-135`) vs ts-morph `Class.method`
   (`function-parser.ts:123-128`).
3. **Lines:** `decl` span (`learn.ts:134-135`) vs full ts-morph span (`function-parser.ts:107-108,129-130`).
Lookups demand exact equality (`queries.ts:67-70` and `:76-78`), so all return empty →
fallback at `select.ts:159-171`. Existing component tests mask it by mocking + hand-aligning
(`__tests__/component/select.test.ts:20-21,38-45,52-53`, `learn.test.ts:28-42,77-81`).

## Second verified core bug — `learn` cross-product over-linking (grounds #14, found run 7)
Independent of the #4 lookup mismatch, `learn` links **every** test to **every** covered function,
so even after #4 is fixed `select` returns the *whole* suite (no subset). In `learn.ts:112-159` the
outer loop is per **test file** (`:112`) but the inner loop iterates **all** source files in Jest's
*merged* `coverage-final.json` (`:115`) with no scoping back to that test file (the computed
`testBaseName` at `:113` is **dead code**); then `:145-153` does `createLink(test, func)` for every
test case × every covered function. So with tests `a1`(→`foo`) and `b1`(→`bar`), `learn` writes
`a1→foo, a1→bar, b1→foo, b1→bar` (full bipartite). `Repository.getTestsForFunctions`
(`repository.ts:106-113`, `queries.ts:87-91`) then returns ALL tests for any changed function.
Root cause is acknowledged in `coverage/parser.ts:53-55` ("Jest coverage doesn't directly map tests
to functions"). Masked by `learn.test.ts:28-42` (1 file × 1 fn × 1 test = 1 link; `:80-81` only
asserts links > 0). Fix = collect coverage **per test file** in `learn` and link only that file's
tests. This **reframes** the old queued "per-test-case coverage" item from a P2 *feature* to a
present **correctness** bug (per-test-*file* attribution is the floor; per-*case* stays the roadmap
enhancement, README line 252).

## Verified dependency-security finding (grounds #7; re-run `npm audit --package-lock-only`)
`npm audit` = **29 vulns (2 critical, 3 high, 22 moderate, 2 low)** as of run 6 (2026-06-16); was
**9 (2 crit, 3 high, 3 mod, 1 low)** at run 3. The **critical/high headline is unchanged** (the
moderate count rose as more advisories were published against the same pinned deps) — **#7 still
fully covers it** (the fix bumps the same direct deps + adds the CI audit gate). Headline:
- **`simple-git@^3.20.0` (DIRECT, `package.json:46`)** — **critical RCE** (`blockUnsafeOperationsPlugin`
  bypass) + command-execution / RCE (high). Used throughout `src/git/diff-analyzer.ts`
  (`simpleGit()` :29; `diffSummary` :39/:67; `diff` :47/:75; `revparse` :95/:107/:115; `fetch` :148).
  Fix = bump to `^3.36.0` (in-range `^3`, non-breaking).
- **`@actions/github@^6.0.1` (DIRECT, `package.json:42`)** → `@actions/http-client` → `undici (<=6.23.0)`
  high (WebSocket memory/exception) + CRLF (mod). Used only for `github.context.sha` (`src/action.ts:28`).
  Fix = `@actions/github@9.1.1` (semver-major, low blast radius).
- Transitive (dev) cleared by `npm audit fix`: `handlebars` crit ← `ts-jest`; `minimatch` high ←
  `@ts-morph/common`/`glob`/`test-exclude`; `picomatch` high ← jest toolchain; `brace-expansion`/`diff`.
- No CI audit gate (`ci.yml` has none). #7 adds `npm audit --audit-level=high --omit=dev`.

## Dependency currency note (low urgency; not yet filed — avoid busywork)
Pins behind latest majors: `commander ^11.1.0`→15, `ts-morph ^21.0.1`→28 (`package.json:44,47`).
`chalk` pinned to v4 is intentional (v5 is ESM-only; repo is CJS). Track as a future chore only if it
blocks a feature; don't churn for fashion.

## Current OPEN backlog (10 work + 1 tracking = 11; cap 15 → 4 slots free) — unchanged through run 9
| # | Title | Intended priority/type | Status |
|---|-------|------------------------|--------|
| 4 | Fix path & function-identity mismatch so `select` matches stored functions | P0 / bug | open, needs `@cursor` trigger |
| 14 | Fix `learn` cross-product over-linking (each test → only functions it executed) | P1 / bug (correctness) | **NEW (run 7)**, needs `@cursor` trigger |
| 7 | Patch critical/high dep vulns (`simple-git` RCE, `@actions/github`/undici) + npm audit CI gate | P1 / bug (security) | open, needs `@cursor` trigger |
| 8 | Harden CI/release: commit & verify `dist/` Action bundle, Node×PG matrix, coverage gate, runtime pin | P1 / chore | open, needs `@cursor` trigger |
| 5 | Add E2E test proving `select` runs a SUBSET (not a full fallback) | P1 / test | open, needs `@cursor` trigger |
| 9 | Real ESLint+Prettier+EditorConfig lint gate; Logger for output; no swallowed `catch` | P1 / chore (+good-first) | open, needs `@cursor` trigger |
| 10 | DB schema hygiene: `TEXT` cols, SSL for managed PG, versioned migrations | P1 / chore (db) | open, needs `@cursor` trigger |
| 11 | Add a SQLite `DatabaseAdapter` for no-Postgres local mode (roadmap) | P2 / feature | open, needs `@cursor` trigger |
| 12 | Add `REPO_OVERVIEW.md` + `AGENTS.md`; fix stale README "Project Structure" | P2 / docs (+good-first) | open, needs `@cursor` trigger |
| 13 | Fix Action outputs: real `tests-selected`/`tests-run` + propagate `base-ref`/sha | P2 / bug | open (run 6), needs `@cursor` trigger |
| 6 | [Tracking] BuildLens backlog — top priorities & daily digest | tracking | open (digest lives here; bot can't edit it) |

## Top 5 priorities (updated run 7; reconfirmed runs 8–9 — unchanged; correctness-of-core-promise occupies the top 3)
1. **#4** — P0/bug: fix path/identity mismatch so `select` *finds* stored functions (else it always
   falls back). *(filed)*
2. **#14** — P1/bug: fix `learn` cross-product so each test maps only to functions it executed —
   otherwise, even with #4 fixed, `select` returns the whole suite. Pairs with #4; both gate the core
   promise. *(filed run 7)*
3. **#5** — P1/test: E2E proof that `select` runs a SUBSET (verifies #4 **and** #14 together). *(filed)*
4. **#7** — P1/security: `simple-git` critical RCE + `@actions/github`/undici + CI audit gate. *(filed)*
5. **#8** — P1/chore: CI/release hardening — commit/verify `dist/`, Node×PG matrix, coverage gate,
   `engines`+`.nvmrc`, dedupe `ci.yml`/`test.yml`. *(filed)* — closely followed by **#9** (lint gate),
   **#10** (DB hygiene), then P2s **#11/#12/#13**.

### Unfiled backlog queue (next candidates, in priority order)
- **P2/chore** — dependency currency (`commander ^11`→15, `ts-morph ^21`→28; `package.json:44,47`) —
  low urgency, don't churn (`chalk` stays v4 = CJS). **Top of the queue now.**
- **P3/chore (watch, not filed)** — `learn.ts:62-73` test-name JSON parse is fragile: it regex-greps
  `/\{[\s\S]*\}/` out of mixed `--json`+`--coverage=text` output (`jest-runner.ts:36-38`); if it fails,
  `testNames` is empty → `testFileMap` empty → **0 links** created silently. Also `parseTestNamesFromJson`
  uses Jest's absolute `result.name` as the test `file_path` (same absolute-vs-relative class as #4).
  Likely folds into #14's `learn` rework — revisit when #14 is picked up; don't file separately yet.
- **P3/chore (watch, not filed)** — `jest-runner.ts:49-54` builds an unquoted `npx jest ${args.join(' ')}`
  for `execSync`; inputs are internal test-file paths today, so low risk — logged for future watch.
- ~~per-test-case coverage as a "feature"~~ → **reframed & filed as #14 (run 7)**: per-test-*file*
  attribution is a **correctness** fix; only finer per-*case* granularity (README line 252) remains a
  future P2 feature, and only after #4/#14 land.
- ~~SQLite local-mode adapter~~ → **filed as #11 (run 5)**.
- ~~`REPO_OVERVIEW.md` + `AGENTS.md` + stale README~~ → **filed as #12 (run 5)**.

## Dedup keywords to search each run
`path`, `fallback`, `select`, `subset`, `e2e`, `lint`, `eslint`, `prettier`, `engines`, `nvmrc`,
`matrix`, `sqlite`, `migration`, `varchar`, `ssl`, `dist artifact`, `REPO_OVERVIEW`, `AGENTS`,
`action.ts`, `tests-selected`, `tests-run`, `setOutput`, `base-ref`, `action output`,
`cross-product`, `over-link`, `createLink`, `per-test`, `attribution`, `bipartite`.

## Ready-to-use `@cursor` handoffs (paste as a comment to kick off the agent)
Because the bot can't comment, the maintainer can trigger the engineering agent by commenting on
each issue:
- **#4:** `@cursor please implement this issue.` Then point it at `README.md` + the cited files,
  the acceptance criteria, and the validation plan (Node 20 / PG 15; add unit + integration tests;
  open a PR that passes CI).
- **#5:** `@cursor please implement this issue.` Same context; add the E2E subset test under
  `src/__tests__/e2e/` using `withTestDb`; open a PR that passes CI.
- **#7:** `@cursor please implement this issue.` Bump `simple-git`→`^3.36.0` + `@actions/github`→`^9.1.1`,
  `npm audit fix`, add CI `npm audit --audit-level=high --omit=dev`; validate Node 20/18 × PG 15
  (`npm run build`, `npm audit`, `npm run test:ci`) + a `DiffAnalyzer` unit test; open a PR that passes CI.
- **#8:** `@cursor please implement this issue.` Commit+verify `dist/` (`git diff --exit-code -- dist`),
  Node[18,20,22]×PG[14,15,16] matrix in one workflow, `coverageThreshold` gate, `engines`+`.nvmrc`;
  validate with `npm run build`/`test:coverage:ci` + a `uses: ./` Action check; open a PR that passes the matrix.
- **#9:** `@cursor please implement this issue.` Add ESLint/Prettier/`.editorconfig` + real `lint`/`format:check`
  scripts, replace `ci.yml:59-60` `|| echo` with a real gate, de-swallow `diff-analyzer.ts` catches, route
  `console.*`→`Logger`; validate `npm run lint && npm run format:check && npm run build && npm run test:ci`
  (Node 20 / PG 15) + a unit test for a previously-swallowed catch path; open a PR that passes CI.
- **#10:** `@cursor please implement this issue.` `VARCHAR`→`TEXT` in `queries.ts`, add SSL to
  `PostgresDatabase`, add a `schema_migrations` versioned migration runner via `DatabaseAdapter`; validate
  with `docker compose -f docker-compose.test.yml up -d` + `npm run build && npm run test:ci` (Node 20 / PG 15)
  + a long-value integration test, a migration-idempotency test, and an SSL unit test; open a PR that passes CI.
- **#11:** `@cursor please implement this issue.` Add `src/db/sqlite-database.ts`
  (`SqliteDatabase implements DatabaseAdapter`, `better-sqlite3`), route SQLite connection strings in
  `DatabaseFactory` (`src/db/database.ts:7-15`), keep SQL parameterized/centralized in `SqlQueries`
  (`src/db/queries.ts`) with dialect-aware array predicates; validate Node 20 with `npm run build` +
  `npm run test:ci` against **both** an in-memory SQLite DB and `postgres:15` (port 5433) + SQLite unit
  tests + a Repository parity integration test + a Node 20 × SQLite CI matrix cell; open a PR that passes CI.
- **#12:** `@cursor please implement this issue.` Create `REPO_OVERVIEW.md` + `AGENTS.md` grounded in
  `README.md` + the real `src/` tree (cite exemplars `src/db/{interface,database,queries}.ts`,
  `src/utils/logger.ts`, `src/commands/{learn,select}.ts`), and fix the stale README/PROJECT_SUMMARY
  "Project Structure" (`README.md:223-248`); validate Node 20 `npm run build` stays green + every cited
  path resolves; open a PR that passes CI.
- **#14:** `@cursor please implement this issue.` Fix `learn` so each test links **only** to functions
  it executed — collect coverage **per test file** (`jest-runner.ts:22-62`) and drop the cross-product +
  dead `testBaseName` (`learn.ts:112-159`); keep SQL parameterized via `Repository`/`SqlQueries` and
  output via `Logger`. Validate Node 20 × `postgres:15` (port 5433) with
  `docker compose -f docker-compose.test.yml up -d` + `npm run build && npm run test:ci`, add a two-
  test-file integration test asserting **no** cross links (via `withTestDb`), update `learn.test.ts`
  proportionally; coordinate with #4 (identity) & #5 (E2E subset); open a PR that passes CI.
- **#13:** `@cursor please implement this issue.` Make `SelectCommand.execute()` return a typed
  `{ selectedTests, ranTests, fellBackToAll }` (computed from `select.ts:150-205`), wire `action.ts`
  outputs to it (drop the hardcoded `'0'` at `src/action.ts:51-52`), add a `fell-back-to-all` output in
  `action.yml`, and fix the dead `GITHUB_BASE_REF`/`GITHUB_SHA` guards (`src/action.ts:24-29`); validate
  Node 20 × `postgres:15` (port 5433) with `npm run build && npm run test:ci` + a unit test (subset &
  fallback counts via `withTestDb`) + an Action-output test spying on `@actions/core`; rebuild `dist/`
  (coordinate with #8); open a PR that passes CI.

## Run log
### 2026-06-13
- Maintainer cleared issues #1–#3 (closed) and asked to recreate them.
- **Recreated** as **#4** (core path/identity bug), **#5** (E2E subset test), **#6** (tracking).
- Could **not** apply labels or post `@cursor` handoff comments (integration is create-only) —
  intended labels + handoff are embedded in issue bodies / this log instead.
- **Skipped** filing priorities 3–5 (kept within the ≤2-new/run budget; well under the 15 cap).
- Open tickets: 3 (cap 15).

### 2026-06-13 (run 3 — 20:00 UTC cron)
- **Synced context:** re-read `README.md`, `src/` tree, `package.json`, all `.github/workflows/*`,
  open/closed issues, PRs, last 15 commits. No PRs exist; last commit is doc-only (`ccf3f48` = run 2's
  log). Core-bug code (#4) is **unchanged**, so #4/#5 remain valid as written.
- **Advisory dependency/security audit** (`npm audit --package-lock-only`) surfaced **9 vulns
  (2 critical, 3 high)** — most importantly a **critical RCE in `simple-git`** (a *direct* dep used all
  over `diff-analyzer.ts`) and an `undici` high chain via `@actions/github`. This is the highest-leverage
  new work, so it jumped the queue.
- **Filed 2 new issues (≤2/run):**
  - **#7** — P1/bug(security): bump `simple-git`→`^3.36.0` + `@actions/github`→`^9.1.1`, `npm audit fix`,
    add CI `npm audit` gate.
  - **#8** — P1/chore: CI/release hardening (commit+verify `dist/` so the Action works via `uses:`,
    Node×PG matrix, coverage gate, `engines`+`.nvmrc`, dedupe `ci.yml`/`test.yml`). Absorbs the old
    priority-4 item.
- **Skipped (deliberately):** lint gate (now top of the unfiled queue), SQLite local mode, dependency
  currency — to honor ≤2-new/run + quality-over-volume.
- **Integration still create-only** (re-verified this run): `addLabelsToLabelable`, `addComment`, and
  label-create all return 403 "Resource not accessible by integration". So #7/#8 are **UNLABELED** and
  the `@cursor` handoff is **embedded in each issue body** (won't auto-trigger). **Maintainer action:**
  comment `@cursor please implement this issue.` on #4, #5, #7, #8 to dispatch the engineering agent, and
  apply intended labels listed at the top of each body.
- **Repo discrepancies (unchanged):** `REPO_OVERVIEW.md` + `AGENTS.md` still missing; README "Project
  Structure" still stale. Recommend adding the two files (would also unblock the handoff instructions).
- **Open tickets: 5** (#4, #5, #6 tracking, #7, #8) — cap 15.

### 2026-06-14 (run 4 — 20:00 UTC cron)
- **Synced context:** re-read `README.md`, full `src/` tree, `package.json`, `.github/workflows/*`,
  all open/closed issues, PRs, last 15 commits, this log, and the automation memory. **No PRs exist**;
  the last commits are doc-only (`f93eb0e`, `ccf3f48` = prior ticket-manager logs). **Core-bug code is
  unchanged** since run 3 → #4/#5/#7/#8 all remain valid as written.
- **User instruction this run:** *"≤15 tickets max; keep progress/flow in a docs md file; push to main
  every run; read at start."* This file already satisfies that; reinforced the 15-cap in Standing
  constraints. Was at **5 open** (well under cap) → eligible to file up to 2.
- **Filed 2 new issues (≤2/run), both already anticipated by existing tickets (not dupes):**
  - **#9** — P1/chore: real ESLint+Prettier+EditorConfig lint gate; replace no-op `lint`
    (`package.json:20`) and soft CI step (`ci.yml:59-60`); de-swallow empty `catch` blocks
    (`diff-analyzer.ts:111-112,131-132,139-140,149-150`); route raw `console.*` through `Logger`
    (`diff-analyzer.ts:60,88`; `postgres-database.ts:24`; `function-parser.ts:34`). **#8 explicitly
    defers lint config here** (its AC: "…or explicitly handed to the lint-gate issue").
  - **#10** — P1/chore(db): `VARCHAR(1000/500)`→`TEXT` (`queries.ts:5-6,16-17`; over-length values
    error `22001`, breaking `learn`), add SSL to `PostgresDatabase` (`postgres-database.ts:11-21`),
    add a versioned migration runner (replaces ad-hoc `CREATE TABLE IF NOT EXISTS`,
    `postgres-database.ts:40-99`). **#4 explicitly defers VARCHAR→TEXT here** ("track VARCHAR→TEXT
    separately"); also unblocks the roadmap SQLite adapter.
- **Skipped (deliberately):** SQLite local-mode feature and dependency currency — to honor ≤2/run +
  quality-over-volume. Queued above.
- **Integration STILL create-only — re-verified live this run on #9:** `gh issue comment 9` →
  `addComment` **403**; `gh issue edit 9 --add-label enhancement` → `addLabelsToLabelable` **403**.
  So the user's step-6 "post an `@cursor` handoff comment" is **not possible with this token** —
  instead the full `@cursor` handoff is **embedded in the body of #9 and #10 at creation**, and intended
  labels are listed at the top of each body. **#9 and #10 are UNLABELED.** **Maintainer action needed:**
  comment `@cursor please implement this issue.` on #4, #5, #7, #8, #9, #10 to dispatch the engineering
  agent (suggested order honoring deps: #4 → #5, then #7 → #8, then #9 / #10), and apply the intended
  labels. Tracking issue **#6 cannot be edited/commented by the bot**, so the live digest is in this file.
- **Repo discrepancies (unchanged):** `REPO_OVERVIEW.md` + `AGENTS.md` still **missing** (handoffs
  reference them); README "Project Structure" still stale. Added a low-priority P3/docs queue item.
- **Open tickets: 7** (#4, #5, #6 tracking, #7, #8, #9, #10) — cap 15.

### 2026-06-15 (run 5 — 20:00 UTC cron)
- **Synced context:** re-read `README.md`, full `src/` tree, `package.json`, `jest.config.js`,
  `.github/workflows/*`, all open/closed issues, PRs, last 15 commits, and this log. **No PRs exist.**
  The last 3 commits are doc-only ticket-manager logs (`d3a93bb`, `f93eb0e`, `ccf3f48`); **last product
  code commit is still `2e0d7bc`** → no `src/`/`package.json` change since run 4, so **#4/#5/#7/#8/#9/#10
  all remain valid as written**. Re-confirmed the core bug by re-reading `learn.ts:131-159` (stores
  Istanbul `normalizePath` keys + `fnCoverage.decl` lines) vs `select.ts:60-146` + `queries.ts:67-78`
  (queries git-relative paths + ts-morph spans; exact-match lookups) → fallback at `select.ts:159-171`.
- **User instruction this run (reinforced):** *"15 tickets max; don't create more if already open; keep
  progress/flow in a docs md file; push to `main` every run; read at start."* Honored: was at **7 open**
  (< 15) → eligible to file up to 2; this file is the progress record, updated and **pushed to `main`**.
- **Filed 2 new issues (≤2/run), both verified non-duplicate** (grepped all open bodies for
  `sqlite`/`repo_overview`/`agents`/`project structure`):
  - **#11** — P2/feature: SQLite local-mode `DatabaseAdapter` (README roadmap line 259). `DatabaseFactory`
    only ever returns `PostgresDatabase` and throws otherwise (`database.ts:7-15`); all SQL is
    Postgres-specific (`$n` params, `SERIAL`, `ON CONFLICT`, `= ANY($1::int[])` — `queries.ts:4,46-51,77,90`).
    #10 only *references* SQLite as a beneficiary; no adapter issue existed. Unblocked by #10's migration runner.
  - **#12** — P2/docs(+good-first): create `REPO_OVERVIEW.md` + `AGENTS.md` (the handoffs in #7/#8/#9/#10
    literally say *"if they're absent, use README"* — they're absent) and fix the stale README/PROJECT_SUMMARY
    "Project Structure" (`README.md:223-248` omits `db/{interface,postgres-database,queries}.ts`, `action.ts`,
    `index.ts`, `__tests__/`). **Elevated from P3→P2** because every run's first instruction + every handoff
    depends on these files. NOT created by the bot directly (rule: only manage issues, don't change product code).
- **Skipped (deliberately):** dependency currency (`commander`/`ts-morph` majors) and per-test-case coverage
  — honoring ≤2/run + quality-over-volume. Queued above.
- **Integration STILL create-only — re-verified live this run on #11:** `gh issue comment 11` →
  `addComment` **403 "Resource not accessible by integration"**; `--label enhancement` was **silently dropped**
  (#11 and #12 are **UNLABELED**). So the user's step-6 *"post an `@cursor` handoff comment"* is **not
  possible with this token** — the full `@cursor` handoff is instead **embedded in the body of #11 and #12 at
  creation**, and intended labels are listed at the top of each body. **Maintainer action needed:** comment
  `@cursor please implement this issue.` on #4, #5, #7, #8, #9, #10, #11, #12 to dispatch the engineering agent
  (suggested order honoring deps: #4 → #5, then #7 → #8, then #9/#10, then #11 [after #10] / #12), and apply
  the intended labels. Tracking issue **#6 still can't be edited/commented by the bot**, so the live digest is
  in this file.
- **Open tickets: 9** (#4, #5, #6 tracking, #7, #8, #9, #10, #11, #12) — cap 15, **6 slots free**.

### 2026-06-16 (run 6 — 20:00 UTC cron)
- **Synced context:** re-read this log first, then `README.md`, the full `src/` tree (incl. `action.ts`,
  `db/*`, `commands/*`, `coverage/parser.ts`, `parser/function-parser.ts`, `git/diff-analyzer.ts`,
  `utils/*`, `repository.ts`), `package.json`, `jest.config.js`, all `.github/workflows/*`, `action.yml`,
  all open/closed issues, PRs, and the last 15 commits. **No PRs exist.** The last 3 commits are doc-only
  ticket-manager logs (`8e962ed` run 5, `d3a93bb` run 4, `f93eb0e` run 3); **last product-code commit is
  still `2e0d7bc`** → no `src/`/`package.json` change since run 3, so **#4/#5/#7/#8/#9/#10/#11/#12 all
  remain valid as written**. Re-confirmed the core bug independently (path absolute-vs-relative, name
  bare-vs-`Class.method`, lines decl-vs-full-span; exact-match lookups `queries.ts:67-70` **and** the
  file-path fallback `queries.ts:76-78` both miss because the stored path is the absolute Istanbul key
  while the query path is git-relative → fallback at `select.ts:159-171`).
- **`REPO_OVERVIEW.md` + `AGENTS.md` still absent** (re-checked this run; the always-load step can't read
  them) → source of truth remains `README.md` + the `src/` tree. This is exactly what **#12** fixes; no new
  ticket (don't duplicate).
- **Refreshed advisory audit:** `npm audit --package-lock-only` now reports **29 vulns (2 critical, 3 high,
  22 moderate, 2 low)**, up from 9 at run 3. Critical/high headline unchanged (`simple-git` RCE +
  `@actions/github`→undici); the moderate jump is more advisories against the same pins. **#7 already covers
  the fix + CI gate** — no new ticket. (Couldn't add a clarifying comment to #7: integration is comment-blocked.)
- **Filed 1 new issue (≤2/run; quality over volume) — a newly-discovered, grounded correctness bug NOT in
  the prior queue and verified non-duplicate** (grepped #4/#5/#7/#8 bodies for `action.ts`/`tests-selected`/
  `setOutput`/`GITHUB_SHA`):
  - **#13** — P2/bug: the published Action mis-reports outputs and has dead input-propagation. `action.yml:28-32`
    declares `tests-selected`/`tests-run`, but `src/action.ts:51-52` hardcodes both to `'0'` (consumers gating
    on them always see 0); and `src/action.ts:24-29`'s `GITHUB_BASE_REF`/`GITHUB_SHA` guards only assign when
    the var is *already* set (no-op on non-PR events). Root cause: `SelectCommand.execute()` returns `void`
    (`select.ts:29`) so there's no real count to emit. Distinct from **#7** (only touches `action.ts:28` for the
    `@actions/github` dep) and **#8** (missing/committed `dist/` so the Action loads at all). Soft-depends on
    **#4** (counts are only *meaningful* once selection works) and coordinates with **#8** (rebuild `dist/`).
- **Skipped (deliberately):** dependency currency (`commander ^11`→15, `ts-morph ^21`→28 — low urgency, don't
  churn; `chalk` stays v4 = CJS) and per-test-case coverage granularity (depends on #4) — honoring ≤2/run +
  quality-over-volume. Both remain queued below. Did **not** file the lower-value `jest-runner.ts` unquoted-`execSync`
  observation (`utils/jest-runner.ts:49-54`) — theoretical, internal-only inputs; logged here for future watch.
- **Integration STILL create-only — re-verified live this run, three ways:** `gh label create P0` → **403**;
  `gh issue edit 4 --add-label bug` → **403 `addLabelsToLabelable`**; `gh issue comment 13` (the required
  step-6 `@cursor` handoff) → **403 `addComment`**. So labels can't be applied (repo also has **no** P0/P1/P2 or
  chore/test/feature labels — only the GitHub defaults) and the handoff comment can't be posted. **Workaround:**
  #13's intended labels are listed at the top of its body and the full `@cursor` handoff is **embedded in its
  body**. **Maintainer action needed:** to actually dispatch the engineering agents, comment
  `@cursor please implement this issue.` on #4, #5, #7, #8, #9, #10, #11, #12, #13 (suggested order honoring deps:
  **#4 → #5**, then **#7 → #8**, then **#9/#10**, then **#11** [after #10] / **#12**, then **#13** [after #4/#8]),
  and apply the intended labels listed atop each body. Tracking issue **#6 still can't be edited/commented by the
  bot**, so the live digest stays in this file. *(Note: after 6 runs, no `@cursor` handoff has ever been dispatchable
  by the bot and no PRs exist — the single biggest blocker to forward motion is a maintainer (or a token with
  comment scope) triggering the agent on #4 first.)*
- **Open tickets: 10** (#4, #5, #6 tracking, #7, #8, #9, #10, #11, #12, #13) — cap 15, **5 slots free**.

### 2026-06-17 (run 7 — 20:00 UTC cron)
- **Synced context (read this log first):** re-read `README.md`, the full `src/` tree (incl. `action.ts`,
  `commands/{learn,select}.ts`, `db/{database,postgres-database,queries,repository,interface}.ts`,
  `coverage/parser.ts`, `parser/function-parser.ts`, `git/diff-analyzer.ts`, `utils/{logger,jest-runner}.ts`),
  `package.json`, `jest.config.js`, `.github/workflows/*`, `action.yml`, the test harness
  (`__tests__/utils/test-db.ts`, `__tests__/component/learn.test.ts`), all open/closed issues, PRs, and the
  last 15 commits. **No PRs exist** (`gh pr list` empty, all states). The last 4 commits are doc-only
  ticket-manager logs (`bce1f4c` run 6 … `ccf3f48` run 2); **last product-code commit is still `2e0d7bc`** →
  no `src/`/`package.json` change since run 3, so **#4/#5/#7/#8/#9/#10/#11/#12/#13 all remain valid as
  written**. Current branch `cursor/buildlens-issue-backlog-872e` == `origin/main` (0 ahead/0 behind).
- **`REPO_OVERVIEW.md` + `AGENTS.md` still absent** (re-checked: `Read` → File not found) → the always-load
  step can't read them; source of truth stays `README.md` + `src/`. Exactly what **#12** fixes; no new ticket.
- **Refresh audit:** `npm audit --package-lock-only` returned no count this run (registry offline in VM) —
  keeping the **last-known 29 vulns (2 crit, 3 high, 22 mod, 2 low)** from run 6 for the digest; **#7 still
  covers the fix + CI gate**, no new ticket.
- **Filed 1 new issue (≤2/run; quality over volume) — a newly-traced, grounded correctness bug, verified
  non-duplicate** (grepped all open+closed issue bodies for `cross-product|every test|all functions|per-test|
  attribution|createLink|bipartite` → **no matches**):
  - **#14** — P1/bug(correctness): `learn` builds a **full test×function cross-product**. Outer loop is per
    test file (`learn.ts:112`) but the inner loop iterates **all** source files in Jest's *merged*
    `coverage-final.json` (`:115`) with the per-file `testBaseName` (`:113`) **unused/dead**; `:145-153` then
    links every test case × every covered function. So even after **#4** (identity) is fixed, `select` returns
    the **whole** suite (`getTestsForFunctions`, `repository.ts:106-113`) — no subset. Root cause acknowledged
    at `coverage/parser.ts:53-55`; masked by `learn.test.ts:28-42` (1×1×1 fixture, asserts only links>0). This
    is **distinct from #4** (lookup-miss → fallback) and **verified by #5** (E2E subset). It **reframes** the
    old queued "per-test-case coverage" *feature* into a present **correctness** bug (per-test-*file*
    attribution is the floor; per-*case* stays the roadmap enhancement).
- **Skipped (deliberately):** dependency currency (`commander`/`ts-morph` majors — low urgency, don't churn;
  `chalk` stays v4=CJS), per-*case* coverage granularity (future, post-#4/#14), and two P3 watch items now
  logged in the unfiled queue (`learn.ts:62-73` fragile test-name JSON parse → can silently create 0 links;
  `jest-runner.ts:49-54` unquoted `execSync`) — honoring ≤2/run + quality-over-volume. Did **not** file a 2nd
  issue: the remaining candidates are low-leverage/duplicative, and the backlog is healthy at 11 open.
- **Integration STILL create-only — re-verified live this run on #14:** `gh issue create --label bug` →
  label **silently dropped** (`gh issue view 14` shows `labels: []`); `gh issue comment 14` (the required
  step-6 `@cursor` handoff) → **403 `addComment` "Resource not accessible by integration"**. So labels can't
  be applied and the handoff comment can't be posted. **Workaround (as every prior run):** #14's intended
  labels are at the top of its body and the full `@cursor` handoff is **embedded in its body**. **Maintainer
  action needed:** to dispatch the engineering agents, comment `@cursor please implement this issue.` on
  #4, #14, #5, #7, #8, #9, #10, #11, #12, #13 (suggested order honoring deps: **#4 → #14 → #5**, then
  **#7 → #8**, then **#9/#10**, then **#11** [after #10] / **#12**, then **#13** [after #4/#8]), and apply the
  intended labels listed atop each body. Tracking issue **#6 still can't be edited/commented by the bot**, so
  the live digest stays in this file. *(After 7 runs: no `@cursor` handoff has ever been dispatchable by the
  bot and no PRs exist — the biggest blocker to forward motion remains a maintainer (or a comment-scoped
  token) triggering the agent on **#4** first.)*
- **Open tickets: 11** (#4, #5, #6 tracking, #7, #8, #9, #10, #11, #12, #13, #14) — cap 15, **4 slots free**.

### 2026-06-18 (run 8 — 20:00 UTC cron)
- **Synced context (read this log first):** re-read `README.md`, the `src/` tree (re-opened `commands/{learn,select}.ts`,
  `db/queries.ts`, `utils/jest-runner.ts` to re-verify the bugs directly from code, not just from this log),
  `package.json`, `jest.config.js`, all `.github/workflows/*` (`ci`, `test`, `publish`, `publish-action`,
  `example-usage`), all open/closed issues, PRs, and the last 15 commits. **No PRs exist** (`gh pr list --state all`
  empty). The last commits are doc-only ticket-manager logs (`9d63e5d` run 7 … `ccf3f48` run 2); **last product-code
  commit is still `2e0d7bc`** → no `src/`/`package.json` change since run 3, so **#4/#5/#7/#8/#9/#10/#11/#12/#13/#14
  all remain valid as written**. Branch `cursor/buildlens-issue-backlog-fd6c` == `origin/main` (0 ahead/0 behind).
- **Re-verified the two core bugs against live code** (so the backlog stays grounded): `learn.ts:112-159` still builds
  the **full test×function cross-product** with the per-file `testBaseName` (`:113`) **dead** and `:145-153` linking
  every test case × every covered function (**#14**); `learn.ts:131-143` still stores the Istanbul `normalizePath`
  absolute key + `fnCoverage.decl` lines + Istanbul name, while `select.ts:118-146` queries git-relative paths +
  ts-morph identity and `queries.ts:67-78` demands exact equality → empty lookup → fallback at `select.ts:159-171`
  (**#4**). `queries.ts:5-6,16-17` still `VARCHAR(1000/500)` (**#10**); all SQL parameterized + Postgres-specific
  (`SERIAL`/`ON CONFLICT`/`$n`/`= ANY($1::int[])`/`::text[]`) (**#11**). `package.json:20` lint is still `echo` and
  there's no `engines` (**#9/#8**); `jest.config.js` still has no `coverageThreshold` (**#8**); `ci.yml`/`test.yml`
  still duplicate (**#8**). `jest-runner.ts:49-54` unquoted `npx jest ${args.join(' ')}` confirmed — internal-only
  inputs, **P3 watch**, folds into #14; not filed.
- **`REPO_OVERVIEW.md` + `AGENTS.md` still absent** (re-checked: `Glob **/{REPO_OVERVIEW,AGENTS}.md` → 0 files) → the
  always-load step still can't read them; source of truth stays `README.md` + the `src/` tree. Exactly what **#12**
  fixes; no new ticket (don't duplicate). Discrepancy noted per the always-load instruction.
- **Refreshed advisory audit:** `npm audit --package-lock-only --omit=dev` = **7 production vulns (1 critical, 3 high,
  3 moderate)** — critical/high headline **unchanged** (`simple-git` RCE + `@actions/github`→`@actions/http-client`→
  `undici`). (Run 6's "29" was the total *including* dev deps; excluding dev, the production-facing set is 7.) **#7
  already covers the fix + CI audit gate** → no new ticket.
- **Integration STILL create-only — re-verified live this run two ways:** `gh issue edit 4 --add-label bug` → **403
  `addLabelsToLabelable`**; `gh issue comment 6` → **403 `addComment` "Resource not accessible by integration"**. Note:
  the repo's **default** labels (`bug`, `enhancement`, `documentation`, `good first issue`, …) now exist, but the token
  still can't attach them, and custom `P0/P1/P2` + `chore/test/feature` still don't exist and can't be created. So the
  user's step-6 `@cursor` handoff comment is **not possible with this token** — the handoff + intended labels stay
  **embedded in each issue body at creation** (as every prior run).
- **Decision — filed 0 NEW issues this run.** Honors *"≤2/run, quality over volume, skip if the backlog is healthy"*
  **and** the user's explicit *"≤15 max; don't create more if already open."* The backlog is healthy at **11 open**
  and covers **every** audit dimension (correctness #4/#14, E2E #5, security #7, CI/release #8, lint/code-quality #9,
  DB hygiene #10, SQLite #11, docs #12, Action outputs #13); code is unchanged since run 3; and the only unfiled
  candidates are low-leverage (dependency currency — don't churn; `learn.ts:62-73` fragile test-name JSON parse —
  folds into #14; `jest-runner.ts` unquoted `execSync` — theoretical/internal). Filing any of them would be busywork.
  4 slots remain free under the cap.
- **Bottleneck unchanged after 8 runs:** no `@cursor` handoff has ever been dispatchable by the bot and **no PRs
  exist**. The single highest-leverage action is a **maintainer (or a comment-scoped token)** commenting
  `@cursor please implement this issue.` on **#4 first**, then **#14 → #5**, then **#7 → #8**, then **#9/#10**, then
  **#11** [after #10] / **#12**, then **#13** [after #4/#8] — and applying the intended labels listed atop each body.
- **Open tickets: 11** (#4, #5, #6 tracking, #7, #8, #9, #10, #11, #12, #13, #14) — cap 15, **4 slots free**.
  Unchanged from run 7.

### 2026-06-19 (run 9 — 20:00 UTC cron)
- **Synced context (read this log first):** re-read `README.md`, then re-opened and re-verified the live
  code directly (not just from this log): `commands/{learn,select}.ts`, `db/queries.ts`, `action.ts`,
  `git/diff-analyzer.ts`, `utils/jest-runner.ts`, `.github/workflows/{ci,test}.yml`, `jest.config.js`,
  `package.json`. Reviewed all open/closed issues, PRs, and the last 15 commits. **No PRs exist**
  (`gh pr list --state all` empty). The last 6 commits are doc-only ticket-manager logs (`49d1d8c` run 8 …
  `ccf3f48` run 2); **last product-code commit is still `2e0d7bc`** (`git diff --stat 2e0d7bc HEAD` = only
  `docs/TICKET_MANAGER_LOG.md`) → no `src/`/`package.json` change since run 3, so
  **#4/#5/#7/#8/#9/#10/#11/#12/#13/#14 all remain valid as written**. Branch
  `cursor/buildlens-issue-backlog-574e` == `origin/main` (0 ahead / 0 behind).
- **Re-verified the two core bugs against live code:** `learn.ts:112-159` still builds the full
  test×function **cross-product** (outer loop per test file `:112`, per-file `testBaseName` `:113` still
  **dead**, inner loop over **all** merged-coverage files `:115`, `createLink` for every test×func
  `:145-153`) → **#14**; `learn.ts:137-143` stores the Istanbul `normalizePath` absolute key + bare name +
  `decl` lines while `select.ts:118-146` queries git-relative paths + ts-morph identity and
  `queries.ts:67-78` demands exact equality → empty lookup → fallback at `select.ts:159-171` → **#4**.
  Also re-confirmed: `queries.ts:5-6,16-17` still `VARCHAR(1000/500)` (**#10**); SQL all parameterized but
  Postgres-specific (`SERIAL`/`ON CONFLICT`/`$n`/`= ANY($1::text[])`/`::int[]`) (**#11**); `action.ts:51-52`
  hardcodes `tests-selected`/`tests-run` to `'0'` and `:24-29` env guards are dead (**#13**); `ci.yml:60`
  lint is still `npm run lint || echo …` no-op + `ci.yml`/`test.yml` duplicate + single Node 20 × `postgres:15`
  (**#8/#9**); `jest.config.js` still has **no** `coverageThreshold` (**#8**); `diff-analyzer.ts:60,88` raw
  `console.error` + empty catches `:111-112,131-132,139-140,149-150` (**#9**); `jest-runner.ts:49` unquoted
  `npx jest ${args.join(' ')}` (P3 watch, folds into #14).
- **`REPO_OVERVIEW.md` + `AGENTS.md` still absent** (re-checked: `Glob **/{REPO_OVERVIEW,AGENTS}.md` → 0
  files; `Read` → File not found). The always-load step can't read them; source of truth stays `README.md` +
  the `src/` tree. Exactly what **#12** fixes — no new ticket. Discrepancy noted per the always-load instruction.
- **Refreshed advisory audit:** `npm audit --package-lock-only --omit=dev` = **7 production vulns
  (1 critical, 3 high, 3 moderate)** — headline **unchanged** vs run 8 (`simple-git` RCE +
  `@actions/github`→`@actions/http-client`→`undici`; fix = bump `@actions/github`→9.1.1 [breaking] +
  `simple-git`→`^3.36.0`). **#7 already covers the fix + CI audit gate** → no new ticket.
- **Integration STILL create-only — re-verified live this run THREE ways, incl. a new REST probe:**
  `gh api -X POST .../issues/4/comments` → **REST 403**; `gh issue comment 6` → **GraphQL `addComment` 403**;
  `gh issue edit 4 --add-label bug` → **`addLabelsToLabelable` 403** (all "Resource not accessible by
  integration"). The REST probe is new evidence that the block is **token-scope**, not a `gh` quirk — so
  **there is no token-side workaround** for step 6's `@cursor` handoff comment. Confirmed the handoff +
  intended labels are already **embedded in each issue body** at creation (verified on #4 and #14:
  body carries "Intended labels: …", a maintainer note about the create-only token, and the full
  `@cursor please implement this issue.` block with read-`REPO_OVERVIEW`/`AGENTS`, acceptance criteria,
  validation plan, house standards, and "open a PR that passes CI").
- **Decision — filed 0 NEW issues this run.** Honors *"≤2/run, quality over volume, skip if the backlog is
  healthy"* **and** the user's explicit *"15 tickets max; don't create more if already open."* The backlog is
  healthy at **11 open** and covers **every** audit dimension (correctness #4/#14, E2E #5, security #7,
  CI/release #8, lint/code-quality #9, DB hygiene #10, SQLite #11, docs #12, Action outputs #13); product code
  is **unchanged since run 3**; and every remaining unfiled candidate is low-leverage (dependency currency —
  don't churn; `learn.ts:62-73` fragile test-name JSON parse — folds into #14; `jest-runner.ts:49` unquoted
  `execSync` — theoretical/internal). Filing any would be busywork. 4 slots remain free under the cap.
- **Bottleneck unchanged after 9 runs:** no `@cursor` handoff has ever been dispatchable by the bot and
  **no PRs exist**. The single highest-leverage action remains a **maintainer (or a comment-scoped token)**
  commenting `@cursor please implement this issue.` on **#4 first**, then **#14 → #5**, then **#7 → #8**, then
  **#9/#10**, then **#11** [after #10] / **#12**, then **#13** [after #4/#8] — and applying the intended labels
  listed atop each body.
- **Open tickets: 11** (#4, #5, #6 tracking, #7, #8, #9, #10, #11, #12, #13, #14) — cap 15, **4 slots free**.
  Unchanged from runs 7–8.
