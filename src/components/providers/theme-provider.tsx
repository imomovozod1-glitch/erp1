'use client'

import { createContext, useContext, useEffect, useCallback, useMemo, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'erp-theme'
const CHANGE_EVENT = 'erp-theme-change'

function getSnapshot(): Theme {
  try {
    return (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'system'
  } catch {
    return 'system'
  }
}

function getServerSnapshot(): Theme {
  return 'system'
}

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback)
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', callback)
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback)
    mq.removeEventListener('change', callback)
  }
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    if (typeof window === 'undefined') return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const resolvedTheme = resolveTheme(theme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
  }, [resolvedTheme])

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // localStorage unavailable (private mode etc.) — theme just won't persist
    }
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
