import { Input, Select, SelectItem, Button, Tooltip } from "@nextui-org/react"
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
            key={index} 
            className="flex gap-2 items-center p-2 rounded-lg bg-gray-900/50 border border-gray-800 transition-colors hover:border-gray-700"
          >
            <Input
              label="Source Folder"
              value={mapping.sourceFolder}
              onChange={(e) => {
                const newMappings = [...config.plex.folderMappings]
                newMappings[index] = { ...mapping, sourceFolder: e.target.value }
                onConfigChange({
                  ...config,
                  plex: { ...config.plex, folderMappings: newMappings }
                })
              }}
              variant="bordered"
              classNames={{
                label: "text-gray-400",
                input: "text-gray-300",
                inputWrapper: "border-gray-800 hover:border-gray-700 group-data-[focus=true]:border-primary",
                base: "flex-1",
              }}
            />
            <Input
              label="Destination Folder"
              value={mapping.destinationFolder}
              onChange={(e) => {
                const newMappings = [...config.plex.folderMappings]
                newMappings[index] = { ...mapping, destinationFolder: e.target.value }
                onConfigChange({
                  ...config,
                  plex: { ...config.plex, folderMappings: newMappings }
                })
              }}
              variant="bordered"
              classNames={{
                label: "text-gray-400",
                input: "text-gray-300",
                inputWrapper: "border-gray-800 hover:border-gray-700 group-data-[focus=true]:border-primary",
                base: "flex-1",
              }}
            />
            <Select
              label="Media Type"
              selectedKeys={[mapping.mediaType]}
              onChange={(e) => {
                const newMappings = [...config.plex.folderMappings]
                newMappings[index] = { ...mapping, mediaType: e.target.value as MediaType }
                onConfigChange({
                  ...config,
                  plex: { ...config.plex, folderMappings: newMappings }
                })
              }}
              variant="bordered"
              classNames={{
                label: "text-gray-400",
                value: "text-gray-300",
                trigger: "border-gray-800 hover:border-gray-700 data-[open=true]:border-primary",
                base: "w-[200px]",
              }}
            >
              {Object.values(MediaType).map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </Select>
            <Tooltip content="Delete mapping">
              <Button
                isIconOnly
                color="danger"
                variant="light"
                onPress={() => handleDeleteMapping(index)}
                className="self-end mb-2"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </Tooltip>
          </div>
        ))}

        {/* Add New Mapping */}
        <div className="flex gap-2 items-center p-2 rounded-lg bg-gray-900/30 border border-dashed border-gray-800 transition-colors hover:border-gray-700">
          <Input
            label="New Source Folder"
            placeholder="Path to source folder"
            value={newMapping.sourceFolder}
            onChange={(e) => setNewMapping(prev => ({ ...prev, sourceFolder: e.target.value }))}
            variant="bordered"
            classNames={{
              label: "text-gray-400",
              input: "text-gray-300",
              inputWrapper: "border-gray-800 hover:border-gray-700 group-data-[focus=true]:border-primary",
              base: "flex-1",
            }}
          />
          <Input
            label="New Destination Folder"
            placeholder="Path to destination folder"
            value={newMapping.destinationFolder}
            onChange={(e) => setNewMapping(prev => ({ ...prev, destinationFolder: e.target.value }))}
            variant="bordered"
            classNames={{
              label: "text-gray-400",
              input: "text-gray-300",
              inputWrapper: "border-gray-800 hover:border-gray-700 group-data-[focus=true]:border-primary",
              base: "flex-1",
            }}
          />
          <Select
            label="Media Type"
            selectedKeys={[newMapping.mediaType]}
            onChange={(e) => setNewMapping(prev => ({ ...prev, mediaType: e.target.value as MediaType }))}
            variant="bordered"
            classNames={{
              label: "text-gray-400",
              value: "text-gray-300",
              trigger: "border-gray-800 hover:border-gray-700 data-[open=true]:border-primary",
              base: "w-[200px]",
            }}
          >
            {Object.values(MediaType).map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </Select>
          <Tooltip content="Add new mapping">
            <Button
              isIconOnly
              color="primary"
              variant="light"
              onPress={handleAddMapping}
              isDisabled={!newMapping.sourceFolder || !newMapping.destinationFolder}
              className="self-end mb-2"
            >
              <FolderPlus className="w-5 h-5" />
            </Button>
          </Tooltip>
        </div>
      </div>
    </section>
  )
}

export default FolderMappings 