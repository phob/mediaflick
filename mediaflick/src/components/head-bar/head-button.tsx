import { Button } from "@nextui-org/react"
import { LucideIcon } from "lucide-react"
import Link from "next/link"



type HeadButtonProps = {
  icon: LucideIcon
  href?: string
  label: string
}

const HeadButton = ({ icon: Icon, href, label }: HeadButtonProps) => {
  return (
    <Button title={label} className="flex items-center gap-2" aria-label={label} startContent={<Icon />} as={href ? Link : 'button'} href={href}>
      {label}
    </Button>
  )
}

export default HeadButton
