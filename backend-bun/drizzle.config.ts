import type { Config } from "drizzle-kit"

const dbFile = process.env.BACKEND_BUN_DB_PATH ?? "./config/plexscan.db"

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: dbFile,
  },
  strict: true,
} satisfies Config
