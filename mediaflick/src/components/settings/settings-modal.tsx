import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input, Divider, Select, SelectItem } from "@nextui-org/react"
import { useState, useEffect } from "react"
import { mediaApi } from "@/lib/api/endpoints"
import { ConfigurationPayload, MediaType, FolderMappingConfig } from "@/lib/api/types"
import { Trash2, FolderPlus } from "lucide-react"

type SettingsModalProps = {
  isOpen: boolean
  onClose: () => void
}

const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const [config, setConfig] = useState<ConfigurationPayload>({
    plex: {
      host: "",
      port: 32400,
      plexToken: "",
      folderMappings: [],
      pollingInterval: 60,
      processNewFolderDelay: 30,
      apiEndpoint: "",
    },
    tmDb: {
      apiKey: "",
    },
    mediaDetection: {
      cacheDuration: 3600,
    },
  })
  const [isLoading, setIsLoading] = useState(false)
  const [newMapping, setNewMapping] = useState<FolderMappingConfig>({
    sourceFolder: "",
    destinationFolder: "",
    mediaType: MediaType.Movies,
  })

  useEffect(() => {
    if (isOpen) {
      loadConfig()
    }
  }, [isOpen])

  const loadConfig = async () => {
    try {
      setIsLoading(true)
      const data = await mediaApi.getAllConfigurations()
      setConfig(data as ConfigurationPayload)
    } catch (error) {
      console.error("Failed to load config:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setIsLoading(true)
      await mediaApi.setAllConfigurations(config)
      onClose()
    } catch (error) {
      console.error("Failed to save config:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddMapping = () => {
    if (newMapping.sourceFolder && newMapping.destinationFolder) {
      setConfig(prev => ({
        ...prev,
        plex: {
          ...prev.plex,
          folderMappings: [...prev.plex.folderMappings, newMapping],
        },
      }))
      setNewMapping({
        sourceFolder: "",
        destinationFolder: "",
        mediaType: MediaType.Movies,
      })
    }
  }

  const handleDeleteMapping = (index: number) => {
    setConfig(prev => ({
      ...prev,
      plex: {
        ...prev.plex,
        folderMappings: prev.plex.folderMappings.filter((_, i) => i !== index),
      },
    }))
  }

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      size="3xl"
      scrollBehavior="inside"
      classNames={{
        backdrop: "bg-black/50 backdrop-blur-sm",
        base: "bg-[#202020] border border-gray-800",
      }}
    >
      <ModalContent>
        <ModalHeader className="text-gray-200">Settings</ModalHeader>
        <ModalBody className="gap-6">
          <div className="space-y-6">
            {/* Plex Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-300">Plex Configuration</h3>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Host"
                  value={config.plex.host}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    plex: { ...prev.plex, host: e.target.value }
                  }))}
                  variant="bordered"
                  classNames={{
                    label: "text-gray-400",
                    input: "text-gray-300",
                  }}
                />
                <Input
                  label="Port"
                  type="number"
                  value={config.plex.port.toString()}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    plex: { ...prev.plex, port: parseInt(e.target.value) }
                  }))}
                  variant="bordered"
                  classNames={{
                    label: "text-gray-400",
                    input: "text-gray-300",
                  }}
                />
              </div>
              <Input
                label="Plex Token"
                value={config.plex.plexToken}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  plex: { ...prev.plex, plexToken: e.target.value }
                }))}
                variant="bordered"
                classNames={{
                  label: "text-gray-400",
                  input: "text-gray-300",
                }}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Polling Interval (seconds)"
                  type="number"
                  value={config.plex.pollingInterval.toString()}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    plex: { ...prev.plex, pollingInterval: parseInt(e.target.value) }
                  }))}
                  variant="bordered"
                  classNames={{
                    label: "text-gray-400",
                    input: "text-gray-300",
                  }}
                />
                <Input
                  label="Process New Folder Delay (seconds)"
                  type="number"
                  value={config.plex.processNewFolderDelay.toString()}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    plex: { ...prev.plex, processNewFolderDelay: parseInt(e.target.value) }
                  }))}
                  variant="bordered"
                  classNames={{
                    label: "text-gray-400",
                    input: "text-gray-300",
                  }}
                />
              </div>
              <Input
                label="API Endpoint"
                value={config.plex.apiEndpoint}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  plex: { ...prev.plex, apiEndpoint: e.target.value }
                }))}
                variant="bordered"
                classNames={{
                  label: "text-gray-400",
                  input: "text-gray-300",
                }}
              />
            </div>

            <Divider className="bg-gray-800" />

            {/* Folder Mappings */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-300">Folder Mappings</h3>
              <div className="space-y-3">
                {config.plex.folderMappings.map((mapping, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      label="Source Folder"
                      value={mapping.sourceFolder}
                      onChange={(e) => {
                        const newMappings = [...config.plex.folderMappings]
                        newMappings[index] = { ...mapping, sourceFolder: e.target.value }
                        setConfig(prev => ({
                          ...prev,
                          plex: { ...prev.plex, folderMappings: newMappings }
                        }))
                      }}
                      variant="bordered"
                      classNames={{
                        label: "text-gray-400",
                        input: "text-gray-300",
                        base: "flex-1",
                      }}
                    />
                    <Input
                      label="Destination Folder"
                      value={mapping.destinationFolder}
                      onChange={(e) => {
                        const newMappings = [...config.plex.folderMappings]
                        newMappings[index] = { ...mapping, destinationFolder: e.target.value }
                        setConfig(prev => ({
                          ...prev,
                          plex: { ...prev.plex, folderMappings: newMappings }
                        }))
                      }}
                      variant="bordered"
                      classNames={{
                        label: "text-gray-400",
                        input: "text-gray-300",
                        base: "flex-1",
                      }}
                    />
                    <Select
                      label="Media Type"
                      selectedKeys={[mapping.mediaType]}
                      onChange={(e) => {
                        const newMappings = [...config.plex.folderMappings]
                        newMappings[index] = { ...mapping, mediaType: e.target.value as MediaType }
                        setConfig(prev => ({
                          ...prev,
                          plex: { ...prev.plex, folderMappings: newMappings }
                        }))
                      }}
                      variant="bordered"
                      classNames={{
                        label: "text-gray-400",
                        value: "text-gray-300",
                        base: "w-[200px]",
                      }}
                    >
                      {Object.values(MediaType).map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </Select>
                    <Button
                      isIconOnly
                      color="danger"
                      variant="light"
                      onPress={() => handleDeleteMapping(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}

                {/* Add New Mapping */}
                <div className="flex gap-2 items-center">
                  <Input
                    label="New Source Folder"
                    value={newMapping.sourceFolder}
                    onChange={(e) => setNewMapping(prev => ({ ...prev, sourceFolder: e.target.value }))}
                    variant="bordered"
                    classNames={{
                      label: "text-gray-400",
                      input: "text-gray-300",
                      base: "flex-1",
                    }}
                  />
                  <Input
                    label="New Destination Folder"
                    value={newMapping.destinationFolder}
                    onChange={(e) => setNewMapping(prev => ({ ...prev, destinationFolder: e.target.value }))}
                    variant="bordered"
                    classNames={{
                      label: "text-gray-400",
                      input: "text-gray-300",
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
                      base: "w-[200px]",
                    }}
                  >
                    {Object.values(MediaType).map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </Select>
                  <Button
                    isIconOnly
                    color="primary"
                    variant="light"
                    onPress={handleAddMapping}
                  >
                    <FolderPlus className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>

            <Divider className="bg-gray-800" />

            {/* TMDb Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-300">TMDb Configuration</h3>
              <Input
                label="API Key"
                value={config.tmDb.apiKey}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  tmDb: { ...prev.tmDb, apiKey: e.target.value }
                }))}
                variant="bordered"
                classNames={{
                  label: "text-gray-400",
                  input: "text-gray-300",
                }}
              />
            </div>

            <Divider className="bg-gray-800" />

            {/* Media Detection Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-300">Media Detection</h3>
              <Input
                label="Cache Duration (seconds)"
                value={config.mediaDetection.cacheDuration.toString()}
                isReadOnly
                variant="faded"
                classNames={{
                  label: "text-gray-400",
                  input: "text-gray-300",
                }}
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="danger" variant="light" onPress={onClose} isDisabled={isLoading}>
            Cancel
          </Button>
          <Button color="primary" onPress={handleSave} isLoading={isLoading}>
            Save Changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default SettingsModal 