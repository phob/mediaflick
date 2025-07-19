// Base API client setup
const FALLBACK_API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

let runtimeApiBase: string | null = null
let configPromise: Promise<string> | null = null

export class ApiError extends Error {
    constructor(
        public status: number,
        message: string
    ) {
        super(message)
        this.name = 'ApiError'
    }
}

async function getApiBase(): Promise<string> {
    if (runtimeApiBase) {
        return runtimeApiBase
    }

    if (!configPromise) {
        configPromise = fetchRuntimeApiBase()
    }

    try {
        runtimeApiBase = await configPromise
        return runtimeApiBase
    } catch (error) {
        console.warn('Failed to load runtime API config, using fallback:', error)
        return FALLBACK_API_BASE
    }
}

async function fetchRuntimeApiBase(): Promise<string> {
    const response = await fetch('/api/config')
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    const config = await response.json()
    return config.apiUrl || FALLBACK_API_BASE
}

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
    try {
        const apiBase = await getApiBase()
        const response = await fetch(`${apiBase}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                ...options?.headers,
            },
            credentials: 'include', // Include cookies if needed
        })

        if (!response.ok) {
            // Try to parse error message from response
            let errorMessage: string
            try {
                const errorData = await response.json()
                errorMessage = errorData.message || errorData.error || response.statusText
            } catch {
                errorMessage = response.statusText
            }

            throw new ApiError(response.status, errorMessage)
        }

        return response.json()
    } catch (error) {
        if (error instanceof ApiError) {
            throw error
        }

        // Check if it's a network error
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
            const apiBase = runtimeApiBase || FALLBACK_API_BASE
            throw new ApiError(
                0,
                `Unable to connect to the API server at ${apiBase}. Please check if the server is running.`
            )
        }

        // Generic error
        throw new ApiError(500, error instanceof Error ? error.message : 'An unknown error occurred')
    }
}
