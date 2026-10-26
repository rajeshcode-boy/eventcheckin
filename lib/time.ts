// 12-hour time in the viewer's own time zone, e.g. "2:51 PM IST".
// The zone name comes from the viewer's locale ("IST" for en-IN, where en-US says "GMT+5:30").
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const zoneName = (locale?: string) =>
    new Intl.DateTimeFormat(locale, { timeZoneName: 'short' }).formatToParts(date).find((p) => p.type === 'timeZoneName')?.value
  const zones = [zoneName(), zoneName('en-IN'), zoneName('en-US')].filter((z): z is string => !!z)
  return `${time} ${zones.find((z) => !z.startsWith('GMT')) ?? zones[0] ?? ''}`.trim()
}

// "27 Oct at 2:49 AM IST" (adds the year when it isn't the current one)
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  const day = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
  return `${day} at ${formatTime(iso)}`
}
