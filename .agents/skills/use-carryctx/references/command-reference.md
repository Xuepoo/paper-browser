# Command Reference

Full command surface, verified against carryctx 0.7.0. Writes require identity:
pass `--agent <name>` (or export `CARRYCTX_AGENT`) — listings never filter by it
implicitly.

| Action          | Command                                                                                                                | Notes                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Initialize      | `carryctx init`                                                                                                        | Config `.carryctx/config.toml`; state in Git common dir                   |
| Register agent  | `carryctx agent register --name sub-1 --provider opencode --kind subagent --role backend`                              | `--kind`: `commander` \| `subagent`                                       |
| Bootstrap       | `carryctx session start` then `carryctx resume --compact`                                                              | One ACTIVE session per agent; `--reuse` keeps the live one                |
| Snapshot        | `carryctx status --compact [--sessions]`                                                                               | Branch, HEAD, active tasks                                                |
| Create task     | `carryctx task create --title "..." [--priority high] [--team core] [--required-role backend] [--depends-on CTX-0001]` | Planned until strong deps complete                                        |
| List tasks      | `carryctx task list [--status ready] [--mine] [--limit N]`                                                             | Statuses: planned ready in_progress blocked in_review completed cancelled |
| Claim / start   | `carryctx task claim CTX-0001` then `carryctx task start CTX-0001`                                                     | Multiple in-progress tasks allowed                                        |
| Dependency      | `carryctx task depend CTX-0002 --on CTX-0001 [--kind informational]`                                                   | `strong` gates claim/start; `informational` records only                  |
| File scope      | `carryctx task scope add CTX-0002 src/api/`; `scope list`; `scope conflicts CTX-0002`                                  | Detect overlapping edits before fan-out                                   |
| Task ↔ team     | `carryctx task team set CTX-0002 --team core` (`unset` to clear)                                                       | Bookkeeping only; never touches lifecycle                                 |
| Block / unblock | `carryctx task block CTX-0002 --reason "..."` / `unblock CTX-0002`                                                     | Visible in `team context`                                                 |
| Complete        | `carryctx task complete CTX-0002`                                                                                      | After you verified the result                                             |
| Progress item   | `carryctx progress todo\|note\|block\|risk "..." --task CTX-0002`                                                      | Durable breadcrumbs                                                       |
| Resolve item    | `carryctx progress complete PX-0001`                                                                                   |                                                                           |
| Checkpoint      | `carryctx checkpoint --done "..." --remaining "..." --task CTX-0002`                                                   | Immutable snapshot; also `--blocker/--risk/--note`                        |
| Decision        | `carryctx decision add --title "..." --rationale "..." --task CTX-0002`                                                | `--rationale` is the searchable why                                       |
| Create team     | `carryctx team create --name core --commander cmd-1`                                                                   | Commander auto-joins as member                                            |
| Membership      | `carryctx team member add core --agent sub-1 --role backend`                                                           | `team commander set core --agent X` / `--clear`                           |
| Team status     | `carryctx team status [core]`                                                                                          | Read-only: members, sessions, active tasks                                |
| Team context    | `carryctx team context [core] [--agent-for sub-1] [--task CTX-0002]`                                                   | Read-only rebuild from durable records                                    |
| Worktree create | `carryctx worktree create CTX-0002`                                                                                    | `.worktrees/<task-id>` on branch `carryctx/<task-id>`                     |
| Worktree remove | `carryctx worktree remove <TASK_REF\|PATH> [--force]`                                                                  | `--force` discards dirty worktrees; `worktree list` for refs              |
| Handoff create  | `carryctx handoff create --agent cmd-1 --target sub-1 --task CTX-0002 --summary "..."`                                 | Needs explicit `--agent` once multiple agents are registered              |
| Handoff inbox   | `carryctx handoff list` then `accept HO-0001 [--claim-task]`                                                           | Default shows pending only; `--all`/`--status` widen                      |
| Search history  | `carryctx search "<query>" [--type task\|progress\|checkpoint\|decision]`                                              | FTS5 syntax; hits cite owning task                                        |
| Event audit     | `carryctx event list [--cursor <token>] [--since 1h]`                                                                  | Cursor tokens are opaque; `--agent` filters explicitly                    |
| Diagnose        | `carryctx doctor [--fix]`                                                                                              | Warnings-only findings still exit 0                                       |
| Auxiliary       | `carryctx mcp`; `graph scan` / `graph export -t mermaid [--focus src/main.rs]`; `stats --markdown`                     | Stdio MCP server (answers ping); AST dep graph; analytics                 |
