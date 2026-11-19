import type { Icon } from '@phosphor-icons/react'
import { AddressBook, Brain, ChartLineUp, ChatsCircle, Cube, CurrencyCircleDollar, DeviceMobile, Factory, FileXls, Key, MapTrifold, Printer, ShieldCheck, ShoppingCart, Storefront, TelegramLogo, Translate, Truck, UsersThree, Wallet, Wrench } from '@phosphor-icons/react/dist/ssr'
import { getTranslations } from 'next-intl/server'
import { formatPhoneInput } from '@/lib/tenant-auth'

export const MODULES: { key: string; icon: Icon; from: string; to: string }[] = [
  { key: 'inventory', icon: Cube, from: 'from-indigo-500', to: 'to-violet-500' },
  { key: 'sales', icon: ShoppingCart, from: 'from-emerald-500', to: 'to-teal-400' },
  { key: 'procurement', icon: Truck, from: 'from-amber-500', to: 'to-orange-500' },
  { key: 'finance', icon: CurrencyCircleDollar, from: 'from-violet-500', to: 'to-fuchsia-500' },
  { key: 'customers', icon: AddressBook, from: 'from-sky-500', to: 'to-cyan-400' },
  { key: 'hr', icon: UsersThree, from: 'from-rose-500', to: 'to-pink-500' },
  { key: 'production', icon: Factory, from: 'from-orange-500', to: 'to-red-500' },
  { key: 'distribution', icon: MapTrifold, from: 'from-teal-500', to: 'to-emerald-400' },
  { key: 'reports', icon: ChartLineUp, from: 'from-fuchsia-500', to: 'to-purple-500' },
]

// Nine tiles fill a 3-column grid exactly.
export const FEATURES: { key: string; icon: Icon }[] = [
  { key: 'languages', icon: Translate },
  { key: 'mobile', icon: DeviceMobile },
  { key: 'telegram', icon: TelegramLogo },
  { key: 'ai', icon: Brain },
  { key: 'roles', icon: Key },
  { key: 'excel', icon: FileXls },
  { key: 'pos', icon: Printer },
  { key: 'support', icon: ChatsCircle },
  { key: 'security', icon: ShieldCheck },
]

// What a business owner struggles with today, each paired with Falco's answer.
export const PAIN = ['stock', 'cash', 'debt', 'staff', 'reports'] as const

// One sale, followed through the system (all of it is one transaction in the
// database — see create_sale in supabase/migration_business_rpc.sql).
export const FLOW: { key: string; icon: Icon }[] = [
  { key: 'sale', icon: ShoppingCart },
  { key: 'stock', icon: Cube },
  { key: 'cash', icon: Wallet },
  { key: 'debt', icon: AddressBook },
  { key: 'report', icon: ChartLineUp },
]

export const SEGMENTS: { key: string; icon: Icon; tone: string }[] = [
  { key: 'retail', icon: Storefront, tone: 'from-emerald-500 to-teal-400' },
  { key: 'wholesale', icon: Truck, tone: 'from-sky-500 to-cyan-400' },
  { key: 'production', icon: Factory, tone: 'from-orange-500 to-red-500' },
  { key: 'services', icon: Wrench, tone: 'from-violet-500 to-fuchsia-500' },
]

export const FAQ = ['import', 'mobile', 'roles', 'security', 'price', 'start'] as const

export const STEPS = ['contact', 'setup', 'start'] as const

export const NAV: { href: string; key: 'navModules' | 'navFeatures' | 'navFaq' | 'navStart' }[] = [
  { href: '#modules', key: 'navModules' },
  { href: '#features', key: 'navFeatures' },
  { href: '#faq', key: 'navFaq' },
  { href: '#start', key: 'navStart' },
]

export const STATS_FIXED = [
  { value: String(MODULES.length), label: 'statModules' },
  { value: '3', label: 'statLanguages' },
] as const

// Stuck top of the first stacked card, and the offset between cards — the
// offset must match STEP in stacked-cards.tsx.
export const STACK_TOP_REM = 6.5
export const STACK_STEP_PX = 20

// The sales number shown on the page. LANDING_CONTACT_PHONE overrides it per
// deployment; LANDING_CONTACT_TELEGRAM adds a Telegram button.
export const DEFAULT_PHONE = '+998998182004'

export function contactLinks() {
  const telegram = process.env.LANDING_CONTACT_TELEGRAM?.trim().replace(/^@/, '')
  const phone = process.env.LANDING_CONTACT_PHONE?.trim() || DEFAULT_PHONE
  return {
    telegram: telegram ? `https://t.me/${telegram}` : null,
    // The Android build (APK or Play link). Nothing is shown until an address is
    // set — a dead download button is worse than none.
    apk: process.env.LANDING_APK_URL?.trim() || null,
    // The App Store / TestFlight address of the iOS build, likewise.
    ios: process.env.LANDING_IOS_URL?.trim() || null,
    phone: `tel:${phone.replace(/[^\d+]/g, '')}`,
    // Grouped (+998 99 818 20 04) so it can be read and dialled by eye.
    phoneLabel: formatPhoneInput(phone) || phone,
  }
}

export async function landingContext(lang: string) {
  const t = await getTranslations('landing')
  const contact = contactLinks()
  const loginHref = `/${lang}/login`
  // What the page may claim about mobile apps follows from what can actually be downloaded.
  const platforms = contact.apk && contact.ios ? 'both' : contact.apk ? 'android' : contact.ios ? 'ios' : 'none'
  const stats = [...STATS_FIXED, { value: platforms === 'both' ? '3' : '2', label: 'statDevices' as const }]
  const navLinks = NAV.map(({ href, key }) => ({ href, label: t(key) }))
  return { t, contact, loginHref, platforms, stats, navLinks, lang }
}

export type LandingContext = Awaited<ReturnType<typeof landingContext>>
