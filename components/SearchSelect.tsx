'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface SearchOption {
  value: string
  label: string
}

interface Props {
  id?: string
  options: SearchOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  // Lets the user keep text that isn't in the list (e.g. a city with no suggestion)
  allowCustom?: boolean
  required?: boolean
  disabled?: boolean
  ariaLabel?: string
}

const MAX_SHOWN = 60

// Type-to-search dropdown (combobox). Arrow keys move, Enter picks, Escape closes.
export default function SearchSelect({ id, options, value, onChange, placeholder, allowCustom, required, disabled, ariaLabel }: Props) {
  const listId = useId()
  const selectedLabel = options.find((o) => o.value === value)?.label ?? (allowCustom ? value : '')
  const [text, setText] = useState(selectedLabel)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Follow value changes made outside (e.g. form reset, country change clearing the city)
  useEffect(() => {
    setText(selectedLabel)
  }, [selectedLabel])

  const matches = useMemo(() => {
    const q = text.trim().toLowerCase()
    if (!q || q === selectedLabel.toLowerCase()) return options.slice(0, MAX_SHOWN)
    const starts = options.filter((o) => o.label.toLowerCase().startsWith(q))
    const contains = options.filter((o) => !o.label.toLowerCase().startsWith(q) && o.label.toLowerCase().includes(q))
    return [...starts, ...contains].slice(0, MAX_SHOWN)
  }, [options, text, selectedLabel])

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) commit()
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  })

  const pick = (option: SearchOption) => {
    onChange(option.value)
    setText(option.label)
    setOpen(false)
  }

  // On blur: keep custom text if allowed, otherwise snap to an exact match or revert
  const commit = () => {
    if (!open) return
    setOpen(false)
    const typed = text.trim()
    const exact = options.find((o) => o.label.toLowerCase() === typed.toLowerCase())
    if (exact) pick(exact)
    else if (allowCustom) onChange(typed)
    else setText(selectedLabel)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(a + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && open) {
      e.preventDefault()
      if (matches[active]) pick(matches[active]!)
      else commit()
    } else if (e.key === 'Escape') {
      setOpen(false)
      setText(selectedLabel)
    } else if (e.key === 'Tab') {
      commit()
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <Input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        autoComplete="off"
        className="h-10 text-base"
        value={text}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
          setActive(0)
          if (!e.target.value) onChange('')
        }}
        onKeyDown={onKeyDown}
      />
      {open && matches.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-card shadow-lg"
        >
          {matches.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(o)
              }}
              onMouseEnter={() => setActive(i)}
              className={cn('cursor-pointer px-3 py-2.5 text-[15px]', i === active && 'bg-muted', o.value === value && 'font-semibold')}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
