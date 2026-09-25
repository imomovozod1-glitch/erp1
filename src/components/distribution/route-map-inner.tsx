'use client'

import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTileConfig } from '@/lib/map-tiles'
import { toLeafletPath, type RouteGeometry } from '@/lib/route-plan'

export interface RouteStopPoint {
  id: string
  name: string
  address?: string | null
  latitude: number | null
  longitude: number | null
}

/**
 * A numbered pin. The order is the whole point of a marshrut, so the stop's
 * position is ON the pin rather than only in the list beside the map — a
 * courier reading the map has to be able to tell stop 3 from stop 8 without
 * counting along the line.
 */
function stopIcon(position: number, isFirst: boolean, isLast: boolean) {
  const tone = isFirst
    ? 'bg-emerald-600'
    : isLast
      ? 'bg-rose-600'
      : 'bg-violet-600'
  return L.divIcon({
    html: `<div class="flex items-center justify-center w-7 h-7 rounded-full ${tone} shadow-lg border-2 border-white text-white text-[11px] font-bold leading-none">${position}</div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

/** Fits the view to the drawn line, or to the pins when there is no line yet. */
function FitRoute({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView(points[0], 14)
      return
    }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40] })
  }, [map, points])
  return null
}

/**
 * Draws one marshrut: the ordered stops and, when it has been solved, the road
 * geometry between them.
 *
 * `geometry` being null is the ordinary state of a route nobody has optimised
 * yet — the pins still show, just without a line joining them. It is also what
 * the database trigger leaves behind when the stops change
 * (supabase/migration_route_geometry.sql), so a stale line is never drawn.
 */
export function RouteMapInner({
  stops,
  geometry,
  className = 'w-full h-120',
}: {
  stops: RouteStopPoint[]
  geometry?: RouteGeometry | null
  className?: string
}) {
  const tiles = useTileConfig()

  const located = useMemo(
    () => stops.filter((s) => typeof s.latitude === 'number' && typeof s.longitude === 'number'),
    [stops]
  )
  const path = useMemo(() => toLeafletPath(geometry), [geometry])
  const pins = useMemo<[number, number][]>(
    () => located.map((s) => [s.latitude as number, s.longitude as number]),
    [located]
  )
  // Prefer the line for framing — it runs along roads and so reaches further
  // than the pins themselves.
  const bounds = path.length > 0 ? path : pins

  if (located.length === 0) return null

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-200/80 dark:border-slate-700 shadow-sm bg-slate-100 dark:bg-slate-800">
      <MapContainer
        center={pins[0]}
        zoom={12}
        zoomControl
        attributionControl={false}
        className={className}
        style={{ zIndex: 1 }}
      >
        <TileLayer url={tiles.url} attribution={tiles.attribution} maxZoom={tiles.maxZoom} />
        <FitRoute points={bounds} />
        {path.length > 0 && (
          <>
            {/* Drawn twice: a wide translucent casing under a solid core, so the
                line stays readable over both the light and the dark basemap. */}
            <Polyline positions={path} pathOptions={{ color: '#ffffff', weight: 8, opacity: 0.55 }} />
            <Polyline positions={path} pathOptions={{ color: '#7c3aed', weight: 4, opacity: 0.95 }} />
          </>
        )}
        {located.map((stop, index) => (
          <Marker
            key={stop.id}
            position={[stop.latitude as number, stop.longitude as number]}
            icon={stopIcon(index + 1, index === 0, index === located.length - 1)}
          >
            <Popup>
              <div className="space-y-1 min-w-40">
                <p className="font-semibold text-slate-800 text-sm">
                  {index + 1}. {stop.name}
                </p>
                {stop.address && <p className="text-xs text-slate-500">{stop.address}</p>}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
