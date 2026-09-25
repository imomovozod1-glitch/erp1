'use client'

import dynamic from 'next/dynamic'
import type { RouteGeometry } from '@/lib/route-plan'
import type { RouteStopPoint } from './route-map-inner'

// Same reason as all-customers-map.tsx: leaflet touches `window` when the
// module is evaluated, so the real map has to be pulled in with ssr:false, and
// ssr:false is only legal inside a Client Component — hence this wrapper.
const RouteMapInner = dynamic(() => import('./route-map-inner').then((mod) => mod.RouteMapInner), {
  ssr: false,
})

export type { RouteStopPoint }

export function RouteMap(props: {
  stops: RouteStopPoint[]
  geometry?: RouteGeometry | null
  className?: string
}) {
  return <RouteMapInner {...props} />
}
