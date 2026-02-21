import { resolve } from "node:path"
import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { migrate } from "drizzle-orm/bun-sqlite/migrator"

const dbPath = process.env.BACKEND_BUN_DB_PATH ?? resolve(process.cwd(), "config", "plexscan.db")
const migrationsPath = resolve(process.cwd(), "src", "db", "migrations")

const sqlite = new Database(dbPath, { create: true })
const db = drizzle(sqlite)

await migrate(db, { migrationsFolder: migrationsPath })

console.log(`Migrations completed for ${dbPath}`)
