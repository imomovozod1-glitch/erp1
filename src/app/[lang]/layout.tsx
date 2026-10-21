import type { Metadata, Viewport } from 'next'
import { Manrope } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { NavigationProgress } from '@/components/providers/navigation-progress'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { CapacitorProvider } from '@/components/providers/capacitor-provider'
import { routing } from '@/i18n/routing'
import '../globals.css'

// Required by cacheComponents — tells Next.js which [lang] values exist
export function generateStaticParams() {
  return routing.locales.map((lang) => ({ lang }))
}


const appFont = Manrope({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-app',
})

export const metadata: Metadata = {
  title: {
    default: 'Falco',
    template: '%s | Falco',
  },
  description: 'Enterprise Resource Planning System for modern businesses',
}

// viewportFit: 'cover' lets the app draw under the iPhone notch/Dynamic
// Island and home indicator so the env(safe-area-inset-*) CSS variables
// report real values inside the Capacitor iOS WebView — without it every
// safe-area-inset-* is 0 and the fixed header sits under the notch.
export const viewport: Viewport = {
  viewportFit: 'cover',
  // The page colours of the design system (--background), per OS scheme; the
  // ThemeProvider keeps them in step with the in-app choice.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf8ff' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0818' },
  ],
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  // Namespaces only server components read (guide, faq, landing) or that belong to the
  // admin/support consoles, which have their own layouts and providers. Sending
  // them anyway put ~35 KB of unused text into every tenant page's payload.
  const SERVER_ONLY_NAMESPACES = new Set(['guide', 'faq', 'admin', 'supportPortal', 'landing'])
  const messages = Object.fromEntries(
    Object.entries(await getMessages()).filter(([namespace]) => !SERVER_ONLY_NAMESPACES.has(namespace))
  )

  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        {/* Applies the persisted theme before first paint — avoids a light-mode flash for dark-mode users. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('erp-theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${appFont.variable} font-sans antialiased`}>
        <ThemeProvider>
          <CapacitorProvider />
          <NextIntlClientProvider messages={messages}>
              <NavigationProgress />
              <TooltipProvider>
                {children}
                <Toaster richColors position="top-right" />
              </TooltipProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
