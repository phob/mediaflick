"use client"

import React from "react"
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input, Divider, Select, SelectItem, Tooltip } from "@nextui-org/react"
import { useState, useEffect } from "react"
import { mediaApi } from "@/lib/api/endpoints"
import { ConfigurationPayload, MediaType, FolderMappingConfig } from "@/lib/api/types"
import { Trash2, FolderPlus, Info } from "lucide-react"

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

  const SectionTitle = ({ title, tooltip }: { title: string; tooltip?: string }) => (
    <div className="flex items-center gap-2 mb-2">
      <h3 className="text-base font-semibold text-gray-200">{title}</h3>
      {tooltip && (
        <Tooltip content={tooltip}>
          <Info className="w-4 h-4 text-gray-400 cursor-help" />
        </Tooltip>
      )}
    </div>
  )

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      size="3xl"
      scrollBehavior="inside"
      classNames={{
        backdrop: "bg-black/50 backdrop-blur-sm",
        base: "bg-[#202020] border border-gray-800 shadow-2xl",
        header: "border-b border-gray-800",
        body: "p-6",
        footer: "border-t border-gray-800",
        closeButton: "hover:bg-white/5 active:bg-white/10",
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-gray-100">Settings</h2>
          <p className="text-sm text-gray-400">Configure your media management preferences</p>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-8">
            {/* Plex Settings */}
            <section className="space-y-4">
              <SectionTitle 
                title="Plex Configuration" 
                tooltip="Configure your Plex server connection settings"
              />
              <div className="space-y-4 rounded-lg bg-black/20 p-4 border border-gray-800">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Host"
                    placeholder="e.g. http://localhost"
                    value={config.plex.host}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      plex: { ...prev.plex, host: e.target.value }
                    }))}
                    variant="bordered"
                    classNames={{
                      label: "text-gray-400",
                      input: "text-gray-300",
                      inputWrapper: "border-gray-800 hover:border-gray-700 group-data-[focus=true]:border-primary",
                    }}
                  />
                  <Input
                    label="Port"
                    type="number"
                    placeholder="32400"
                    value={config.plex.port.toString()}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      plex: { ...prev.plex, port: parseInt(e.target.value) }
                    }))}
                    variant="bordered"
                    classNames={{
                      label: "text-gray-400",
                      input: "text-gray-300",
                      inputWrapper: "border-gray-800 hover:border-gray-700 group-data-[focus=true]:border-primary",
                    }}
                  />
                </div>
                <Input
                  label="Plex Token"
                  type="password"
                  value={config.plex.plexToken}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    plex: { ...prev.plex, plexToken: e.target.value }
                  }))}
                  variant="bordered"
                  classNames={{
                    label: "text-gray-400",
                    input: "text-gray-300",
                    inputWrapper: "border-gray-800 hover:border-gray-700 group-data-[focus=true]:border-primary",
                  }}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Polling Interval"
                    endContent={<span className="text-gray-500 text-sm">seconds</span>}
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
                      inputWrapper: "border-gray-800 hover:border-gray-700 group-data-[focus=true]:border-primary",
                    }}
                  />
                  <Input
                    label="Process New Folder Delay"
                    endContent={<span className="text-gray-500 text-sm">seconds</span>}
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
                      inputWrapper: "border-gray-800 hover:border-gray-700 group-data-[focus=true]:border-primary",
                    }}
                  />
                </div>
                <Input
                  label="API Endpoint"
                  placeholder="Optional custom API endpoint"
                  value={config.plex.apiEndpoint}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    plex: { ...prev.plex, apiEndpoint: e.target.value }
                  }))}
                  variant="bordered"
                  classNames={{
                    label: "text-gray-400",
                    input: "text-gray-300",
                    inputWrapper: "border-gray-800 hover:border-gray-700 group-data-[focus=true]:border-primary",
                  }}
                />
              </div>
            </section>

            {/* Folder Mappings */}
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
                        setConfig(prev => ({
                          ...prev,
                          plex: { ...prev.plex, folderMappings: newMappings }
                        }))
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
                        setConfig(prev => ({
                          ...prev,
                          plex: { ...prev.plex, folderMappings: newMappings }
                        }))
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
                        setConfig(prev => ({
                          ...prev,
                          plex: { ...prev.plex, folderMappings: newMappings }
                        }))
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

            {/* TMDb Settings */}
            <section className="space-y-4">
              <SectionTitle 
                title="TMDb Configuration" 
                tooltip="Configure your TMDb API settings for media metadata"
              />
              <div className="rounded-lg bg-black/20 p-4 border border-gray-800">
                <Input
                  label="API Key"
                  type="password"
                  value={config.tmDb.apiKey}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    tmDb: { ...prev.tmDb, apiKey: e.target.value }
                  }))}
                  variant="bordered"
                  classNames={{
                    label: "text-gray-400",
                    input: "text-gray-300",
                    inputWrapper: "border-gray-800 hover:border-gray-700 group-data-[focus=true]:border-primary",
                  }}
                />
              </div>
            </section>

            {/* Media Detection Settings */}
            <section className="space-y-4">
              <SectionTitle 
                title="Media Detection" 
                tooltip="Configure media detection and caching settings"
              />
              <div className="rounded-lg bg-black/20 p-4 border border-gray-800">
                <Input
                  label="Cache Duration"
                  endContent={<span className="text-gray-500 text-sm">seconds</span>}
                  value={config.mediaDetection.cacheDuration.toString()}
                  isReadOnly
                  variant="bordered"
                  classNames={{
                    label: "text-gray-400",
                    input: "text-gray-300",
                    inputWrapper: "border-gray-800",
                  }}
                />
              </div>
            </section>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button 
            color="danger" 
            variant="light" 
            onPress={onClose} 
            isDisabled={isLoading}
            className="hover:bg-white/5"
          >
            Cancel
          </Button>
          <Button 
            color="primary" 
            onPress={handleSave} 
            isLoading={isLoading}
            className="bg-primary hover:bg-primary-500"
          >
            Save Changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default SettingsModal 