'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

// The guest's digital pass: open it, copy the link, or share it to their own phone or chat
export default function PassLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)
  // Browser-only values are read after mount so the server and first browser render match
  const [origin, setOrigin] = useState('')
  const [canShare, setCanShare] = useState(false)
  useEffect(() => {
    setOrigin(window.location.origin)
    setCanShare(typeof navigator.share === 'function')
  }, [])
  const path = `/pass/${token}`
  const url = origin + path

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard blocked: the link is shown below to copy by hand */
    }
  }
  const share = async () => {
    try {
      await navigator.share({ title: 'My event pass', url })
    } catch {
      /* cancelled */
    }
  }

  return (
    <div className="mt-5 grid gap-3 rounded-lg border border-border bg-muted p-4">
      <div>
        <p className="font-semibold">Your digital pass</p>
        <p className="text-sm text-muted-foreground">Save this link. Open it on your phone at the entrance and show the QR code to check in.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button render={<a href={path} />} nativeButton={false}>Open pass</Button>
        <Button type="button" variant="outline" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</Button>
        {canShare && <Button type="button" variant="outline" onClick={share}>Share</Button>}
      </div>
      <code className="text-xs break-all text-muted-foreground">{url}</code>
    </div>
  )
}
