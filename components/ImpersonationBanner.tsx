'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { clearImpersonation, readImpersonation, type ImpersonationState } from '@/lib/admin/impersonation'

// Shown on every signed-in page while a master admin is logged in as someone else,
// so it's never mistaken for that person's own session on a shared screen.
export default function ImpersonationBanner() {
  const [state, setState] = useState<ImpersonationState | null>(null)
  const [exiting, setExiting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setState(readImpersonation())
  }, [])

  if (!state) return null

  const exit = async () => {
    setExiting(true)
    try {
      await fetch('/api/admin/impersonate', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId: state.logId }),
      }).catch(() => undefined)

      await supabase.auth.setSession({
        access_token: state.returnAccessToken,
        refresh_token: state.returnRefreshToken,
      })
    } finally {
      clearImpersonation()
      router.push('/admin')
      router.refresh()
    }
  }

  return (
    <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <span>
        Viewing as {state.targetName || state.targetEmail} ({state.targetEmail}) — support session
      </span>
      <Button type="button" size="sm" variant="outline" className="border-amber-950/30 bg-amber-50 text-amber-950 hover:bg-amber-100" onClick={exit} disabled={exiting}>
        {exiting ? 'Exiting...' : 'Exit impersonation'}
      </Button>
    </div>
  )
}
