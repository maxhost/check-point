# Existing harness assessment

Inventory of the coding-agent harness this repository already carries (as of 2026-10-06,
commit `7d92027`). Nothing here was removed or disabled during GLaDOS onboarding. The
classification only says which parts are project knowledge and which parts overlap with
orchestration GLaDOS owns (worktrees, lanes, verification, independent review, acceptance).

Sources: `CLAUDE.md`, `AGENTS.md`, `.claude/` (settings, hooks, agents, skills),
`.githooks/pre-push`, `tools/`, `docs/AGENT-WORKFLOW.md`, `docs/TRABAJO-EN-PARALELO.md`,
`.github/workflows/`.

## Shape of the current harness

- Two agents work on `main` in parallel: Claude (API, server, packages, tooling) and
  GPT/Codex (screens, CSS, e2e). The boundary is a written HTTP contract (ADR 0114, ADR 0123).
- Work levels N0/N1/N2 (`CLAUDE.md` §Niveles, spec 0151): N2 (money, auth/sessions,
  cross-merchant isolation, migrations, DTOs with internal data) requires a closed spec,
  one `implementador` subagent and one `revisor` subagent that runs mutations.
- Every design decision produces an ADR (`docs/adr/`, 121 files) and a row in
  `docs/INDEX.md`; features get specs (`docs/specs/`, 188 files, templates
  `TEMPLATE.md` / `TEMPLATE-CHICA.md`).
- Session state lives in `docs/estado/claude.md` and `docs/estado/gpt.md`; old blocks in
  `docs/estado/claude-historico.md`.
- In the 30 days before onboarding, 564 of 840 commits were `docs:` commits.

## KEEP — project-specific knowledge and tools

Remain useful regardless of who orchestrates.

| Item | Why it is project knowledge |
|---|---|
| `tools/verify.ts` (`pnpm verify`) | Change-aware gate planner: docs-only → `format:check`; UI → e2e; server/`packages/domain` → related Neon suites; schema/SQL/config/lockfile → full Neon. Encodes which suites matter for which paths. |
| `tools/neon-test.sh` | The only safe way to run `*.neon.integration.test.ts`: refuses if the CI branch host equals `DATABASE_URL` (production), migrates the CI branch, sets `NEON_INTEGRATION_ISOLATED=true`. Without it those suites silently skip. |
| `.github/workflows/ci.yml` | Full gate on push to `main`; fails hard if Neon secrets are missing (spec 0062). |
| `tools/ui-guard.ts` (+ `ui-guard-tsx.ts`, `ui-guard-counts.ts`) | Ratchet over `apps/merchant/src` UI rules (no native elements, raw palette, arbitrary values…; spec 0164, `docs/design-system.md`). |
| `tools/check-numbers.ts` | Detects duplicate spec/ADR numbers. Only needed while specs/ADRs are numbered in parallel. |
| `tools/app-boundary.test.ts`, `tools/vi-mock-targets.test.ts`, `tools/node-version-pins.test.ts` | Repo invariants enforced as tests (run by `pnpm test`). |
| `tools/wipe-database.sql` | Destructive runbook; explicitly "delivered, not executed" without owner authorization. |
| `tools/google-wallet-callback.ts` | Operational script for the Google Wallet class callback (spec 0107). |
| `.claude/skills/gotchas-del-repo/SKILL.md` | Measured domain/infra gotchas: raw SQL with drizzle, Stripe webhooks/SDK, Neon migrations to prod, Vercel Hobby cron limits, pnpm offline, better-auth, wallet/push, image formats. High value for any agent. |
| `docs/adr/`, `docs/specs/`, `docs/INDEX.md` | Source of truth for decisions and HTTP contracts. Preserved as-is. |
| `docs/LECCIONES.md` | Dated incidents behind each rule. |
| Rules in `CLAUDE.md` §Codigo / §Gotchas | Never run tests against `DATABASE_URL` (prod); never serialize R2 `*ObjectKey` to the browser (DTO with public `*Path`); delete old UI when refactoring; don't edit tests to get green; never print `.env` values. |
| `apps/merchant/COPY.md` | Copy conventions (tuteo, no voseo). |
| `docs/design-system.md`, `docs/sistema-visual-checkpass.md`, `docs/wallet/*`, `docs/notificaciones/*` | Product/design/domain references. |
| PostToolUse hooks `format-on-write.sh`, `invisible-test.sh`, `no-control-bytes.sh` | Cheap, mechanical, project-specific checks (e.g. a `*.test.tsx` that vitest will never run). |
| `.githooks/pre-push` | Blocks pushing red to `main`. |
| `.claude/hooks/stale-validator.sh` (called from `verify.sh`) | Deletes Next's generated `apps/merchant/.next/types/validator.ts` when it references deleted routes, which otherwise breaks `tsc` with a phantom error (spec 0064 §4.b). Relevant to any typecheck run in a worktree that has an old `.next/`. |
| `.claude/hooks/foreign-staged.sh` | Blocks a commit that would sweep in files another agent staged in the same tree. Project-specific because of the shared working tree. |

