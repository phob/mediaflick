"use client"

import { signalr } from "@/lib/api/signalr"
import { useEffect, useState } from "react"

const HEARTBEAT_TIMEOUT = 31000 // 31 seconds timeout

export function HeartbeatStatus() {
  const [lastHeartbeat, setLastHeartbeat] = useState<number>(0)
  const [isOffline, setIsOffline] = useState(true)

  useEffect(() => {
    // Check connection status and heartbeat timeout
    const checkStatus = () => {
      const now = Date.now()
      const timeSinceLastHeartbeat = now - lastHeartbeat
      const isConnected = signalr.isConnectedToHub()
      
      setIsOffline(!isConnected || (lastHeartbeat !== 0 && timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT))
    }

    const statusInterval = setInterval(checkStatus, HEARTBEAT_TIMEOUT/10)
    
    const unsubscribe = signalr.subscribe('OnHeartbeat', (timestamp: number) => {
      setLastHeartbeat(timestamp)
      setIsOffline(false)
    })

    // Get initial heartbeat if available
    setLastHeartbeat(signalr.getLastHeartbeat())

    return () => {
      unsubscribe()
      clearInterval(statusInterval)
    }
  }, [lastHeartbeat])

  const formatHeartbeat = (timestamp: number) => {
    if (isOffline) {
      return 'Offline'
    }
    if (timestamp === 0) {
      return 'Connecting...'
    }
    const date = new Date(timestamp)
    return `Last heartbeat: ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex h-2.5 w-2.5 ml-2">
        <span className={`absolute inline-flex h-full w-full rounded-full ${
          isOffline ? 'bg-red-500' : 'bg-green-500 animate-pulse'
        }`} />
        <span className={`absolute inline-flex h-full w-full rounded-full ${
          isOffline ? 'bg-red-500' : 'bg-green-500'
        } opacity-75 animate-ping`} />
      </div>
      <div className={`ml-2 text-sm ${isOffline ? 'text-red-500 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
        {formatHeartbeat(lastHeartbeat)}
      </div>
    </div>
  )
} 