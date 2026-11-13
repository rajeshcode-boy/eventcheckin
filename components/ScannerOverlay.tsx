import { cn } from '@/lib/utils'

const corner = 'absolute size-8 border-primary-foreground'

export interface ScanStatusFeedback {
  type: 'success' | 'error' | 'warning'
  title: string
  subtitle?: string
}

// Drawn over the camera preview: a box to place the QR code in, a moving scan line, a
// "Scanning" label, and immediate high-visibility HUD feedback inside the scanner frame when a scan succeeds or fails.
export default function ScannerOverlay({
  hint = "Place the QR code inside the box",
  feedback,
}: {
  hint?: string
  feedback?: ScanStatusFeedback | null
}) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center overflow-hidden" aria-hidden="true">
      {/* Target Scanning Box */}
      <div
        className={cn(
          'relative aspect-square w-[min(13rem,60%)] rounded-2xl transition-all duration-300 shadow-[0_0_0_9999px_rgb(0_0_0/0.55)]',
          feedback?.type === 'error' && 'shadow-[0_0_0_9999px_rgb(185_28_28/0.4)] ring-4 ring-destructive',
          feedback?.type === 'success' && 'shadow-[0_0_0_9999px_rgb(5_150_105/0.4)] ring-4 ring-emerald-500',
          feedback?.type === 'warning' && 'shadow-[0_0_0_9999px_rgb(217_119_6/0.4)] ring-4 ring-amber-500'
        )}
      >
        <span className={cn(corner, 'left-0 top-0 rounded-tl-2xl border-l-4 border-t-4', feedback?.type === 'error' && 'border-destructive', feedback?.type === 'success' && 'border-emerald-400')} />
        <span className={cn(corner, 'right-0 top-0 rounded-tr-2xl border-r-4 border-t-4', feedback?.type === 'error' && 'border-destructive', feedback?.type === 'success' && 'border-emerald-400')} />
        <span className={cn(corner, 'bottom-0 left-0 rounded-bl-2xl border-b-4 border-l-4', feedback?.type === 'error' && 'border-destructive', feedback?.type === 'success' && 'border-emerald-400')} />
        <span className={cn(corner, 'bottom-0 right-0 rounded-br-2xl border-b-4 border-r-4', feedback?.type === 'error' && 'border-destructive', feedback?.type === 'success' && 'border-emerald-400')} />
        
        {!feedback && (
          <span className="scanner-sweep absolute inset-x-3 h-0.5 rounded-full bg-brand shadow-[0_0_12px_2px_var(--color-live)]" />
        )}

        {/* Center In-Scanner Flash Badge */}
        {feedback && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center animate-in zoom-in-90 fade-in duration-200">
            <div
              className={cn(
                'flex size-12 items-center justify-center rounded-full text-white shadow-lg',
                feedback.type === 'error' && 'bg-destructive',
                feedback.type === 'success' && 'bg-emerald-600',
                feedback.type === 'warning' && 'bg-amber-600'
              )}
            >
              {feedback.type === 'error' && <span className="text-2xl font-bold">✕</span>}
              {feedback.type === 'success' && <span className="text-2xl font-bold">✓</span>}
              {feedback.type === 'warning' && <span className="text-xl font-bold">!</span>}
            </div>
            <p className="mt-2 text-sm font-bold text-white drop-shadow-md">{feedback.title}</p>
            {feedback.subtitle && (
              <p className="mt-0.5 text-xs text-white/90 drop-shadow-md line-clamp-2 max-w-[180px]">
                {feedback.subtitle}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Top Status Capsule */}
      <div className="absolute inset-x-0 top-3 flex justify-center">
        {feedback ? (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold text-white shadow-lg transition-all animate-in slide-in-from-top-2',
              feedback.type === 'error' && 'bg-destructive',
              feedback.type === 'success' && 'bg-emerald-600',
              feedback.type === 'warning' && 'bg-amber-600'
            )}
          >
            {feedback.type === 'error' ? 'Scan Failed' : feedback.type === 'success' ? 'Pass Verified' : 'Attention'}
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-sm font-medium text-primary-foreground backdrop-blur-xs">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-75 motion-reduce:hidden" />
              <span className="relative inline-flex size-2.5 rounded-full bg-brand" />
            </span>
            Scanning
          </span>
        )}
      </div>

      {/* Bottom Hint */}
      <p className="absolute inset-x-0 bottom-3 px-4 text-center text-sm font-medium text-primary-foreground [text-shadow:0_1px_3px_rgb(0_0_0/0.8)]">
        {feedback ? feedback.title : hint}
      </p>
    </div>
  )
}
