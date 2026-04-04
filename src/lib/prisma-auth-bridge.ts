import "server-only";
import { dateToUnixMs, unixMsToDate } from "@/lib/unix-ms";

type Row = Record<string, unknown>;

function writeUserData(data: Row | undefined) {
  if (!data) return;
  if (data.emailVerified instanceof Date) {
    data.emailVerified = dateToUnixMs(data.emailVerified);
  }
}

function readUser(u: Row | null | undefined) {
  if (!u) return;
  const v = u.emailVerified;
  if (typeof v === "bigint") u.emailVerified = unixMsToDate(v);
}

function writeSessionData(data: Row | undefined) {
  if (!data) return;
  if (data.expires instanceof Date) {
    data.expires = dateToUnixMs(data.expires);
  }
}

function readSession(s: Row | null | undefined) {
  if (!s) return;
  const e = s.expires;
  if (typeof e === "bigint") s.expires = unixMsToDate(e);
  if (s.user && typeof s.user === "object") readUser(s.user as Row);
}

function writeVtData(data: Row | undefined) {
  if (!data) return;
  if (data.expires instanceof Date) {
    data.expires = dateToUnixMs(data.expires);
  }
}

function readVt(v: Row | null | undefined) {
  if (!v) return;
  const e = v.expires;
  if (typeof e === "bigint") v.expires = unixMsToDate(e);
}

function readAccount(a: Row | null | undefined) {
  if (!a) return;
  if (a.user && typeof a.user === "object") readUser(a.user as Row);
}

function mapMany(rows: unknown, fn: (r: Row) => void) {
  if (rows == null) return;
  if (Array.isArray(rows)) {
    for (const r of rows) {
      if (r && typeof r === "object") fn(r as Row);
    }
  } else if (typeof rows === "object") {
    fn(rows as Row);
  }
}

type QueryCtx = { args: { data?: unknown; create?: unknown; update?: unknown }; query: (a: unknown) => Promise<unknown> };

/** NextAuth PrismaAdapter uses Date; DB stores BIGINT ms. */
export const authTimestampBridgeExtension = {
  query: {
    user: {
      async create({ args, query }: QueryCtx) {
        writeUserData(args.data as Row);
        const r = await query(args);
        readUser(r as Row);
        return r;
      },
      async update({ args, query }: QueryCtx) {
        writeUserData(args.data as Row);
        const r = await query(args);
        readUser(r as Row);
        return r;
      },
      async upsert({ args, query }: QueryCtx) {
        writeUserData(args.create as Row);
        writeUserData(args.update as Row);
        const r = await query(args);
        readUser(r as Row);
        return r;
      },
      async findUnique({ args, query }: { args: unknown; query: (a: unknown) => Promise<unknown> }) {
        const r = await query(args);
        readUser(r as Row);
        return r;
      },
      async findFirst({ args, query }: { args: unknown; query: (a: unknown) => Promise<unknown> }) {
        const r = await query(args);
        readUser(r as Row);
        return r;
      },
      async findMany({ args, query }: { args: unknown; query: (a: unknown) => Promise<unknown> }) {
        const rows = await query(args);
        mapMany(rows, readUser);
        return rows;
      },
    },
    session: {
      async create({ args, query }: QueryCtx) {
        writeSessionData(args.data as Row);
        const r = await query(args);
        readSession(r as Row);
        return r;
      },
      async update({ args, query }: QueryCtx) {
        writeSessionData(args.data as Row);
        const r = await query(args);
        readSession(r as Row);
        return r;
      },
      async upsert({ args, query }: QueryCtx) {
        writeSessionData(args.create as Row);
        writeSessionData(args.update as Row);
        const r = await query(args);
        readSession(r as Row);
        return r;
      },
      async findUnique({ args, query }: { args: unknown; query: (a: unknown) => Promise<unknown> }) {
        const r = await query(args);
        readSession(r as Row);
        return r;
      },
      async findFirst({ args, query }: { args: unknown; query: (a: unknown) => Promise<unknown> }) {
        const r = await query(args);
        readSession(r as Row);
        return r;
      },
      async findMany({ args, query }: { args: unknown; query: (a: unknown) => Promise<unknown> }) {
        const rows = await query(args);
        mapMany(rows, readSession);
        return rows;
      },
    },
    verificationToken: {
      async create({ args, query }: QueryCtx) {
        writeVtData(args.data as Row);
        const r = await query(args);
        readVt(r as Row);
        return r;
      },
      async createMany({ args, query }: QueryCtx) {
        const data = (args as { data?: unknown }).data;
        if (Array.isArray(data)) {
          for (const row of data) writeVtData(row as Row);
        } else {
          writeVtData(data as Row);
        }
        return query(args);
      },
      async update({ args, query }: QueryCtx) {
        writeVtData(args.data as Row);
        const r = await query(args);
        readVt(r as Row);
        return r;
      },
      async upsert({ args, query }: QueryCtx) {
        writeVtData(args.create as Row);
        writeVtData(args.update as Row);
        const r = await query(args);
        readVt(r as Row);
        return r;
      },
      async findUnique({ args, query }: { args: unknown; query: (a: unknown) => Promise<unknown> }) {
        const r = await query(args);
        readVt(r as Row);
        return r;
      },
      async findFirst({ args, query }: { args: unknown; query: (a: unknown) => Promise<unknown> }) {
        const r = await query(args);
        readVt(r as Row);
        return r;
      },
      async findMany({ args, query }: { args: unknown; query: (a: unknown) => Promise<unknown> }) {
        const rows = await query(args);
        mapMany(rows, readVt);
        return rows;
      },
      async delete({ args, query }: { args: unknown; query: (a: unknown) => Promise<unknown> }) {
        const r = await query(args);
        readVt(r as Row);
        return r;
      },
    },
    account: {
      async findUnique({ args, query }: { args: unknown; query: (a: unknown) => Promise<unknown> }) {
        const r = await query(args);
        readAccount(r as Row);
        return r;
      },
      async findFirst({ args, query }: { args: unknown; query: (a: unknown) => Promise<unknown> }) {
        const r = await query(args);
        readAccount(r as Row);
        return r;
      },
      async findMany({ args, query }: { args: unknown; query: (a: unknown) => Promise<unknown> }) {
        const rows = await query(args);
        mapMany(rows, readAccount);
        return rows;
      },
    },
  },
};
