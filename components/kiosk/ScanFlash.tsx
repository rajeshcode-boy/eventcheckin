'use client'

import { useEffect } from 'react'
import { cn } from '@/lib/utils'

export interface Flash {
  /** Changes with every scan so the same guest can flash twice in a row. */
  id: number
  kind: 'ok' | 'dup'
  name: string
  detail?: string
}

const SHOW_MS = { ok: 1800, dup: 2800 } as const

// Full-page result shown right after a camera scan. It closes itself and the kiosk is back in scan
// mode underneath (the camera never stopped). Tap anywhere to close it sooner.
export default function ScanFlash({ flash, onDone }: { flash: Flash; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, SHOW_MS[flash.kind])
    return () => clearTimeout(t)
  }, [flash.id, flash.kind, onDone])

  const ok = flash.kind === 'ok'

  return (
    <div
      role="status"
      aria-live="assertive"
      onClick={onDone}
      className={cn(
        'kiosk-flash fixed inset-0 z-[60] flex cursor-pointer flex-col items-center justify-center gap-6 px-6 text-center text-white',
        ok ? 'bg-(--color-live)' : 'bg-amber-500 text-black'
      )}
    >
      <svg viewBox="0 0 120 120" className="kiosk-flash-badge size-40 sm:size-56" aria-hidden="true">
        <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="7" opacity="0.35" />
        {ok ? (
          <path className="kiosk-flash-check" d="M34 62 L53 80 L88 40" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path className="kiosk-flash-check" d="M60 30 V68 M60 86 V88" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
        )}
      </svg>
      <div className="kiosk-flash-text grid gap-2">
        <p className="text-5xl font-bold tracking-tight sm:text-7xl">{ok ? 'Checked in' : 'Already checked in'}</p>
        <p className="text-3xl font-semibold sm:text-4xl">{flash.name}</p>
        {flash.detail && <p className="text-xl opacity-90 sm:text-2xl">{flash.detail}</p>}
      </div>
    </div>
  )
}
