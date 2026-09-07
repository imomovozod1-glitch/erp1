import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Toaster } from '@/components/ui/sonner'
import '../globals.css'

export const metadata: Metadata = { title: 'UzLider ERP' }

// Telegram renders the Mini App in a WebView sized to the chat sheet;
// viewportFit lets it draw under the device's safe areas like the native shell.
export const viewport: Viewport = {
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

/**
 * The Mini App lives outside `[lang]` and outside `(dashboard)` on purpose: it
 * has no sidebar, no locale segment and no tenant-subdomain gate — it is a thin
 * entry screen whose only job is to establish a session and then hand off to
 * the real app. `src/proxy.ts` skips /tg for the same reason it skips /admin.
 */
export default function TelegramLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <head>
        {/* Telegram injects window.Telegram.WebApp; beforeInteractive so it is
            present before the entry screen reads the theme or initData. */}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body className="font-sans antialiased bg-background text-foreground">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
