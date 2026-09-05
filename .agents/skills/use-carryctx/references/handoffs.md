# Handoffs

A handoff routes work between agents. Division of labour:

- **CarryCtx is the record** — queryable tasks, checkpoints, decisions, progress.
- **The handoff document is the entry point** — first commands, task order,
  verification standard, traps. It cites IDs; it does not restate the record.

Use a written document when the next agent needs measurements, ordering, or
traps. For a simple transfer, `handoff create --summary` alone can suffice.

## Creating (session end)

Gather state, then route:

```bash
carryctx status --compact
carryctx task list --status in_progress
carryctx checkpoint list
carryctx decision list
carryctx search "<topic>"                 # prior work a successor must not rediscover

carryctx handoff create \
  --target sub-1 \
  --task CTX-0002 \
  --summary "Continue backend API: doc at docs/handoff/2026-08-25T120000Z-api.md — read first. FOLLOWS CTX-0001."
```

- `--target` resolves an agent name, ULID, or role.
- `--task` links the request to its task — create the task first when handing
  off new work.
- `--summary` is the only text `handoff list` shows: put the document path and
  the ordering claim (`FOLLOWS` / `INDEPENDENT OF`) in it so a receiver can
  plan parallel worktrees.

When a document is warranted, name it timestamp-first
(`YYYY-MM-DDTHHMMSSZ-slug.md`, `date -u +%Y-%m-%dT%H%M%SZ`) and structure it:
§1 first commands (executable), repo-state table, done-work citing checkpoint
and decision IDs instead of restating them, ordered tasks with `file:line`
evidence, then verification commands and traps (symptom/cause/fix). One subject
per file. Route every document, even when the next session is you — an
unrouted file is discoverable only by someone who already knows to look.

Checkpoint **before** the branch merges away, and close or block tasks you
started; a lingering `in_progress` is indistinguishable from active work.

## Taking over

```bash
carryctx handoff list                     # pending requests by default
carryctx handoff show HO-0001
carryctx handoff accept HO-0002 --claim-task   # claims + starts linked task
# equivalently, explicitly:
carryctx task claim CTX-0004 && carryctx task start CTX-0004
```

Widen deliberately: `--all` (everything), `--status pending|accepted|declined|closed`,
`--for-agent <name|ULID|role>`. Multiple open requests are normal — their
summaries declare ordering or independence.

1. Read the referenced document first; reconcile it against reality (`resume`,
   HEAD, dirty files) before coding — yesterday's handoff can be wrong about
   what has since merged.
2. Execute in order, recording as you go: `progress todo/note`, `decision add`.
3. Close the loop: correct surviving documents if this one invalidates them,
   archive yours as `.completed.md` (or `.superseded.md`), then
   `task complete`, final `checkpoint`, and write the next handoff if work
   remains. "Reconciled, no change needed" is a real outcome — record it.

## Reject / close

```bash
carryctx handoff reject HO-0003 --reason "Not my area"
carryctx handoff close HO-0003
```

## Don'ts

- Do not restate the record in a document; cite `CTX-/DEC-/PX-` IDs.
- Do not leave a document unrouted.
- Do not assume one live document is fine while another is ambiguous about
  ordering — ambiguity, not plurality, is the failure mode.
