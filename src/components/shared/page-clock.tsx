'use client'

import { useSyncExternalStore } from 'react'
import { Clock } from 'lucide-react'

interface PageClockProps {
  lang: string
}

function getLocale(lang: string) {
  return lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : 'en-US'
}

function subscribe(callback: () => void) {
  const id = setInterval(callback, 1000)
  return () => clearInterval(id)
}

function getSnapshot() {
  return Date.now()
}

// Server and first client render must agree, so report "not mounted yet" (0)
// on the server and let the client tick take over post-hydration.
function getServerSnapshot() {
  return 0
}

export function PageClock({ lang }: PageClockProps) {
  const timestamp = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  if (timestamp === 0) return null

  const now = new Date(timestamp)
  const locale = getLocale(lang)
  const date = now.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
  const time = now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex items-center gap-1.5 h-8 pl-1.5 pr-2.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs shrink-0">
      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
        <Clock className="h-3 w-3" />
      </span>
      <span className="text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
        {date}
      </span>
      <span className="h-3 w-px bg-slate-200 dark:bg-slate-700" />
      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
        {time}
      </span>
    </div>
  )
}
