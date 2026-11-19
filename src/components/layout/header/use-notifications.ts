'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database.types'
import { loadNotifications, rememberRead, type HeaderNotification } from './notifications'

// The first load waits for the page's own queries; a low-stock warning changes far less often than every few minutes.
const FIRST_FETCH_MS = 1500
const POLL_MS = 300_000

export function useNotifications(profile: Profile | null, lang: string) {
  const t = useTranslations('nav')
  const [items, setItems] = useState<HeaderNotification[]>([])

  useEffect(() => {
    const viewer = { id: profile?.id, role: profile?.role, permissions: (profile as { permissions?: unknown } | null)?.permissions }
    const refresh = async () => setItems(await loadNotifications(createClient(), viewer, lang, t))
    const first = setTimeout(refresh, FIRST_FETCH_MS)
    const poll = setInterval(refresh, POLL_MS)
    return () => {
      clearTimeout(first)
      clearInterval(poll)
    }
  }, [lang, t, profile])

  const markRead = (ids: string[]) => {
    rememberRead(ids)
    setItems((current) => current.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)))
  }

  return {
    items,
    unread: items.filter((n) => !n.read).length,
    hasOverdue: items.some((n) => n.type === 'overdue_invoice'),
    markRead: (id: string) => markRead([id]),
    markAllRead: () => markRead(items.map((n) => n.id)),
  }
}

export type NotificationsState = ReturnType<typeof useNotifications>
