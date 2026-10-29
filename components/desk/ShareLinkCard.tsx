'use client'

import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

// A link with its QR code, copy and open buttons. Used by the Kiosk and Self check-in desk tabs.
export default function ShareLinkCard({ path, title, children }: { path: string; title: string; children?: React.ReactNode }) {
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => setOrigin(window.location.origin), [])
  const url = origin + path

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked: the link is still shown below to copy by hand */
    }
  }

  return (
    <section className="grid gap-5 rounded-xl border border-border bg-card p-5 sm:grid-cols-[auto_1fr]">
      <div className="grid size-40 place-items-center rounded-lg border border-border bg-white p-2">
        {origin ? <QRCodeSVG value={url} size={144} aria-label={`QR code for ${title}`} /> : null}
      </div>
      <div className="grid content-start gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {children && <div className="grid gap-2 text-sm text-muted-foreground">{children}</div>}
        <code className="break-all rounded-md bg-muted px-2 py-1.5 text-xs">{url || path}</code>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={copy}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? 'Copied' : 'Copy link'}
          </Button>
          <Button render={<a href={path} target="_blank" rel="noopener noreferrer" />} nativeButton={false}>
            <ExternalLink className="size-4" />
            Open
          </Button>
        </div>
      </div>
    </section>
  )
}
