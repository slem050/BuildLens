# BuildLens — Ticket Manager Log & Backlog State

> **Read this file at the start of every Ticket Manager run.** It is the persistent
> progress/flow record (the automation also keeps a private memory, but this file is the
> human-readable source of truth on `main`). Update it and push to `main` every run.

## What the Ticket Manager does
Maintains a healthy, deduplicated, prioritized GitHub issue backlog for BuildLens (a TS/Node CLI
for function-level Test Impact Analysis on Jest, backed by PostgreSQL). It **only manages issues** —
never opens PRs or changes product code.

## Standing constraints
- **Hard cap: ≤ 15 OPEN tickets total.** Do not create more if already at the cap.
- **≤ 2 new *work* issues per run** (quality over volume). Skip a run if the backlog is healthy.
- Keep **one** pinned tracking/digest issue updated each run (currently **#6**) — don't open new ones.
- Bias order: (1) correctness bugs that break the core promise, (2) roadmap gaps, (3) hygiene.

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

## Current OPEN backlog
| # | Title | Intended priority/type | Status |
|---|-------|------------------------|--------|
| 4 | Fix path & function-identity mismatch so `select` matches stored functions | P0 / bug | open, needs `@cursor` trigger |
| 5 | Add E2E test proving `select` runs a SUBSET (not a full fallback) | P1 / test | open, needs `@cursor` trigger |
| 6 | [Tracking] BuildLens backlog — top priorities & daily digest | tracking | open (keep updated) |

## Top 5 priorities
1. **#4** — P0/bug: fix path/identity mismatch (core promise). *(filed)*
2. **#5** — P1/test: E2E subset proof. *(filed)*
3. **P1/chore** — real lint gate + ESLint/Prettier/EditorConfig; fix empty `catch` blocks in
   `src/git/diff-analyzer.ts`. *(not yet filed)*
4. **P1/chore** — `engines` + `.nvmrc`; Node×PG **CI matrix**; dedupe `ci.yml`/`test.yml`;
   coverage threshold that fails the build; rebuild/verify the published `dist/` Action artifact.
   *(not yet filed)*
5. **P2/feature** — SQLite local-mode `DatabaseAdapter` (README roadmap) + DB hygiene
   (`VARCHAR(1000/500)`→`TEXT` for paths/names, SSL for managed PG, versioned migrations).
   *(not yet filed)*

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

## Run log
### 2026-06-13
- Maintainer cleared issues #1–#3 (closed) and asked to recreate them.
- **Recreated** as **#4** (core path/identity bug), **#5** (E2E subset test), **#6** (tracking).
- Could **not** apply labels or post `@cursor` handoff comments (integration is create-only) —
  intended labels + handoff are embedded in issue bodies / this log instead.
- **Skipped** filing priorities 3–5 (kept within the ≤2-new/run budget; well under the 15 cap).
- Open tickets: 3 (cap 15).
