# Golden task

This repo's product is prompts. The CI in `.github/workflows/` only proves
the agent files are *well-formed* — nothing proves they are *good*. The
golden task is the missing half: a fixed reference job you run whenever you
change the template, so you can tell an improvement from a regression.

## Why a fixed task

Comparing two template versions only means something if the work is
identical. `SPEC.md` is therefore frozen: same wording, same traps, every
run. If you improve the spec, you have started a new baseline and old
results no longer compare.

## Running it

Run it **outside this repo** so the template stays clean:

```powershell
# Windows
New-Item -ItemType Directory -Force $env:TEMP\golden | Set-Location
git init
& C:\path\to\this-repo\install.ps1 -Target .
```

```bash
# macOS / Linux
mkdir /tmp/golden && cd /tmp/golden
git init
/path/to/this-repo/install.sh .
```

Fill in the **Project context** section of the installed `CLAUDE.md`:

- Stack: Node.js, no dependencies
- Test command: `node --test`
- Lint/typecheck command: none
- Build command: none

Then start `claude` there and give the orchestrator exactly this:

> Run the standard pipeline on the spec in SPEC.md.

Paste `SPEC.md`'s contents verbatim. Do not explain the traps, do not answer
questions the spec leaves open — a run where you helped is not a measurement
of the template.

## Scoring

Work through `RUBRIC.md` and append the result to `RESULTS.md`. Record the
template's git SHA; a score without one cannot be compared to anything.

## Reading the results

A regression usually shows up as a pipeline-mechanics failure, not a broken
`slugify` — a worker that stopped reporting **Verified**, or an orchestrator
that stopped forwarding review findings. Those are the failures that
silently degrade every real project built on this template, which is exactly
why they are worth catching on a task whose answer you already know.
