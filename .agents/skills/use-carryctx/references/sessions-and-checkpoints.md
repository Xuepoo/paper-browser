# Sessions & Checkpoints

A session is a contiguous period of work by one agent; a checkpoint is an
immutable snapshot of semantic progress plus Git state. Together they are what
`carryctx resume` rebuilds context from.

## Session Lifecycle

States: `ACTIVE`, `PAUSED`, `ENDED`. An `ACTIVE`/`PAUSED` session idle longer
than `session.stale_after` (default 2h) is reported **STALE** on the next
status check — a warning state, not terminal; `session resume` clears it.

```bash
carryctx session start [--reuse] [--task CTX-0001]   # binds agent + worktree
carryctx session pause
carryctx session resume
carryctx session end [--summary "..."]               # prompts for final checkpoint
carryctx session abandon                             # end WITHOUT checkpoint
carryctx session list / current / show <id>
```

- One agent holds at most one ACTIVE session — the guarantee is per **agent**,
  not per repository, so teammates hold concurrent sessions in the same repo.
  Starting again while active ends the previous session first (use `--reuse`
  to keep the live one instead).
- On start the current Git HEAD is captured as `start_commit`; pause stops the
  timer and blocks new progress/checkpoints.
- Read team-wide liveness via `carryctx team status <team>` (`active_session_id`
  per member).

## Restoring Context

```bash
carryctx resume --compact        # token-efficient re-orientation at session start
carryctx resume --full           # extensive history
carryctx status --compact        # branch, HEAD, tasks without full dump
```

`resume` shows the current task, recent progress, and the most recent
checkpoint. It never writes state.

## Checkpoints

```bash
carryctx checkpoint --done "..." --remaining "..." \
  [--blocker ...] [--risk ...] [--note ...] [--next ...] \
  [--task CTX-0001] [--include-diff] [--no-git]
carryctx checkpoint list
carryctx checkpoint show <CHECKPOINT_ID>
```

Each checkpoint records: id (ULID), owning session/task, `git_head_sha`,
HEAD message, dirty flag, done/remaining text, blockers, risks, notes, UTC
timestamp. The raw diff is not stored unless `--include-diff` is passed — commit
first when you need reproducibility. Checkpoint **before** merging a feature
branch away: `branch`/HEAD are captured at checkpoint time, so checkpointing
only after a squash-merge loses the branch reference.

Checkpoints are immutable. To correct one, append
`carryctx progress note "<correction>"` and optionally create a new checkpoint;
never try to edit history.

`checkpoint correct <ID>` exists for rollback of project/agent state to a prior
checkpoint — use deliberately; it discards subsequent changes.

## Policy

1. Checkpoint at meaningful boundaries: unit of work done, task switch,
   blocker hit, before ending any session with unfinished work.
2. Be specific: "Implemented JWT refresh endpoint" beats "auth progress".
3. Record known blockers even if temporary — accountability survives silence.
4. Use granular `progress todo|note|block|risk` between checkpoints; checkpoints summarize, progress items trace.
5. Do not over-checkpoint; noise drowns signal.

Storage: `<git-common-dir>/carryctx/state.sqlite`, shared across worktrees,
never pruned automatically (`project prune` archives old completed tasks only).
