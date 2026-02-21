import { MediaStatus, MediaType, ScannedFile } from "../api/types"

type FileEventType = "file.added" | "file.updated" | "file.removed" | "heartbeat" | "zurg.version"
type FileEventHandler = (file: ScannedFile) => void
type HeartbeatHandler = (timestamp: number) => void
type ZurgVersionHandler = (timestamp: number) => void

interface RealtimeEnvelope {
  type: FileEventType
  payload: unknown
}

interface ScannedFileDto {
  id: number
  sourceFile: string
  destFile: string | null
  fileSize: number | null
  fileHash: string | null
  mediaType: string | null
  tmdbId: number | null
  imdbId: string | null
  title: string | null
  year: number | null
  genres: string[] | null
  seasonNumber: number | null
  episodeNumber: number | null
  episodeNumber2: number | null
  status: string
  createdAt: string
  updatedAt: string | null
  versionUpdated: number
  updateToVersion: number
}

const FILE_EVENT_TYPES: FileEventType[] = ["file.added", "file.updated", "file.removed", "heartbeat", "zurg.version"]
const FILE_MEDIA_TYPES = new Set<string>(Object.values(MediaType))
const FILE_MEDIA_STATUSES = new Set<string>(Object.values(MediaStatus))

function toScannedFile(payload: unknown): ScannedFile | null {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const dto = payload as ScannedFileDto
  if (!dto.id || !dto.sourceFile || !dto.createdAt || !dto.status) {
    return null
  }

  const mediaType = dto.mediaType && FILE_MEDIA_TYPES.has(dto.mediaType) ? (dto.mediaType as MediaType) : MediaType.Unknown
  const status = FILE_MEDIA_STATUSES.has(dto.status) ? (dto.status as MediaStatus) : MediaStatus.Processing

  return {
    id: dto.id,
    sourceFile: dto.sourceFile,
    destFile: dto.destFile ?? "",
    fileSize: dto.fileSize ?? undefined,
    fileHash: dto.fileHash ?? undefined,
    mediaType,
    tmdbId: dto.tmdbId ?? undefined,
    imdbId: dto.imdbId ?? undefined,
    title: dto.title ?? undefined,
    year: dto.year ?? undefined,
    genres: dto.genres ?? undefined,
    seasonNumber: dto.seasonNumber ?? undefined,
    episodeNumber: dto.episodeNumber ?? undefined,
    episodeNumber2: dto.episodeNumber2 ?? undefined,
    status,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt ?? dto.createdAt,
    versionUpdated: dto.versionUpdated,
    updateToVersion: dto.updateToVersion,
  }
}

class FileTrackingSocket {
  private socket: WebSocket | null = null
  private isConnected = false
  private retryCount = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private lastHeartbeat = 0
  private lastZurgVersion = 0
  private eventHandlers = new Map<FileEventType, Set<FileEventHandler | HeartbeatHandler | ZurgVersionHandler>>()

  constructor() {
    for (const eventType of FILE_EVENT_TYPES) {
      this.eventHandlers.set(eventType, new Set())
    }

    if (typeof window !== "undefined") {
      this.connect()
    }
  }

  private getWsUrl(): string {
    if (process.env.NEXT_PUBLIC_WS_URL) {
      return process.env.NEXT_PUBLIC_WS_URL
    }

    const protocol = window.location.protocol === "https:" ? "wss" : "ws"
    return `${protocol}://${window.location.host}/ws/filetracking`
  }

  private connect() {
    try {
      const ws = new WebSocket(this.getWsUrl())

      ws.onopen = () => {
        this.socket = ws
        this.isConnected = true
        this.retryCount = 0
      }

      ws.onmessage = event => {
        this.handleMessage(event.data)
      }

      ws.onclose = () => {
        this.isConnected = false
        this.socket = null
        this.scheduleReconnect()
      }

      ws.onerror = error => {
        console.error("WebSocket realtime error:", error)
      }
    } catch (error) {
      console.error("Failed to initialize realtime WebSocket:", error)
      this.scheduleReconnect()
    }
  }

  private handleMessage(data: unknown) {
    try {
      const message = typeof data === "string" ? (JSON.parse(data) as RealtimeEnvelope) : null
      if (!message || !FILE_EVENT_TYPES.includes(message.type)) {
        return
      }

      const handlers = this.eventHandlers.get(message.type)
      if (!handlers || handlers.size === 0) {
        return
      }

      if (message.type === "heartbeat") {
        const timestamp = Number(message.payload)
        if (!Number.isFinite(timestamp)) return
        this.lastHeartbeat = timestamp
        handlers.forEach(handler => (handler as HeartbeatHandler)(timestamp))
        return
      }

      if (message.type === "zurg.version") {
        const timestamp = Number(message.payload)
        if (!Number.isFinite(timestamp)) return
        this.lastZurgVersion = timestamp
        handlers.forEach(handler => (handler as ZurgVersionHandler)(timestamp))
        return
      }

      const file = toScannedFile(message.payload)
      if (!file) {
        return
      }

      handlers.forEach(handler => (handler as FileEventHandler)(file))
    } catch (error) {
      console.error("Failed to process realtime message:", error)
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      return
    }

    const delay = Math.min(1000 * 2 ** this.retryCount, 30000)
    this.retryCount += 1
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }

  public subscribe(eventType: "file.added" | "file.updated" | "file.removed", handler: FileEventHandler): () => void
  public subscribe(eventType: "heartbeat", handler: HeartbeatHandler): () => void
  public subscribe(eventType: "zurg.version", handler: ZurgVersionHandler): () => void
  public subscribe(eventType: FileEventType, handler: FileEventHandler | HeartbeatHandler | ZurgVersionHandler): () => void {
    const handlers = this.eventHandlers.get(eventType)
    if (handlers) {
      handlers.add(handler)
    }

    return () => {
      handlers?.delete(handler)
    }
  }

  public isConnectedToHub(): boolean {
    return this.isConnected
  }

  public getLastHeartbeat(): number {
    return this.lastHeartbeat
  }

  public getLastZurgVersion(): number {
    return this.lastZurgVersion
  }
}

export const signalr = new FileTrackingSocket()
