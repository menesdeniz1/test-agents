# Team operating rules

This repo runs an orchestrator/worker agent setup. The orchestrator is the
main session: it plans, writes precise specs, dispatches workers, and
integrates/verifies their results. Workers live in `.claude/agents/`.

## Dispatch policy — quality over speed

- Default to **sequential** dispatch: one worker at a time, so each worker
  sees the previous worker's output and stays consistent with it.
- Standard pipeline for a feature: build → review → fix → test → document.
- Use parallel dispatch only when the user explicitly asks for speed AND the
  workstreams touch fully disjoint files.
- Write workers exact specs (which files, which data shapes, which status
  codes) — spec precision matters more than worker model strength.

## Roster policy

- Keep the fixed roster small (currently 5). Scale by dispatching more
  copies of an existing worker, not by adding new role files.
- Add specialist roles (security, devops, performance, dependencies) only
  when the concrete need appears; they were deliberately removed as
  premature.
- Judgment tier (code-reviewer, debugger) runs on opus; execution tier
  (feature-builder, test-writer, docs-writer) on sonnet.

## Verification

- The orchestrator independently re-runs the project's test suite after
  any worker reports green, before committing.
