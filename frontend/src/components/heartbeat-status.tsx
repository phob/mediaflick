"use client"

import { signalr } from "@/lib/api/signalr"
import { useEffect, useState } from "react"

const HEARTBEAT_TIMEOUT = 31000 // 31 seconds timeout

export function HeartbeatStatus() {
  // Initialize state with current values from signalr to avoid setState in effect
  const [lastHeartbeat, setLastHeartbeat] = useState<number>(() => signalr.getLastHeartbeat())
  const [lastZurgVersion, setLastZurgVersion] = useState<number>(() => signalr.getLastZurgVersion())
  const [isOffline, setIsOffline] = useState(true)
  const [isZurgOffline, setIsZurgOffline] = useState(true)

  useEffect(() => {
    // Check connection status and heartbeat timeout
    const checkStatus = () => {
      const now = Date.now()
      const timeSinceLastHeartbeat = now - lastHeartbeat
      const timeSinceLastZurgVersion = now - lastZurgVersion
      const isConnected = signalr.isConnectedToHub()

      setIsOffline(!isConnected || (lastHeartbeat !== 0 && timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT))
      setIsZurgOffline(!isConnected || (lastZurgVersion !== 0 && timeSinceLastZurgVersion > HEARTBEAT_TIMEOUT))
    }

    const statusInterval = setInterval(checkStatus, HEARTBEAT_TIMEOUT/10)

    const unsubscribe = signalr.subscribe('OnHeartbeat', (timestamp: number) => {
      setLastHeartbeat(timestamp)
      setIsOffline(false)
    })

    const unsubscribeZurgVersion = signalr.subscribe('OnZurgVersion', (timestamp: number) => {
      setLastZurgVersion(timestamp)
      setIsZurgOffline(false)
    })

    return () => {
      unsubscribe()
      unsubscribeZurgVersion()
      clearInterval(statusInterval)
    }
  }, [lastHeartbeat, lastZurgVersion])

  const formatHeartbeat = (timestamp: number) => {
    if (isOffline) {
      return 'Backend offline'
    }
    if (timestamp === 0) {
      return 'Connecting to backend...'
    }
    const date = new Date(timestamp)
    return `Backend online: ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`
  }

  const formatZurgVersion = (timestamp: number) => {
    if (isZurgOffline && !isOffline) {
      return 'Zurg offline'
    }
    if (timestamp === 0) {
      return 'Connecting to Zurg...'
    }
    const date = new Date(timestamp)
    return `Zurg online: ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`
  }

  return (
    <>
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
    {!isOffline && (
    <div className="flex items-center gap-2">
      <div className="relative flex h-2.5 w-2.5 ml-2">
        <span className={`absolute inline-flex h-full w-full rounded-full ${
          isZurgOffline ? 'bg-red-500' : 'bg-green-500 animate-pulse'
        }`} />
        <span className={`absolute inline-flex h-full w-full rounded-full ${
          isZurgOffline ? 'bg-red-500' : 'bg-green-500'
        } opacity-75 animate-ping`} />
      </div>
      <div className={`ml-2 text-sm ${isZurgOffline ? 'text-red-500 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
        {formatZurgVersion(lastZurgVersion)}
      </div>

    </div>
    )}
    </>
  )
} 