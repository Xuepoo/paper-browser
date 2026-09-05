---
name: use-carryctx
description: >
  Coordinate multi-step coding work across agents with CarryCtx, the
  local-first project context engine. Load once per main session when planning
  or coordinating engineering work: plan as the commander, assign durable tasks
  with dependencies, teams, and scopes, dispatch implementation to subagents in
  isolated Git worktrees, and accept results by reading state back from
  carryctx instead of trusting subagent self-reports.
license: MIT
metadata:
  author: Xuepoo
  version: "1.1.0"
---

# Use CarryCtx

CarryCtx is a local-first project context engine: durable tasks, sessions,
checkpoints, decisions, teams, and handoffs stored in SQLite under the Git common
dir (`<git-common-dir>/carryctx/state.sqlite`), shared by every agent and linked
worktree on the repository. It is a **management and persistence layer, not an
orchestration runtime** — spawning processes, retries, and concurrency limits
belong to you and your harness. This skill is loaded once per main session.

## When to Apply

Apply at main-session start for any multi-step engineering effort, especially:

> **Prerequisite — run inside the target Git repository.** Every carryctx
> command must execute from within that project's repo clone (state lives at
> `<git-common-dir>/carryctx/state.sqlite`). From a non-repo directory every
> command fails with `GIT_ERROR` exit 4. In multi-repo workspaces, `cd` into
> each product repository first — state is per-repo, never workspace-wide.

- Planning and splitting an effort into tasks with dependencies and owners.
- Dispatching implementation to subagents while keeping your own context lean.
- Running parallel work streams that need isolation (Git worktrees).
- Continuing prior work: restoring context, accepting handoffs, finding past
  decisions and checkpoints by content.

## Commander Doctrine

You (the main-session agent) are the **commander**. Subagents implement; you do
not. The loop:

1. **Plan** — decompose the goal into tasks with explicit dependencies and
   scopes. Small one-line fixes stay inline; batching tightly-coupled tasks to
   one subagent beats fan-out.
2. **Assign** — encode the plan durably in carryctx so nothing depends on your
   conversation surviving: `task create` with `--depends-on`, `--team`,
   `--required-role`, and `task scope add` for conflict detection.
3. **Dispatch** — give each subagent exactly its slice: a task ID plus
   `carryctx team context <team> --agent-for <sub>` output. Prefer running each
   subagent in its own worktree: `carryctx worktree create <TASK_REF>` creates
   `<path>/.worktrees/<task-id>` on a `carryctx/<task-id>` branch.
4. **Accept & verify** — never trust a subagent's self-report. Read state back:
   `team status`, `team context`, `task show`, `search`. Verify the diff and run
   the tests yourself before `task complete`.

Supporting rules:

- **Record durably because subagents die silently.** A process killed before its
  final checkpoint leaves nothing behind. Require subagents to append
  `progress todo/note/block/risk`, `checkpoint`, and `decision add` records as
  they work — `team context` can only rebuild what was written down.
- **Keep your own context lean.** Outline before reading files, prefer compact
  output (`--compact`, `--fields display_id,status,title`), re-read
  `team status` between rounds instead of holding state in conversation.
- **Close what you open.** A task left `in_progress` after its agent stops is
  indistinguishable from active work; end sessions cleanly, checkpoint before
  merging branches away.

Bootstrap once, then operate the loop:

```bash
carryctx init                                            # first time only
carryctx agent register --name "$(whoami)" --provider opencode --kind commander
carryctx session start
carryctx resume --compact                                # restore prior context

carryctx task create --title "Backend API" --team core --required-role backend
carryctx task create --title "Login form" --depends-on CTX-0002
carryctx worktree create CTX-0002                        # isolate implementation
```

## Core Commands

All flags verified against carryctx 0.7.0. Writes require identity: pass
`--agent <name>` (or export `CARRYCTX_AGENT`) — listings never filter by it
implicitly.

```bash
# Plan & track
carryctx task create --title "..." [--priority high] [--team core] \
    [--required-role backend] [--depends-on CTX-0001]
carryctx task show CTX-0002                              # full detail + records
carryctx task claim CTX-0002 && carryctx task start CTX-0002
carryctx task complete CTX-0002                          # only after verification

# Read team state back (never trust self-reports)
carryctx team status [core]
carryctx team context [core] [--agent-for sub-1] [--task CTX-0002]

# Durable breadcrumbs written by subagents as they work
carryctx progress note|block|risk "..." --task CTX-0002
carryctx checkpoint --done "..." --remaining "..." --task CTX-0002

# Isolation & continuity
carryctx worktree create CTX-0002        # .worktrees/<task-id>, branch carryctx/<id>
carryctx handoff create --agent cmd-1 --target sub-1 --task CTX-0002 --summary "..."
```

Everything else — dependency kinds (`strong`/`informational`), file scopes and
conflict detection, task statuses, blockers, decisions, search, event audit,
presets/rules/personas in `.carryctx/`, error recovery — is documented in the
references below. Consult them when operating in that area; do not guess flags.

## References

Read the focused guide when operating in that area:

- [references/command-reference.md](references/command-reference.md) — full
  command table for all subcommands and flags (verified against 0.7.0).
- [references/task-lifecycle.md](references/task-lifecycle.md) — states,
  transitions, dependency gating, scopes, team metadata.
- [references/team-coordination.md](references/team-coordination.md) — team
  semantics, read-only projections, dispatch patterns, recording discipline.
- [references/sessions-and-checkpoints.md](references/sessions-and-checkpoints.md)
  — session lifecycle, stale detection, checkpoint policy.
- [references/handoffs.md](references/handoffs.md) — writing and taking over
  handoffs, routing documents, accept/reject/close.
- [references/presets-rules-personas.md](references/presets-rules-personas.md) —
  installing SOPs, domain rules, and personas into `.carryctx/`.
- [references/troubleshooting.md](references/troubleshooting.md) — error codes,
  recovery, diagnostics.
