'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Bell, LogOut, Settings, User, AlertTriangle, Clock, Check, CheckCircle2, ChevronDown, Languages } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
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
import { getInitials } from '@/lib/utils'
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

export function AppHeader({ profile, lang }: AppHeaderProps) {
  const router = useRouter()
  const t = useTranslations('auth')
  const tSettings = useTranslations('settings')
  const { state: sidebarState, isMobile: isSidebarMobile } = useSidebar()

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

      // 1. Fetch low stock products
      const { data: products } = await supabase
        .from('products')
        .select('id, name, stock, min_stock, updated_at')
        .eq('is_active', true)

      // 2. Fetch invoices
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, invoice_number, total_amount, due_at, customers(name)')
        .in('status', ['sent', 'overdue'])

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

      const lowStockAlerts = (products || [])
        .filter((p: any) => p.stock <= p.min_stock)
        .map((p: any) => ({
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

      const overdueAlerts = (invoices || [])
        .filter((i: any) => new Date(i.due_at) < new Date())
        .map((i: any) => ({
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

      const allNotifications = [...lowStockAlerts, ...overdueAlerts].sort(
        (a, b) => b.created_at.getTime() - a.created_at.getTime()
      )

      setNotifications(allNotifications)
    }

    fetchNotifications()

    const interval = setInterval(fetchNotifications, 120000)
    return () => clearInterval(interval)
  }, [lang])

  const initials = getInitials(profile?.full_name) || 'U'

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push(`/${lang}/login`)
    router.refresh()
    toast.success(lang === 'uz' ? 'Muvaffaqiyatli chiqildi' : lang === 'ru' ? 'Вы успешно вышли' : 'Logged out successfully')
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
      className={`flex h-16 shrink-0 items-center gap-2 border-b bg-white px-4 fixed top-0 right-0 z-30 transition-[left] duration-200 ease-linear ${
        isSidebarMobile ? 'left-0' : sidebarState === 'expanded' ? 'left-0 md:left-(--sidebar-width)' : 'left-0 md:left-(--sidebar-width-icon)'
      }`}
    >
      <SidebarTrigger className="-ml-1" />

      <div className="flex-1" />

      {/* Overdue Invoices Alert Notification */}
      {hasOverdueInvoices && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/${lang}/sales/invoices`)}
          className="h-8 border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 hover:text-rose-800 font-semibold text-xs rounded-lg animate-pulse gap-1.5 transition-all mr-2"
        >
          <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
          {lang === 'uz' ? "Muddati o'tgan" : lang === 'ru' ? 'Просрочено' : 'Overdue'}
        </Button>
      )}

      {/* Language Switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="flex items-center gap-1.5 h-8 pl-1.5 pr-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer shadow-2xs"
            />
          }
        >
          <Languages className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-xs font-semibold text-slate-700">{currentLocale?.code.toUpperCase()}</span>
          <ChevronDown className="h-3 w-3 text-slate-400" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44 rounded-xl p-1.5">
          <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pt-1 pb-1.5">
            {tSettings('language')}
          </DropdownMenuLabel>
          {LOCALES.map((locale) => {
            const isActive = lang === locale.code
            return (
              <DropdownMenuItem
                key={locale.code}
                onClick={() => handleLocaleChange(locale.code)}
                className={`rounded-lg gap-2 py-2 cursor-pointer ${isActive ? 'bg-indigo-50 text-indigo-700 font-semibold' : ''}`}
              >
                <span className="flex-1 text-sm">{locale.label}</span>
                {isActive && <Check className="h-3.5 w-3.5 text-indigo-600" />}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Notifications */}
      <DropdownMenu open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
        <DropdownMenuTrigger render={
          <Button variant="ghost" size="icon" className="relative text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
            )}
          </Button>
        } />
        <DropdownMenuContent align="end" className="w-80 sm:w-96 p-0 border border-slate-200/60 shadow-lg rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-4 bg-slate-50/50 border-b border-slate-100">
            <span className="font-semibold text-slate-800 text-sm">
              {lang === 'uz' ? 'Bildirishnomalar' : lang === 'ru' ? 'Уведомления' : 'Notifications'}
              {unreadCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs font-medium rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                  {unreadCount}
                </span>
              )}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 hover:underline cursor-pointer"
              >
                <Check className="h-3 w-3" />
                {lang === 'uz' ? 'Hammasini o\'qilgan qilish' : lang === 'ru' ? 'Прочитать все' : 'Mark all as read'}
              </button>
            )}
          </div>
          <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                <p className="text-sm font-medium text-slate-700">
                  {lang === 'uz' ? 'Hamma bildirishnomalar o\'qildi' : lang === 'ru' ? 'Все прочитано' : 'All caught up!'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
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
                      isUnread ? 'bg-indigo-50/20 hover:bg-indigo-50/40' : 'bg-white hover:bg-slate-50/80'
                    }`}
                  >
                    <div className={`p-2 rounded-xl mt-0.5 ${
                      n.type === 'low_stock' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {n.type === 'low_stock' ? (
                        <AlertTriangle className="h-4 w-4" />
                      ) : (
                        <Clock className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-semibold ${isUnread ? 'text-slate-800' : 'text-slate-500'}`}>
                          {n.title}
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {new Date(n.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className={`text-xs ${isUnread ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                        {n.description}
                      </p>
                    </div>
                    {isUnread && (
                      <div className="h-2 w-2 rounded-full bg-indigo-600 mt-2 self-start shrink-0" />
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
              <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-slate-700 hidden sm:block">
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
          <DropdownMenuItem onClick={() => window.location.href = `/${lang}/settings/profile`}>
            <User className="mr-2 h-4 w-4" />
            {tSettings('profile')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => window.location.href = `/${lang}/settings`}>
            <Settings className="mr-2 h-4 w-4" />
            {tSettings('title')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            className="text-red-600 focus:text-red-600 focus:bg-red-50"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t('logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
