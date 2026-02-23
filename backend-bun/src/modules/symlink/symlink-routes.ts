import { Hono } from "hono"
import { ENTRYPOINTS } from "@/app/entrypoints"
import type { AppContext } from "@/app/context"
import { cleanupDeadSymlinks } from "@/modules/symlink/symlink-service"

export function createSymlinkRouter(context: AppContext) {
  const router = new Hono()

  router.post(ENTRYPOINTS.api.symlink.cleanup, async c => {
    const config = await context.configStore.get()

    for (const mapping of config.plex.folderMappings) {
      await cleanupDeadSymlinks(mapping.destinationFolder)
    }

    return c.json({ message: "Symlink cleanup completed" })
  })

  return router
}
