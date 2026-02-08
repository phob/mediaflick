import { relations, sql } from "drizzle-orm"
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const scannedFiles = sqliteTable(
  "ScannedFiles",
  {
    id: integer("Id").primaryKey({ autoIncrement: true }),
    sourceFile: text("SourceFile").notNull(),
    destFile: text("DestFile"),
    fileSize: integer("FileSize"),
    fileHash: text("FileHash"),
    mediaType: text("MediaType"),
    tmdbId: integer("TmdbId"),
    imdbId: text("ImdbId"),
    title: text("Title"),
    year: integer("Year"),
    genres: text("Genres"),
    seasonNumber: integer("SeasonNumber"),
    episodeNumber: integer("EpisodeNumber"),
    episodeNumber2: integer("EpisodeNumber2"),
    status: text("Status").notNull(),
    createdAt: text("CreatedAt").notNull(),
    updatedAt: text("UpdatedAt"),
    versionUpdated: integer("VersionUpdated").notNull().default(0),
    updateToVersion: integer("UpdateToVersion").notNull().default(0),
  },
  table => [
    index("IX_ScannedFiles_SourceFile").on(table.sourceFile),
    index("IX_ScannedFiles_DestFile").on(table.destFile),
    index("IX_ScannedFiles_TmdbId").on(table.tmdbId),
    uniqueIndex("IX_ScannedFiles_Source_Dest_Episode").on(
      table.sourceFile,
      table.destFile,
      table.episodeNumber,
    ),
  ],
)

export const seriesIdentityMap = sqliteTable(
  "series_identity_map",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    normalizedTitle: text("normalized_title").notNull(),
    year: integer("year"),
    tmdbId: integer("tmdb_id").notNull(),
    imdbId: text("imdb_id"),
    canonicalTitle: text("canonical_title").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    lastVerifiedAt: text("last_verified_at"),
  },
  table => [
    uniqueIndex("ux_series_identity_normalized_year").on(table.normalizedTitle, table.year),
    index("ix_series_identity_tmdb_id").on(table.tmdbId),
  ],
)

export const seriesAliases = sqliteTable(
  "series_aliases",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    identityId: integer("identity_id")
      .notNull()
      .references(() => seriesIdentityMap.id, { onDelete: "cascade" }),
    aliasRaw: text("alias_raw").notNull(),
    aliasNormalized: text("alias_normalized").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  table => [
    uniqueIndex("ux_series_alias_identity_alias").on(table.identityId, table.aliasNormalized),
    index("ix_series_alias_normalized").on(table.aliasNormalized),
  ],
)

export const seriesIdentityRelations = relations(seriesIdentityMap, ({ many }) => ({
  aliases: many(seriesAliases),
}))

export const seriesAliasRelations = relations(seriesAliases, ({ one }) => ({
  identity: one(seriesIdentityMap, {
    fields: [seriesAliases.identityId],
    references: [seriesIdentityMap.id],
  }),
}))
