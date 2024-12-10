// Base API client setup
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options?.headers,
      },
      credentials: 'include', // Include cookies if needed
    });

    if (!response.ok) {
      // Try to parse error message from response
      let errorMessage: string;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || response.statusText;
      } catch {
        errorMessage = response.statusText;
      }
      
      throw new ApiError(response.status, errorMessage);
    }

    return response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Check if it's a network error
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new ApiError(0, `Unable to connect to the API server at ${API_BASE}. Please check if the server is running.`);
    }
    
    // Generic error
    throw new ApiError(500, error instanceof Error ? error.message : 'An unknown error occurred');
  }
}