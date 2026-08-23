'use client'

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface PhoneCountry {
  iso: string
  name: string
  dialCode: string
  flag: string
}

/**
 * Countries relevant to this app's Central Asia + neighbors user base
 * (see AGENTS.md — uz/ru/en locales, Uzbekistan-focused tenant base per
 * `formatPhoneInput`'s doc comment), plus a handful of common international
 * ones. Sorted by dial-code length (longest first) is done at lookup time,
 * not here, so a listed order stays natural for the dropdown.
 */
export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: 'UZ', name: "O'zbekiston", dialCode: '998', flag: '🇺🇿' },
  { iso: 'RU', name: 'Rossiya', dialCode: '7', flag: '🇷🇺' },
  { iso: 'KZ', name: "Qozog'iston", dialCode: '7', flag: '🇰🇿' },
  { iso: 'KG', name: "Qirg'iziston", dialCode: '996', flag: '🇰🇬' },
  { iso: 'TJ', name: 'Tojikiston', dialCode: '992', flag: '🇹🇯' },
  { iso: 'TM', name: 'Turkmaniston', dialCode: '993', flag: '🇹🇲' },
  { iso: 'AZ', name: 'Ozarbayjon', dialCode: '994', flag: '🇦🇿' },
  { iso: 'TR', name: 'Turkiya', dialCode: '90', flag: '🇹🇷' },
  { iso: 'AE', name: 'BAA', dialCode: '971', flag: '🇦🇪' },
  { iso: 'US', name: 'AQSH', dialCode: '1', flag: '🇺🇸' },
  { iso: 'GB', name: 'Buyuk Britaniya', dialCode: '44', flag: '🇬🇧' },
  { iso: 'DE', name: 'Germaniya', dialCode: '49', flag: '🇩🇪' },
  { iso: 'CN', name: 'Xitoy', dialCode: '86', flag: '🇨🇳' },
  { iso: 'IN', name: 'Hindiston', dialCode: '91', flag: '🇮🇳' },
]

const DEFAULT_COUNTRY = PHONE_COUNTRIES[0]

/** 2-3-2-2 grouping, e.g. "90 123 45 67" — matches the app-wide +998 display convention. */
function groupDigits(digits: string): string {
  let out = ''
  if (digits.length > 0) out += digits.slice(0, 2)
  if (digits.length > 2) out += ' ' + digits.slice(2, 5)
  if (digits.length > 5) out += ' ' + digits.slice(5, 7)
  if (digits.length > 7) out += ' ' + digits.slice(7, 9)
  if (digits.length > 9) out += ' ' + digits.slice(9, 12)
  return out
}

function detectCountry(fullValue: string): { country: PhoneCountry; national: string } {
  const digits = (fullValue || '').replace(/\D/g, '')
  const byLongestCode = [...PHONE_COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length)
  for (const c of byLongestCode) {
    if (digits.startsWith(c.dialCode)) {
      return { country: c, national: digits.slice(c.dialCode.length) }
    }
  }
  return { country: DEFAULT_COUNTRY, national: digits }
}

interface PhoneInputProps {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  triggerClassName?: string
  inputClassName?: string
  /** Override for the country dropdown popup — needed on always-dark surfaces (e.g. the login screen) that don't toggle the app's `.dark` class. */
  contentClassName?: string
  hasError?: boolean
}

/**
 * Country-code phone input: a flag+dial-code selector next to the national
 * number field. Always emits a single `+{dialCode}{digits}` string via
 * `onChange` — country selection is purely a data-entry aid, since every
 * consumer (login, tenant provisioning) only ever cares about the final
 * digit sequence (see `phoneToSyntheticEmail` in `src/lib/tenant-auth.ts`,
 * which strips non-digits regardless of country).
 */
export function PhoneInput({
  id,
  value,
  onChange,
  placeholder,
  className,
  triggerClassName,
  inputClassName,
  contentClassName,
  hasError,
}: PhoneInputProps) {
  const initial = detectCountry(value)
  const [countryIso, setCountryIso] = useState(initial.country.iso)
  const [national, setNational] = useState(initial.national)

  const emit = (iso: string, nationalDigits: string) => {
    const c = PHONE_COUNTRIES.find((x) => x.iso === iso) ?? DEFAULT_COUNTRY
    onChange(nationalDigits ? `+${c.dialCode} ${groupDigits(nationalDigits)}`.trimEnd() : '')
  }

  return (
    <div className={cn('flex gap-2', className)}>
      <Select
        value={countryIso}
        onValueChange={(iso) => {
          if (!iso) return
          setCountryIso(iso)
          emit(iso, national)
        }}
      >
        <SelectTrigger className={cn('w-[100px] shrink-0', triggerClassName)}>
          <SelectValue>
            {(iso: string) => {
              const c = PHONE_COUNTRIES.find((x) => x.iso === iso) ?? DEFAULT_COUNTRY
              return `${c.flag} +${c.dialCode}`
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className={contentClassName}>
          {PHONE_COUNTRIES.map((c) => (
            <SelectItem key={c.iso} value={c.iso}>
              {c.flag} {c.name} (+{c.dialCode})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        type="tel"
        inputMode="numeric"
        placeholder={placeholder}
        value={groupDigits(national)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 12)
          setNational(digits)
          emit(countryIso, digits)
        }}
        className={cn('flex-1', hasError && 'border-red-500/50', inputClassName)}
      />
    </div>
  )
}
