"use client"

import HeadButton from "@/components/head-bar/head-button"
import Stats from "@/components/head-bar/stats"
import { HeartbeatStatus } from "@/components/heartbeat-status"

import { navigationItems, settingsItems } from "../../config/nav-config"

export default function HeadBar() {
  return (
    <header className="border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4">
        <div className="flex items-center gap-8">
          <div className="flex text-3xl font-bold">
            <span className="text-foreground">Media</span>
            <span className="uppercase tracking-wider text-primary">Flick</span>
          </div>
          <div className="flex gap-2">
            {navigationItems.map((item) => (
              <HeadButton key={item.href} {...item} />
            ))}
          </div>
        </div>
        <div className="flex flex-1 justify-end items-center gap-6">
          <Stats />
          <HeartbeatStatus />
          {settingsItems.map((item) => (
            <HeadButton 
              key={item.label} 
              {...item}
            />
          ))}
        </div>
      </div>
    </header>
  )
}
