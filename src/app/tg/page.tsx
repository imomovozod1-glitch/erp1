import type { Metadata } from 'next'
import { TelegramEntry } from '@/components/telegram/telegram-entry'

export const metadata: Metadata = { title: 'Falco ERP' }
export const dynamic = 'force-dynamic'

export default function TelegramMiniAppPage() {
  return <TelegramEntry />
}
