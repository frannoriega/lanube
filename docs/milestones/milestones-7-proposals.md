# Milestone 7 — Proposals (community suggestion box)

> **Decided (2026-09-21):** the existing dormant `Proposal`/`ProposalComment`
> schema is stale, not authoritative — where it conflicts with the use case
> below (status names, missing `IN_REVIEW`, no thread/decision-reason
> columns), the use case wins and the schema gets migrated to match it, not
> the other way around.

## Use case (as described 2026-09-21)

A way for users to propose changes to La Nube: a markdown document with a
title, plus discussion — a top-level comment and one reply level under it
(no deeper nesting). Lifecycle: `PENDING → IN_REVIEW → APPROVED/REJECTED`,
changed only by admins; approving or rejecting requires a reason.

## Engineering input

This is a reasonable, well-scoped feature — good instinct keeping the
thread depth capped at one level (first-level comment + one reply) instead
of open-ended nesting; that alone avoids a meaningful chunk of UI
complexity (indentation, collapse/expand trees) for a feature whose real
value is "can people discuss this," not "can people out-nest each other."

One thing to flag rather than assume: the dormant schema already has
`ProposalLike` and `ProposalCommentLike` (upvote-style likes on a proposal
and on individual comments), but your description above doesn't mention
voting/likes at all. Worth an explicit call: keep likes in v1 since the
schema already anticipates them (cheap — the tables and unique constraints
already exist), or drop them and treat that schema as itself a rejected
idea? Either is fine; it's the kind of thing worth deciding rather than
silently keeping or silently dropping. See open questions.

## Visibility & moderation (2026-09-21)

You asked me to confirm I understand the goal here, and whether it's
worth building — yes on both. What you're describing is a tension between
two different things that are easy to accidentally conflate into one
mechanism:

1. **Content moderation** — some submissions are going to be genuinely
   inappropriate (harassment, doxxing, spam) and shouldn't sit in public
   view regardless of whether the _idea_ has merit.
2. **Decision legitimacy** — a proposal an admin just doesn't want to act
   on is not the same thing as a proposal that shouldn't be seen, and if
   "reject" or "don't publish yet" is the only lever, the two become
   indistinguishable from the outside — an admin quietly disliking an idea
   and an admin protecting the community from abuse look identical to
   everyone else. That's the abuse case worth designing against.

**Recommendation: decouple visibility from decision status entirely, and
make hiding a distinct, accountable action.**

- Proposals are **public by default**, including `REJECTED` ones **with
  their decision reason shown**. Rejecting an idea is not a way to make it
  disappear — the rejection and its stated reason are exactly what
  demonstrates the decision was made on the merits, in public, rather than
  quietly. This is the concrete thing that resists the abuse case: an
  admin who just doesn't like an idea has to reject it _and give a reason
  that's visible to everyone_, which is a meaningfully higher-friction,
  higher-accountability action than making the idea vanish.
- A **separate `isHidden` moderation flag** (independent of `status`) is
  the only thing that actually removes a proposal from public view — for
  genuine abuse/spam/harassment, not for "we don't want to do this."
  Hiding **requires a reason** (stored, not shown publicly — moderation
  reasons may need to reference the offending content directly) and is
  **written to the audit trail** (Milestone 2) the same as any other admin
  mutation. That's what makes this workable rather than just a second,
  quieter way to bury things: hiding is a logged, reviewable action a
  superadmin can audit, distinct from a normal decision, and the
  audit-trail's own "superadmin-only, employer-tier" visibility
  (`milestones-2-audit-trail.md`) means the accountability lands on the
  same people who'd be positioned to catch misuse of it.
- Whether _global_ visibility (all proposals public) or _per-proposal_
  configurability is the right default is still your call to make — see
  open questions below for the narrower, now-actionable version of that
  question.

## What needs building

1. **Schema changes**:
   - `ProposalStatus` enum: add `IN_REVIEW` (currently only
     `PENDING/APPROVED/REJECTED`).
   - `Proposal`: add `decisionReason` + `decidedAt` (+ `decidedById`),
     mirroring the existing `EventParticipant` approve/reject pattern —
     don't invent a new shape for "an admin decision with a reason," reuse
     the one this codebase already has twice.
   - `ProposalComment`: add a nullable `parentCommentId` self-relation, and
     enforce the one-level cap at the **application** layer (reject a
     reply-to-a-reply at write time) rather than in the schema, matching
     how other single-level constraints in this codebase are enforced in
     code, not SQL.
   - `Proposal`: add `isHidden Boolean @default(false)`, `hiddenReason`,
     `hiddenAt`, `hiddenById` — independent of `status`/`decisionReason`,
     per "Visibility & moderation" below. A hide action goes through
     `recordAudit()` like any other admin mutation.
2. **Author-facing UI**: create/edit (while `PENDING`) a proposal — title +
   markdown body, reusing the existing `MarkdownEditor` /
   `Markdown`-rendering molecules built for Event descriptions
   (`docs/design/04-events-and-forms.md`'s "markdown" note) rather than
   introducing a second markdown stack. Once `IN_REVIEW` or later, the
   proposal is presumably read-only for its author — confirm as part of
   design.
3. **Comment UI**: top-level comment box + reply-to-a-top-level-comment
   only; no reply-to-a-reply affordance in the UI (backed by the
   application-layer cap above).
4. **Admin decision UI**: a `proposals:manage` (or reuse an existing
   permission — see open questions) admin view listing proposals by status,
   with an approve/reject action requiring a reason, mirroring the
   participant-decision confirm dialog pattern
   (`docs/design/04-events-and-forms.md`'s "Admin decisions" section) —
   type-to-confirm isn't necessarily warranted here (lower blast radius
   than bulk-rejecting event registrants), but the "reason required, shown
   to the author" shape should match.
5. **Notifications**: does the author get emailed on a status change (like
   `EventParticipant` decisions do), or is this surfaced in-app only (a
   dashboard "your proposals" list)? See open questions — this determines
   whether it plugs into the existing synchronous-email pattern or not at
   all.

## Open questions (needs a product decision before/while building)

- **Likes**: keep `ProposalLike`/`ProposalCommentLike` for v1 (community
  can upvote proposals/comments) or drop that schema as unused?
- **Permission**: new `proposals:manage`/`proposals:decide` permissions in
  `rbac.ts`, or does an existing one (e.g. `reports:view`, or a new
  standalone one) fit better? Also: ADMIN and SUPERADMIN both, or
  SUPERADMIN-only, mirroring the same "who decides" question already open
  for the audit trail and Noticias approval?
- **Author edit window**: can the author edit their proposal after
  submission, or only while `PENDING` (before an admin starts reviewing)?
- **Notification on decision**: email the author, in-app only, or both?
- **Visibility (narrowed, 2026-09-21)**: given "public by default, hide as
  a distinct moderation action" (see "Visibility & moderation" above) —
  should hiding require a **different permission** than deciding
  (approve/reject), so the person who can make an idea disappear isn't
  automatically the same person deciding whether to act on it? Recommend
  yes (e.g. `proposals:moderate` separate from `proposals:manage`), since
  that's the concrete lever against one admin holding both the "we don't
  like this" and "make it vanish" powers unchecked. Also: does a hidden
  proposal's _existence_ stay visible to the author (so they at least know
  it was moderated, without necessarily seeing the internal reason), or
  does it disappear for them too?
