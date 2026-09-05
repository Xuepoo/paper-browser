# Task Lifecycle

Tasks drive the project lifecycle. All transitions go through the CLI — never
edit `state.sqlite` by hand.

## States

`planned`, `ready`, `in_progress`, `blocked`, `in_review`, `completed`,
`cancelled`.

A task created with unmet strong dependencies starts as **planned** and rejects
`claim`/`start` (`INVALID_TASK_TRANSITION`) until every strong prerequisite is
completed. Tasks without blockers start **ready**.

## Commands

```bash
carryctx task create --title "Fix parser bug" \
  [--description "..."] [--priority low|normal|high|urgent] \
  [--team core] [--required-role backend] [--assignee <agent>] \
  [--depends-on CTX-0001]        # repeatable list
carryctx task list [--status ready] [--mine] [--assignee <agent>] [--limit N]
carryctx task show CTX-0001
carryctx task edit CTX-0001 --title "..." --priority high --description "..."

carryctx task claim CTX-0001      # take ownership (requires ready)
carryctx task release CTX-0001    # give ownership back (owner must have no active session)
carryctx task start CTX-0001      # planned/ready -> in_progress
carryctx task block CTX-0001 --reason "Waiting on API spec"
carryctx task unblock CTX-0001
carryctx task review CTX-0001     # in_progress -> in_review
carryctx task complete CTX-0001
carryctx task cancel CTX-0001 --reason "Duplicate of CTX-0007"
carryctx task reopen CTX-0001     # terminal (completed/cancelled) -> in_progress
```

There are no `unclaim`, `approve`, `reject`, or `close` commands for tasks.

## Dependencies

```bash
carryctx task depend CTX-0002 --on CTX-0001                    # strong (default)
carryctx task depend CTX-0002 --on CTX-0003 --kind informational
carryctx task undepend CTX-0002 --on CTX-0001
```

`--kind` accepts `strong` or `informational` (alias `info`). Strong edges gate
`claim`/`start` until the prerequisite completes; informational edges are
recorded and never gate anything.

## Scopes

Scopes record which file paths a task intends to touch, powering conflict
detection before parallel dispatch:

```bash
carryctx task scope add CTX-0002 src/api/
carryctx task scope remove CTX-0002 src/api/
carryctx task scope list CTX-0002
carryctx task scope conflicts CTX-0002   # overlapping open-task scopes for this task
```

Two tasks whose scopes overlap are not independent, whatever their dependency
edges say — batch them to one subagent or serialize them.

## Team & Role Metadata

```bash
carryctx task create --title "Backend API" --team core --required-role backend
carryctx task team set CTX-0002 --team core       # or --team none (= unset)
carryctx task team unset CTX-0002
carryctx task edit CTX-0002 --required-role frontend   # edit carries role, not team
```

Both fields are optional, additive metadata defaulting to null. Associating,
changing, or clearing a task's team never alters status, owner, dependencies,
or scopes. `required_role` is advisory: it records the role a task wants and
does not restrict who may claim it.

## Capacity

An agent may hold many `in_progress` tasks at once; `claim`, `start`, and
`assign` never fail on a count. The legacy config key
`task.single_active_task_per_agent` is compatibility-only and non-enforcing.
Capacity policy belongs to the commander or the harness — enforce it in your own
dispatch logic and check `active_task_count` from `team status`.
