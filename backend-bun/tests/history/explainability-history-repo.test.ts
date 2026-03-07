import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { eq } from "drizzle-orm"
import { scanHistoryItems } from "../../src/db/schema"
import { HistoryRepo } from "../../src/modules/history/history-repo"
import { createTestDb, type TestDbHandle } from "../helpers/test-db"

describe("history repo explainability persistence", () => {
  let handle: TestDbHandle
  let repo: HistoryRepo

  beforeEach(async () => {
    handle = await createTestDb("history-explainability")
    repo = new HistoryRepo(handle.db)
  })

  afterEach(async () => {
    await handle.cleanup()
  })

  test("persists explainability envelope with ordered match attempts", async () => {
    const run = await repo.createRun({ trigger: "test" })
    const attempt = await repo.createAttempt({
      runId: run.id,
      sourceFile: "/tmp/Show.Name.S01E01.mkv",
      mediaType: "TvShows",
    })

    await repo.recordExplainability({
      attemptId: attempt.id,
      explainability: {
        identification: {
          parser: "tv-filename",
          titleCandidates: ["show name"],
          selectedTitle: "Show Name",
          selectedYear: 2024,
          provider: "tmdb",
          providerQuery: "12345",
          providerResultId: 12345,
          providerResultTitle: "Show Name",
        },
        classification: {
          numberingStrategy: "episode-group-remap",
          sourceSeasonNumber: 1,
          sourceEpisodeNumber: 1,
          sourceEpisodeNumber2: null,
          resolvedSeasonNumber: 1,
          resolvedEpisodeNumber: 3,
          resolvedEpisodeNumber2: null,
          usedEpisodeGroup: true,
          confidence: {
            score: 0.88,
            factors: ["tmdb-metadata", "episode-group-selection"],
          },
        },
        matchAttempts: [
          {
            order: 1,
            provider: "tmdb",
            query: "12345",
            outcome: "match",
            detail: "Resolved S1E3",
            causeCode: null,
          },
          {
            order: 2,
            provider: "tmdb",
            query: "12345 secondary",
            outcome: "match",
            detail: "Resolved secondary tuple",
            causeCode: null,
          },
        ],
        unresolvedCause: {
          code: "tv-episode-detection-failed",
          message: "sample message",
        },
      },
    })

    const listed = await repo.listAttempts({ page: 1, pageSize: 10 })
    expect(listed.items.length).toBe(1)
    expect(listed.items[0]!.explainability.matchAttempts.map(item => item.order)).toEqual([1, 2])
    expect(listed.items[0]!.explainability.unresolvedCause?.code).toBe("tv-episode-detection-failed")
    expect(listed.items[0]!.explainability.classification?.numberingStrategy).toBe("episode-group-remap")
  })

  test("maps null explainability rows to stable empty shape", async () => {
    const run = await repo.createRun({ trigger: "test" })
    const attempt = await repo.createAttempt({
      runId: run.id,
      sourceFile: "/tmp/Movie.2024.mkv",
      mediaType: "Movies",
    })

    await handle.db
      .update(scanHistoryItems)
      .set({ explainability: null })
      .where(eq(scanHistoryItems.id, attempt.id))

    const listed = await repo.listAttempts({ page: 1, pageSize: 10 })
    expect(listed.items[0]!.explainability.identification.parser).toBe("none")
    expect(listed.items[0]!.explainability.matchAttempts).toEqual([])
    expect(listed.items[0]!.explainability.unresolvedCause).toBeNull()
  })
})
