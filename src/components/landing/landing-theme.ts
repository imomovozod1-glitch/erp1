// Light/dark colour pairs, named once so a section cannot drift from the rest.
export const TEXT_STRONG = 'text-slate-900 dark:text-white'
export const TEXT_BODY = 'text-slate-700 dark:text-slate-300'
export const TEXT_MUTED = 'text-slate-600 dark:text-slate-400'
export const ACCENT = 'text-violet-600 dark:text-violet-300'
export const INSET = 'bg-slate-900/[0.04] dark:bg-black/20'
export const HAIRLINE = 'border-slate-900/10 dark:border-white/10'
export const SKELETON = 'bg-slate-900/10 dark:bg-white/15'

export const primaryButton =
  'group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-7 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition-all duration-300 hover:scale-[1.03] hover:shadow-violet-500/60'
export const glassButton = `lp-glass inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-sm font-semibold transition-all duration-300 hover:bg-white dark:hover:bg-white/10 ${TEXT_STRONG}`
