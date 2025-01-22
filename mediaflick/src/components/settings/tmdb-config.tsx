import { Input } from "@nextui-org/react"
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
        <Input
          label="API Key"
          type="password"
          value={config.tmDb.apiKey}
          onChange={(e) => onConfigChange({
            ...config,
            tmDb: { ...config.tmDb, apiKey: e.target.value }
          })}
          variant="bordered"
          classNames={{
            label: "text-gray-400",
            input: "text-gray-300",
            inputWrapper: "border-gray-800 hover:border-gray-700 group-data-[focus=true]:border-primary",
          }}
        />
      </div>
    </section>
  )
}

export default TMDbConfig 