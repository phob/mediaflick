import Link from "next/link"
import React from "react"

import { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

type HeadButtonProps = {
  icon: LucideIcon
  href?: string
  label: string
}

const a = "True"
const b = "False"
console.log(a + " " + b)

const HeadButton = ({ icon: Icon, href, label }: HeadButtonProps) => {
  return (
    <Button title={label} variant="ghost" className="flex items-center gap-2" asChild aria-label={label}>
      {href ? (
        <Link href={href}>
          <Icon />
          {label}
        </Link>
      ) : (
        <Icon />
      )}
    </Button>
  )
}

export default HeadButton
