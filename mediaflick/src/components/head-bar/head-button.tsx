import { Button } from "@/components/ui/button"
import { LucideIcon } from "lucide-react"
import Link from "next/link"
import { Suspense, useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import SettingsModal from "../settings/settings-modal"

type HeadButtonProps = {
  icon: LucideIcon
  href?: string
  label: string
  className?: string
  isSettings?: boolean
}

// Component that uses useSearchParams
const HeadButtonLink = ({ href, label, icon: Icon, className }: { href: string; label: string; icon: LucideIcon; className?: string }) => {
  const [linkHref, setLinkHref] = useState(href)
  const searchParams = useSearchParams()

  useEffect(() => {
    if (href === "/medialibrary") {
      const savedState = localStorage.getItem('mediaLibraryState')
      if (savedState) {
        setLinkHref(`${href}?${savedState}`)
      } else if (searchParams.toString()) {
        setLinkHref(`${href}?${searchParams.toString()}`)
      }
    } else if (href === "/mediainfo") {
      const savedMediaType = localStorage.getItem('selectedMediaType')
      if (savedMediaType) {
        setLinkHref(`${href}?mediaType=${savedMediaType}`)
      }
    } else {
      setLinkHref(href)
    }
  }, [href, searchParams])

  return (
    <Button
      asChild
      variant="ghost"
      className={className}
    >
      <Link href={linkHref}>
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 relative z-10" />
          <span className="relative z-10">{label}</span>
        </div>
      </Link>
    </Button>
  )
}

const HeadButton = ({ icon: Icon, href, label, className, isSettings }: HeadButtonProps) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const handleClick = () => {
    if (isSettings) {
      setIsSettingsOpen(true)
    }
  }

  const buttonClasses = cn(
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
    "after:bg-linear-to-br after:from-gray-500/20 after:to-gray-700/20",
    "hover:after:opacity-100 after:transition-opacity",
    className
  )

  return (
    <>
      {href && !isSettings ? (
        <Suspense>
          <HeadButtonLink 
            href={href} 
            label={label} 
            icon={Icon} 
            className={buttonClasses}
          />
        </Suspense>
      ) : (
        <Button
          variant="ghost"
          onClick={handleClick}
          title={label}
          className={buttonClasses}
          aria-label={label}
        >
          <Icon className="w-5 h-5 relative z-10" />
          <span className="relative z-10">{label}</span>
        </Button>
      )}

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

