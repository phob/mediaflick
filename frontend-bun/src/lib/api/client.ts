const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api").replace(/\/+$/, "")

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  try {
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint
    const response = await fetch(`${API_BASE}/${cleanEndpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...options?.headers,
      },
      cache: options?.cache || "default",
    })

    if (!response.ok) {
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

    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new ApiError(0, "Unable to connect to the API server. Please check if the server is running.")
    }

    throw new ApiError(500, error instanceof Error ? error.message : "An unknown error occurred")
  }
}
