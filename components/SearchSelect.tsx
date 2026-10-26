'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'

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
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        autoComplete="off"
        className="input-field"
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
          style={{
            position: 'absolute', zIndex: 20, left: 0, right: 0, top: '100%', marginTop: '4px', maxHeight: '240px',
            overflowY: 'auto', listStyle: 'none', backgroundColor: 'var(--color-white)', border: '1px solid var(--color-border)',
            borderRadius: '6px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          }}
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
              style={{
                padding: '10px 12px', cursor: 'pointer', fontSize: '15px',
                backgroundColor: i === active ? 'var(--color-neutral-light)' : undefined,
                fontWeight: o.value === value ? 600 : undefined,
              }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
