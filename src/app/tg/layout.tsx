import type { Metadata, Viewport } from 'next'
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
        {/*
          A PLAIN, blocking script tag — deliberately not next/script.

          `<Script strategy="beforeInteractive">` does not emit a real script
          tag: Next queues the URL into `self.__next_s` and its own runtime
          loads it during hydration. That left `window.Telegram` undefined when
          the entry screen's effect ran, so the Mini App reported "open me
          inside Telegram" even when it WAS inside Telegram. (The strategy is
          also documented as root-layout-only, and this is a segment root.)

          A blocking tag in <head> is what Telegram's own docs specify, and it
          runs before any of the page's JavaScript. TelegramEntry additionally
          waits for the object, so a slow or blocked CDN degrades into a short
          wait rather than a wrong answer.
        */}
        {/*
          eslint-disable-next-line @next/next/no-sync-scripts -- the rule is a
          general performance heuristic; here the script is synchronous ON
          PURPOSE. Deferring it is precisely what caused the Mini App to report
          "open me inside Telegram" while inside Telegram, and this page is a
          thin entry screen with nothing else to render meanwhile. Correctness
          no longer depends on it — TelegramEntry waits for the object either
          way — but the fast path should stay synchronous.
        */}
        <script src="https://telegram.org/js/telegram-web-app.js" />
      </head>
      <body className="font-sans antialiased bg-background text-foreground">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
