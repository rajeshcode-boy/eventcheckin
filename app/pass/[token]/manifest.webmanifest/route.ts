import { NextResponse } from 'next/server'

// Per-pass manifest: start_url and scope point at this pass, so the installed icon opens it directly.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const path = `/pass/${encodeURIComponent(token)}`
  return NextResponse.json(
    {
      id: path,
      name: 'Event pass',
      short_name: 'Event pass',
      start_url: path,
      scope: path,
      display: 'standalone',
      theme_color: '#1A4439',
      background_color: '#ffffff',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' } }
  )
}
