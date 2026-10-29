'use client'

import { useCallback, useRef, useState } from 'react'
import { AlertDialog } from '@base-ui/react/alert-dialog'
import { Button } from '@/components/ui/button'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Red confirm button, for deleting or anything that cannot be undone. */
  destructive?: boolean
}

interface ConfirmDialogProps extends ConfirmOptions {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

// Accessible replacement for window.confirm(): focus is trapped, Esc cancels, and the title and
// description are announced. Cancel gets initial focus so Enter never confirms by accident.
export function ConfirmDialog({
  open, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', destructive, onConfirm, onCancel,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => { if (!next) onCancel() }}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <AlertDialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
          <AlertDialog.Popup className="w-full max-w-md rounded-xl border border-border bg-background p-5 text-foreground shadow-xl transition-all data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
            {description && (
              <AlertDialog.Description className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                {description}
              </AlertDialog.Description>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <AlertDialog.Close render={<Button variant="outline" autoFocus />} onClick={onCancel}>
                {cancelLabel}
              </AlertDialog.Close>
              <Button variant={destructive ? 'destructive' : 'default'} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Viewport>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

// Promise-style helper so call sites read like window.confirm:
//   const { confirm, dialog } = useConfirm()
//   if (!(await confirm({ title: 'Delete this?', destructive: true }))) return
// Render {dialog} once in the component.
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((ok: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions) => {
    resolver.current?.(false)
    setOptions(opts)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const settle = (ok: boolean) => {
    resolver.current?.(ok)
    resolver.current = null
    setOptions(null)
  }

  const dialog = (
    <ConfirmDialog
      open={options !== null}
      title={options?.title ?? ''}
      description={options?.description}
      confirmLabel={options?.confirmLabel}
      cancelLabel={options?.cancelLabel}
      destructive={options?.destructive}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  )

  return { confirm, dialog }
}
