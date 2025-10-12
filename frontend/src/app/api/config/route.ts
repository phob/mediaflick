import { NextResponse } from 'next/server'

export interface RuntimeConfig {
  apiUrl: string
  signalrUrl: string
}

export async function GET() {
  try {
    // Return proxy endpoints for browser-side communication
    // Backend communication happens server-side via environment variables
    const config: RuntimeConfig = {
      apiUrl: '/api/proxy',
      signalrUrl: '/api/signalr'
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