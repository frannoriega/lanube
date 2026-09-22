# Milestone 6 — Teams & Organizations

> **Decided (2026-09-21):** no org-level nesting in v1 — confirmed. `Organization`
> stays flat; `Team` (optionally under one `Organization`) is the only
> subdivision mechanism. If a real ≥2-level case appears later, that's a
> `parentOrganizationId` self-relation added then, not built speculatively now.
>
> **Also decided:** Organizations are **admin-provisioned** (superadmin sets
> one up, its lead invites members), Teams are **self-service** (any user can
> start one). Whole-space org booking reuses the `Event`-style trick — an
> `ORGANIZATION` reservation with `actorSize` = full resource capacity, no new
> reservable subtype — and **always** requires admin approval, regardless of
> the resource's `exclusive` flag.

## Use case (as described 2026-09-21)

La Nube currently only models individual members. In practice, people show
up in groups: an ad hoc team for a hackathon or a friends' side project
(no formal affiliation), or as part of a formal organization (a university,
a company) that may itself be internally divided into areas. Needs:

- **Team**: a group of members. Can be standalone, or belong to an
  Organization.
- **Organization**: can subdivide into "areas" — the request as stated is a
  **recursive nested structure** (an org can contain sub-orgs, to arbitrary
  depth).
- **Membership management without a member directory**: orgs/teams must be
  able to manage who's in them, but must **not** get to browse the full
  registered-user catalog to do it — proposed mechanism is **email
  invites**.
- **Team size drives reservation capacity** — a team's booking should
  occupy capacity proportional to its member count.
- **Whether Orgs can reserve at all** is undecided; the concrete legitimate
  case raised is an org booking an entire space for an event (any resource,
  exclusive or not — they're claiming the whole space, so no per-seat
  capacity check applies), distinct from individual/team bookings that
  compete for capacity normally.

## Engineering input — where I'd push back

**Recursive nested organizations: skip it for v1.** The concrete example
given — "a company handling different teams" — is already exactly what
`Team` models: a Team optionally belongs to one `Organization`. That's one
level of nesting, not recursion. Genuine recursion (an org's sub-org
containing its own sub-orgs) buys you very little here and costs real
complexity everywhere it touches:

- Capacity rollups get ambiguous — does a sub-org's reservation draw
  against its own member count only, or roll up its descendants' members
  too? That's a real design question with no obvious default.
- Membership/permission questions multiply: can a sub-org invite members
  the parent org can't see? Can a sub-org be moved under a different
  parent later? Cycles need explicit prevention.
- UI cost: breadcrumbs, a tree picker instead of a flat dropdown, "which
  level am I inviting someone into" — all for a feature with, right now,
  zero named concrete scenario that needs more than one level.

**Recommendation**: build `Organization` flat (no self-nesting) for v1,
with `Team` as the one and only subdivision mechanism (already true in the
schema — `Team.organizationId`, currently required, would become
**optional** to also support standalone teams per the ask). If a real
2-level case shows up later (e.g. a university's faculties each containing
their own departments), that's the moment to add a single
`parentOrganizationId` self-relation with `WITH RECURSIVE` queries — a
much smaller, better-motivated change than building unbounded recursion
speculatively now. Pushing back here, not vetoing — if there's a concrete
case that specifically needs ≥2 levels of org nesting today (not just
"might someday"), that changes the calculus and it's worth building
correctly from the start rather than retrofitting.

**Should orgs reserve directly? I'd lean the same way you did (no), with
your stated exception (whole-space event booking).** Letting an
`Organization` hold arbitrary capacity-competing bookings the way a `Team`
does raises the same rollup ambiguity as nesting (which member count?).
The whole-space case sidesteps that entirely — it's not "how many seats does
this org need," it's "give us the space, full stop," which the system
already knows how to express (see below).

**Good news on the hard part**: the SQL layer already has almost
everything needed for team/org-sized bookings. `ReservableType` already
includes `ORGANIZATION` and `TEAM` (not just `USER`/`EVENT`), and
`get_actor_size()` already computes actor size correctly for both —
**live**, from `team_members`/`org_memberships` count, recomputed on every
ledger write via the existing `rebuild_reservation_ledger_forward()`
machinery Events already exercise. Confirmed: **zero application code
currently constructs a `TEAM` or `ORGANIZATION` reservation** — this was
evidently scaffolded in the original schema/SQL design and never finished
on the app side. This means the reservation-capacity mechanics for
"team size drives capacity" are not new work — they're wiring an existing,
untested-in-anger DB capability into the app layer for the first time.

## What needs building

1. **Schema changes**:
   - `Team.organizationId` → optional (standalone teams).
   - New `OrgInvite` / `TeamInvite` models (email, token, expiry, target
     org/team, inviter) — same shape as `VerificationToken`, reused rather
     than reinvented.
   - A way to mark an org's whole-space booking distinct from a
     capacity-competing one (likely: reuse the `Event`-style pattern —
     `actorSize` = resource capacity — rather than a new reservable
     subtype; needs a decision, see open questions).
2. **Org/Team management UI**: create org/team, invite by email (accept
   flow creates the `OrgMembership`/`TeamMember` row on accept, mirroring
   email-verification's token-consume pattern), remove a member, see
   current members (org/team-scoped only — never the full user directory).
3. **Wire `TEAM`/`ORGANIZATION` into the booking flow**: extend whichever
   booking UI/API currently only builds `reservableType=USER` reservations
   to accept "book as a team I belong to" as an option, calling the same
   `create_reservation()` SQL path that already understands the other
   types.
4. **Whole-space org booking flow**: likely always requires admin approval
   regardless of the resource's `exclusive` flag (blocking an entire space
   is a bigger ask than a normal booking) — needs its own request path,
   not the standard capacity-checked booking form.
5. **Permissions**: Organization creation is superadmin-only (a new
   `organizations:manage` permission, or reuse an existing superadmin
   permission — see open questions); Team creation is open to any
   authenticated user.

## Open questions (needs a product decision before/while building)

- **Invite acceptance for a non-member**: if the invited email isn't a
  `RegisteredUser` yet, does accepting the invite short-circuit into
  signup (pre-filled email) the way email-confirmation does, or is org/team
  membership USER-only (must already have an account)?
- **Can a Team's membership change after reservations exist?** If someone
  leaves a team with a standing recurring booking, does the ledger
  recompute (it can, mechanically, via `get_actor_size()`) automatically,
  or does that need an explicit admin-triggered rebuild?
