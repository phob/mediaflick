import { NextRequest, NextResponse } from "next/server"

// Cache images for 1 year since TMDB URLs never change
const CACHE_DURATION = 31536000 // 365 days in seconds

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const url = searchParams.get("url")

  if (!url) {
    return new NextResponse("Missing url parameter", { status: 400 })
  }

  // Only allow TMDB images for security
  if (!url.startsWith("https://image.tmdb.org/")) {
    return new NextResponse("Invalid image source", { status: 403 })
  }

  try {
    // Fetch the image from TMDB
    const imageResponse = await fetch(url, {
      // Cache the fetch request itself
      next: { revalidate: CACHE_DURATION },
    })

    if (!imageResponse.ok) {
      return new NextResponse("Failed to fetch image", { status: imageResponse.status })
    }

    // Get the image buffer
    const imageBuffer = await imageResponse.arrayBuffer()
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg"

    // Return the image with aggressive caching headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": `public, max-age=${CACHE_DURATION}, immutable`,
        "CDN-Cache-Control": `public, max-age=${CACHE_DURATION}, immutable`,
        "Vercel-CDN-Cache-Control": `public, max-age=${CACHE_DURATION}, immutable`,
      },
    })
  } catch (error) {
    console.error("Image proxy error:", error)
    return new NextResponse("Error fetching image", { status: 500 })
  }
}
