# AGENTS.md

Backend-specific instructions for TV episode remapping:

- Treat source filenames as the source numbering.
- Only apply season compaction when TMDb season numbering is contiguous and starts at `1` with no gaps.
- The common trigger is a source double-episode file such as `S01E01-E02` or `S01E01E02` that causes source episode numbers to run one higher than TMDb after the opener.
- If TMDb numbering is contiguous, compaction is allowed:
  - Example: `E01-E02`, then `E03`, `E04`, `E05` can map to TMDb `1`, `2`, `3`, `4`.
  - `Star Trek: Deep Space Nine` season 1 behaves this way.
- If TMDb numbering is sparse or preserves gaps, compaction is forbidden even when `E01-E02` exists in the source:
  - Example: TMDb episode numbers `1, 3, 4, 5, ...` must stay `1, 3, 4, 5, ...`.
  - `Star Trek: Enterprise` season 1 behaves this way.
- Never infer compaction from counts alone. A source max episode of `26` versus a TMDb count of `25` is not enough by itself.
- When changing remap logic, verify both cases:
  - DS9 season 1 should still compact after `E01-E02`.
  - Enterprise season 1 should not compact after `E01-E02`.
