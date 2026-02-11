"use client"

import { Loader2, Zap, Database } from "lucide-react"
import { cn } from "@/lib/utils"

interface LoadingIndicatorProps {
  isLoading?: boolean
  isStale?: boolean
  isFetching?: boolean
  size?: "sm" | "md" | "lg"
  showText?: boolean
  className?: string
}

export function LoadingIndicator({ 
  isLoading = false, 
  isStale = false, 
  isFetching = false,
  size = "md",
  showText = true,
  className 
}: LoadingIndicatorProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6", 
    lg: "h-8 w-8"
  }

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base"
  }

  if (!isLoading && !isFetching) return null

  const getLoadingState = () => {
    if (isLoading && !isStale) {
      return {
        icon: <Loader2 className={cn(sizeClasses[size], "animate-spin")} />,
        text: "Loading...",
        description: "Fetching fresh data"
      }
    }
    
    if (isStale && isFetching) {
      return {
        icon: <Database className={cn(sizeClasses[size], "animate-pulse text-blue-500")} />,
        text: "Updating...",
        description: "Refreshing cached data"
      }
    }
    
    if (isFetching) {
      return {
        icon: <Zap className={cn(sizeClasses[size], "animate-pulse text-green-500")} />,
        text: "From cache",
        description: "Loading from cache"
      }
    }
    
    return {
      icon: <Loader2 className={cn(sizeClasses[size], "animate-spin")} />,
      text: "Loading...",
      description: "Please wait"
    }
  }

  const { icon, text, description } = getLoadingState()

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {icon}
      {showText && (
        <div className="flex flex-col">
          <span className={cn("font-medium", textSizeClasses[size])}>{text}</span>
          {size !== "sm" && (
            <span className={cn("text-muted-foreground", textSizeClasses.sm)}>
              {description}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
