'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { PAYPAL_COMMERCIALS, PLAN_CONFIGS } from '@/lib/plans'
import {
  Sparkles,
  Check,
  X,
  KeyRound,
  ExternalLink,
  ShieldCheck,
  Users,
  Printer,
  FileSpreadsheet,
  Zap,
} from 'lucide-react'

interface UpgradeModalProps {
  open: boolean
  onClose: () => void
  onUpgraded?: () => void
  featureNotice?: string
}

export default function UpgradeModal({
  open,
  onClose,
  onUpgraded,
  featureNotice,
}: UpgradeModalProps) {
  const [licenseKey, setLicenseKey] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const proConfig = PLAN_CONFIGS.pro

  if (!open) return null

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanKey = licenseKey.trim().toUpperCase()
    if (!cleanKey) {
      toast.error('Please enter a license key.')
      return
    }

    setRedeeming(true)
    try {
      const { data, error } = await supabase.rpc('redeem_license_key', {
        p_key: cleanKey,
      })
      if (error) {
        toast.error('Failed to redeem: ' + error.message)
        return
      }

      if (!data?.success) {
        toast.error(data?.message || 'Invalid license key.')
        return
      }

      toast.success(data.message || 'Pro license activated successfully!')
      setLicenseKey('')
      if (onUpgraded) onUpgraded()
      onClose()
    } finally {
      setRedeeming(false)
    }
  }

  const handlePayPalClick = () => {
    // Open PayPal.Me or PayPal checkout in new tab
    const url = PAYPAL_COMMERCIALS.paypalMeUrl
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl sm:p-7 overflow-hidden text-card-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="mb-5 text-center">
          <div className="mx-auto mb-2.5 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles size={24} />
          </div>
          <Badge variant="outline" className="mb-2 border-primary/30 bg-primary/10 text-primary">
            Unlock Full Commercial Power
          </Badge>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Upgrade to Pro Organizer
          </h2>
          {featureNotice ? (
            <p className="mt-1 text-sm font-medium text-amber-600 dark:text-amber-400">
              {featureNotice}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Everything you need to deliver high-capacity, professional event check-ins.
            </p>
          )}
        </div>

        {/* Features Checklist */}
        <div className="mb-6 rounded-xl border border-border/80 bg-muted/30 p-4 text-sm">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <Check size={16} className="text-primary shrink-0" />
              <span><strong>1,000</strong> attendees per event</span>
            </div>
            <div className="flex items-center gap-2">
              <Check size={16} className="text-primary shrink-0" />
              <span><strong>10</strong> active events</span>
            </div>
            <div className="flex items-center gap-2">
              <Check size={16} className="text-primary shrink-0" />
              <span><strong>5</strong> team staff seats</span>
            </div>
            <div className="flex items-center gap-2">
              <Check size={16} className="text-primary shrink-0" />
              <span><strong>Full Badge Studio</strong> (double-sided)</span>
            </div>
            <div className="flex items-center gap-2">
              <Check size={16} className="text-primary shrink-0" />
              <span><strong>Full CSV Export</strong> & debrief</span>
            </div>
            <div className="flex items-center gap-2">
              <Check size={16} className="text-primary shrink-0" />
              <span><strong>5 Live Kiosks</strong> & sync</span>
            </div>
          </div>
        </div>

        {/* Payment & License Activation Section */}
        <div className="space-y-4">
          {/* Step 1: PayPal Action */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Step 1: One-Time / Monthly License
                </span>
                <p className="text-lg font-bold text-foreground">
                  $49 <span className="text-xs font-normal text-muted-foreground">/ event or monthly</span>
                </p>
              </div>
              <Button
                type="button"
                onClick={handlePayPalClick}
                className="bg-[#0070BA] hover:bg-[#005ea6] text-white gap-2 font-semibold shadow-sm"
              >
                <span>Pay via PayPal</span>
                <ExternalLink size={14} />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Instant PayPal transfer. Please include your organization name or email in the note!
            </p>
          </div>

          {/* Step 2: License Key Activation */}
          <div className="rounded-xl border border-border p-4 bg-background">
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Step 2: Have a License Code? Activate Instantly:
            </label>
            <form onSubmit={handleRedeem} className="flex gap-2">
              <div className="relative flex-1">
                <KeyRound size={15} className="absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="PRO-XXXX-XXXX-XXXX"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                  className="pl-9 font-mono uppercase text-xs h-10"
                />
              </div>
              <Button type="submit" disabled={redeeming} className="shrink-0 h-10">
                {redeeming ? 'Activating...' : 'Activate'}
              </Button>
            </form>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Once payment is received, your license code is emailed or activated immediately.
            </p>
          </div>
        </div>

        {/* Footer Support Notice */}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Need an invoice or bank transfer? Email{' '}
          <a
            href={`mailto:${PAYPAL_COMMERCIALS.supportEmail}`}
            className="font-medium text-primary hover:underline"
          >
            {PAYPAL_COMMERCIALS.supportEmail}
          </a>
        </p>
      </div>
    </div>
  )
}
