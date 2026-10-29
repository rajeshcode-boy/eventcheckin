'use client'

import { useEffect, useRef, useState } from 'react'
import { ImageMime, ImageRules, validateImageFile } from '@/lib/images'
import { Bucket, publicImageUrl, removeImage, uploadImage } from '@/lib/storage'
import { useConfirm } from '@/components/ConfirmDialog'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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

const PREVIEW_CLASSES: Record<CommonProps['shape'], string> = {
  banner: 'aspect-[4/1] w-full rounded-md object-cover',
  logo: 'size-[120px] rounded-md bg-white object-contain p-2',
  avatar: 'size-24 rounded-full object-cover',
}

export default function ImageUpload(props: Props) {
  const { confirm, dialog } = useConfirm()
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

    if (props.path && !(await confirm({ title: `Replace the current ${props.label.toLowerCase()}?`, confirmLabel: 'Replace' }))) return
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
    if (!(await confirm({ title: `Remove the ${props.label.toLowerCase()}?`, confirmLabel: 'Remove', destructive: true }))) return
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
    <>
    {dialog}
    <div>
      <p className="mb-2 font-medium">{props.label}</p>
      <div className="flex flex-wrap items-center gap-4">
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentUrl} alt={`${props.label} preview`} className={cn(PREVIEW_CLASSES[props.shape], 'max-w-full border border-border')} />
        ) : (
          <div className={cn(PREVIEW_CLASSES[props.shape], 'flex items-center justify-center border border-dashed border-border bg-transparent p-0 text-[13px] text-muted-foreground')}>
            No image
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy || props.disabled}>
            {busy ? 'Uploading...' : currentUrl ? 'Replace' : 'Upload'}
          </Button>
          {currentUrl && (
            <Button type="button" variant="outline" className="text-destructive" onClick={remove} disabled={busy || props.disabled}>
              Remove
            </Button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => choose(e.target.files?.[0])}
        className="hidden"
        aria-label={`${props.label} file`}
      />
      <p className="mt-1.5 text-xs text-muted-foreground">
        {props.hint ?? 'PNG, JPG or WebP.'} Max {Math.round(props.rules.maxBytes / 1048576)} MB
        {props.rules.minWidth ? `, at least ${props.rules.minWidth}×${props.rules.minHeight}px` : ''}.
      </p>
      {error && <Alert variant="error" className="mt-2">{error}</Alert>}
      {message && <Alert variant="success" className="mt-2">{message}</Alert>}
    </div>
    </>
  )
}
