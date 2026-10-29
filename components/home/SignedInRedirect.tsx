'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Signed-in organisers go straight to their events
export default function SignedInRedirect() {
  const router = useRouter()

  useEffect(() => {
    let active = true
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (active && session) router.replace('/events')
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [router])

  return null
}
