import { Button } from "@nextui-org/react"
import { LucideIcon } from "lucide-react"
import Link from "next/link"
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
        startContent={<Icon className="w-5 h-5 relative z-10" />}
        as={href && !isSettings ? Link : 'button'}
        href={href && !isSettings ? href : undefined}
        onPress={handleClick}
      >
        <span className="relative z-10">{label}</span>
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
