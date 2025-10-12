import React from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getFileName, stripFolderPrefix } from "@/lib/files-folders"
import { MediaType, PlexConfig } from "@/lib/api/types"

interface FilePathTooltipProps {
  filePath: string
  mediaType: MediaType
  plexConfig: PlexConfig | null
  maxWidth?: string
  className?: string
}

export function FilePathTooltip({
  filePath,
  mediaType,
  plexConfig,
  maxWidth = "32rem",
  className = "",
}: FilePathTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div
            className={`overflow-hidden truncate ${className}`}
            style={{ maxWidth }}
          >
            <span className="cursor-help font-medium">{getFileName(filePath)}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side="right" 
          className="max-w-2xl break-all bg-popover text-popover-foreground border border-border shadow-md"
        >
          <div>
            <div className="text-muted-foreground">
              {stripFolderPrefix(filePath, mediaType, plexConfig).replace(/[^/\\]*$/, "")}
            </div>
            <div className="font-semibold text-foreground">
              {getFileName(stripFolderPrefix(filePath, mediaType, plexConfig))}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
