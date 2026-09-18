# Milestones

Forward-looking feature docs, one per milestone. Each doc states the use case,
what needs building, and an implementation plan — not a task-by-task
execution plan (see `docs/superpowers/plans/` for that level of detail once a
milestone is scheduled).

Grouping criterion: one coherent piece of user-facing (or operator-facing)
capability per milestone, regardless of how many files it touches. A
milestone is done when its use case is fully satisfied, not when an arbitrary
task list is checked off.

- [`milestones-1-admin-reservations-browsing.md`](./milestones-1-admin-reservations-browsing.md) — replace the fixed two-week reservation window (dashboard + admin page) with a paginated, arbitrary-window view, and add an "All spaces" filter as the default.
- [`milestones-2-audit-trail.md`](./milestones-2-audit-trail.md) — record who did what, with a before/after diff and a human-readable timestamp, across admin mutations.
