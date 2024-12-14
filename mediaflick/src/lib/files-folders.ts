import { MediaType, PlexConfig } from "./api/types"

export const stripFolderPrefix = (path: string, mediaType: MediaType, plexConfig: PlexConfig | null) => {
  if (!plexConfig || !path) return path

  const mapping = plexConfig.folderMappings.find((m) => m.mediaType === mediaType)
  if (!mapping) return path

  if (path.startsWith(mapping.sourceFolder)) {
    return path.slice(mapping.sourceFolder.length).replace(/^[/\\]+/, "")
  }

  if (path.startsWith(mapping.destinationFolder)) {
    return path.slice(mapping.destinationFolder.length).replace(/^[/\\]+/, "")
  }

  const lastSlashIndex = path.lastIndexOf("/")
  const lastBackslashIndex = path.lastIndexOf("\\")
  const lastIndex = Math.max(lastSlashIndex, lastBackslashIndex)
  if (lastIndex >= 0) {
    return path.slice(0, lastIndex + 1)
  }

  return path
}

export const getFileName = (filePath: string) => {
  return filePath.split(/[\\/]/).pop() || filePath
}
