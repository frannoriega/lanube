import "dotenv/config";
import path from "node:path";
import type { PrismaConfig } from "prisma";

export default {
  schema: "prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
    path: path.join("prisma", "migrations"),
  },
  views: {
    path: path.join("prisma", "views"),
  },
  typedSql: {
    path: path.join("prisma", "queries"),
  }
} satisfies PrismaConfig;