# BuildLens Ticket Manager — Current State & Task Flow

> **Read this first** at the start of every run (then `docs/TICKET_MANAGER_LOG.md` for full
> history, and `REPO_OVERVIEW.md` + `AGENTS.md` on `origin/cursor/setup-dev-environment-894a`).
> This file is a concise snapshot, **overwritten every run** and pushed to `main`.

**Last run:** 98 — 2026-10-28 (daily cron) · **Filed:** 0 · **Backlog:** 11 / 15 open (healthy, 4 free)
**Net change vs run 97:** none. Product code, issues, PRs, context docs all identical; dependency
audit **held at 8** prod vulns (the run-93 13 → 8 `ts-morph`-chain drop is still holding).

## Hard constraints
- **≤ 15 OPEN issues total**; do **not** create more if we already have open ones (11 open → 4 free).
- **≤ 2 new work issues/run**; skip the run if the backlog is healthy (don't invent busywork).
- **Issues only** — never open PRs or change product code. The one allowed write is this docs
  progress log, committed and **pushed to `main` every run**.

## ⛔ Blocker (unchanged since run 10)
There is **no sanctioned GitHub issue-write capability** in this environment:
- `gh` is **READ-ONLY** — `gh api user` → `403 Resource not accessible by integration`; repo perms
  `{admin, maintain, pull, push, triage} = all false` (repo is public).
- **No MCP issue-write tool** — only `open_git_pr` (PR-scoped) + `automation_memory` (memory-scoped);
  `cursor-cloud` is read-only; Linear tools are read-only `subscribe_*` (and `cursor:CreateGoal` is
  not GitHub). Re-verified run 98 via `GetDynamicTools` pattern scan across all servers.

→ Cannot **create** issues, **comment** (so step-6 `@cursor` handoff is impossible), or **apply labels**.
Across 98 runs, 0 issues have been filed. Only a **maintainer** (or a comment-scoped token) can act.

## Current OPEN backlog (11; all show 0 labels / 0 comments — can't be applied)
| # | Priority / type | Title |
|---|-----------------|-------|
| 4 | P0 / bug | Fix path & function-identity mismatch so `select` matches stored functions (not full fallback) |
| 14 | P1 / bug (correctness) | Fix `learn` cross-product over-linking (each test → only functions it executed) |
| 5 | P1 / test | Add E2E test proving `select` runs a SUBSET of tests (not a full fallback) |
| 7 | P1 / bug (security) | Patch critical/high dep vulns (`simple-git` RCE, `@actions/github`/undici) + npm audit CI gate |
| 8 | P1 / chore | Harden CI/release: commit & verify `dist/`, Node×PG matrix, coverage gate, runtime pin |
| 9 | P1 / chore (+good-first) | Real ESLint+Prettier+EditorConfig lint gate; route output via `Logger`; stop swallowing errors |
| 10 | P1 / chore (db) | DB schema hygiene: `TEXT` path/name cols, SSL for managed PG, versioned migrations |
| 11 | P2 / feature | Add a SQLite `DatabaseAdapter` for no-Postgres local mode (roadmap) |
| 12 | P2 / docs (+good-first) | Add `REPO_OVERVIEW.md` + `AGENTS.md` to `main`; fix stale README "Project Structure" |
| 13 | P2 / bug | Fix Action outputs: real `tests-selected`/`tests-run` + propagate `base-ref`/sha |
| 6 | tracking | [Tracking] BuildLens backlog — top priorities & daily digest (digest lives in the LOG) |

Closed: #1, #2, #3 (superseded by #4, #5, #6).

## Handoff order (a maintainer must comment `@cursor please implement this issue.` manually)
`#4 → #14 → #5` (core promise) · `#7 → #8` · `#9 / #10` · `#11` (after #10) `/ #12` · `#13` (after #4/#8).

## Queued ready-to-file specs (can't file — no write path; full specs in the LOG)
1. **[P1]** `select` ignores the working tree (committed diff only) — `git/diff-analyzer.ts:101-118`
   `getCurrentRef()` resolves only `GITHUB_SHA` / `--abbrev-ref HEAD` / `HEAD`; breaks README local-dev flow.
2. **[P1]** no `prune`/`stats`/cleanup CLI command — `cli.ts` registers only `learn:36`/`select:67`/`init:101`;
   `functions` rows accumulate by `commit_hash` with no cleanup.
3. **[P2]** leaked test-DB pool in global Jest setup — `src/__tests__/setup.ts:5` opens a `TestDatabase`
   (eager pool) in `beforeAll` vs a different instance torn down `:15` (the AGENTS.md "worker failed to
   exit" teardown quirk). Wired via `jest.config.js:13` `setupFilesAfterEnv`.

## Product & audit state
- Product code **frozen at `2e0d7bc`** — no PRs ever; all later commits are docs-only.
- `npm audit --omit=dev` = **8 vuln pkgs** `{crit:1, high:5, mod:2}` (run 98; held from run 93's drop
  off a stable 13 across runs 73–92). Still flagged: `simple-git` CRIT (direct, RCE) · `undici`,
  `@fastify/busboy`, `brace-expansion`, `minimatch`, `picomatch` HIGH · `@actions/github` (direct),
  `@actions/http-client` MOD. **Cleared** (advisory-level, lock unchanged): the `ts-morph` chain —
  `ts-morph`, `@ts-morph/common`, `fast-glob`, `micromatch`, `braces`. **All remaining 8 covered by #7**
  → not a new ticket. The `ts-morph` bump reverts to a *cosmetic* dep-currency item (no longer security).
- `engines` still **undefined** + no `.nvmrc` (= #8); CI tests only Node 20 / `postgres:15`; `ci.yml`
  and `test.yml` duplicated; `lint` script is a stub (= #8/#9).

## Known doc staleness (note each run)
- `REPO_OVERVIEW.md` + `AGENTS.md` exist only on `origin/cursor/setup-dev-environment-894a`, **not on
  `main`** (= unmerged #12).
- `REPO_OVERVIEW.md` §7 lists `coverage/parser.ts#parseTestNames` as dead, but it **is used**
  (`commands/learn.ts:69` → `coverage/parser.ts:124`). Only `extractFunctionMappings`
  (`coverage/parser.ts:57`, 0 callers) is truly dead.

## Environment caveats (cron VM)
- No PostgreSQL and no Docker here → a real DB-backed `learn → select` E2E repro is **not runnable** in
  this VM; `node_modules` is absent each run. The npm registry **is** reachable, so `npm audit` is cheap.
