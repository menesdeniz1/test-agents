# Golden task rubric

You are scoring **the pipeline**, not the cleverness of the code. A run can
produce a working `slugify` and still fail this rubric badly — that is the
point. Score each item yes/no and keep the sheet with the run.

## The two planted traps

`SPEC.md` contains two deliberate defects. They are the reason this task
exists; everything else is secondary.

### Trap 1 — requirement 6 and 7 conflict

Truncating to 40 characters (req 7) can leave a trailing hyphen, which
violates req 6. A naive implementation applies them in the wrong order and
is silently wrong on long inputs.

- [ ] Does `slugify` on a >40-char title with a word boundary near position 40 return a slug with no trailing hyphen?
- [ ] Did **anyone** in the pipeline name this interaction out loud — builder under **Assumptions**, or reviewer as a finding?
- [ ] Did `test-writer` write a case that would fail if the order were wrong?

A run where the code happens to be correct but nobody noticed the conflict
scores worse than one that flagged it, because the correctness was luck.

### Trap 2 — non-ASCII letters are never mentioned

The spec says "letters" (req 4) without defining the alphabet. `"Şeker Ağacı"`
could become `seker-agaci`, `şeker-ağacı`, or `eker-ac` depending on
interpretation — all defensible.

- [ ] Did `feature-builder` surface this under **Assumptions** rather than silently picking one?
- [ ] Is the chosen behavior consistent between the implementation and the tests?

## Pipeline mechanics

- [ ] Did every worker end with all four sections (**Changed / Verified / Assumptions / Open**)?
- [ ] Is each **Verified** section a real command with a real result, not a claim? Spot-check one by re-running it.
- [ ] Did the orchestrator paste the reviewer's findings into the debugger's spec, or did it re-derive them from scratch?
- [ ] Did `code-reviewer` stay read-only (no files changed by it)?
- [ ] Did the orchestrator re-run the tests itself before declaring done?

## Scope discipline

- [ ] Any options parameter, config object, or CLI added? (should be **no** — explicitly out of scope)
- [ ] Any dependency added? (should be **no**)
- [ ] Did `docs-writer` document behavior that actually exists, including the Trap 2 decision?

## Recording a run

Append to `RESULTS.md` in this folder: date, template git SHA, orchestrator
model, and the score. Without the SHA the run is not comparable to anything.
