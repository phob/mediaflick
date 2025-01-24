import { Button } from "@/components/ui/button"
import { LucideIcon } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { cn } from "@/lib/utils"
import { useState } from "react"
import SettingsModal from "../settings/settings-modal"

type HeadButtonProps = {
  icon: LucideIcon
  href?: string
  label: string
  className?: string
  isSettings?: boolean
}

// Component that uses useSearchParams
const HeadButtonLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: LucideIcon }) => {
  const getHref = () => {
    if (href === "/medialibrary") {
      // Try to get saved state first
      const savedState = typeof window !== 'undefined' ? localStorage.getItem('mediaLibraryState') : null
      if (savedState) {
        return `${href}?${savedState}`
      }
    }
    return href
  }

  return (
    <Link href={getHref()} className="flex items-center gap-2">
      <Icon className="w-5 h-5 relative z-10" />
      <span className="relative z-10">{label}</span>
    </Link>
  )
}

const HeadButton = ({ icon: Icon, href, label, className, isSettings }: HeadButtonProps) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const handleClick = () => {
    if (isSettings) {
      setIsSettingsOpen(true)
    }
  }

  return (
    <>
      <Button
        asChild={Boolean(href && !isSettings)}
        variant="ghost"
        onClick={handleClick}
        title={label}
        className={cn(
          "flex items-center gap-2",
          "bg-[#202020] hover:bg-[#252525]",
          "text-gray-300 font-medium",
          "transform-gpu transition-all duration-300",
          "hover:translate-y-[-2px] active:translate-y-[1px]",
          "shadow-[4px_4px_10px_rgba(0,0,0,0.4)]",
          "hover:shadow-[0_0_15px_rgba(125,125,125,0.2)]",
          "hover:text-white",
          "border border-gray-800 hover:border-gray-700",
          "rounded-lg",
          "relative",
          "after:absolute after:inset-0",
          "after:rounded-lg after:opacity-0",
          "after:bg-gradient-to-br after:from-gray-500/20 after:to-gray-700/20",
          "hover:after:opacity-100 after:transition-opacity",
          className
        )}
        aria-label={label}
      >
        {href && !isSettings ? (
          <Suspense>
            <HeadButtonLink href={href} label={label} icon={Icon} />
          </Suspense>
        ) : (
          <>
            <Icon className="w-5 h-5 relative z-10" />
            <span className="relative z-10">{label}</span>
          </>
        )}
      </Button>

      {isSettings && (
        <SettingsModal 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)} 
        />
      )}
    </>
  )
}

export default HeadButton
