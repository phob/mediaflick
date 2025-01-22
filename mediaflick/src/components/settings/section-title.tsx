import { Info } from "lucide-react"
import { Tooltip } from "@nextui-org/react"

type SectionTitleProps = {
  title: string
  tooltip?: string
}

export const SectionTitle = ({ title, tooltip }: SectionTitleProps) => (
  <div className="flex items-center gap-2 mb-2">
    <h3 className="text-base font-semibold text-gray-200">{title}</h3>
    {tooltip && (
      <Tooltip content={tooltip}>
        <Info className="w-4 h-4 text-gray-400 cursor-help" />
      </Tooltip>
    )}
  </div>
) 