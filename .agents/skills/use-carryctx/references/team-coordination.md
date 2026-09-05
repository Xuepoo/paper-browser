# Team Coordination

A **team** is durable, project-scoped membership in
`<git-common-dir>/carryctx/state.sqlite`. It survives session ends, closed
terminals, and linked worktrees; every agent that can reach the repository sees
the same team.

## What CarryCtx Owns — and What It Does Not

CarryCtx answers three questions durably: who is on this team, what is each
member working on, and what does each member need to know. It ships **no
scheduler, no worker runtime, no lease/heartbeat machinery**. Spawning
processes, routing work, retries, concurrency limits, and worktree creation
belong to the harness (or to you as commander). Read state, decide, act, record.

## Write Commands

Every write mutates state and appends an audit event in the same transaction;
all support `--json` and `--dry-run`.

```bash
carryctx team create --name core [--commander cmd-1]   # --commander also adds membership
carryctx team member add core --agent sub-1 --role backend
carryctx team member remove core --agent sub-1
carryctx team commander set core --agent cmd-1         # or --clear
carryctx agent register --name cmd-1 --provider opencode --kind commander
carryctx agent register --name sub-1 --provider opencode --kind subagent --role backend
```

`--kind` accepts only `commander` or `subagent`. `agent register --role` (the
agent's default) and `team member add --role` (its role on one specific team)
are separate fields; an agent may hold different roles on different teams.
`<TEAM_REF>` and `<AGENT_REF>` accept names or ULIDs.

Semantic rules enforced with `STATE_CONFLICT` errors:

- A commander must be a member of its own team (`team create --commander`
  adds the membership for you).
- The current commander cannot be removed until replaced or cleared via
  `commander set --clear`.
- `team member add` is not an upsert — remove and re-add to change a role,
  minding the commander rule above.
- Team names are unique per project: duplicates report
  `STATE_CONFLICT: Team '<name>' already exists in project`.

## Read-Only Projections

```bash
carryctx team status [core]
carryctx team context [core] [--agent-for sub-1] [--task CTX-0002]
```

Both open the database read-only, run no migrations, write nothing — no events,
no claims, no session touches. Call them as often as needed, from any agent.
They currently emit the JSON envelope regardless of `--format`; parse it, do not
paste it as prose.

### `team status`

With a ref, `data` is `{team, members, counts}`. Each member carries its team
role, agent kind, `active_session_id` (null when offline), and its non-terminal
tasks. Read `counts` precisely:

| Field        | Actually means                                                   |
| ------------ | ---------------------------------------------------------------- |
| `total`      | number of members                                                |
| `commanders` | `1` if a commander is set, else `0`                              |
| `subagents`  | members whose agent kind is `subagent`                           |
| `unassigned` | non-terminal tasks on this team with **no owner** — a task count |

Without a ref, `data` is `{teams: [...]}`, one `{team, members, counts}` per
project team.

### `team context`

Rebuilds the picture from durable records: tasks, dependencies, scopes,
progress, scope conflicts, blockers, latest checkpoints, decisions, handoffs,
and recent events. `rebuild.source` states `"durable_records"` explicitly.
`view` reports the narrowing: `commander` (whole team), `member`
(`--agent-for`), or `task` (`--task`). Both flags narrow **every** collection
consistently, and dependency edges are closed over the returned task set — an
empty `dependencies` in a narrowed view does not mean the task has no
prerequisites.

## Commander Working Pattern

```bash
carryctx team status core                      # who is live, what they hold
carryctx team context core                     # full durable picture
carryctx team context core --agent-for sub-1   # exactly one member's slice
```

Judgment calls, not fixed rules:

- Small work stays inline — dispatching a one-line fix costs more than fixing it.
- Batch tightly-coupled tasks to one subagent; check `scope conflicts` before
  fanning out supposedly independent work.
- Re-read `team status` between dispatch rounds; compare `active_session_id`
  and `active_task_count` across calls to notice a subagent that stopped
  reporting — there is no timeout event.

## Recording Discipline

Projections can only rebuild what was written down. An agent that works
silently and dies leaves nothing behind. Members should:

1. Checkpoint at boundaries, not only at exit.
2. Write the "why" into a decision or note the moment a non-obvious choice lands.
3. Block explicitly (`progress block`, `task block --reason`) — going quiet is invisible.
4. Cite IDs (`CTX-NNNN`, `DEC-NNNN`, checkpoint ULIDs) instead of restating findings.
5. Close out started tasks; lingering `in_progress` poisons every startup signal.

Audit trail: inspect writes with `carryctx event list` (e.g. `team.created`,
`team.member_added`, `task.team_changed`) or aggregate with `carryctx stats`.
