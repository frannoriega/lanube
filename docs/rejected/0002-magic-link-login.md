# Rejected: magic-link login

**Proposed**: passwordless sign-in via an emailed one-time link
(`/api/auth/magic-link`, `/auth/magic-link`). The route existed as a `501`
stub with a fully-written, commented-out reference implementation
(decode a base64 `email:timestamp` token, 24h expiry, auto-create the
`User` row) — someone sketched the whole thing but never wired it up or
called it from anywhere.

**Why it was tempting**: removes password friction for sign-in for members
who just want quick access.

**Why not**: La Nube authenticates with email + password (Credentials
provider) and already uses email for two other, narrower purposes —
confirming an email address and resetting a forgotten password (see
`docs/design/03-auth-and-permissions.md`). A separate passwordless
sign-in path isn't needed on top of that, and the stub's own approach
(a hand-rolled base64 token, not `VerificationToken`-backed) wouldn't have
matched the existing verification-token infrastructure anyway.

**Decided (2026-09-21)**: confirmed not in use — deleted the dead route
(`src/app/api/auth/magic-link/route.ts`) and its orphaned page
(`src/app/(management)/auth/magic-link/page.tsx`); neither was linked from
anywhere in the app. If passwordless sign-in is ever wanted again, design
it against `VerificationToken` (the same primitive email-confirm and
password-reset already use) rather than reviving the stub's bespoke token
format.
