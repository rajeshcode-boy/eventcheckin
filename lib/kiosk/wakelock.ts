// Keeps a tablet or phone screen on while the kiosk is scanning.
// Uses the Screen Wake Lock API (Chrome, Edge, Safari 16.4+). Older iOS has none, so it falls
// back to NoSleep.js, which plays a tiny hidden looping video. Call it from a tap or click.
// The browser drops a wake lock whenever the tab is hidden, so it is taken again on return.

type Sentinel = { release: () => Promise<void> }
type WakeLockApi = { request: (type: 'screen') => Promise<Sentinel> }

export async function keepScreenAwake(): Promise<() => void> {
  const api = (navigator as unknown as { wakeLock?: WakeLockApi }).wakeLock

  if (api) {
    let sentinel: Sentinel | null = await api.request('screen')
    let released = false

    const retake = async () => {
      if (released || document.visibilityState !== 'visible') return
      try {
        sentinel = await api.request('screen')
      } catch {
        /* the browser refused (for example low battery); scanning still works */
      }
    }
    document.addEventListener('visibilitychange', retake)

    return () => {
      released = true
      document.removeEventListener('visibilitychange', retake)
      sentinel?.release().catch(() => undefined)
      sentinel = null
    }
  }

  const { default: NoSleep } = await import('nosleep.js')
  const noSleep = new NoSleep()
  await noSleep.enable()
  return () => noSleep.disable()
}
