'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useEventRole } from '@/components/EventRoleContext'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import KioskPairing from '@/components/KioskPairing'
import ShareLinkCard from '@/components/desk/ShareLinkCard'
import { canCheckIn, canManageEvent } from '@/lib/permissions'
import PickupTab from './PickupTab'

type TabKey = 'pickup' | 'kiosk' | 'self' | 'devices'

// Onsite desk: everything gate and front-desk staff use on event day, in one place.
function DeskHub() {
  const params = useParams()
  const eventUuid = params.id as string
  const role = useEventRole()
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const [event, setEvent] = useState<{ name: string; event_id: string } | null>(null)

  useEffect(() => {
    supabase.from('events').select('name, event_id').eq('id', eventUuid).single().then(({ data }) => setEvent(data))
  }, [eventUuid])

  // Which tabs this role gets. Pairing devices is for owners and managers only.
  const tabs: { key: TabKey; label: string }[] = [
    ...(canCheckIn(role)
      ? ([
          { key: 'pickup', label: 'Pickup desk' },
          { key: 'kiosk', label: 'Kiosk mode' },
          { key: 'self', label: 'Self check-in' },
        ] as const)
      : []),
    ...(canManageEvent(role) ? ([{ key: 'devices', label: 'Devices' }] as const) : []),
  ]
  const wanted = search.get('tab') as TabKey | null
  const active = tabs.find((t) => t.key === wanted)?.key ?? tabs[0]?.key

  const select = (key: string) => router.replace(`${pathname}?tab=${key}`, { scroll: false })

  if (!active) return <p>Your role does not use the desk.</p>

  return (
    <div className="grid max-w-3xl gap-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Onsite desk</h1>
        <p className="text-sm text-muted-foreground">{event?.name ?? ' '}</p>
      </header>

      <Tabs value={active} onValueChange={(v) => select(String(v))}>
        <TabsList variant="line" aria-label="Desk tools" className="h-auto w-full flex-wrap justify-start">
          {tabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="flex-none px-3">{t.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="pickup" className="pt-4">
          <PickupTab />
        </TabsContent>

        <TabsContent value="kiosk" className="pt-4">
          <ShareLinkCard path="/kiosk" title="Check-in kiosk">
            <p>Open this on a tablet at the gate. It keeps the guest list on the device, so check-ins carry on if the Wi-Fi drops, and uploads them when it returns.</p>
            <p>
              The tablet needs a one-time code first.{' '}
              {canManageEvent(role) ? (
                <button type="button" className="font-medium text-primary underline" onClick={() => select('devices')}>Create a pairing code</button>
              ) : (
                'Ask an event manager for one.'
              )}
            </p>
          </ShareLinkCard>
        </TabsContent>

        <TabsContent value="self" className="pt-4">
          {event ? (
            <ShareLinkCard path={`/checkin/${event.event_id}`} title="Guest self check-in">
              <p>Guests scan this on their own phone to check in with their email or phone number. Walk-ins can register on the same page.</p>
              <p>Print the QR code for the entrance, or show it on a screen.</p>
            </ShareLinkCard>
          ) : (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}
        </TabsContent>

        <TabsContent value="devices" className="pt-4">
          <KioskPairing eventUuid={eventUuid} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function DeskPage() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <DeskHub />
    </Suspense>
  )
}
