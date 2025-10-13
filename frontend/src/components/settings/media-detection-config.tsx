import { Input } from "@/components/ui/input"
import { ConfigurationPayload } from "@/lib/api/types"
import { SectionTitle } from "./section-title"

type MediaDetectionConfigProps = {
  config: ConfigurationPayload
  onConfigChange: (newConfig: ConfigurationPayload) => void
}

const MediaDetectionConfig = ({ config, onConfigChange }: MediaDetectionConfigProps) => {
  const thresholdBytes = config.mediaDetection.autoExtrasThresholdBytes ?? 104857600
  const thresholdMb = Math.round(thresholdBytes / 1048576)

  const handleThresholdChange = (value: string) => {
    const numValue = parseInt(value, 10)
    if (isNaN(numValue) || numValue < 0) return
    if (numValue > 1024) return

    const bytes = numValue * 1048576

    onConfigChange({
      ...config,
      mediaDetection: {
        ...config.mediaDetection,
        autoExtrasThresholdBytes: bytes,
      },
    })
  }

  return (
    <section className="space-y-4">
      <SectionTitle
        title="Media Detection"
        tooltip="Configure media detection and classification settings"
      />
      <div className="rounded-lg bg-black/20 p-4 border border-gray-800">
        <div className="space-y-2">
          <label htmlFor="cache-duration" className="text-sm text-gray-400">
            Cache Duration (seconds)
          </label>
          <Input
            id="cache-duration"
            type="number"
            min="0"
            value={config.mediaDetection.cacheDuration}
            onChange={(e) =>
              onConfigChange({
                ...config,
                mediaDetection: {
                  ...config.mediaDetection,
                  cacheDuration: parseInt(e.target.value, 10) || 0,
                },
              })
            }
            className="bg-transparent border-gray-800 hover:border-gray-700 focus:border-primary text-gray-300"
          />
        </div>
        <div className="space-y-2 mt-4">
          <label htmlFor="extras-threshold" className="text-sm text-gray-400">
            Auto-classify files as Extras (MB)
          </label>
          <Input
            id="extras-threshold"
            type="number"
            min="0"
            max="1024"
            value={thresholdMb}
            onChange={(e) => handleThresholdChange(e.target.value)}
            className="bg-transparent border-gray-800 hover:border-gray-700 focus:border-primary text-gray-300"
          />
          <p className="text-xs text-gray-500">
            Files smaller than this size that don&apos;t match Movies/TV Shows will be
            automatically marked as Extras. Set to 0 to disable. Maximum: 1024 MB (1 GB).
          </p>
        </div>
      </div>
    </section>
  )
}

export default MediaDetectionConfig
