'use client'

import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/providers/theme-provider'

interface ThemeToggleProps {
  labels?: { light: string; dark: string }
}

export function ThemeToggle({ labels }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      // Read at click time, which is always after hydration, so this sees the
      // real resolved theme rather than the hydration-safe placeholder.
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      // Safe to derive from `resolvedTheme`: the hydration render now reports
      // the same value on both sides, so this matches. It corrects itself on
      // React's post-hydration re-render — and being a non-visual label, a
      // single frame of staleness costs nothing.
      aria-label={
        resolvedTheme === 'dark'
          ? labels?.light ?? 'Light mode'
          : labels?.dark ?? 'Dark mode'
      }
      className="text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
    >
      {/*
        Both icons are always rendered and swapped purely by the `dark` class
        on <html>, which the root layout's blocking script sets before first
        paint. Picking one in JS from `resolvedTheme` would show the wrong icon
        for a frame: the hydration render deliberately reports 'light' for
        everyone (see theme-provider), so a dark-mode user would get the moon
        until React's post-hydration re-render swapped it.
      */}
      <Sun className="hidden h-4 w-4 dark:block" aria-hidden="true" />
      <Moon className="h-4 w-4 dark:hidden" aria-hidden="true" />
    </Button>
  )
}
