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

## Verified dependency-security finding (grounds #7; re-run `npm audit --package-lock-only`)
`npm audit` = **9 vulns (2 critical, 3 high, 3 moderate, 1 low)**. Headline:
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

## Current OPEN backlog (6 work + 1 tracking = 7; cap 15)
| # | Title | Intended priority/type | Status |
|---|-------|------------------------|--------|
| 4 | Fix path & function-identity mismatch so `select` matches stored functions | P0 / bug | open, needs `@cursor` trigger |
| 7 | Patch critical/high dep vulns (`simple-git` RCE, `@actions/github`/undici) + npm audit CI gate | P1 / bug (security) | open, needs `@cursor` trigger |
| 8 | Harden CI/release: commit & verify `dist/` Action bundle, Node×PG matrix, coverage gate, runtime pin | P1 / chore | open, needs `@cursor` trigger |
| 5 | Add E2E test proving `select` runs a SUBSET (not a full fallback) | P1 / test | open, needs `@cursor` trigger |
| 9 | Real ESLint+Prettier+EditorConfig lint gate; Logger for output; no swallowed `catch` | P1 / chore (+good-first) | **NEW (run 4)**, needs `@cursor` trigger |
| 10 | DB schema hygiene: `TEXT` cols, SSL for managed PG, versioned migrations | P1 / chore (db) | **NEW (run 4)**, needs `@cursor` trigger |
| 6 | [Tracking] BuildLens backlog — top priorities & daily digest | tracking | open (digest lives here; bot can't edit it) |

## Top 5 priorities (all filed as of run 4)
1. **#4** — P0/bug: fix path/identity mismatch so `select` runs a real subset (core promise). *(filed)*
2. **#7** — P1/security: `simple-git` critical RCE + `@actions/github`/undici + CI audit gate. *(filed)*
3. **#8** — P1/chore: CI/release hardening — commit/verify `dist/`, Node×PG matrix, coverage gate,
   `engines`+`.nvmrc`, dedupe `ci.yml`/`test.yml`. *(filed)*
4. **#5** — P1/test: E2E proof that `select` runs a SUBSET (not a full fallback). *(filed)*
5. **#9** — P1/chore: real lint gate (ESLint/Prettier/EditorConfig) + Logger for output + de-swallow
   `catch` blocks in `diff-analyzer.ts`. *(filed run 4)* — closely followed by **#10** (DB hygiene).

### Unfiled backlog queue (next candidates, in priority order)
- **P2/feature** — SQLite local-mode `DatabaseAdapter` (README roadmap line 259) via the
  `DatabaseAdapter`/`DatabaseFactory` pattern (`src/db/interface.ts`, `src/db/database.ts`). **Now
  unblocked by #10's migration runner.** Larger surface; file when budget allows.
- **P2/chore** — dependency currency (`commander ^11`→15, `ts-morph ^21`→28; `package.json:44,47`) —
  low urgency, don't churn (`chalk` stays v4 = CJS).
- **P3/docs** — add `REPO_OVERVIEW.md` + `AGENTS.md`; fix stale README "Project Structure". (Process
  files the handoff references but that don't exist. Low risk; consider a `documentation` ticket — but
  this is borderline busywork, so only file if a run is otherwise empty.)

## Dedup keywords to search each run
`path`, `fallback`, `select`, `subset`, `e2e`, `lint`, `eslint`, `prettier`, `engines`, `nvmrc`,
`matrix`, `sqlite`, `migration`, `varchar`, `ssl`, `dist artifact`, `REPO_OVERVIEW`, `AGENTS`.

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
