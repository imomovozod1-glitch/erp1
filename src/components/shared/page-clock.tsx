'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

interface PageClockProps {
  lang: string
}

export function PageClock({ lang }: PageClockProps) {
  const [currentTime, setCurrentTime] = useState<Date | null>(null)

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentTime(new Date())
    }, 0)
    const timerId = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => {
      clearTimeout(timeoutId)
      clearInterval(timerId)
    }
  }, [])

  if (!currentTime) return null

  return (
    <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl font-medium shadow-sm border border-slate-200 dark:border-slate-800 transition-all duration-300 hover:border-slate-300 dark:hover:border-slate-750">
      <Clock className="h-4 w-4 text-indigo-600 dark:text-indigo-400 animate-pulse" />
      <span className="text-sm">
        {currentTime.toLocaleDateString(lang === 'uz' ? 'uz-UZ' : 'ru-RU', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </span>
      <span className="text-slate-300 dark:text-slate-700">|</span>
      <span className="text-sm font-semibold text-slate-950 dark:text-white">
        {currentTime.toLocaleTimeString(lang === 'uz' ? 'uz-UZ' : 'ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </span>
    </div>
  )
}
