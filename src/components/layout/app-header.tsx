'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Bell, LogOut, Settings, AlertTriangle, Clock, Check, CheckCircle2, ChevronDown, Languages, BookOpen, HelpCircle, CircleQuestionMark } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useSidebarOffset } from '@/lib/hooks/use-sidebar-offset'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { useConfirm } from '@/components/shared/confirm-dialog'
import { GlobalSearch } from '@/components/layout/global-search'
import { formatDate, getInitials, isoDate } from '@/lib/utils'
import type { Profile } from '@/types/database.types'

const LOCALES = [
  { code: 'uz' as const, label: "O'zbekcha" },
  { code: 'ru' as const, label: 'Русский' },
  { code: 'en' as const, label: 'English' },
]

interface AppHeaderProps {
  profile: Profile | null
  lang: string
}

/**
 * Every icon control in the bar shares this: same height, same corner, same
 * border as the search box on the left. They used to be four different things
 * standing in a row — two bordered pills with full rounding, and two ghost
 * buttons with none — which read as unrelated widgets rather than one toolbar.
 */
const HEADER_CONTROL =
  'h-8 rounded-lg border border-slate-200 bg-white text-slate-500 shadow-2xs transition-colors ' +
  'hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 ' +
  'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 ' +
  'dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200'

