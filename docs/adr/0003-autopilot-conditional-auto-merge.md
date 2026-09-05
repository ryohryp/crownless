# ADR 0003: Autopilot conditional auto-merge

- Status: Accepted
- Date: 2026-09-05
- Scope: Crownless autonomous development

## Decision

Crownless Autopilot may automatically merge a pull request after implementation when, and only when, all merge gates below are satisfied.

This ADR is the explicit repository policy anticipated by `docs/autonomous-development-policy.md` and supersedes its earlier assumption that autonomous cycles always stop at PR creation. The implementation executor may remain simple and stop after PR creation; the surrounding autonomous cycle/orchestrator is allowed to perform the gated merge.

## Auto-merge gates

A PR may be merged automatically only when all of the following are true:

1. The change is low-risk, reversible, and within current Canon.
2. The originating Issue does not require a pre-implementation human gate (`humanGate=false` or equivalent evidence).
3. Focused tests and repository-required validation passed before PR creation.
4. The current PR head SHA has all required CI checks completed successfully.
5. The PR is mergeable and has no unresolved conflict.
6. Structured/self review has no unresolved blocking or high-severity finding, and there is no outstanding `REQUEST_CHANGES` review.
7. The final diff still matches the Issue Acceptance Criteria and does not contain accidental scope expansion.
8. The change does not perform any of the excluded operations below.
9. The PR head SHA has not changed since the CI/review evidence used for the merge decision.

When any gate cannot be verified, Autopilot must fail closed and leave the PR open.

## Excluded from automatic merge

The following require human judgment/approval and must not be auto-merged solely because CI is green:

- gameplay Canon or core-loop direction changes
- major balance/economy changes
- GPS/privacy/location-data boundary changes
- save migrations or irreversible player-state changes
- security, credentials, auth, IAM, or secret-management changes
- major architecture, backend, hosting, or public deployment policy changes
- substantial legacy deletion or destructive data/file operations
- monetization
- production visual asset approval or visual-direction changes
- changes explicitly marked `human-gate`, `agent-proposed`, or otherwise awaiting approval

## Gameplay and playtest

`playtestRequired=true` does not block merging a low-risk playable vertical slice. A gameplay PR may be merged after the technical gates above pass, but its gameplay truth state becomes **Implemented / Playtest pending**, not **Keep**.

Automatic merge must never infer Keep / Change / Kill from tests, CI, static review, or successful deployment. Human playtest remains authoritative for those states.

After merge, a gameplay Issue that still requires playtest should remain open or be marked `playtest-pending` according to the repository lifecycle convention; it must not be selected again for implementation merely because it is open.

## Post-merge behavior

After an automatic merge, the autonomous cycle should:

1. confirm the merged commit is present on current `main`;
2. confirm relevant post-merge CI/deployment status when available;
3. close the originating Issue only if all of its completion criteria are actually satisfied;
4. otherwise update/classify the Issue to reflect the remaining bounded work or `playtest-pending` state;
5. record the merge decision and evidence in #367.

## Rationale

The product-development loop is slowed when low-risk, fully validated PRs wait only for routine merge approval. Conditional auto-merge removes that mechanical wait while preserving human control over product direction, irreversible changes, privacy/security boundaries, and gameplay taste.

The intended loop is now:

`Plan → implement smallest slice → validate/review → PR → gated auto-merge → Implemented → Playtest pending → human Keep / Change / Kill → next hypothesis`
