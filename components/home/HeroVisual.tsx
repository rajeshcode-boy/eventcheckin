import { BadgeCheck, Check, QrCode, WifiOff } from 'lucide-react'

// Illustration of the kiosk screen, not live data
export default function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-hidden="true">
      <div className="absolute -inset-6 -z-10 rounded-[40px] bg-primary/15 blur-3xl" />

      <div className="rounded-3xl border border-border bg-card p-5 shadow-xl sm:p-7">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-primary/30" />
            <span className="size-2.5 rounded-full bg-primary/50" />
            <span className="size-2.5 rounded-full bg-primary" />
            <span className="ml-2 text-xs text-muted-foreground">Entrance kiosk</span>
          </div>
          <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground dark:text-brand">Ready to scan</span>
        </div>

        <div className="space-y-4 pt-5">
          <div className="flex flex-col items-center rounded-2xl border border-border bg-background p-6">
            <div className="relative flex size-28 items-center justify-center overflow-hidden rounded-xl bg-neutral-50 shadow-sm">
              <QrCode className="size-20 text-neutral-900" strokeWidth={1.5} />
              <span className="hp-scan-line absolute inset-x-2 h-0.5 rounded-full bg-primary shadow-[0_0_10px_2px_var(--color-primary)]" />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Scan the QR code on your pass</p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl bg-primary p-4 text-primary-foreground">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-50/20">
              <Check className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">Checked in</p>
              <p className="truncate text-sm font-bold">Welcome, Emily Carter</p>
            </div>
            <BadgeCheck className="ml-auto size-5 shrink-0 opacity-80" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Checked in</p>
              <p className="text-xl font-bold text-primary dark:text-brand">
                184 <span className="text-xs font-normal text-muted-foreground">/ 250</span>
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Walk-ins</p>
              <p className="text-xl font-bold">12</p>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-10 -right-4 hidden items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-lg sm:flex">
        <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground dark:text-brand">
          <WifiOff className="size-5" />
        </span>
        <div>
          <p className="text-xs text-muted-foreground">Works offline</p>
          <p className="text-sm font-semibold">Syncs when Wi-Fi returns</p>
        </div>
      </div>
    </div>
  )
}