## POTENTIALLY DUPLICATED BY GLADOS

Identified only; not removed.

| Item | Overlap |
|---|---|
| `.claude/agents/implementador.md` + `.claude/agents/revisor.md`, `docs/AGENT-WORKFLOW.md` | Planner → implementer → independent reviewer loop with PASS/FAIL. GLaDOS has its own lanes and conditional independent reviewer. The mutation protocol inside them is project-specific and could survive as a skill. |
| `CLAUDE.md` §Niveles (N0/N1/N2) | Risk-tiering of work. Maps closely to GLaDOS lanes (L0–L3). |
| `.claude/hooks/verify.sh` (Stop) | Runs typecheck + lint + test when the code fingerprint changes. GLaDOS runs deterministic verification after the agent finishes. |
| `tools/worktree-new.sh` | Creates a worktree with its own offline-installed `node_modules`. GLaDOS creates task worktrees. The offline-install knowledge is project-specific. |
| `docs/estado/claude.md`, `docs/estado/gpt.md`, `.claude/skills/handoff/`, hooks `state-uncommitted-lie.sh`, `tasks-fresh.sh`, `pre-compact.sh`, `context-budget.sh` | Session state, handoff and context management. GLaDOS persists task/run state itself. |
| `.claude/hooks/no-mutations-left.sh` | Guards leftover mutation-testing edits from the reviewer loop. |
| `.claude/skills/protocolo-de-verificacion/SKILL.md` | Review budget, cut-off conditions and evidence rules. Partly generic acceptance workflow, partly project lessons. |
| `docs/TRABAJO-EN-PARALELO.md`, `AGENTS.md` start routine, `tools/ci-status.ts` | Multi-agent coordination on `main` (pull/rebase, zones, spec-number reservation, CI status at start). GLaDOS owns git integration and task isolation. |
| Requirement "spec + ADR + INDEX row for every change" | Generic planning and acceptance ceremony. The owner has said simple changes will drop spec/ADR. Not decided here. |

## UNCERTAIN

| Item | Why uncertain |
|---|---|
| `.claude/glados-arnes.json` | Manifest of a previous GLaDOS harness template ("plantilla 1", `pm: npm`) with file hashes. Its relation to the current GLaDOS app is unclear, and its params do not match the repo (`pnpm`). |
| `.claude/hooks/file-size.sh`, `claude-md-size.sh` | Size limits. Partly harness hygiene, partly code-style policy. |
| `tools/zone-audit.ts` (SessionStart) | Detects non-Claude commits to Claude-owned files. Only meaningful while the Claude/GPT zone split exists. |
| `.claude/skills/delete-user`, `qa-cupon-valido`, `qa-cupones-prueba` | Marked TEMPORAL (owner QA since 2026-10-04). They mutate PRODUCTION data of test merchants through Neon MCP. Operational runbooks, not orchestration, but their lifetime is open. |
| `tools/claude-md-coverage.sh` | One-off proof for a past `CLAUDE.md` prune (spec 0066). |
| `docs/TASKS.md` (7.8k lines), `docs/archivo/`, `docs/handoff-*.md` | Historical working notes. Unclear what is still authoritative. |
