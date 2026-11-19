import { dataScope, hasViewAccess, type PermissionModule } from '@/lib/permissions'
import { isoDate } from '@/lib/utils'

export type NotificationType = 'low_stock' | 'overdue_invoice' | 'support_reply'

export interface HeaderNotification {
  id: string
  type: NotificationType
  title: string
  description: string
  href: string
  read: boolean
  created_at: Date
}

interface Viewer {
  id?: string
  role?: string | null
  permissions?: unknown
}

type Translate = (key: string, values?: Record<string, string | number>) => string

const READ_KEY = 'read_notification_ids'
const LIMIT = 20

export function readIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(READ_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function rememberRead(ids: string[]) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...new Set([...readIds(), ...ids])]))
  } catch {}
}

const nothing = Promise.resolve({ data: [] as any[] })

/** Alerts follow the module's permissions: nothing for a module the user cannot open, own records under an `own` scope. */
function guarded(viewer: Viewer, module: PermissionModule, query: () => any) {
  if (!hasViewAccess(viewer.role, viewer.permissions, module)) return nothing
  const own = dataScope(viewer.role, viewer.permissions, module) === 'own' && viewer.id
  return own ? query().or(`assigned_to.eq.${viewer.id},assigned_to.is.null`) : query()
}

// Bounded and indexed: `is_low_stock` is a generated column, overdue filters on due_at. Services never run low.
const queries = (supabase: any, viewer: Viewer) =>
  Promise.all([
    guarded(viewer, 'inventory', () =>
      supabase.from('products').select('id, name, stock, min_stock, updated_at').eq('is_active', true).eq('is_low_stock', true).eq('is_service', false).order('stock', { ascending: true }).limit(LIMIT)
    ),
    guarded(viewer, 'sales', () =>
      supabase.from('invoices').select('id, invoice_number, total_amount, due_at, customers(name)').in('status', ['sent', 'overdue']).lt('due_at', isoDate()).order('due_at', { ascending: true }).limit(LIMIT)
    ),
    supabase.from('support_messages').select('id, body, sender_name, sender_role, created_at').in('sender_role', ['agent', 'admin']).is('read_by_tenant_at', null).order('created_at', { ascending: false }).limit(LIMIT),
  ])

export async function loadNotifications(supabase: any, viewer: Viewer, lang: string, t: Translate): Promise<HeaderNotification[]> {
  const [{ data: products }, { data: invoices }, { data: replies }] = await queries(supabase, viewer)
  const read = new Set(readIds())
  const lowStock = (products ?? []).map((p: any) => ({
    id: `low-stock-${p.id}`,
    type: 'low_stock' as const,
    title: t('notifications.lowStockTitle'),
    description: t('notifications.lowStockDescription', { name: p.name, stock: p.stock, min: p.min_stock }),
    href: `/${lang}/inventory/products`,
    created_at: new Date(p.updated_at || Date.now()),
  }))
  const overdue = (invoices ?? []).map((i: any) => ({
    id: `overdue-invoice-${i.id}`,
    type: 'overdue_invoice' as const,
    title: t('notifications.overdueInvoiceTitle'),
    description: t('notifications.overdueInvoiceDescription', { number: i.invoice_number, customer: i.customers?.name || '' }),
    href: `/${lang}/sales/invoices/${i.id}`,
    created_at: new Date(i.due_at),
  }))
  // A support reply stays unread until its thread is opened, when the row stops being returned.
  const support = (replies ?? []).map((m: any) => ({
    id: `support-reply-${m.id}`,
    type: 'support_reply' as const,
    title: t('notifications.supportReplyTitle'),
    description: `${m.sender_name}: ${String(m.body).slice(0, 90)}`,
    href: `/${lang}/support`,
    created_at: new Date(m.created_at),
    read: false,
  }))
  return [...support, ...[...lowStock, ...overdue].map((n) => ({ ...n, read: read.has(n.id) }))].sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
}
