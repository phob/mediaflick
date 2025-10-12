import { Input } from "@/components/ui/input"
import { ConfigurationPayload } from "@/lib/api/types"
import { SectionTitle } from "./section-title"

type ZurgConfigProps = {
  config: ConfigurationPayload
  onConfigChange: (newConfig: ConfigurationPayload) => void
}

const ZurgConfig = ({ config, onConfigChange }: ZurgConfigProps) => {
  return (
    <section className="space-y-4">
      <SectionTitle 
        title="Zurg Configuration" 
        tooltip="Configure your Zurg settings"
      />
      <div className="rounded-lg bg-black/20 p-4 border border-gray-800">
        <div className="space-y-2">
          <label htmlFor="zurg-version-location" className="text-sm text-gray-400">Version Location</label>
          <Input
            id="zurg-version-location"
            type="text"
            value={config.zurg.versionLocation}
            onChange={(e) => onConfigChange({
              ...config,
              zurg: { ...config.zurg, versionLocation: e.target.value }
            })}
            className="bg-transparent border-gray-800 hover:border-gray-700 focus:border-primary text-gray-300"
          />
        </div>
      </div>
    </section>
  )
}

export default ZurgConfig 