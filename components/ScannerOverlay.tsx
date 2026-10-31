import { cn } from '@/lib/utils'

const corner = 'absolute size-8 border-primary-foreground'

// Drawn over the camera preview: a box to place the QR code in, a moving scan line, and a
// "Scanning" label, so the person scanning knows where to hold the code and that it is working.
export default function ScannerOverlay({ hint = 'Place the QR code inside the box' }: { hint?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
      <div className="relative aspect-square w-[min(13rem,60%)] rounded-2xl shadow-[0_0_0_9999px_rgb(0_0_0/0.45)]">
        <span className={cn(corner, 'left-0 top-0 rounded-tl-2xl border-l-4 border-t-4')} />
        <span className={cn(corner, 'right-0 top-0 rounded-tr-2xl border-r-4 border-t-4')} />
        <span className={cn(corner, 'bottom-0 left-0 rounded-bl-2xl border-b-4 border-l-4')} />
        <span className={cn(corner, 'bottom-0 right-0 rounded-br-2xl border-b-4 border-r-4')} />
        <span className="scanner-sweep absolute inset-x-3 h-0.5 rounded-full bg-brand shadow-[0_0_12px_2px_var(--color-live)]" />
      </div>
      <div className="absolute inset-x-0 top-3 flex justify-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-sm font-medium text-primary-foreground">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-75 motion-reduce:hidden" />
            <span className="relative inline-flex size-2.5 rounded-full bg-brand" />
          </span>
          Scanning
        </span>
      </div>
      <p className="absolute inset-x-0 bottom-3 px-4 text-center text-sm font-medium text-primary-foreground [text-shadow:0_1px_3px_rgb(0_0_0/0.8)]">
        {hint}
      </p>
    </div>
  )
}
