'use client'

import { useEffect, useMemo, useState } from 'react'
import { COUNTRIES, Country, countryByIso, countryFromTypedNumber, flagEmoji, formatPhone } from '@/lib/countries'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'

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
      <div className="flex gap-2">
        <NativeSelect
          value={country.iso}
          onChange={(e) => update(countryByIso(e.target.value) ?? country, national)}
          className="h-10 w-28 flex-none p-2"
          aria-label="Country code"
          title={country.name}
        >
          {sortedCountries.map((c) => (
            <option key={c.iso} value={c.iso}>
              {c.name} (+{c.dial})
            </option>
          ))}
        </NativeSelect>
        <div className="relative min-w-0 flex-1">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base text-muted-foreground"
          >
            {flagEmoji(country.iso)} +{country.dial}
          </span>
          <Input
            id={id}
            type="tel"
            inputMode="tel"
            value={national}
            onChange={(e) => onType(e.target.value)}
            className="h-10"
            // the left padding makes room for the flag and dial code, whose width depends on the number
            style={{ paddingLeft: `${40 + country.dial.length * 10}px` }}
            placeholder="Mobile number"
          />
        </div>
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
