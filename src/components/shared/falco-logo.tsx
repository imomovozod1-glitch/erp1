import { useId } from 'react'
import { cn } from '@/lib/utils'

/*
 * The Falco brand, drawn inline from public/falco-logo-*.svg so it scales crisply, needs no
 * request, and its wordmark can turn light in dark mode (the files' ink is a dark violet).
 * Gradient ids are made unique per instance, or two logos on one page would share them.
 */

type Stop = readonly [offset: string, color: string]

const STOPS: Record<'topShade' | 'topLight' | 'lowShade' | 'lowLight' | 'ink', readonly Stop[]> = {
  topShade: [['0', '#38187D'], ['0.5', '#4825A3'], ['1', '#6537D7']],
  topLight: [['0', '#46239A'], ['0.45', '#6138C6'], ['1', '#7F55F5']],
  lowShade: [['0', '#482993'], ['0.5', '#6146BB'], ['1', '#7E75EA']],
  lowLight: [['0', '#7D69D8'], ['0.5', '#9888EB'], ['1', '#AB9CFB']],
  ink: [['0', '#3B1A86'], ['1', '#5A2FC8']],
}

const AXES: Record<keyof typeof STOPS, [number, number, number, number]> = {
  topShade: [300, 590, 700, 240],
  topLight: [330, 470, 720, 200],
  lowShade: [400, 640, 660, 470],
  lowLight: [350, 640, 650, 445],
  ink: [300, 0, 720, 0],
}

// Each wing is a whole shape in its shade with the lit face laid over it.
const WINGS: [keyof typeof STOPS, string][] = [
  ['topShade', 'M275,528 C280,460 335,408 400,378 C520,323 660,228 758,154 C740,240 665,370 600,414 C510,475 345,520 304,603 C285,585 274,555 275,528 Z'],
  ['topLight', 'M304,603 C285,585 274,555 275,528 C280,460 335,408 400,378 C520,323 660,228 758,154 C715,225 590,340 500,402 C430,445 340,500 304,603 Z'],
  ['lowShade', 'M338,630 C340,590 390,545 450,522 C560,478 660,428 727,382 C712,460 615,560 534,585 C580,588 620,582 649,573 C625,595 590,622 540,625 C470,627 390,630 352,693 C342,675 337,650 338,630 Z'],
  ['lowLight', 'M352,693 C342,675 337,650 338,630 C340,590 390,545 450,522 C560,478 660,428 727,382 C690,440 600,500 500,547 C430,580 375,620 352,693 Z'],
]

/** "Falco": a monoline wordmark, cap height 780–920. */
const LETTERS = ['M292,910 V790 H358', 'M292,848 H344', 'M460,840 V910', 'M514,790 V910', 'M625.2,848.8 A37,37 0 1 0 625.2,901.2']
const RINGS = [423, 704]

function Gradients({ prefix }: { prefix: string }) {
  return (
    <defs>
      {(Object.keys(STOPS) as (keyof typeof STOPS)[]).map((name) => {
        const [x1, y1, x2, y2] = AXES[name]
        return (
          <linearGradient key={name} id={`${prefix}-${name}`} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
            {STOPS[name].map(([offset, color]) => (
              <stop key={offset} offset={offset} stopColor={color} />
            ))}
          </linearGradient>
        )
      })}
    </defs>
  )
}

function Wings({ prefix, transform }: { prefix: string; transform?: string }) {
  return (
    <g transform={transform}>
      {WINGS.map(([fill, d]) => (
        <path key={fill} d={d} fill={`url(#${prefix}-${fill})`} />
      ))}
    </g>
  )
}

function Wordmark({ prefix }: { prefix: string }) {
  return (
    <g fill="none" stroke={`url(#${prefix}-ink)`} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" className="dark:stroke-violet-100">
      {LETTERS.map((d) => (
        <path key={d} d={d} />
      ))}
      {RINGS.map((cx) => (
        <circle key={cx} cx={cx} cy={875} r={37} />
      ))}
    </g>
  )
}

const usePrefix = () => `falco${useId().replace(/[^a-zA-Z0-9]/g, '')}`

interface LogoProps {
  className?: string
  /** Read by screen readers; leave empty where the name is already written beside it. */
  title?: string
}

const a11y = (title?: string) => (title ? { role: 'img' as const, 'aria-label': title } : { 'aria-hidden': true as const })

/** The two wings alone — for icons, small spaces and the collapsed sidebar. */
export function FalcoMark({ className, title }: LogoProps) {
  const prefix = usePrefix()
  return (
    <svg viewBox="268 148 496 551" className={cn('shrink-0', className)} {...a11y(title)}>
      <Gradients prefix={prefix} />
      <Wings prefix={prefix} />
    </svg>
  )
}

/** Wings beside the wordmark (public/falco-logo-horizontal.svg). */
export function FalcoLogo({ className, title = 'Falco' }: LogoProps) {
  const prefix = usePrefix()
  return (
    <svg viewBox="-16 699 783 302" className={cn('shrink-0', className)} {...a11y(title)}>
      <Gradients prefix={prefix} />
      <Wings prefix={prefix} transform="translate(-137,638) scale(0.5)" />
      <Wordmark prefix={prefix} />
    </svg>
  )
}

/** Wings above the wordmark (public/falco-logo-transparent.svg). */
export function FalcoLogoStacked({ className, title = 'Falco' }: LogoProps) {
  const prefix = usePrefix()
  return (
    <svg viewBox="250 130 526 814" className={cn('shrink-0', className)} {...a11y(title)}>
      <Gradients prefix={prefix} />
      <Wings prefix={prefix} />
      <Wordmark prefix={prefix} />
    </svg>
  )
}
