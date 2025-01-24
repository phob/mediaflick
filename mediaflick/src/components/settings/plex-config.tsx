import { Input } from "@/components/ui/input"
import { ConfigurationPayload } from "@/lib/api/types"
import { SectionTitle } from "./section-title"

type PlexConfigProps = {
  config: ConfigurationPayload
  onConfigChange: (newConfig: ConfigurationPayload) => void
}

const PlexConfig = ({ config, onConfigChange }: PlexConfigProps) => {
  return (
    <section className="space-y-4">
      <SectionTitle 
        title="Plex Configuration" 
        tooltip="Configure your Plex server connection settings"
      />
      <div className="space-y-4 rounded-lg bg-black/20 p-4 border border-gray-800">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="plex-host" className="text-sm text-gray-400">Host</label>
            <Input
              id="plex-host"
              placeholder="e.g. http://localhost"
              value={config.plex.host}
              onChange={(e) => onConfigChange({
                ...config,
                plex: { ...config.plex, host: e.target.value }
              })}
              className="bg-transparent border-gray-800 hover:border-gray-700 focus:border-primary text-gray-300"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="plex-port" className="text-sm text-gray-400">Port</label>
            <Input
              id="plex-port"
              type="number"
              placeholder="32400"
              value={config.plex.port.toString()}
              onChange={(e) => onConfigChange({
                ...config,
                plex: { ...config.plex, port: parseInt(e.target.value) }
              })}
              className="bg-transparent border-gray-800 hover:border-gray-700 focus:border-primary text-gray-300"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="plex-token" className="text-sm text-gray-400">Plex Token</label>
          <Input
            id="plex-token"
            type="password"
            value={config.plex.plexToken}
            onChange={(e) => onConfigChange({
              ...config,
              plex: { ...config.plex, plexToken: e.target.value }
            })}
            className="bg-transparent border-gray-800 hover:border-gray-700 focus:border-primary text-gray-300"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="plex-polling-interval" className="text-sm text-gray-400">Polling Interval</label>
            <div className="relative">
              <Input
                id="plex-polling-interval"
                type="number"
                value={config.plex.pollingInterval.toString()}
                onChange={(e) => onConfigChange({
                  ...config,
                  plex: { ...config.plex, pollingInterval: parseInt(e.target.value) }
                })}
                className="bg-transparent border-gray-800 hover:border-gray-700 focus:border-primary text-gray-300 pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">seconds</span>
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="plex-process-delay" className="text-sm text-gray-400">Process New Folder Delay</label>
            <div className="relative">
              <Input
                id="plex-process-delay"
                type="number"
                value={config.plex.processNewFolderDelay.toString()}
                onChange={(e) => onConfigChange({
                  ...config,
                  plex: { ...config.plex, processNewFolderDelay: parseInt(e.target.value) }
                })}
                className="bg-transparent border-gray-800 hover:border-gray-700 focus:border-primary text-gray-300 pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">seconds</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default PlexConfig 