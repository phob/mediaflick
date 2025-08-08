"use client"

import { LayoutGrid, Square, Maximize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { type CardSize } from "@/hooks/use-card-size"

interface CardSizeSelectorProps {
  cardSize: CardSize
  onCardSizeChange: (size: CardSize) => void
  disabled?: boolean
}

export function CardSizeSelector({ cardSize, onCardSizeChange, disabled = false }: CardSizeSelectorProps) {
  const sizeOptions = [
    {
      size: "small" as const,
      icon: LayoutGrid,
      label: "Small cards",
      description: "Compact view with more cards per row",
    },
    {
      size: "medium" as const,
      icon: Square,
      label: "Medium cards",
      description: "Balanced view with moderate card size",
    },
    {
      size: "large" as const,
      icon: Maximize2,
      label: "Large cards",
      description: "Detailed view with larger cards",
    },
  ]

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 rounded-md border p-1">
        {sizeOptions.map(({ size, icon: Icon, label, description }) => (
          <Tooltip key={size}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCardSizeChange(size)}
                disabled={disabled}
                className={cn(
                  "h-8 w-8 p-0 transition-colors",
                  cardSize === size && "bg-accent text-accent-foreground"
                )}
                aria-label={label}
              >
                <Icon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-center">
                <p className="font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  )
}
