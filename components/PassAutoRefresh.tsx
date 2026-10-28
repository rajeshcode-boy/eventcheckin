'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Re-reads the pass from the server while the guest waits, so "Ready for Entry" flips to "Checked In" on its own.
export default function PassAutoRefresh({ intervalMs = 15000 }: { intervalMs?: number }) {
  const router = useRouter()
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, intervalMs)
    return () => clearInterval(t)
  }, [router, intervalMs])
  return null
}
