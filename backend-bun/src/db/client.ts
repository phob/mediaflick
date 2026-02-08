import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"
import { Database } from "bun:sqlite"
import { sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/bun-sqlite"
import * as schema from "@/db/schema"

export type AppDb = Awaited<ReturnType<typeof createDb>>

export async function createDb(dbPath: string) {
  await mkdir(dirname(dbPath), { recursive: true })
  const sqlite = new Database(dbPath, { create: true, strict: false })
  sqlite.exec("PRAGMA journal_mode = WAL;")
  sqlite.exec("PRAGMA busy_timeout = 5000;")

  const db = drizzle(sqlite, { schema })
  await ensureSchema(db)

  return db
}

async function ensureSchema(db: ReturnType<typeof drizzle<typeof schema>>): Promise<void> {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS "ScannedFiles" (
      "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "SourceFile" TEXT NOT NULL,
      "DestFile" TEXT NULL,
      "FileSize" INTEGER NULL,
      "FileHash" TEXT NULL,
      "MediaType" TEXT NULL,
      "TmdbId" INTEGER NULL,
      "ImdbId" TEXT NULL,
      "Title" TEXT NULL,
      "Year" INTEGER NULL,
      "Genres" TEXT NULL,
      "SeasonNumber" INTEGER NULL,
      "EpisodeNumber" INTEGER NULL,
      "EpisodeNumber2" INTEGER NULL,
      "Status" TEXT NOT NULL,
      "CreatedAt" TEXT NOT NULL,
      "UpdatedAt" TEXT NULL,
      "VersionUpdated" INTEGER NOT NULL DEFAULT 0,
      "UpdateToVersion" INTEGER NOT NULL DEFAULT 0
    )
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS "IX_ScannedFiles_SourceFile" ON "ScannedFiles" ("SourceFile")`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS "IX_ScannedFiles_DestFile" ON "ScannedFiles" ("DestFile")`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS "IX_ScannedFiles_TmdbId" ON "ScannedFiles" ("TmdbId")`)
  await db.run(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS "IX_ScannedFiles_Source_Dest_Episode" ON "ScannedFiles" ("SourceFile", "DestFile", "EpisodeNumber")`,
  )

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS "series_identity_map" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "normalized_title" TEXT NOT NULL,
      "year" INTEGER NULL,
      "tmdb_id" INTEGER NOT NULL,
      "imdb_id" TEXT NULL,
      "canonical_title" TEXT NOT NULL,
      "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "last_verified_at" TEXT NULL
    )
  `)
  await db.run(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS "ux_series_identity_normalized_year" ON "series_identity_map" ("normalized_title", "year")`,
  )
  await db.run(sql`CREATE INDEX IF NOT EXISTS "ix_series_identity_tmdb_id" ON "series_identity_map" ("tmdb_id")`)

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS "series_aliases" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "identity_id" INTEGER NOT NULL,
      "alias_raw" TEXT NOT NULL,
      "alias_normalized" TEXT NOT NULL,
      "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("identity_id") REFERENCES "series_identity_map" ("id") ON DELETE CASCADE
    )
  `)
  await db.run(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS "ux_series_alias_identity_alias" ON "series_aliases" ("identity_id", "alias_normalized")`,
  )
  await db.run(sql`CREATE INDEX IF NOT EXISTS "ix_series_alias_normalized" ON "series_aliases" ("alias_normalized")`)
}
