import { AE, AZ, CN, DE, GB, IN, KG, KZ, RU, TJ, TM, TR, US, UZ } from 'country-flag-icons/react/3x2'
import { cn } from '@/lib/utils'

/**
 * Country flags as inline SVG.
 *
 * Emoji flags (🇺🇿) are two "regional indicator" characters that only macOS,
 * iOS, Android and Linux fonts draw as a flag — Windows has no flag glyphs and
 * shows the letters "UZ" instead. SVG renders the same everywhere, needs no
 * network request, and stays inside the CSP.
 *
 * Only the countries in `PHONE_COUNTRIES` are imported, so the bundle carries
 * just these flags. Add the import here when a country is added there.
 */
const FLAGS: Record<string, typeof UZ> = { AE, AZ, CN, DE, GB, IN, KG, KZ, RU, TJ, TM, TR, US, UZ }

export function CountryFlag({ iso, title, className }: { iso: string; title?: string; className?: string }) {
  const Flag = FLAGS[iso.toUpperCase()]
  const box = cn(
    'inline-block h-3.5 w-[21px] shrink-0 overflow-hidden rounded-[2px] ring-1 ring-black/10 dark:ring-white/15',
    className
  )
  if (!Flag) {
    return (
      <span className={cn(box, 'bg-slate-200 text-[8px] font-bold leading-3.5 text-center text-slate-600')} aria-hidden>
        {iso}
      </span>
    )
  }
  return <Flag title={title ?? iso} className={box} />
}
