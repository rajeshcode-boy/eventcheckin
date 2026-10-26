'use client'

import { useEffect, useMemo, useState } from 'react'
import { COUNTRIES, Country, countryByIso, countryFromTypedNumber, flagEmoji, formatPhone } from '@/lib/countries'

interface Props {
  id: string
  // Stored format: "+971 501234567" (or a legacy free-text number)
  value: string
  onChange: (stored: string) => void
  defaultCountryIso: string
  hint?: string
}

// Splits a stored "+<code> <number>" into country + local number
function parse(value: string, fallback: Country): { country: Country; national: string } {
  const typed = countryFromTypedNumber(value, fallback.iso)
  if (typed) return { country: typed, national: value.replace(/\D/g, '').slice(typed.dial.length) }
  return { country: fallback, national: value.replace(/[^\d\s()-]/g, '') }
}

// Country dial-code picker + local number. Typing a "+code" switches the country.
export default function PhoneInput({ id, value, onChange, defaultCountryIso, hint }: Props) {
  const fallback = countryByIso(defaultCountryIso) ?? countryByIso('IN')!
  const initial = parse(value, fallback)
  const [country, setCountry] = useState<Country>(initial.country)
  const [national, setNational] = useState(initial.national)

  const sortedCountries = useMemo(() => [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name)), [])

  // Reset when the parent clears the value (e.g. after saving)
  useEffect(() => {
    if (!value) setNational('')
  }, [value])

  const update = (nextCountry: Country, nextNational: string) => {
    setCountry(nextCountry)
    setNational(nextNational)
    onChange(formatPhone(nextCountry, nextNational))
  }

  const onType = (text: string) => {
    const typed = countryFromTypedNumber(text, country.iso)
    if (typed) update(typed, text.replace(/^\s*\+\s*/, '').replace(/\D/g, '').slice(typed.dial.length))
    else update(country, text.replace(/[^\d\s()-]/g, ''))
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <select
          value={country.iso}
          onChange={(e) => update(countryByIso(e.target.value) ?? country, national)}
          className="input-field"
          aria-label="Country code"
          title={country.name}
          style={{ flex: '0 0 112px', width: '112px', padding: '8px' }}
        >
          {sortedCountries.map((c) => (
            <option key={c.iso} value={c.iso}>
              {c.name} (+{c.dial})
            </option>
          ))}
        </select>
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', color: 'var(--color-text-secondary)', pointerEvents: 'none' }}
          >
            {flagEmoji(country.iso)} +{country.dial}
          </span>
          <input
            id={id}
            type="tel"
            inputMode="tel"
            value={national}
            onChange={(e) => onType(e.target.value)}
            className="input-field"
            style={{ paddingLeft: `${40 + country.dial.length * 10}px` }}
            placeholder="Mobile number"
          />
        </div>
      </div>
      {hint && <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>{hint}</p>}
    </div>
  )
}
