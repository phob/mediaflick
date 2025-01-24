import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ConfigurationPayload, MediaType, FolderMappingConfig } from "@/lib/api/types"
import { SectionTitle } from "./section-title"
import { Trash2, FolderPlus } from "lucide-react"
import { useState } from "react"

type FolderMappingsProps = {
  config: ConfigurationPayload
  onConfigChange: (newConfig: ConfigurationPayload) => void
}

const FolderMappings = ({ config, onConfigChange }: FolderMappingsProps) => {
  const [newMapping, setNewMapping] = useState<FolderMappingConfig>({
    sourceFolder: "",
    destinationFolder: "",
    mediaType: MediaType.Movies,
  })

  const handleAddMapping = () => {
    if (newMapping.sourceFolder && newMapping.destinationFolder) {
      onConfigChange({
        ...config,
        plex: {
          ...config.plex,
          folderMappings: [...config.plex.folderMappings, newMapping],
        },
      })
      setNewMapping({
        sourceFolder: "",
        destinationFolder: "",
        mediaType: MediaType.Movies,
      })
    }
  }

  const handleDeleteMapping = (index: number) => {
    onConfigChange({
      ...config,
      plex: {
        ...config.plex,
        folderMappings: config.plex.folderMappings.filter((_, i) => i !== index),
      },
    })
  }

  return (
    <section className="space-y-4">
      <SectionTitle 
        title="Folder Mappings" 
        tooltip="Configure source and destination folders for your media files"
      />
      <div className="space-y-3 rounded-lg bg-black/20 p-4 border border-gray-800">
        {config.plex.folderMappings.map((mapping, index) => (
          <div 
            key={`${mapping.sourceFolder}-${mapping.destinationFolder}`}
            className="flex gap-2 items-center p-2 rounded-lg bg-gray-900/50 border border-gray-800 transition-colors hover:border-gray-700"
          >
            <Input
              placeholder="Source Folder"
              value={mapping.sourceFolder}
              onChange={(e) => {
                const newMappings = [...config.plex.folderMappings]
                newMappings[index] = { ...mapping, sourceFolder: e.target.value }
                onConfigChange({
                  ...config,
                  plex: { ...config.plex, folderMappings: newMappings }
                })
              }}
              className="flex-1 bg-transparent border-gray-800 hover:border-gray-700 focus:border-primary text-gray-300"
            />
            <Input
              placeholder="Destination Folder"
              value={mapping.destinationFolder}
              onChange={(e) => {
                const newMappings = [...config.plex.folderMappings]
                newMappings[index] = { ...mapping, destinationFolder: e.target.value }
                onConfigChange({
                  ...config,
                  plex: { ...config.plex, folderMappings: newMappings }
                })
              }}
              className="flex-1 bg-transparent border-gray-800 hover:border-gray-700 focus:border-primary text-gray-300"
            />
            <Select
              value={mapping.mediaType}
              onValueChange={(value) => {
                const newMappings = [...config.plex.folderMappings]
                newMappings[index] = { ...mapping, mediaType: value as MediaType }
                onConfigChange({
                  ...config,
                  plex: { ...config.plex, folderMappings: newMappings }
                })
              }}
            >
              <SelectTrigger className="w-[200px] bg-transparent border-gray-800 hover:border-gray-700 focus:border-primary text-gray-300">
                <SelectValue placeholder="Media Type" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(MediaType).map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteMapping(index)}
                    className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete mapping</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ))}

        {/* Add New Mapping */}
        <div className="flex gap-2 items-center p-2 rounded-lg bg-gray-900/30 border border-dashed border-gray-800 transition-colors hover:border-gray-700">
          <Input
            placeholder="New Source Folder"
            value={newMapping.sourceFolder}
            onChange={(e) => setNewMapping(prev => ({ ...prev, sourceFolder: e.target.value }))}
            className="flex-1 bg-transparent border-gray-800 hover:border-gray-700 focus:border-primary text-gray-300"
          />
          <Input
            placeholder="New Destination Folder"
            value={newMapping.destinationFolder}
            onChange={(e) => setNewMapping(prev => ({ ...prev, destinationFolder: e.target.value }))}
            className="flex-1 bg-transparent border-gray-800 hover:border-gray-700 focus:border-primary text-gray-300"
          />
          <Select
            value={newMapping.mediaType}
            onValueChange={(value) => setNewMapping(prev => ({ ...prev, mediaType: value as MediaType }))}
          >
            <SelectTrigger className="w-[200px] bg-transparent border-gray-800 hover:border-gray-700 focus:border-primary text-gray-300">
              <SelectValue placeholder="Media Type" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(MediaType).map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleAddMapping}
                  disabled={!newMapping.sourceFolder || !newMapping.destinationFolder}
                  className="text-primary hover:text-primary/90 hover:bg-primary/10"
                >
                  <FolderPlus className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Add new mapping</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </section>
  )
}

export default FolderMappings 