import type { AppContext } from "@/app/context"
import { cleanupDeadSymlinks } from "@/modules/symlink/symlink-service"
import { json } from "@/shared/http"

export async function handleSymlinkRoute(request: Request, context: AppContext): Promise<Response | null> {
  const pathname = new URL(request.url).pathname

  if (request.method === "POST" && pathname === "/api/symlink/cleanup") {
    const config = await context.configStore.get()

    for (const mapping of config.plex.folderMappings) {
      await cleanupDeadSymlinks(mapping.destinationFolder)
    }

    return json({ message: "Symlink cleanup completed" })
  }

  return null
}
