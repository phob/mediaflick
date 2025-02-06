"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { mediaApi } from "@/lib/api/endpoints"
import { ConfigurationPayload } from "@/lib/api/types"
import PlexConfig from "./plex-config"
import FolderMappings from "./folder-mappings"
import TMDbConfig from "./tmdb-config"
import ZurgConfig from "./zurg-config"

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
    zurg: {
      versionLocation: "",
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
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="max-w-4xl bg-[#202020] border-gray-800 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-100">Settings</DialogTitle>
          <DialogDescription className="text-sm text-gray-400">
            Configure your media management preferences
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-8 p-6">
          <PlexConfig config={config} onConfigChange={setConfig} />
          <FolderMappings config={config} onConfigChange={setConfig} />
          <TMDbConfig config={config} onConfigChange={setConfig} />
          <ZurgConfig config={config} onConfigChange={setConfig} />
        </div>
        <DialogFooter className="border-t border-gray-800 px-6 py-4">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
            className="hover:bg-white/5"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading}
            className="bg-primary hover:bg-primary/90"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Saving...
              </div>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default SettingsModal 