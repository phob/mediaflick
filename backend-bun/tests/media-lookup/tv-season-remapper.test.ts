import { describe, expect, test } from "bun:test"
import {
  applySeasonRemap,
  buildSeasonRemapPlan,
  type SourceEpisodeTuple,
} from "@/modules/media-lookup/tv-season-remapper"

describe("buildSeasonRemapPlan", () => {
  function buildSeasonTuples(lastEpisode: number): SourceEpisodeTuple[] {
    return [
      { seasonNumber: 1, episodeNumber: 1, episodeNumber2: 2 },
      ...Array.from({ length: lastEpisode - 2 }, (_, index) => ({
        seasonNumber: 1,
        episodeNumber: index + 3,
        episodeNumber2: null,
      })),
    ]
  }

  test("keeps compaction for contiguous TMDb numbering like DS9 season 1", () => {
    const plan = buildSeasonRemapPlan({
      seasonNumber: 1,
      tmdbEpisodeCount: 19,
      tmdbEpisodeNumbers: Array.from({ length: 19 }, (_, index) => index + 1),
      tuples: buildSeasonTuples(20),
    })

    expect(plan).not.toBeNull()
    expect(applySeasonRemap({ seasonNumber: 1, episodeNumber: 3, episodeNumber2: null }, plan)).toEqual({
      seasonNumber: 1,
      episodeNumber: 2,
      episodeNumber2: null,
    })
    expect(applySeasonRemap({ seasonNumber: 1, episodeNumber: 4, episodeNumber2: null }, plan)).toEqual({
      seasonNumber: 1,
      episodeNumber: 3,
      episodeNumber2: null,
    })
  })

  test("skips compaction for sparse TMDb numbering like Enterprise season 1", () => {
    const plan = buildSeasonRemapPlan({
      seasonNumber: 1,
      tmdbEpisodeCount: 25,
      tmdbEpisodeNumbers: [1, ...Array.from({ length: 24 }, (_, index) => index + 3)],
      tuples: buildSeasonTuples(26),
    })

    expect(plan).toBeNull()
    expect(applySeasonRemap({ seasonNumber: 1, episodeNumber: 4, episodeNumber2: null }, plan)).toEqual({
      seasonNumber: 1,
      episodeNumber: 4,
      episodeNumber2: null,
    })
  })
})
