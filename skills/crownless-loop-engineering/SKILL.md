---
name: crownless-loop-engineering
description: Improve Crownless through one small play-driven iteration that strengthens the current fun loop.
---

# Crownless Loop Engineering

Use this Skill when deciding or implementing the next gameplay improvement.

Protect and strengthen these current fun anchors:

- equipment visibly changes the character,
- combat rewards strategy and meaningful choices,
- exploration makes the world feel larger,
- stronger equipment creates motivation to explore again.

For each iteration, choose the weakest or most promising link, make one small coherent change, run the game, play the affected loop, and decide whether to keep, change, or drop it.

Prefer changes that connect multiple anchors, especially:

**Explore → Fight → Loot → Equip/Improve → Reach farther → Explore again**

Do not add a large new system when a smaller change can make this loop more compelling.

## Jev Decision Gate v1

Use Jev to remove bounded semantic branches from expensive agent reasoning. Jev is an evaluator, not an approval authority or execution agent.

The standard autonomous-development flow is:

1. gather cheap deterministic evidence;
2. reduce the next step to a small candidate set when a semantic choice remains;
3. run at most one bounded Jev preflight over that shared state;
4. implement the smallest coherent change;
5. verify with deterministic checks, CI, browser/runtime evidence, and playtest where relevant;
6. run one bounded Jev completion evaluation only when semantic acceptance still matters;
7. let deterministic project policy choose proceed, retry, escalate, merge, or stop.

### Preflight: offload early, not after deep reasoning

Skip Jev when the next action is deterministic or explicitly requested. Examples: one reproducible blocker, one failing assertion with a clear cause, a concrete user-requested implementation, or a required CI repair.

When 2–4 genuinely reasonable paths remain, collect only decision-relevant facts and batch the useful heads into one request:

- `next_action` — Choice among the explicit candidates;
- `risk` — Score using concrete standalone risk levels;
- `evidence_sufficient` — Noul for whether the supplied evidence is enough to act.

Omit heads that cannot change the next action. Do not ask Jev to reconfirm a decision the primary agent already spent substantial reasoning on.

Good state contains the player-facing objective, relevant AGENTS.md / Issue constraints, concise recent evidence, explicit candidates, and known blockers. Do not send full repositories, full diffs, long logs, secrets, credentials, or unrelated history.

### Transport boundary

Follow the shared `typesafe-jev` transport contract:

1. **Direct TypeSafe System One API** is the normal path for trusted runtimes, CI, and coding agents that can safely receive `TYPESAFE_API_KEY`.
2. **Generic Remote MCP** is the credential bridge for ChatGPT or other clients that should not receive the API key.
3. If neither transport is available, record Jev as failed/skipped and continue according to deterministic project policy when safe.

Transport choice does not change Jev authority. Keep transport/auth/rate-limit/timeout/parsing failure separate from evaluator judgment. Never treat a failed Jev call as a negative semantic verdict.

### Execution routing

Choose the cheapest sufficient execution target from known capabilities. Prefer GitHub/API for repository facts and mutations, public web for current external documentation, local CLI/browser for runtime verification, and interactive GUI only when APIs or CLI are insufficient.

Use Jev for execution-target selection only when multiple plausible targets materially differ in cost or capability. Skip it when the target is obvious.

### Failure recovery

Read the actual failing assertion, stack trace, workflow step, or runtime observation first. If that evidence still leaves 2–4 plausible diagnostic branches, use one bounded Jev Choice to decide which branch to inspect first.

Do not use Jev instead of deterministic diagnosis.

### Completion semantic gate

After implementation, deterministic evidence comes first: relevant tests, CI, mergeability, runtime/browser observations, and required phone-size/playtest evidence.

If acceptance still contains a bounded semantic judgment, evaluate only the materially changed final head. Typical heads are:

- `semantic_acceptance` — Noul: does the supplied evidence support the explicit player-facing objective / acceptance condition?
- `follow_up` — optional Choice among `keep`, `change`, and `investigate` when playtest semantics require it.

Do not repeat the same evaluation unless implementation, evidence, questions, or policy changed materially.

### Deterministic action policy

Jev never authorizes merge, deploy, publish, Issue closure, test skipping, or any other side effect.

Compose actions deterministically from repository facts plus configured semantic thresholds. Conceptually:

```
tests/CI/mergeability required by the task are green
AND required runtime/playtest evidence exists
AND semantic gate is absent OR satisfies project threshold
=> action may proceed

deterministic requirement failed
=> fix/retry without asking Jev to override it

semantic evidence missing or Jev uncertainty exceeds policy
=> gather evidence or escalate

Jev transport failed
=> record failed/skipped; follow the project's safe fallback
```

Thresholds belong to Crownless policy, not to the generic Jev skill. Do not invent a universal confidence cutoff.

### Calibration log: end-of-cycle invariant

If an autonomous development cycle reaches this Decision Gate, append exactly one compact calibration record to #367 before the cycle is considered complete. This is required even when the cycle makes no code, Issue, PR, or merge mutation.

Record all of the following that are available:

- cycle trigger and immutable starting `main` SHA;
- compact evidence/state summary and explicit candidates, if any;
- Jev call count for the cycle;
- heads actually evaluated and their criteria version or concise criteria;
- Jev transport status separately from evaluator output;
- Jev model/version when returned;
- raw choice/score/noul, confidence, and probabilities when returned;
- deterministic action taken: `proceed`, `retry`, `escalate`, `no_action`, or `stop`;
- Issue / PR / commit / merge identities created by the cycle, or `none`;
- final verification state and the next observation needed;
- later observed outcome or human override when available in a later record.

A deterministic skip is still calibration evidence: record `jev_calls: 0`, the reason Jev was unnecessary, and the deterministic action. A transport/auth/rate-limit/timeout/parsing failure must be recorded as `jev_status: failed` or `skipped`, never converted into an evaluator verdict. Evidence-insufficient outcomes must say what evidence is missing.

Use the starting main SHA plus the cycle trigger/run identity when available as the deduplication key. Before appending, check the recent #367 records for that immutable identity; do not create a second record for the same completed cycle.

This is calibration data, not a success report. Preserve `no_action`, skips, failures, uncertainty, disagreements, false positives, false negatives, retries, and human overrides. Do not rewrite old judgments to make them look correct. A cycle that exercised the Decision Gate but did not append this record is incomplete.

### Efficiency rule

A Jev call should reduce branches, context, or expensive reasoning. If it does not change what the agent needs to inspect, run, implement, or verify, skip it. Batch independent questions that share the same state, and do not make a second call without materially new evidence.
