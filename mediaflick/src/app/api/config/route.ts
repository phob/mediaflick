import { NextResponse } from 'next/server'

export interface RuntimeConfig {
  apiUrl: string
  signalrUrl: string
}

export async function GET() {
  try {
    const config: RuntimeConfig = {
      apiUrl: process.env.API_URL || 'http://localhost:5000/api',
      signalrUrl: process.env.SIGNALR_URL || 'http://localhost:5000/hubs'
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