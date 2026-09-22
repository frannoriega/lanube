# Use cases

Concrete scenarios walked through the abstract model in `docs/design/`, end
to end. Each file follows a fixed shape:

1. **Situation** — plain language, no jargon, as a person would describe it.
2. **Walkthrough** — how it maps onto the entities/flows in `docs/design/`,
   step by step.
3. **Gaps / friction** — anywhere the model didn't cleanly cover the
   scenario. Every gap listed here must also appear in
   [`docs/OPEN_QUESTIONS.md`](../OPEN_QUESTIONS.md), cross-linked both
   ways. If a use-case has no gaps, say so explicitly rather than omitting
   the section — an absent section reads as "not checked," not "checked,
   found nothing."

Files:

- [`book-a-recurring-space.md`](./book-a-recurring-space.md) — a user books
  a weekly-recurring slot in a meeting room, then needs to skip one week.
- [`event-with-manual-approval.md`](./event-with-manual-approval.md) — an
  admin runs a capacity-limited workshop that requires approval, including
  a participant who cancels and re-registers.
