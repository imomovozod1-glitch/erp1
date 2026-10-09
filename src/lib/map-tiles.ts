'use client'

import { useTheme } from '@/components/providers/theme-provider'

/**
 * Which basemap the Leaflet maps draw.
 *
 * OpenStreetMap's own raster tiles: free and with no key. This used to be
 * CARTO's light/dark pair, until CARTO started answering every keyless request
 * with an "API KEY REQUIRED" placeholder tile — every map in the app went blank
 * at once (October 2026). OSM has no dark variant, so dark mode is a CSS filter
 * on the tile layer (`.map-tiles-osm` in globals.css) rather than a second URL —
 * which also means switching the theme needs no tile reload.
 *
 * Mapbox is NOT the default on purpose: it bills its raster basemap per TILE
 * request, not per map load, and one Leaflet viewport is 10–20 tiles — the 50k
 * free allowance is roughly 3 000 map openings a month. The Mapbox budget goes
 * to Directions/Optimization (src/lib/mapbox.ts).
 *
 * Set NEXT_PUBLIC_MAPBOX_STYLE_TILES to a style id (e.g. `mapbox/streets-v12`)
 * together with NEXT_PUBLIC_MAPBOX_TILE_TOKEN to switch the basemap to Mapbox
 * anyway — next.config.ts already allows api.mapbox.com in img-src. That token
 * is necessarily public, so restrict it to the app's hosts in the Mapbox
 * dashboard.
 */

export interface TileConfig {
  url: string
  attribution: string
  maxZoom: number
  /** Passed to `<TileLayer className>`; constant per provider so it never needs a remount. */
  className?: string
}

const OSM: TileConfig = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
  className: 'map-tiles-osm',
}

function mapboxTiles(resolved: 'light' | 'dark'): TileConfig | null {
  const style = process.env.NEXT_PUBLIC_MAPBOX_STYLE_TILES
  const token = process.env.NEXT_PUBLIC_MAPBOX_TILE_TOKEN
  if (!style || !token) return null
  // One style id may be given, or a `light|dark` pair separated by a comma.
  const [lightStyle, darkStyle] = style.split(',').map((part) => part.trim())
  const chosen = resolved === 'dark' ? darkStyle || lightStyle : lightStyle
  return {
    url: `https://api.mapbox.com/styles/v1/${chosen}/tiles/512/{z}/{x}/{y}@2x?access_token=${token}`,
    attribution: '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
    maxZoom: 20,
  }
}

/** The basemap for the current theme. Safe to call in any client component. */
export function useTileConfig(): TileConfig {
  const { resolvedTheme } = useTheme()
  return mapboxTiles(resolvedTheme) ?? OSM
}
