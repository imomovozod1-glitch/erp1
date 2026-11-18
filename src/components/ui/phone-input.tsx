'use client'

import { useMemo, useState } from 'react'
import { useLocale } from 'next-intl'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { CountryFlag } from '@/components/ui/country-flag'
import { cn } from '@/lib/utils'
import {
  DEFAULT_PHONE_COUNTRY,
  PHONE_COUNTRIES,
  findPhoneCountry,
  groupNationalDigits,
  splitPhone,
  type PhoneCountry,
} from '@/lib/phone-countries'

export { PHONE_COUNTRIES, type PhoneCountry }

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
 *
 * Typing is hard-capped at the selected country's national length, so a +998
 * number cannot grow past its 9 digits; `isValidPhone` enforces the same rule
 * for pasted and server-side values.
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
  const initial = splitPhone(value)
  const [countryIso, setCountryIso] = useState(initial.country.iso)
  const [national, setNational] = useState(initial.national)

  const country = findPhoneCountry(countryIso)
  const maxDigits = country.nationalLength[1]
  const countryName = useCountryNames()

  const emit = (c: PhoneCountry, nationalDigits: string) => {
    onChange(nationalDigits ? `+${c.dialCode} ${groupNationalDigits(c, nationalDigits)}`.trimEnd() : '')
  }

  return (
    <div className={cn('flex gap-2', className)}>
      <Select
        value={countryIso}
        onValueChange={(iso) => {
          if (!iso) return
          const next = findPhoneCountry(iso)
          // Trim to the new country's length so switching from a 10-digit
          // country to a 9-digit one can't leave an over-long number behind.
          const trimmed = national.slice(0, next.nationalLength[1])
          setCountryIso(iso)
          setNational(trimmed)
          emit(next, trimmed)
        }}
      >
        <SelectTrigger className={cn('w-[112px] shrink-0', triggerClassName)}>
          <SelectValue>
            {(iso: string) => {
              const c = findPhoneCountry(iso)
              return (
                <span className="flex items-center gap-1.5">
                  <CountryFlag iso={c.iso} title={c.name} />
                  <span className="tabular-nums">+{c.dialCode}</span>
                </span>
              )
            }}
          </SelectValue>
        </SelectTrigger>
        {/* Opens BELOW the trigger and wider than it: anchored to the trigger's
            own 112px the names and codes were clipped, and centred over it
            (the Select default) the list covered the number being typed. */}
        <SelectContent
          align="start"
          alignItemWithTrigger={false}
          sideOffset={6}
          className={cn('max-h-80 w-60 rounded-2xl p-1.5 shadow-lg', contentClassName)}
        >
          {PHONE_COUNTRIES.map((c) => (
            <SelectItem key={c.iso} value={c.iso} className="rounded-xl py-2 pr-9 pl-2.5">
              <span className="flex w-full min-w-0 items-center gap-2.5">
                <CountryFlag iso={c.iso} title={countryName(c)} />
                <span className="min-w-0 flex-1 truncate">{countryName(c)}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums">+{c.dialCode}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        maxLength={groupNationalDigits(country, '9'.repeat(maxDigits)).length}
        placeholder={placeholder ?? country.example}
        value={groupNationalDigits(country, national)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, maxDigits)
          setNational(digits)
          emit(country, digits)
        }}
        className={cn('flex-1', hasError && 'border-red-500/50', inputClassName)}
      />
    </div>
  )
}

export { DEFAULT_PHONE_COUNTRY }

/**
 * Country names in the interface language. The list in phone-countries.ts is
 * Uzbek only; `Intl.DisplayNames` knows every region in every locale. The
 * options are only rendered once the list is opened — on the client — so the
 * ICU difference between Node and the browser (CLAUDE.md § Conventions) never
 * reaches hydration. The stored name is the fallback.
 */
function useCountryNames(): (country: PhoneCountry) => string {
  const locale = useLocale()
  const names = useMemo(() => {
    try {
      return new Intl.DisplayNames([locale], { type: 'region' })
    } catch {
      return null
    }
  }, [locale])
  return (country) => {
    if (locale === 'uz' || !names) return country.name
    return names.of(country.iso) ?? country.name
  }
}