export function AppHeader({ profile, lang }: AppHeaderProps) {
  const router = useRouter()
  const tSettings = useTranslations('settings')
  const tNav = useTranslations('nav')
  const tCommon = useTranslations('common')
  const t = useTranslations('auth')
  const sidebarOffset = useSidebarOffset()

  const [notifications, setNotifications] = useState<any[]>([])
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)

  const unreadCount = notifications.filter((n) => !n.read).length

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => {
        if (n.id === id) {
          const updated = { ...n, read: true }
          try {
            const saved = localStorage.getItem('read_notification_ids')
            const readIds = saved ? JSON.parse(saved) : []
            if (!readIds.includes(id)) {
              readIds.push(id)
              localStorage.setItem('read_notification_ids', JSON.stringify(readIds))
            }
          } catch (e) {
            console.error(e)
          }
          return updated
        }
        return n
      })
    )
  }

  const markAllAsRead = () => {
    setNotifications((prev) =>
      prev.map((n) => {
        const updated = { ...n, read: true }
        try {
          const saved = localStorage.getItem('read_notification_ids')
          const readIds = saved ? JSON.parse(saved) : []
          if (!readIds.includes(n.id)) {
            readIds.push(n.id)
            localStorage.setItem('read_notification_ids', JSON.stringify(readIds))
          }
        } catch (e) {
          console.error(e)
        }
        return updated
      })
    )
  }

  useEffect(() => {
    const fetchNotifications = async () => {
      const supabase = createClient() as any

      // These three run concurrently and are BOUNDED. The first two used to
      // pull every active product and every unpaid invoice in the tenant to
      // the browser on every page load — and then filter them in JavaScript.
      // For a catalogue of any size that is the single most expensive thing
      // the app does per navigation, repeated every 2 minutes thereafter.
      //
      // `is_low_stock` is a generated column added by
      // migration_low_stock_column.sql, so "stock <= min_stock" is now an
      // indexed predicate the database evaluates instead of a filter over the
      // whole table in the client. Overdue invoices filter on due_at directly.
      const todayISO = isoDate()
      const [{ data: products }, { data: invoices }, { data: supportReplies }] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, stock, min_stock, updated_at')
          .eq('is_active', true)
          .eq('is_low_stock', true)
          // A service is pinned at stock 0 / min_stock 0, and `is_low_stock` is
          // a generated `stock <= min_stock` — so every service matches it
          // forever. Goods only (migration_services.sql).
          .eq('is_service', false)
          .order('stock', { ascending: true })
          .limit(20),
        supabase
          .from('invoices')
          .select('id, invoice_number, total_amount, due_at, customers(name)')
          .in('status', ['sent', 'overdue'])
          .lt('due_at', todayISO)
          .order('due_at', { ascending: true })
          .limit(20),
        supabase
          .from('support_messages')
          .select('id, body, sender_name, sender_role, created_at')
          .in('sender_role', ['agent', 'admin'])
          .is('read_by_tenant_at', null)
          .order('created_at', { ascending: false })
          .limit(20),
      ])

      // Load read IDs from localStorage
      let readIds: string[] = []
      try {
        const saved = localStorage.getItem('read_notification_ids')
        if (saved) {
          readIds = JSON.parse(saved)
        }
      } catch (e) {
        console.error(e)
      }

      const lowStockAlerts = (products || []).map((p: any) => ({
          id: `low-stock-${p.id}`,
          type: 'low_stock',
          title: lang === 'uz' ? 'Kam qolgan tovar' : lang === 'ru' ? 'Мало на складе' : 'Low stock alert',
          description: lang === 'uz' 
            ? `"${p.name}" tovaridan ${p.stock} dona qoldi (min: ${p.min_stock})`
            : lang === 'ru'
            ? `Осталось ${p.stock} шт. товара "${p.name}" (мин: ${p.min_stock})`
            : `Only ${p.stock} left of "${p.name}" (min: ${p.min_stock})`,
          href: `/${lang}/inventory/products`,
          read: readIds.includes(`low-stock-${p.id}`),
          created_at: new Date(p.updated_at || Date.now()),
        }))

      const overdueAlerts = (invoices || []).map((i: any) => ({
          id: `overdue-invoice-${i.id}`,
          type: 'overdue_invoice',
          title: lang === 'uz' ? 'Muddati o\'tgan faktura' : lang === 'ru' ? 'Просроченный счет' : 'Overdue invoice',
          description: lang === 'uz'
            ? `"${i.customers?.name || ''}" uchun #${i.invoice_number} muddati o'tdi`
            : lang === 'ru'
            ? `Счет #${i.invoice_number} для "${i.customers?.name || ''}" просрочен`
            : `Invoice #${i.invoice_number} for "${i.customers?.name || ''}" is past due`,
          href: `/${lang}/sales/invoices`,
          read: readIds.includes(`overdue-invoice-${i.id}`),
          created_at: new Date(i.due_at),
        }))

      const supportAlerts = (supportReplies || []).map((m: any) => ({
        id: `support-reply-${m.id}`,
        type: 'support_reply',
        title: lang === 'uz' ? 'Qo\'llab-quvvatlash javobi' : lang === 'ru' ? 'Ответ поддержки' : 'Support reply',
        description: `${m.sender_name}: ${String(m.body).slice(0, 90)}`,
        href: `/${lang}/support`,
        // Always unread: the row itself is the unread marker, and it stops
        // being returned once the thread is opened.
        read: false,
        created_at: new Date(m.created_at),
      }))

      const allNotifications = [...supportAlerts, ...lowStockAlerts, ...overdueAlerts].sort(
        (a, b) => b.created_at.getTime() - a.created_at.getTime()
      )

      setNotifications(allNotifications)
    }

    // Deliberately NOT fetched on mount: these three queries are a background
    // convenience (a badge on a bell), and firing them the instant the shell
    // hydrates put them in a race with the queries the page the user actually
    // asked for is waiting on. A short delay hands the network to the page
    // first; two minutes was also far more often than a low-stock warning
    // changes.
    const firstFetch = setTimeout(fetchNotifications, 1500)
    const interval = setInterval(fetchNotifications, 300000)
    return () => {
      clearTimeout(firstFetch)
      clearInterval(interval)
    }
  }, [lang])

  const initials = getInitials(profile?.full_name) || 'U'

  // Signing out is one click away in the avatar menu, right under Settings,
  // and it throws away whatever half-filled form is open behind it — so it
  // asks first, through the same dialog every delete in the app uses.
  const [confirm, confirmDialog] = useConfirm()

  const handleLogout = async () => {
    const confirmed = await confirm({
      title: tCommon('confirmLogoutTitle'),
      description: tCommon('confirmLogoutDescription'),
      confirmLabel: t('logout'),
      confirmIcon: LogOut,
    })
    if (!confirmed) return
    const supabase = createClient()
    await supabase.auth.signOut()
    // A full page load rather than router.push + router.refresh: the refresh
    // re-rendered the page being left (on the dashboard, every stats query)
    // before the login page could show, and with `staleTimes` the client
    // router could still serve cached signed-in pages afterwards.
    window.location.replace(`/${lang}/login`)
  }

  useEffect(() => {
    try {
      const savedStr = sessionStorage.getItem('pending_form_data')
      if (savedStr) {
        const saved = JSON.parse(savedStr)
        const currentPath = window.location.pathname.replace(`/${lang}`, '')
        if (saved.path === currentPath) {
          const timer = setTimeout(() => {
            Object.entries(saved.fields).forEach(([name, value]) => {
              const elements = document.querySelectorAll(`[name="${name}"]`)
              elements.forEach(el => {
                const input = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
                if (input.type === 'checkbox' || input.type === 'radio') {
                  (input as HTMLInputElement).checked = (input.value === value)
                } else {
                  input.value = value as string
                }
                input.dispatchEvent(new Event('input', { bubbles: true }))
                input.dispatchEvent(new Event('change', { bubbles: true }))
              })
            })
            sessionStorage.removeItem('pending_form_data')
          }, 300)
          return () => clearTimeout(timer)
        } else {
          sessionStorage.removeItem('pending_form_data')
        }
      }
    } catch (e) {
      console.error('Error restoring form data', e)
    }
  }, [lang])

  const handleLocaleChange = (locale: string) => {
    const fields: Record<string, string> = {}
    document.querySelectorAll('input, select, textarea').forEach(el => {
      const input = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      if (input.name && input.type !== 'submit' && input.type !== 'button' && input.type !== 'hidden') {
        if (input.type === 'checkbox' || input.type === 'radio') {
          if ((input as HTMLInputElement).checked) {
            fields[input.name] = input.value
          }
        } else {
          fields[input.name] = input.value
        }
      }
    })
    if (Object.keys(fields).length > 0) {
      sessionStorage.setItem('pending_form_data', JSON.stringify({
        path: window.location.pathname.replace(`/${lang}`, ''),
        fields
      }))
    }

    const pathWithoutLocale = window.location.pathname.replace(`/${lang}`, '')
    router.replace(`/${locale}${pathWithoutLocale}`)
  }

  const currentLocale = LOCALES.find((l) => l.code === lang)

  // Count active overdue invoice alerts in notifications
  const hasOverdueInvoices = notifications.some((n) => n.type === 'overdue_invoice')

  return (
    <header
      className={`flex min-h-16 shrink-0 items-center gap-1.5 sm:gap-2 border-b bg-white dark:bg-slate-900 dark:border-slate-800 px-3 sm:px-4 pt-[env(safe-area-inset-top)] fixed top-0 right-0 z-30 ${sidebarOffset}`}
    >
      <SidebarTrigger className="-ml-1" />

      {/* Quick search — ⌘K from anywhere, click here on touch devices. */}
      <GlobalSearch
        lang={lang}
        role={profile?.role}
        permissions={(profile as any)?.permissions}
        userId={profile?.id ?? null}
      />

      <div className="flex-1" />

      {/* Overdue Invoices Alert Notification */}
      {hasOverdueInvoices && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/${lang}/sales/invoices`)}
          // Rose because it classifies — money that is late. Not animated:
          // a button that pulses on every page for as long as one invoice is
          // overdue stops meaning "look here" within a day.
          className="h-8 w-8 justify-center gap-1.5 rounded-lg border-rose-200 bg-rose-50 px-0 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 hover:text-rose-800 sm:w-auto sm:px-3 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-950/60 dark:hover:text-rose-300"
          title={lang === 'uz' ? "Muddati o'tgan" : lang === 'ru' ? 'Просрочено' : 'Overdue'}
        >
          <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
          <span className="hidden sm:inline">{lang === 'uz' ? "Muddati o'tgan" : lang === 'ru' ? 'Просрочено' : 'Overdue'}</span>
        </Button>
      )}

      {/* Help: the guide used to sit in the sidebar, which pushed it out of
          sight on the pages people actually get stuck on. */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={tNav('help')}
              title={tNav('help')}
              className={`flex w-8 cursor-pointer items-center justify-center ${HEADER_CONTROL}`}
            />
          }
        >
          <CircleQuestionMark className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44 rounded-xl p-1.5">
          <DropdownMenuItem
            onClick={() => router.push(`/${lang}/guide`)}
            className="rounded-lg gap-2 py-1.5 cursor-pointer"
          >
            <BookOpen className="h-3.5 w-3.5 text-violet-600" />
            <span className="text-sm">{tNav('guide')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push(`/${lang}/faq`)}
            className="rounded-lg gap-2 py-1.5 cursor-pointer"
          >
            <HelpCircle className="h-3.5 w-3.5 text-violet-600" />
            <span className="text-sm">{tNav('faq')}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Language Switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className={`flex w-8 cursor-pointer items-center justify-center gap-1.5 px-0 sm:w-auto sm:pr-2 sm:pl-1.5 ${HEADER_CONTROL}`}
            />
          }
        >
          <Languages className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden text-xs font-semibold sm:inline">{currentLocale?.code.toUpperCase()}</span>
          <ChevronDown className="hidden h-3 w-3 opacity-60 sm:block" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32 rounded-lg p-1">
          {LOCALES.map((locale) => {
            const isActive = lang === locale.code
            return (
              <DropdownMenuItem
                key={locale.code}
                onClick={() => handleLocaleChange(locale.code)}
                className={`rounded-md gap-1.5 px-2 py-1 cursor-pointer ${isActive ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 font-semibold' : ''}`}
              >
                <span className="flex-1 text-xs">{locale.label}</span>
                {isActive && <Check className="h-3 w-3 text-violet-600" />}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <ThemeToggle
        className={`w-8 ${HEADER_CONTROL}`}
        labels={{
          light: lang === 'uz' ? "Yorug' rejim" : lang === 'ru' ? 'Светлая тема' : 'Light mode',
          dark: lang === 'uz' ? "Qorong'i rejim" : lang === 'ru' ? 'Тёмная тема' : 'Dark mode',
        }}
      />

      {/* Notifications */}
      <DropdownMenu open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
        <DropdownMenuTrigger render={
          <Button variant="ghost" size="icon" className={`relative w-8 ${HEADER_CONTROL}`}>
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
            )}
          </Button>
        } />
        <DropdownMenuContent align="end" className="w-80 sm:w-96 p-0 border border-slate-200/60 dark:border-slate-700 shadow-lg rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
            <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
              {lang === 'uz' ? 'Bildirishnomalar' : lang === 'ru' ? 'Уведомления' : 'Notifications'}
              {unreadCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs font-medium rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-900">
                  {unreadCount}
                </span>
              )}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-violet-600 transition-colors hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300"
              >
                <Check className="h-3 w-3" />
                {lang === 'uz' ? 'Hammasini o\'qilgan qilish' : lang === 'ru' ? 'Прочитать все' : 'Mark all as read'}
              </button>
            )}
          </div>
          <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 dark:text-slate-500">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 dark:text-emerald-400 mb-2" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {lang === 'uz' ? 'Hamma bildirishnomalar o\'qildi' : lang === 'ru' ? 'Все прочитано' : 'All caught up!'}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {lang === 'uz' ? 'Hozircha yangi bildirishnomalar yo\'q' : lang === 'ru' ? 'Нет новых уведомлений' : 'No new notifications.'}
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const isUnread = !n.read
                return (
                  <div
                    key={n.id}
                    onClick={() => {
                      markAsRead(n.id)
                      setIsNotificationsOpen(false)
                      router.push(n.href)
                    }}
                    className={`flex items-start gap-3 p-4 cursor-pointer transition-colors ${
                      isUnread ? 'bg-violet-50/20 dark:bg-violet-950/20 hover:bg-violet-50/40 dark:hover:bg-violet-950/30' : 'bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <div className={`p-2 rounded-xl mt-0.5 ${
                      n.type === 'low_stock' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                    }`}>
                      {n.type === 'low_stock' ? (
                        <AlertTriangle className="h-4 w-4" />
                      ) : (
                        <Clock className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-semibold ${isUnread ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
                          {n.title}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                          {formatDate(n.created_at.toISOString())}
                        </span>
                      </div>
                      <p className={`text-xs ${isUnread ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                        {n.description}
                      </p>
                    </div>
                    {isUnread && (
                      <div className="h-2 w-2 rounded-full bg-violet-600 dark:bg-violet-400 mt-2 self-start shrink-0" />
                    )}
                  </div>
                )
              })
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* User Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" className="gap-2 pl-2" />}>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-violet-100 text-violet-700 text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hidden sm:block">
              {profile?.full_name?.split(' ')[0] ?? 'User'}
            </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">{profile?.full_name}</p>
              <p className="text-xs text-muted-foreground">{profile?.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {/* router.push, not window.location: a full document reload here
              threw away the whole client cache to move one route. */}
          <DropdownMenuItem onClick={() => router.push(`/${lang}/settings`)}>
            <Settings className="mr-2 h-4 w-4" />
            {tSettings('title')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t('logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {confirmDialog}
    </header>
  )
}
