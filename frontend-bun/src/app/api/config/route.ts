import { NextResponse } from 'next/server'

export interface RuntimeConfig {
  apiUrl: string
  signalrUrl: string
}

export async function GET() {
  try {
    const config: RuntimeConfig = {
      apiUrl: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api",
      signalrUrl: process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:5000/ws/filetracking",
    }

    return NextResponse.json(config)
  } catch (error) {
    console.error('Failed to load runtime configuration:', error)
    return NextResponse.json(
      { error: 'Failed to load configuration' },
      { status: 500 }
    )
  }
}
