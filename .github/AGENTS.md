# CI task-entry guard

Root `AGENTS.md` remains authoritative.

This repository is public. Before changing GitHub Actions or CI runner routing, inspect
the current workflows and deployment documents first.

Do not route pull-request jobs from this repository onto a persistent shared runner
used by private repositories. Use a separate trust boundary for any self-hosted runner
that may execute public or fork-originated code.

Do not replace the existing CI architecture from generic setup guidance without first
checking the repository's current implementation and constraints.
