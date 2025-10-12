"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

export interface StatCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  description?: string
  href?: string
  className?: string
  valueClassName?: string
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  href,
  className,
  valueClassName,
}: Readonly<StatCardProps>) {
  const router = useRouter()

  const handleClick = () => {
    if (href) {
      router.push(href)
    }
  }

  return (
    <Card
      onClick={handleClick}
      className={cn(
        "transition-all duration-200",
        href && "cursor-pointer hover:scale-[1.02] hover:shadow-lg hover:border-primary/50",
        className
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold", valueClassName)}>{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}
