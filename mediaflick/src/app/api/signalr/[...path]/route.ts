import { NextRequest } from 'next/server'

const SIGNALR_BASE_URL = process.env.SIGNALR_URL || 'http://localhost:5000/hubs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params
  const path = resolvedParams.path.join('/')
  const searchParams = request.nextUrl.searchParams.toString()
  const url = `${SIGNALR_BASE_URL}/${path}${searchParams ? `?${searchParams}` : ''}`

  // Forward the request to the backend SignalR hub
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...Object.fromEntries(request.headers),
      host: new URL(SIGNALR_BASE_URL).host,
    },
  })

  // Return the response with appropriate headers
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params
  const path = resolvedParams.path.join('/')
  const searchParams = request.nextUrl.searchParams.toString()
  const url = `${SIGNALR_BASE_URL}/${path}${searchParams ? `?${searchParams}` : ''}`

  const body = await request.text()

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...Object.fromEntries(request.headers),
      host: new URL(SIGNALR_BASE_URL).host,
    },
    body,
  })

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}