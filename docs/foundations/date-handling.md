# Foundation: date & time handling

Already stated as a standing principle (see memory: date-handling-principle),
recorded here so it lives in the repo, not just in agent memory:

**Store and transmit time as UNIX UTC milliseconds. Format dates
client-side, in the viewer's timezone and locale, as `dd/mm/YYYY`.**

## Why

- The database stores every domain timestamp as `BigInt` ms (see
  [`../design/02-architecture.md`](../design/02-architecture.md)), generated
  server-side via `clock_timestamp()`. A UTC-ms wire format matches that
  exactly — no timezone conversion happens on the server, avoiding a class
  of bug where the server's assumed timezone silently differs from the
  admin's or the DB host's.
- RRULE expansion runs in SQL via `generate_series()` against Postgres
  `now()`. Keeping the canonical representation as UTC ms end-to-end means
  the SQL layer, the API layer, and the client all agree on the same
  instant without a conversion step that could drift.
- Faketime (libfaketime, see `docker-compose.timemock.yml`) fakes the
  _server's_ clock. If formatting happened server-side, faked dates would
  need to also fake the server's timezone-formatting logic; keeping
  formatting client-side means faketime only ever needs to fake the raw
  instant, not any locale/timezone logic.
- `ServerTimeProvider` syncs the client's clock to the server's (via
  `serverNowMs`) specifically so client-side formatting/relative-time logic
  agrees with the (possibly faked) server time, without the server ever
  needing to know the client's timezone.

## How to apply

- New timestamp columns: `BigInt` ms, `dbgenerated` via
  `clock_timestamp()`, same as existing tables — never `Date`/`timestamptz`
  except inside the NextAuth-adapter tables already bridged by
  `prisma-auth-bridge.ts`.
- New API responses: send raw numbers (ms), not ISO strings, matching every
  existing endpoint.
- New UI: format with the existing date utils (`src/lib/utils/date.ts`,
  `unix-ms.ts`) at render time, not in a query/serializer.
