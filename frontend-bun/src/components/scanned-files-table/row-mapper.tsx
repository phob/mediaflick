import React from "react"
import { FilePathTooltip } from "./file-path-tooltip"
import { DateTooltip } from "./date-tooltip"
import { ScannedFile, PlexConfig, Row } from "@/lib/api/types"
import { formatEpisodeNumber, getMediaTypeLabel, getStatusClass, getStatusLabel, formatBytes } from "@/lib/format-helper"

interface RowMapperOptions {
  plexConfig: PlexConfig | null
}

export function createRowMapper({ plexConfig }: RowMapperOptions) {
  return (file: ScannedFile): Row => ({
    key: file.id,
    sourceFile: (
      <div className="flex flex-col whitespace-nowrap">
        <FilePathTooltip
          filePath={file.sourceFile}
          mediaType={file.mediaType}
          plexConfig={plexConfig}
          maxWidth="32rem"
        />
      </div>
    ),
    destFile: (
      <div className="flex flex-col whitespace-nowrap">
        {file.destFile ? (
          <FilePathTooltip
            filePath={file.destFile}
            mediaType={file.mediaType}
            plexConfig={plexConfig}
            maxWidth="28rem"
          />
        ) : (
          <span>-</span>
        )}
      </div>
    ),
    genres: (
      <span className="block max-w-[20rem] truncate whitespace-nowrap" title={file.genres?.join(", ") || undefined}>
        {file.genres?.join(", ")}
      </span>
    ),
    tmdbId: file.tmdbId ?? 0,
    imdbId: file.imdbId ?? "-",
    mediaType: getMediaTypeLabel(file.mediaType),
    episode: formatEpisodeNumber(file.seasonNumber, file.episodeNumber),
    status: (
      <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusClass(file.status)}`}>
        {getStatusLabel(file.status)}
      </span>
    ),
    fileSize: <span className="font-mono">{formatBytes(file.fileSize)}</span>,
    fileHash: file.fileHash ? (
      <span className="font-mono" title={file.fileHash}>
        {file.fileHash.slice(0, 10)}…{file.fileHash.slice(-6)}
      </span>
    ) : (
      <span>-</span>
    ),
    createdAt: <DateTooltip date={file.createdAt} />,
    updatedAt: <DateTooltip date={file.updatedAt} />,
  })
}
