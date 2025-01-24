import { Info } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type SectionTitleProps = {
  title: string
  tooltip?: string
}

export const SectionTitle = ({ title, tooltip }: SectionTitleProps) => (
  <div className="flex items-center gap-2 mb-2">
    <h3 className="text-base font-semibold text-gray-200">{title}</h3>
    {tooltip && (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Info className="w-4 h-4 text-gray-400 cursor-help" />
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )}
  </div>
) 