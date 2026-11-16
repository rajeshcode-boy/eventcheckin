'use client'

import React, { useEffect, useRef, useState, useId } from 'react'
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
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const autoId = useId()
  const selectId = id || autoId

  // Normalize options
  const normalizedOptions: SelectOption[] = options.map((opt) => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt }
    }
    return opt
  })

  // Find currently selected option
  const selectedOption = normalizedOptions.find((opt) => String(opt.value) === String(value))

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleSelect = (optValue: string | number) => {
    onChange(optValue)
    setIsOpen(false)
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative inline-block w-full min-w-0 select-none', className)}
    >
      {/* Trigger Button */}
      <button
        id={selectId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || placeholder}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
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

      {/* Floating Popover Menu */}
      {isOpen && (
        <div
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          className={cn(
            'absolute left-0 top-[calc(100%+4px)] z-50 min-w-full w-max max-w-[320px] max-h-64 overflow-y-auto rounded-2xl border border-border bg-popover p-1.5 shadow-xl backdrop-blur-md animate-in fade-in-0 zoom-in-95',
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
        </div>
      )}
    </div>
  )
}
