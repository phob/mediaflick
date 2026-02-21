declare global {
  interface Window {
    __MEDIAFLICK_CONFIG__?: {
      apiBaseUrl?: string
      wsUrl?: string
    }
  }
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "")
}

export function getApiBaseUrl(): string {
  const fromRuntime = window.__MEDIAFLICK_CONFIG__?.apiBaseUrl
  if (fromRuntime && fromRuntime.trim().length > 0) {
    return trimTrailingSlash(fromRuntime)
  }

  const fromBuild = import.meta.env.VITE_API_BASE_URL
  if (typeof fromBuild === "string" && fromBuild.trim().length > 0) {
    return trimTrailingSlash(fromBuild)
  }

  return "http://localhost:5000/api"
}

export function getWsUrl(): string {
  const fromRuntime = window.__MEDIAFLICK_CONFIG__?.wsUrl
  if (fromRuntime && fromRuntime.trim().length > 0) {
    return fromRuntime
  }

  const fromBuild = import.meta.env.VITE_WS_URL
  if (typeof fromBuild === "string" && fromBuild.trim().length > 0) {
    return fromBuild
  }

  return "ws://localhost:5000/ws/filetracking"
}

export {}
