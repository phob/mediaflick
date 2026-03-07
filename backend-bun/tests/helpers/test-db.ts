import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { createDb, type AppDb } from "../../src/db/client"

export interface TestDbHandle {
  rootDir: string
  dbPath: string
  db: AppDb
  cleanup: () => Promise<void>
}

export async function createTestDb(prefix: string): Promise<TestDbHandle> {
  const rootDir = await mkdtemp(join(tmpdir(), `mediaflick-${prefix}-`))
  const dbPath = join(rootDir, "test.db")
  const db = await createDb(dbPath)

  return {
    rootDir,
    dbPath,
    db,
    cleanup: async () => {
      await rm(rootDir, { recursive: true, force: true })
    },
  }
}
