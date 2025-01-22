import { Input } from "@nextui-org/react"
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
          <Input
            label="Host"
            placeholder="e.g. http://localhost"
            value={config.plex.host}
            onChange={(e) => onConfigChange({
              ...config,
              plex: { ...config.plex, host: e.target.value }
            })}
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
            onChange={(e) => onConfigChange({
              ...config,
              plex: { ...config.plex, port: parseInt(e.target.value) }
            })}
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
          onChange={(e) => onConfigChange({
            ...config,
            plex: { ...config.plex, plexToken: e.target.value }
          })}
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
            onChange={(e) => onConfigChange({
              ...config,
              plex: { ...config.plex, pollingInterval: parseInt(e.target.value) }
            })}
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
            onChange={(e) => onConfigChange({
              ...config,
              plex: { ...config.plex, processNewFolderDelay: parseInt(e.target.value) }
            })}
            variant="bordered"
            classNames={{
              label: "text-gray-400",
              input: "text-gray-300",
              inputWrapper: "border-gray-800 hover:border-gray-700 group-data-[focus=true]:border-primary",
            }}
          />
        </div>
      </div>
    </section>
  )
}

export default PlexConfig 