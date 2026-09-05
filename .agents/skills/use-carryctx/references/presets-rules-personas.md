# Presets, Rules & Personas

Project-level capability packs live under `.carryctx/` and shape how agents
work: `workflows/` (SOPs), `rules/` (domain constraints), `personas/`
(behavioral roles). The carryctx-skills repository ships a preset library; copy
or install what you need.

## Installing presets via CLI

Presets are installed from a JSON pack, then activated per project:

```bash
carryctx preset list                          # installed + active
carryctx preset install /path/to/presets/workflows/bugfix.json
carryctx preset apply workflows/bugfix        # alias of activate; validates hash + permissions
carryctx preset show /path/to/presets/workflows/bugfix.json   # inspect a preset spec
```

Installation records the content hash and permission envelope
(`filesystem`, `network`, `env`) in `.carryctx/presets.lock`; activation
validates against it. The apply name is the pack's id (e.g.
`workflows/bugfix`), which may differ from the file name.

## Workflow blueprints (`.carryctx/workflows/`)

1. On assignment of a high-level task, check `.carryctx/workflows/` for a
   matching blueprint and read it before acting.
2. Break the blueprint into tracked steps instead of trusting memory:
   `carryctx progress todo "Run unit tests" --task CTX-0002`.
3. Execute steps sequentially; after each step completes cleanly, mark it:
   `carryctx progress complete PX-0001`. Never skip or reorder silently — if a
   step must change, note why with `progress note`.

## Rules (`.carryctx/rules/`)

1. At task start, list `.carryctx/rules/` for files relevant to the domain
   (`frontend.md`, `database.md`, `security.md`).
2. Read matching rule files **before** making code changes.
3. Treat them as absolute constraints — never guess conventions the project
   has already written down.
4. When delegating to a subagent, pass the relevant rule paths so the same
   constraints bind it.

## Personas (`.carryctx/personas/`)

1. Projects may define personas such as `reviewer.md`, `architect.md`,
   `qa-engineer.md`.
2. Adopt one when explicitly asked ("act as the Architect") or when the task
   strongly matches one (rigorous PR review).
3. Adjust communication style, strictness, reasoning focus, and output format
   to match the persona definition; maintain it until told to revert.

## Commander usage

- Apply a workflow preset to standardize how subagents execute a class of work;
  reference the activated SOP in dispatch prompts.
- Point each subagent at its domain rules and any persona it should embody
  (e.g., reviewer persona for acceptance passes).
