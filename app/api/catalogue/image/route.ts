import { NextResponse } from 'next/server'

/**
 * Cached image proxy for eTijwaal country/flag artwork.
 *
 * eTijwaal serves its images publicly from services.etijwaal.com, but with
 * Cache-Control: max-age=0 (so browsers revalidate every time). This route
 * re-serves them from OUR origin with a strong cache, so repeat views hit the
 * browser/CDN cache instead of round-tripping to eTijwaal each time.
 *
 * Security: we do NOT accept arbitrary URLs. Only `kind` (flag|country) plus a
 * plain filename are allowed, and the upstream URL is reconstructed here — so
 * this can never be turned into an open proxy / SSRF vector.
 */

export const runtime = 'nodejs'

const IMAGE_ORIGIN = 'https://services.etijwaal.com'
const ENDPOINT = {
  flag: 'displayFlagImage',
  country: 'displayCountryImage',
} as const

// eTijwaal filenames look like "Asia1699454511030.png",
// "Afghanistan-min1695820546071.png", "asia_present1777470826069.png".
const SAFE_FILENAME = /^[A-Za-z0-9._-]+$/

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const kind = searchParams.get('kind') === 'flag' ? 'flag' : 'country'
  const file = searchParams.get('file') ?? ''

  if (!file || !SAFE_FILENAME.test(file)) {
    return new NextResponse('Bad request', { status: 400 })
  }

  const target = `${IMAGE_ORIGIN}/api/country/${ENDPOINT[kind]}?image=${encodeURIComponent(file)}`

  try {
    const upstream = await fetch(target, { cache: 'no-store' })
    const contentType = upstream.headers.get('content-type') ?? ''
    // eTijwaal answers a missing image with HTTP 200 + a JSON "no image" body,
    // so gate on the content-type, not just res.ok. Anything non-image → 404 so
    // the <img> onError fires and the UI falls back (and we never cache JSON).
    if (!upstream.ok || !contentType.startsWith('image/')) {
      return new NextResponse('Image not found', { status: 404 })
    }

    const body = Buffer.from(await upstream.arrayBuffer())

    return new NextResponse(body as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // eTijwaal sends max-age=0; we cache hard on our origin + any CDN.
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
      },
    })
  } catch {
    return new NextResponse('Upstream error', { status: 502 })
  }
}
