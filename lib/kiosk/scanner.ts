import jsQR from 'jsqr'

// Camera QR scanning that works on every browser with a camera.
// Chrome and Edge decode with the built-in BarcodeDetector. iPhone Safari and Firefox do not
// have it, so frames are drawn to a canvas and decoded with jsQR instead.

type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> }
type DetectorCtor = (new (o: { formats: string[] }) => Detector) & { getSupportedFormats?: () => Promise<string[]> }

export const cameraAvailable = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

const SCAN_EVERY_MS = 250
const REPEAT_AFTER_MS = 4000
// A pass held up to a laptop webcam fills only part of the frame, so decode at up to 1280px.
// Shrinking to 640px left too few pixels per QR module for jsQR to read it.
export const MAX_DECODE_WIDTH = 1280

// Some Chrome and Edge builds (e.g. on Windows) expose BarcodeDetector without QR support,
// and it then finds nothing forever. Only trust it when it says it reads QR codes.
export async function nativeQrDetector(Native: DetectorCtor | undefined): Promise<Detector | null> {
  if (!Native) return null
  try {
    const formats = (await Native.getSupportedFormats?.()) ?? []
    return formats.includes('qr_code') ? new Native({ formats: ['qr_code'] }) : null
  } catch {
    return null
  }
}

/**
 * Opens the rear (`environment`) or front (`user`) camera on `video` and calls `onCode` for each QR code read. The same code is not
 * repeated within a few seconds. Returns a function that stops the camera. Rejects if the camera
 * cannot be opened (no permission, no camera, or an insecure page).
 */
export type Facing = 'environment' | 'user'

export async function startScanner(video: HTMLVideoElement, onCode: (value: string) => void, facing: Facing = 'environment'): Promise<() => void> {
  if (!cameraAvailable()) throw new Error('camera-unavailable')
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing } }, audio: false })
  video.srcObject = stream
  video.muted = true
  video.setAttribute('playsinline', 'true') // iOS plays inline only with this attribute
  await video.play()

  const native = await nativeQrDetector((window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let last = ''
  let lastAt = 0

  const decodeWithJsQR = (): string | undefined => {
    if (!ctx || !video.videoWidth) return undefined
    const scale = Math.min(1, MAX_DECODE_WIDTH / video.videoWidth)
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
    // attemptBoth also reads a light-on-dark QR, e.g. a pass shown with the phone in dark mode
    return jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'attemptBoth' })?.data
  }

  // Native first when it can read QR codes, then jsQR on the same frame if it found nothing
  const read = async (): Promise<string | undefined> => {
    const fromNative = native ? (await native.detect(video).catch(() => []))[0]?.rawValue : undefined
    return fromNative || decodeWithJsQR()
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
