# Open questions

This project keeps **one** running list of unresolved product/design
decisions: [`docs/OPEN_QUESTIONS.md`](../OPEN_QUESTIONS.md). This file is a
pointer, not a fork — don't duplicate entries here. It exists so the
`docs/design/` tree matches the shape the workflow expects
(`NN-open-questions.md` per subsystem area), while the actual list stays in
one place, grouped by milestone.

Product-level questions surfaced while writing `docs/design/*` that aren't
tied to a specific milestone live in
[`docs/OPEN_QUESTIONS.md`](../OPEN_QUESTIONS.md) under its
**"Housekeeping"** section, alongside the milestone-grouped ones.

When resolving an entry, follow the workflow's rule: move the decision into
the relevant `docs/design/*.md` file as the new authoritative statement,
then strike it from `docs/OPEN_QUESTIONS.md`. If a `docs/use-cases/*.md`
file's "Gaps / friction" section raised it, update that file too.
