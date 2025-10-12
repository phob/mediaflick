import React from "react"
import { format } from "date-fns"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface DateTooltipProps {
  date: string | Date
}

export function DateTooltip({ date }: DateTooltipProps) {
  const dateObj = new Date(date)
  
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span className="whitespace-nowrap">
            {format(dateObj, "MMM d, HH:mm")}
          </span>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="bg-popover text-popover-foreground border border-border shadow-md"
        >
          <p>{format(dateObj, "yyyy-MM-dd HH:mm:ss")}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
