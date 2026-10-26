'use client'

import { useEffect, useRef, useState } from 'react'
import { ImageMime, ImageRules, validateImageFile } from '@/lib/images'
import { Bucket, publicImageUrl, removeImage, uploadImage } from '@/lib/storage'

export interface PendingImage {
  file: File
  type: ImageMime
  previewUrl: string
}

interface CommonProps {
  label: string
  hint?: string
  rules: ImageRules
  // How the preview is drawn: wide banner, square-ish logo, or round photo
  shape: 'banner' | 'logo' | 'avatar'
  disabled?: boolean
}

// Saved mode: uploads immediately. `onSave` stores the new path (or null) in the
// database and returns true on success; the previous file is then deleted.
interface SavedProps extends CommonProps {
  mode: 'saved'
  bucket: Bucket
  folder: string
  kind: string
  path: string | null
  onSave: (path: string | null) => Promise<boolean>
}

// Pending mode: for records that don't exist yet (e.g. a new event). The parent
// receives the validated file and uploads it after creating the record.
interface PendingProps extends CommonProps {
  mode: 'pending'
  pending: PendingImage | null
  onPendingChange: (image: PendingImage | null) => void
}

type Props = SavedProps | PendingProps

const PREVIEW_STYLES: Record<CommonProps['shape'], React.CSSProperties> = {
  banner: { width: '100%', aspectRatio: '4 / 1', objectFit: 'cover', borderRadius: '6px' },
  logo: { width: '120px', height: '120px', objectFit: 'contain', borderRadius: '6px', backgroundColor: '#ffffff', padding: '8px' },
  avatar: { width: '96px', height: '96px', objectFit: 'cover', borderRadius: '50%' },
}

export default function ImageUpload(props: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const currentUrl = props.mode === 'saved' ? publicImageUrl(props.bucket, props.path) : props.pending?.previewUrl ?? null

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(''), 3000)
    return () => clearTimeout(t)
  }, [message])

  const choose = async (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = ''
    if (!file) return
    setError('')
    setMessage('')
    const check = await validateImageFile(file, props.rules)
    if (!check.ok) {
      setError(check.error)
      return
    }

    if (props.mode === 'pending') {
      if (props.pending) URL.revokeObjectURL(props.pending.previewUrl)
      props.onPendingChange({ file, type: check.type, previewUrl: URL.createObjectURL(file) })
      return
    }

    if (props.path && !confirm(`Replace the current ${props.label.toLowerCase()}?`)) return
    setBusy(true)
    try {
      const newPath = await uploadImage(props.bucket, props.folder, props.kind, file, check.type)
      const saved = await props.onSave(newPath)
      if (saved) {
        await removeImage(props.bucket, props.path)
        setMessage(props.path ? 'Image replaced.' : 'Image uploaded.')
      } else {
        await removeImage(props.bucket, newPath)
        setError('The image could not be saved.')
      }
    } catch (err) {
      setError('Upload failed: ' + (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setError('')
    if (props.mode === 'pending') {
      if (props.pending) URL.revokeObjectURL(props.pending.previewUrl)
      props.onPendingChange(null)
      return
    }
    if (!confirm(`Remove the ${props.label.toLowerCase()}?`)) return
    setBusy(true)
    const saved = await props.onSave(null)
    if (saved) {
      await removeImage(props.bucket, props.path)
      setMessage('Image removed.')
    } else {
      setError('The image could not be removed.')
    }
    setBusy(false)
  }

  return (
    <div>
      <p style={{ marginBottom: '8px', fontWeight: 500 }}>{props.label}</p>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentUrl} alt={`${props.label} preview`} style={{ ...PREVIEW_STYLES[props.shape], border: '1px solid var(--color-border)', maxWidth: '100%' }} />
        ) : (
          <div
            style={{
              ...PREVIEW_STYLES[props.shape], border: '1px dashed var(--color-border)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: 'var(--color-text-secondary)', fontSize: '13px', backgroundColor: 'transparent', padding: 0,
            }}
          >
            No image
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" className="btn-secondary" onClick={() => inputRef.current?.click()} disabled={busy || props.disabled}>
            {busy ? 'Uploading...' : currentUrl ? 'Replace' : 'Upload'}
          </button>
          {currentUrl && (
            <button type="button" className="btn-secondary" onClick={remove} disabled={busy || props.disabled} style={{ color: 'var(--color-error-red)' }}>
              Remove
            </button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => choose(e.target.files?.[0])}
        style={{ display: 'none' }}
        aria-label={`${props.label} file`}
      />
      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '6px' }}>
        {props.hint ?? 'PNG, JPG or WebP.'} Max {Math.round(props.rules.maxBytes / 1048576)} MB
        {props.rules.minWidth ? `, at least ${props.rules.minWidth}×${props.rules.minHeight}px` : ''}.
      </p>
      {error && <div className="alert-error" style={{ marginTop: '8px', fontSize: '14px' }}>{error}</div>}
      {message && <div className="alert-success" style={{ marginTop: '8px', fontSize: '14px' }}>{message}</div>}
    </div>
  )
}
