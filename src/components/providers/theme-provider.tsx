'use client'

import { createContext, useContext, useEffect, useCallback, useMemo, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'erp-theme'
const CHANGE_EVENT = 'erp-theme-change'

function readStoredTheme(): Theme {
  try {
    return (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'system'
  } catch {
    return 'system'
  }
}

function prefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

function getThemeSnapshot(): Theme {
  return readStoredTheme()
}

function getThemeServerSnapshot(): Theme {
  return 'system'
}

function getResolvedSnapshot(): ResolvedTheme {
  const theme = readStoredTheme()
  if (theme !== 'system') return theme
  return prefersDark() ? 'dark' : 'light'
}

/**
 * MUST be a constant, and must equal what the server rendered.
 *
 * `resolvedTheme` used to be computed during render as
 * `theme === 'system' ? (typeof window === 'undefined' ? 'light' : matchMedia(...)) : theme`.
 * That is a server/client branch: the server always produced 'light', while
 * the very first client render produced 'dark' for anyone whose OS is in dark
 * mode. Consumers render different output from it — `ThemeToggle` swaps its
 * icon and aria-label, the analytics/admin charts pick different colors — so
 * hydration mismatched and React threw away the server HTML and re-rendered
 * the whole tree on the client. (That re-render is also what produced the
 * separate "Encountered a script tag while rendering React component"
 * warning: the theme <script> in the root layout's <head> only gets *created*
 * client-side when the tree is regenerated.)
 *
 * Reading it through useSyncExternalStore instead means hydration renders
 * 'light' on both sides, then React immediately re-runs `getResolvedSnapshot`
 * and re-renders once with the real value. The visible theme itself never
 * flashes, because the blocking script in the root layout has already put the
 * `dark` class on <html> before first paint.
 */
function getResolvedServerSnapshot(): ResolvedTheme {
  return 'light'
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

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getThemeSnapshot, getThemeServerSnapshot)
  const resolvedTheme = useSyncExternalStore(subscribe, getResolvedSnapshot, getResolvedServerSnapshot)

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
