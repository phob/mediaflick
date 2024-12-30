"use client"

import HeadButton from "@/components/head-bar/head-button"

import { navigationItems } from "../../config/nav-config"

export default function HeadBar() {
  return (
    <header className="border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4">
        <div className="flex items-center gap-8">
          <div className="flex gap-2 text-3xl font-bold">
            <span className="text-foreground">Media</span>{" "}
            <span className="uppercase tracking-wider text-primary">Flick</span>
          </div>
          <div className="flex gap-2">
            {navigationItems.map((item) => (
              <HeadButton key={item.href} icon={item.icon} label={item.label} href={item.href} />
            ))}
          </div>
        </div>
        <div className="flex flex-1 justify-end"></div>
      </div>
    </header>
  )
}
