import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { QueryProvider } from '@/components/providers/query-provider'
import { NavigationProgress } from '@/components/providers/navigation-progress'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { routing } from '@/i18n/routing'
import '../globals.css'

// Required by cacheComponents — tells Next.js which [lang] values exist
export function generateStaticParams() {
  return routing.locales.map((lang) => ({ lang }))
}


const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: {
    default: 'ERP System',
    template: '%s | ERP System',
  },
  description: 'Enterprise Resource Planning System for modern businesses',
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const messages = await getMessages()

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
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider>
          <NextIntlClientProvider messages={messages}>
            <QueryProvider>
              <NavigationProgress />
              <TooltipProvider>
                {children}
                <Toaster richColors position="top-right" />
              </TooltipProvider>
            </QueryProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
