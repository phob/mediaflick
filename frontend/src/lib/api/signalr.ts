import { HubConnectionBuilder, HubConnection } from '@microsoft/signalr'
import { ScannedFile, MediaType, MediaStatus } from '../api/types'

// Connect through Next.js API proxy which handles WebSocket upgrades via custom server
// All SignalR communication flows through /api/signalr/* which proxies to backend /hubs/*
const SIGNALR_BASE = typeof window !== 'undefined'
  ? '/api/signalr'
  : '/api/signalr'

interface ScannedFileDto {
    id: number
    sourceFile: string
    destFile: string | null
    fileSize: number | null
    fileHash: string | null
    mediaType: string
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
    updatedAt: string
    versionUpdated: number
    updateToVersion: number
}

const convertDtoToScannedFile = (dto: ScannedFileDto): ScannedFile => ({
    id: dto.id,
    sourceFile: dto.sourceFile,
    destFile: dto.destFile || '',
    fileSize: dto.fileSize ?? undefined,
    fileHash: dto.fileHash ?? undefined,
    mediaType: dto.mediaType as MediaType,
    tmdbId: dto.tmdbId || undefined,
    imdbId: dto.imdbId || undefined,
    title: dto.title || undefined,
    year: dto.year || undefined,
    genres: dto.genres || undefined,
    seasonNumber: dto.seasonNumber || undefined,
    episodeNumber: dto.episodeNumber || undefined,
    episodeNumber2: dto.episodeNumber2 || undefined,
    status: dto.status as MediaStatus,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    versionUpdated: dto.versionUpdated,
    updateToVersion: dto.updateToVersion
})

type FileEventHandler = (file: ScannedFile) => void
type HeartbeatHandler = (timestamp: number) => void
type ZurgVersionHandler = (timestamp: number) => void
type FileEventType = 'OnFileAdded' | 'OnFileUpdated' | 'OnFileRemoved' | 'OnHeartbeat' | 'OnZurgVersion'

class FileTrackingSignalR {
    private connection: HubConnection | null = null;
    private eventHandlers: Map<FileEventType, Set<FileEventHandler | HeartbeatHandler | ZurgVersionHandler>> = new Map();
    private isConnected: boolean = false
    private lastHeartbeat: number = 0
    private lastZurgVersion: number = 0
    private initializationPromise: Promise<void> | null = null

    constructor() {
        if (typeof window !== 'undefined') {
            this.initializationPromise = this.initialize()
        }
    }

    private async initialize(): Promise<void> {
        try {
            this.connection = new HubConnectionBuilder()
                .withUrl(`${SIGNALR_BASE}/filetracking`)
                .withAutomaticReconnect()
                .build()

            this.setupEventHandlers()
            await this.startConnection()
        } catch (error) {
            console.error('Failed to initialize SignalR connection:', error)
        }
    }

    private setupEventHandlers(): void {
        if (!this.connection) return;
        const events: FileEventType[] = ['OnFileAdded', 'OnFileUpdated', 'OnFileRemoved', 'OnHeartbeat', 'OnZurgVersion']
        
        events.forEach(eventType => {
            this.eventHandlers.set(eventType, new Set())
            
            if (this.connection) {
                if (eventType === 'OnHeartbeat') {
                    this.connection.on(eventType, (timestamp: number) => {
                        this.lastHeartbeat = timestamp
                        this.eventHandlers.get(eventType)?.forEach(handler =>
                            (handler as HeartbeatHandler)(timestamp)
                        )
                    })
                } 
                if (eventType === 'OnZurgVersion') {
                    this.connection.on(eventType, (timestamp: number) => {
                        this.lastZurgVersion = timestamp
                        this.eventHandlers.get(eventType)?.forEach(handler =>
                            (handler as ZurgVersionHandler)(timestamp)
                        )
                    })
                } 
                if (eventType === 'OnFileAdded' || eventType === 'OnFileUpdated' || eventType === 'OnFileRemoved') {
                    this.connection.on(eventType, (dto: ScannedFileDto) => {
                        const file = convertDtoToScannedFile(dto)
                        this.eventHandlers.get(eventType)?.forEach(handler =>
                            (handler as FileEventHandler)(file)
                        )
                    })
                }
            }
        })
    }

    private async startConnection(): Promise<void> {
        if (!this.connection) return;
        try {
            await this.connection.start()
            this.isConnected = true
        } catch (err) {
            console.error('SignalR Connection Error:', err)
            setTimeout(() => this.startConnection(), 5000)
        }
    }

    public subscribe(eventType: Exclude<FileEventType, 'OnHeartbeat'>, handler: FileEventHandler): () => void
    public subscribe(eventType: 'OnHeartbeat', handler: HeartbeatHandler): () => void
    public subscribe(eventType: 'OnZurgVersion', handler: ZurgVersionHandler): () => void
    public subscribe(eventType: FileEventType, handler: FileEventHandler | HeartbeatHandler | ZurgVersionHandler): () => void {
        // Ensure initialization is complete before subscribing
        this.initializationPromise?.catch(console.error)
        
        const handlers = this.eventHandlers.get(eventType)
        if (handlers) {
            handlers.add(handler)
        }

        // Return unsubscribe function
        return () => {
            handlers?.delete(handler)
        }
    }

    public unsubscribe(eventType: FileEventType, handler: FileEventHandler | HeartbeatHandler | ZurgVersionHandler): void {
        this.eventHandlers.get(eventType)?.delete(handler)
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

// Export a singleton instance
export const signalr = new FileTrackingSignalR()

