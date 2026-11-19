import { Building2, Contact, FileText, Package, ShoppingCart, type LucideIcon } from 'lucide-react'
import { dataScope, hasViewAccess, type PermissionModule } from '@/lib/permissions'
import { formatCurrency } from '@/lib/utils'

export interface Hit {
  id: string
  href: string
  title: string
  subtitle?: string
}

export interface Viewer {
  role: string | null | undefined
  permissions: unknown
  userId: string | null
}

export type ResultKey = 'products' | 'customers' | 'suppliers' | 'orders' | 'invoices'
export type Results = Record<ResultKey, Hit[]>

export const EMPTY_RESULTS: Results = { products: [], customers: [], suppliers: [], orders: [], invoices: [] }
export const MIN_TERM = 2
const PER_GROUP = 5

/** Escapes the PostgREST `or=(…)` separators so a comma or paren in the query can't break out of the filter. */
export const safeTerm = (term: string) => term.replace(/[,()*\\]/g, ' ').trim()

const joined = (...parts: unknown[]) => parts.filter(Boolean).join(' · ')

interface Source {
  key: ResultKey
  module: PermissionModule
  icon: LucideIcon
  heading: string
  table: string
  select: string
  match: (query: any, like: string) => any
  hit: (row: any, lang: string) => Hit
}

export const SOURCES: Source[] = [
  {
    key: 'products', module: 'inventory', icon: Package, heading: 'inventory.products', table: 'products', select: 'id, name, sku, price, is_service',
    match: (q, like) => q.or(`name.ilike.${like},sku.ilike.${like}`),
    // A service has its own screens: the product editor would offer stock fields the database forbids it.
    hit: (p, lang) => ({ id: p.id, href: p.is_service ? `/${lang}/inventory/services/${p.id}/edit` : `/${lang}/inventory/products/${p.id}`, title: p.name, subtitle: joined(p.sku, formatCurrency(p.price)) }),
  },
  {
    key: 'customers', module: 'customers', icon: Contact, heading: 'sales.customers', table: 'customers', select: 'id, name, phone',
    match: (q, like) => q.or(`name.ilike.${like},phone.ilike.${like}`),
    hit: (c, lang) => ({ id: c.id, href: `/${lang}/customers/${c.id}`, title: c.name, subtitle: c.phone ?? undefined }),
  },
  {
    key: 'suppliers', module: 'procurement', icon: Building2, heading: 'procurement.suppliers', table: 'suppliers', select: 'id, name, phone',
    match: (q, like) => q.or(`name.ilike.${like},phone.ilike.${like}`),
    hit: (s, lang) => ({ id: s.id, href: `/${lang}/procurement/suppliers/${s.id}`, title: s.name, subtitle: s.phone ?? undefined }),
  },
  {
    key: 'orders', module: 'sales', icon: ShoppingCart, heading: 'sales.orders', table: 'sales_orders', select: 'id, order_number, total_amount, customers(name)',
    match: (q, like) => q.ilike('order_number', like),
    hit: (o, lang) => ({ id: o.id, href: `/${lang}/sales/orders/${o.id}`, title: o.order_number, subtitle: joined(o.customers?.name, formatCurrency(o.total_amount)) }),
  },
  {
    key: 'invoices', module: 'sales', icon: FileText, heading: 'sales.invoices', table: 'invoices', select: 'id, invoice_number, total_amount, customers(name)',
    match: (q, like) => q.ilike('invoice_number', like),
    hit: (i, lang) => ({ id: i.id, href: `/${lang}/sales/invoices/${i.id}`, title: i.invoice_number, subtitle: joined(i.customers?.name, formatCurrency(i.total_amount)) }),
  },
]

/** Only modules the user may view, narrowed to their own rows under an `own` scope — never a row its list would hide. */
async function searchSource(supabase: any, source: Source, like: string, viewer: Viewer, lang: string) {
  if (!hasViewAccess(viewer.role, viewer.permissions, source.module)) return []
  let query = source.match(supabase.from(source.table).select(source.select), like)
  if (viewer.userId && dataScope(viewer.role, viewer.permissions, source.module) === 'own') query = query.or(`assigned_to.eq.${viewer.userId},assigned_to.is.null`)
  const { data } = await query.limit(PER_GROUP)
  return (data ?? []).map((row: any) => source.hit(row, lang))
}

export async function searchRecords(supabase: any, term: string, viewer: Viewer, lang: string): Promise<Results> {
  const lists = await Promise.all(SOURCES.map((source) => searchSource(supabase, source, `%${term}%`, viewer, lang)))
  return Object.fromEntries(SOURCES.map((source, i) => [source.key, lists[i]])) as Results
}
