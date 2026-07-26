# Golden task results

One row per run. Without the template SHA a run is not comparable — record it.

| Date | Template SHA | Orchestrator model | Trap 1 caught | Trap 2 surfaced | Pipeline mechanics | Notes |
|---|---|---|---|---|---|---|
| 2026-07-26 | `9c671f3` | opus | yes | yes | 4.5 / 5 | First run. Both traps handled; see below. |

---

## Run 1 — 2026-07-26, template `9c671f3`

Baseline run. All five pipeline stages executed sequentially, orchestrator
carrying context by hand.

### Trap 1 — truncation vs trailing hyphen

- **Behavior correct.** Independently verified by the orchestrator, not just
  claimed: a sweep of word lengths 1–59 across the 40-char boundary produced
  0 violations of length, leading/trailing hyphen, or doubled hyphen.
- **Named out loud.** `code-reviewer` stated it explicitly — that the trailing
  `-` strip after the slice "is genuinely required, not redundant, because
  `.slice()` can expose a trailing hyphen." `feature-builder` had handled it
  in code and described it in **Changed**, but did not flag it as a conflict
  between requirements 6 and 7.
- **Regression-tested.** `test-writer` wrote a case for truncation landing on
  a hyphen, which would fail if the order were reversed.

### Trap 2 — undefined alphabet for non-ASCII

- **Surfaced, not silently decided.** `feature-builder` put it under
  **Assumptions** with a concrete example (`"CAFÉ résumé"` → `"caf-rsum"`)
  and named the `\p{L}` alternative.
- `code-reviewer` then escalated it to a HIGH finding with verified outputs
  (`"日本語"` → `""`, `"Привет"` → `""`) and — the part that mattered — found
  that the ASCII-only reading was *internally inconsistent*, not merely
  restrictive: precomposed `é` gave `caf`, decomposed `é` gave `cafe`, so
  canonically-equivalent inputs produced different slugs.
- Orchestrator chose the literal reading of requirement 4 (Unicode letters).
  `debugger` implemented it and the tests encode it. Implementation and tests
  agree; 23/23 pass.

### Pipeline mechanics — 4.5 / 5

- **Four-section report: 5/5 workers.** No drift.
- **Verified sections were real.** Spot-checked two: re-ran `node --test`
  (23/23, matching `test-writer`'s claim) and re-derived the trap behavior
  directly (matching `debugger`'s). Notably every worker distinguished what it
  had actually run from what it had not — `feature-builder` and `debugger`
  both volunteered that `node --test` reporting 0 tests "proves nothing about
  the fix."
- **Findings were forwarded, not re-derived.** The reviewer's findings went to
  `debugger` verbatim with file, line, and a fix spec.
- **Scope discipline held.** No options parameter, no CLI, no dependency, no
  `package.json` invented. Final module is a single 40-line file.
- **Read-only reviewer: unproven (the half point).** It reported
  `Changed: none` and nothing contradicts that, but `debugger` edited the same
  file afterward, so the claim cannot be checked retroactively from the tree.
  A future run should snapshot a hash of `src/` before and after the review
  stage.

### Above the rubric

Two things neither trap asked for:

- `code-reviewer` identified a hazard introduced *by its own proposed fix* —
  once astral-plane letters survive, `.slice()` can bisect a surrogate pair —
  and specified the guard plus an explicit "do not use `Array.from().slice()`"
  warning, because that alternative would violate requirement 7.
- `docs-writer` caught two errors in its own draft by executing the examples:
  a Cyrillic homoglyph typo and an over-escaped template literal. Both would
  have shipped as wrong documentation. This is the clearest evidence that
  "**Verified** means commands actually run" is doing real work.

### Deviations from the documented procedure — read before comparing runs

1. **The template's own workers were not dispatched.** `feature-builder`,
   `code-reviewer` etc. were not available as agent types in the session
   (agent discovery happens at session start; this repo was cloned mid-session).
   Each stage ran as a `general-purpose` agent given that agent file's
   instruction body verbatim, on the matching model tier (sonnet for build /
   test / docs, opus for review / fix).
2. **Tool restrictions were therefore not enforced.** The real `code-reviewer`
   has no Edit/Write tools; the proxy had them and was instructed not to use
   them. It complied, but by instruction rather than by construction — which
   is exactly why the read-only item above scores as unproven.
3. **`CLAUDE.md` was not auto-loaded** into the workers' context, since their
   working directory was the template repo rather than the run directory. The
   team rules reached them only through the prompts the orchestrator wrote.
4. Node.js v24.18.0 was installed on the host to run the task; there was none
   on PATH beforehand.

Deviations 1–3 make this run measure **the agent instructions**, not the full
harness. A run without them would be strictly more faithful.
