# Rejected: rewriting existing docs into the new structure retroactively

**Proposed**: when adopting the `docs/design/` + `docs/use-cases/` +
`docs/foundations/` + `docs/rejected/` structure (per
[`/DOCS-WORKFLOW.md`](../../DOCS-WORKFLOW.md)), migrate the existing
`docs/changes/` (22 ad hoc implementation-note files),
`docs/milestones/`, and `docs/superpowers/` content into the new shape —
one clean tree, one convention.

**Why it was tempting**: having two documentation conventions side by side
is exactly the kind of drift this workflow is meant to prevent. A single
consistent tree is easier for a future agent to navigate without needing a
"here's how the docs are organized" preamble.

**Why not (for now)**: `docs/changes/` is a historical log of specific past
implementation efforts (calendar refactors, JWT/middleware fixes, seed
setup) — rewriting it risks silently losing or distorting the original
record of _what actually happened and when_, for a benefit (tidiness) that
doesn't offset the cost of an agent re-deriving 22 files' worth of history
without a diff to check against. `docs/milestones/` and
`docs/superpowers/` already implement the workflow's own core idea (a
capability spec before/while building, an explicit open-questions file) —
just under different file names — so rewriting them would be
reorganization for its own sake, not a real gap being closed.

**What was decided instead**: keep `docs/changes/`, `docs/milestones/`, and
`docs/superpowers/` as-is; treat them as already-compatible layers per
[`docs/design/00-overview.md`](../design/00-overview.md#relationship-to-other-docs-in-this-repo).
New durable "why" content goes into `docs/design/`; new forward-looking
feature specs keep going into `docs/milestones/`; the single
`docs/OPEN_QUESTIONS.md` stays the one open-questions file (see
[`docs/design/NN-open-questions.md`](../design/NN-open-questions.md)) rather
than forking a second one. If `docs/changes/` ever needs consolidating,
that's a separate, explicit task — not a side effect of introducing this
workflow.
