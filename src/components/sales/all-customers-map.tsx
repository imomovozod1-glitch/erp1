'use client'

import dynamic from 'next/dynamic'

// react-leaflet/leaflet touch `window` at module-evaluation time, not just
// render time — a static import crashes SSR (ReferenceError: window is not
// defined). `ssr:false` on next/dynamic is only valid from within a Client
// Component boundary (Next.js 16 rejects it directly in a Server
// Component), which is exactly why this thin wrapper exists: the
// server page imports this ('use client') file normally, and this file is
// the one that does the ssr:false dynamic import of the actual map.
const AllCustomersMapInner = dynamic(
  () => import('./all-customers-map-inner').then((mod) => mod.AllCustomersMapInner),
  { ssr: false }
)

interface MappableCustomer {
  id: string
  name: string
  phone: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  assigned_to?: string | null
  total_debt?: number
}

export function AllCustomersMap({
  customers,
  currentUserId,
  lang,
}: {
  customers: MappableCustomer[]
  currentUserId: string | null
  lang: string
}) {
  return <AllCustomersMapInner customers={customers} currentUserId={currentUserId} lang={lang} />
}
