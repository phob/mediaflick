import { useState, useEffect } from 'react'
import type { RuntimeConfig } from '../../app/api/config/route'

interface UseRuntimeConfigResult {
  config: RuntimeConfig | null
  loading: boolean
  error: string | null
}

const defaultConfig: RuntimeConfig = {
  apiUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api',
  signalrUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5000/ws/filetracking'
}

let cachedConfig: RuntimeConfig | null = null
let configPromise: Promise<RuntimeConfig> | null = null

export function useRuntimeConfig(): UseRuntimeConfigResult {
  // Initialize state from cache
  const [config, setConfig] = useState<RuntimeConfig | null>(() => cachedConfig)
  const [loading, setLoading] = useState(() => !cachedConfig)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Skip effect if already cached
    if (cachedConfig) {
      return
    }

    if (!configPromise) {
      configPromise = fetchConfig()
    }

    configPromise
      .then((fetchedConfig) => {
        cachedConfig = fetchedConfig
        setConfig(fetchedConfig)
        setError(null)
      })
      .catch((err) => {
        cachedConfig = defaultConfig
        setConfig(defaultConfig)
        setError(err.message)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  return { config, loading, error }
}

async function fetchConfig(): Promise<RuntimeConfig> {
  try {
    const response = await fetch('/api/config')
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const config = await response.json()
    
    if (!config.apiUrl || !config.signalrUrl) {
      throw new Error('Invalid configuration response')
    }

    return config
  } catch (error) {
    throw new Error(
      error instanceof Error 
        ? `Failed to fetch runtime config: ${error.message}`
        : 'Failed to fetch runtime config: Unknown error'
    )
  }
}
