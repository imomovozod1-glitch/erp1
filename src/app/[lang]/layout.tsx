import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { QueryProvider } from '@/components/providers/query-provider'
import { NavigationProgress } from '@/components/providers/navigation-progress'
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
      <body className={`${inter.variable} font-sans antialiased`}>
        <NextIntlClientProvider messages={messages}>
          <QueryProvider>
            <NavigationProgress />
            <TooltipProvider>
              {children}
              <Toaster richColors position="top-right" />
            </TooltipProvider>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
