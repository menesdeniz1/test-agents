# Team operating rules

This repo runs an orchestrator/worker agent setup. The orchestrator is the
main session: it plans, writes precise specs, dispatches workers, and
integrates/verifies their results. Workers live in `.claude/agents/`.

## Dispatch policy — quality over speed

- Default to **sequential** dispatch: one worker at a time, so each worker
  builds on the previous worker's result instead of contradicting it.
- Standard pipeline for a feature: build → review → fix → test → document.
- Use parallel dispatch only when the user explicitly asks for speed AND the
  workstreams touch fully disjoint files.
- Write workers exact specs (which files, which data shapes, which status
  codes) — spec precision matters more than worker model strength.

### Handoff is manual — the orchestrator carries the context

Workers do not see each other's output. A subagent starts with a fresh
context window and receives only the prompt the orchestrator writes for it.
So "each worker sees the previous one's output" is something the
orchestrator has to *do*, not something the setup provides:

- Paste the previous worker's report into the next worker's spec — at
  minimum its **Changed** and **Open** sections.
- Name the files the next worker should read rather than assuming it will
  find them.
- Restate any decision made mid-pipeline; a later worker has no way to know
  it happened.

### Who owns each pipeline step

| Step | Worker | Note |
|---|---|---|
| build | feature-builder | implements the spec |
| review | code-reviewer | read-only by design — it reports, it does not fix |
| fix | debugger | closes review findings *and* root-causes failures |
| test | test-writer | |
| document | docs-writer | |

`code-reviewer` has no Edit/Write tools on purpose, so review findings must
be handed to `debugger` as an explicit fix spec. Do not ask the reviewer to
fix its own findings.

## Roster policy

- Keep the fixed roster small. Scale by dispatching more copies of an
  existing worker, not by adding new role files.
- Add specialist roles (security, devops, performance, dependencies) only
  when the concrete need appears; they were deliberately removed as
  premature.
- Judgment tier (code-reviewer, debugger) runs on opus; execution tier
  (feature-builder, test-writer, docs-writer) on sonnet.

## Worker report format

Every worker ends its response with these four sections, so the orchestrator
can chain them mechanically:

- **Changed:** each file touched, with a one-line description. `none` if none.
- **Verified:** commands actually run and their real result. Never claim a
  command passed without running it; if you could not run it, say so here.
- **Assumptions:** decisions made that the orchestrator should confirm.
- **Open:** anything deliberately left undone, and why.

## Verification

- The orchestrator independently re-runs the project's test suite after any
  worker reports green, before committing — a worker's **Verified** section
  is a claim to check, not evidence.
- If a worker's **Verified** section is empty or hedged, treat the work as
  unverified regardless of how confident the prose sounds.

## Project context (fill in when this template lands in a real project)

- **Stack:**
- **Test command:**
- **Lint/typecheck command:**
- **Build command:**

This repo starts stack-agnostic on purpose — the team rules above don't
assume any language or framework. The first task in a new project is filling
in this section; workers rely on it to know what "run the tests" or "run the
build" actually means here.
