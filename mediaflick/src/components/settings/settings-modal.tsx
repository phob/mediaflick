"use client"

import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@nextui-org/react"
import { useState, useEffect } from "react"
import { mediaApi } from "@/lib/api/endpoints"
import { ConfigurationPayload } from "@/lib/api/types"
import PlexConfig from "./plex-config"
import FolderMappings from "./folder-mappings"
import TMDbConfig from "./tmdb-config"

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
      processNewFolderDelay: 30
    },
    tmDb: {
      apiKey: "",
    },
    mediaDetection: {
      cacheDuration: 3600,
    },
  })
  const [isLoading, setIsLoading] = useState(false)

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
            <PlexConfig config={config} onConfigChange={setConfig} />
            <FolderMappings config={config} onConfigChange={setConfig} />
            <TMDbConfig config={config} onConfigChange={setConfig} />
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