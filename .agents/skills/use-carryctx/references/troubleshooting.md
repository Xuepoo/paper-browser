# Troubleshooting

Verified against carryctx 0.7.0. Errors are single JSON envelopes on stderr with
an error `code`; text mode prints the message.

## Identity & Sessions

**"Current agent could not be resolved automatically … specify --agent <name>"**
Several agents are registered and none is unambiguously yours. Pass
`--agent <name>` or export `CARRYCTX_AGENT`. Note: this only supplies identity
for writes — listing commands (e.g. `event list`) are **never** implicitly
scoped by it; filter them explicitly with `--agent`.

**"agent '<name>' is not registered"**
`carryctx agent register --name <name> --provider <provider>`.

**Session already active / no active session**
One ACTIVE session per agent: `session end` (with checkpoint), `session
abandon` (without), or `session start --reuse` to keep it. Commands that need a
session (`checkpoint`, `progress`) fail without one — run
`carryctx session start`.

## Tasks

**`INVALID_TASK_TRANSITION` on claim/start**
The task is not in an accepting state — most often **planned** because a strong
dependency is incomplete, or already claimed by another agent (`task is already
claimed`). Check `carryctx task show CTX-NNNN`, complete the prerequisite or ask
its owner to `task release`, then retry.

**Task left `in_progress` across a session boundary**
Treat as a hygiene defect: close (`complete`/`cancel`) or `block --reason`.
Lingering tasks make every startup signal unreliable.

## Teams

| Error                                                       | Fix                                                                    |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| `STATE_CONFLICT: Commander must be a member of this team.`  | Add membership first (`team create --commander` auto-adds).            |
| `STATE_CONFLICT: Cannot remove the current team commander.` | `team commander set <team> --agent <other>` or `--clear`, then remove. |
| `STATE_CONFLICT: Agent is already a member of this team.`   | Not an upsert — remove and re-add to change role.                      |
| `STATE_CONFLICT: Team '<name>' already exists in project`   | Team names are project-unique; reuse or rename.                        |
| `TEAM_NOT_FOUND: Team '<ref>' not found.`                   | Refs are project-scoped; `team status` (no ref) lists all.             |

## Worktrees

**"Worktree path '…' already exists"**
Use the existing one (`worktree list`), or remove first:
`carryctx worktree remove <TASK_REF|PATH> [--force]` — `--force` discards dirty
or untracked files.

**Missing directory but still registered**
`carryctx doctor --prune-stale-worktrees` removes stale registrations; it never
deletes files.

**Refs**
`worktree show`/`unbind` need a full ULID or absolute path; `create`/`remove`
also accept task display IDs.

## Diagnostics & Recovery

```bash
carryctx doctor            # exit 0 even with warnings-only findings
carryctx doctor --fix      # attempt automatic fixes
carryctx doctor --json     # machine-readable
```

Doctor icons: `✓` pass, `·` informational, `⚠` warning, `✗` error. Only real
errors fail the command (non-zero); warnings like "No CarryCtx git hooks
installed" do not.

Schema upgrade after CLI update: `carryctx project migrate` (idempotent,
auto-backup). Database trouble: `carryctx project backup`, then restore with
`carryctx project restore`; run `doctor --fix` first.

Prune archived history with `carryctx project prune --older-than-days 30`
(default 30).

Audit trail: `carryctx event list` pages via opaque `next_cursor` tokens — pass
them back verbatim to `--cursor`; never parse or construct cursor values.

## Hooks & Completions

Commits not checkpointing:
`carryctx hooks status` then `carryctx hooks install --force` (backs up existing
hooks to `.bak`). Verify management with `grep CarryCtx .git/hooks/post-commit`.

Shell completions:

```bash
carryctx completions fish > ~/.config/fish/completions/carryctx.fish   # fish
eval "$(carryctx completions zsh)"                                     # zsh
```

## "Not a Git Repository" (GIT_ERROR, exit 4)

Every command must run from inside the project's Git clone — carryctx resolves
state at `<git-common-dir>/carryctx/state.sqlite` via git discovery. From a
workspace root that is not itself a repo, all commands fail. Fix: `cd` into the
product repository (or a linked worktree) first. Multi-repo workspaces hold one
independent state DB per repository.
