import { Input } from "@/components/ui/input"
import { ConfigurationPayload } from "@/lib/api/types"
import { SectionTitle } from "./section-title"

type TMDbConfigProps = {
  config: ConfigurationPayload
  onConfigChange: (newConfig: ConfigurationPayload) => void
}

const TMDbConfig = ({ config, onConfigChange }: TMDbConfigProps) => {
  return (
    <section className="space-y-4">
      <SectionTitle 
        title="TMDb Configuration" 
        tooltip="Configure your TMDb API settings for media metadata"
      />
      <div className="rounded-lg bg-black/20 p-4 border border-gray-800">
        <div className="space-y-2">
          <label className="text-sm text-gray-400">API Key</label>
          <Input
            type="password"
            value={config.tmDb.apiKey}
            onChange={(e) => onConfigChange({
              ...config,
              tmDb: { ...config.tmDb, apiKey: e.target.value }
            })}
            className="bg-transparent border-gray-800 hover:border-gray-700 focus:border-primary text-gray-300"
          />
        </div>
      </div>
    </section>
  )
}

export default TMDbConfig 