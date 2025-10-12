"use client"

import { CacheManagement } from "@/components/admin/cache-management"

export default function AdminPage() {
  return (
    <div className="container mx-auto py-6 motion-blur-in-md motion-opacity-in-0 motion-duration-500">
      <h1 className="mb-6 text-2xl font-bold motion-translate-y-in-100 motion-delay-400">Administration</h1>
      <CacheManagement />
    </div>
  )
}


