import type { Metadata } from 'next'

// Each pass gets its own web app manifest, so "Add to Home Screen" opens this guest's pass
// instead of the app's home page (the shared manifest's start_url is "/").
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  return {
    title: 'Event pass',
    manifest: `/pass/${encodeURIComponent(token)}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: 'Event pass', statusBarStyle: 'default' },
  }
}

export default function PassLayout({ children }: { children: React.ReactNode }) {
  return children
}
