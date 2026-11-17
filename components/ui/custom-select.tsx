'use client'

import React, { useEffect, useRef, useState, useId, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string | number
  label: string
  dot?: string // Tailwind bg color class e.g. 'bg-emerald-500'
  icon?: React.ReactNode
  description?: string
  fontFamily?: string
}

export interface CustomSelectProps {
  value: string | number | undefined
  onChange: (value: any) => void
  options: (SelectOption | string)[]
  placeholder?: string
  className?: string
  triggerClassName?: string
  popoverClassName?: string
  disabled?: boolean
  id?: string
  'aria-label'?: string
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  className,
  triggerClassName,
  popoverClassName,
  disabled = false,
  id,
  'aria-label': ariaLabel,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const autoId = useId()
  const selectId = id || autoId

  const [coords, setCoords] = useState<{
    top?: number
    bottom?: number
    left: number
    width: number
    placement: 'bottom' | 'top'
    maxHeight: number
  } | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Normalize options
  const normalizedOptions: SelectOption[] = options.map((opt) => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt }
    }
    return opt
  })

  // Find currently selected option
  const selectedOption = normalizedOptions.find((opt) => String(opt.value) === String(value))

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const minHeightNeeded = 180

    const placeAbove = spaceBelow < minHeightNeeded && spaceAbove > spaceBelow
    const availableHeight = placeAbove ? spaceAbove - 16 : spaceBelow - 16
    const maxHeight = Math.max(120, Math.min(280, availableHeight))

    if (placeAbove) {
      setCoords({
        bottom: window.innerHeight - rect.top + 4,
        left: rect.left,
        width: Math.max(rect.width, 160),
        placement: 'top',
        maxHeight,
      })
    } else {
      setCoords({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 160),
        placement: 'bottom',
        maxHeight,
      })
    }
  }, [])

  // Update position when opening or scrolling/resizing
  useEffect(() => {
    if (!isOpen) return

    updatePosition()

    const handleScrollOrResize = () => {
      updatePosition()
    }

    window.addEventListener('resize', handleScrollOrResize, { passive: true })
    window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true })

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        listRef.current &&
        !listRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('resize', handleScrollOrResize)
      window.removeEventListener('scroll', handleScrollOrResize, true)
      document.removeEventListener('pointerdown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, updatePosition])

  const handleSelect = (optValue: string | number) => {
    onChange(optValue)
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div className={cn('relative inline-block w-full min-w-0 select-none', className)}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        id={selectId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || placeholder}
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev)
          }
        }}
        className={cn(
          'flex h-10 w-full min-w-0 items-center justify-between gap-2.5 rounded-2xl border border-border bg-card px-3.5 text-xs font-semibold text-foreground shadow-2xs transition-all cursor-pointer',
          'hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          isOpen && 'border-primary ring-2 ring-primary/20',
          disabled && 'opacity-50 cursor-not-allowed',
          triggerClassName
        )}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {selectedOption?.dot && (
            <span className={cn('size-2 shrink-0 rounded-full', selectedOption.dot)} />
          )}
          {selectedOption?.icon && (
            <span className="shrink-0 text-muted-foreground">{selectedOption.icon}</span>
          )}
          <span
            className={cn('truncate', !selectedOption && 'text-muted-foreground font-normal')}
            style={selectedOption?.fontFamily ? { fontFamily: selectedOption.fontFamily } : undefined}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>

        <ChevronDown
          size={14}
          className={cn(
            'shrink-0 text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-180 text-foreground'
          )}
        />
      </button>

      {/* Floating Popover Menu rendered in React Portal to escape any overflow:hidden */}
      {isOpen && mounted && coords && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={listRef}
            role="listbox"
            tabIndex={-1}
            style={{
              position: 'fixed',
              top: coords.top !== undefined ? `${coords.top}px` : undefined,
              bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              maxHeight: `${coords.maxHeight}px`,
              zIndex: 9999,
            }}
            className={cn(
              'overflow-y-auto rounded-2xl border border-border bg-popover/98 p-1.5 shadow-2xl backdrop-blur-md animate-in fade-in-0 zoom-in-95',
              coords.placement === 'top' ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2',
              popoverClassName
            )}
          >
            {normalizedOptions.map((opt) => {
              const isSelected = String(opt.value) === String(value)

              return (
                <div
                  key={String(opt.value)}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(opt.value)}
                  className={cn(
                    'flex items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium cursor-pointer transition-colors',
                    isSelected
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'text-foreground hover:bg-muted hover:text-foreground'
                  )}
                  style={opt.fontFamily ? { fontFamily: opt.fontFamily } : undefined}
                >
                  <div className="flex min-w-0 items-center gap-2 truncate">
                    {opt.dot && (
                      <span className={cn('size-2 shrink-0 rounded-full', opt.dot)} />
                    )}
                    {opt.icon && (
                      <span className="shrink-0 text-muted-foreground">{opt.icon}</span>
                    )}
                    <div className="min-w-0 truncate">
                      <span className="truncate">{opt.label}</span>
                      {opt.description && (
                        <p className="text-[10px] text-muted-foreground font-normal truncate">
                          {opt.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <Check size={14} className="shrink-0 text-primary ml-1" />
                  )}
                </div>
              )
            })}
          </div>,
          document.body
        )}
    </div>
  )
}
