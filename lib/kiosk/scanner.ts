import jsQR from 'jsqr'

// Camera QR scanning that works on every browser with a camera.
// Chrome and Edge decode with the built-in BarcodeDetector. iPhone Safari and Firefox do not
// have it, so frames are drawn to a canvas and decoded with jsQR instead.

type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> }
type DetectorCtor = new (o: { formats: string[] }) => Detector

export const cameraAvailable = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

const SCAN_EVERY_MS = 250
const REPEAT_AFTER_MS = 4000
const MAX_DECODE_WIDTH = 640

/**
 * Opens the rear camera on `video` and calls `onCode` for each QR code read. The same code is not
 * repeated within a few seconds. Returns a function that stops the camera. Rejects if the camera
 * cannot be opened (no permission, no camera, or an insecure page).
 */
export async function startScanner(video: HTMLVideoElement, onCode: (value: string) => void): Promise<() => void> {
  if (!cameraAvailable()) throw new Error('camera-unavailable')
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
  video.srcObject = stream
  video.muted = true
  video.setAttribute('playsinline', 'true') // iOS plays inline only with this attribute
  await video.play()

  const Native = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector
  const native = Native ? new Native({ formats: ['qr_code'] }) : null
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let last = ''
  let lastAt = 0

  const read = async (): Promise<string | undefined> => {
    if (native) return (await native.detect(video).catch(() => []))[0]?.rawValue
    if (!ctx || !video.videoWidth) return undefined
    const scale = Math.min(1, MAX_DECODE_WIDTH / video.videoWidth)
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
    return jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' })?.data
  }

  const tick = async () => {
    if (stopped) return
    const value = await read()
    if (value && !stopped && (value !== last || Date.now() - lastAt > REPEAT_AFTER_MS)) {
      last = value
      lastAt = Date.now()
      onCode(value)
    }
    if (!stopped) timer = setTimeout(tick, SCAN_EVERY_MS)
  }
  tick()

  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
    stream.getTracks().forEach((t) => t.stop())
    video.srcObject = null
  }
}
