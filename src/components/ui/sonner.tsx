'use client'

import { useSyncExternalStore } from 'react'
import { Toaster as SonnerToaster } from 'sonner'

type ToasterProps = React.ComponentProps<typeof SonnerToaster>

/**
 * The toasts follow the app's theme by reading the `dark` class on <html> —
 * the one thing every root layout (tenant app, admin, support, Telegram) has in
 * common. ThemeProvider is not required here: the Telegram Mini App has none.
 */
function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}
const getTheme = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light')
const getServerTheme = () => 'light' as const

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme)
  return (
    <SonnerToaster
      className="toaster group"
      theme={theme}
      style={{ '--border-radius': '1rem' } as React.CSSProperties}
      {...props}
    />
  )
}

export { Toaster }
