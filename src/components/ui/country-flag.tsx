import { cn } from '@/lib/utils'

/**
 * Country flags as static SVG files.
 *
 * Emoji flags (🇺🇿) are two "regional indicator" characters that only macOS,
 * iOS, Android and Linux fonts draw as a flag — Windows has no flag glyphs and
 * shows the letters "UZ" instead. An SVG renders the same everywhere and is
 * served from our own origin, so it stays inside the CSP (`img-src 'self'`).
 *
 * The files in `public/flags/` are copied from `country-flag-icons/3x2/`.
 * Its React components are NOT used: every one of them lives in a single
 * 330 KB module, so importing even one flag compiled all ~260 of them into the
 * login page's bundle. Copy the file there when a country is added to
 * `PHONE_COUNTRIES`.
 */
const FLAGS = new Set(['AE', 'AZ', 'CN', 'DE', 'GB', 'IN', 'KG', 'KZ', 'RU', 'TJ', 'TM', 'TR', 'US', 'UZ'])

export function CountryFlag({ iso, title, className }: { iso: string; title?: string; className?: string }) {
  const code = iso.toUpperCase()
  const box = cn(
    'inline-block h-3.5 w-[21px] shrink-0 overflow-hidden rounded-[2px] ring-1 ring-black/10 dark:ring-white/15',
    className
  )
  if (!FLAGS.has(code)) {
    return (
      <span className={cn(box, 'bg-slate-200 text-[8px] font-bold leading-3.5 text-center text-slate-600')} aria-hidden>
        {iso}
      </span>
    )
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/flags/${code}.svg`} alt={title ?? code} title={title ?? code} className={cn(box, 'object-cover')} />
}
