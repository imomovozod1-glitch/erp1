'use client'

import { useTheme } from '@/components/providers/theme-provider'

/**
 * Which basemap the Leaflet maps draw.
 *
 * Two reasons this is not just a hardcoded OSM URL any more:
 *
 * 1. **Dark mode.** The app has a full dark theme, but plain OSM raster is
 *    always daylight-bright — a white rectangle in the middle of a dark page.
 *    CARTO publishes a matched light/dark pair off the same OSM data, free and
 *    with no key, so the map finally follows the theme like everything else.
 *
 * 2. **Cost.** Mapbox bills its raster basemap per TILE request, not per map
 *    load, and one Leaflet viewport is 10–20 tiles — the 50k free allowance is
 *    roughly 3 000 map openings a month, which an ERP passes quickly. The
 *    routing APIs have no free alternative; basemaps do. So the Mapbox budget
 *    goes entirely to Directions/Optimization (src/lib/mapbox.ts) and the tiles
 *    stay free.
 *
 * Set NEXT_PUBLIC_MAPBOX_STYLE_TILES to a style id (e.g. `mapbox/streets-v12`)
 * together with NEXT_PUBLIC_MAPBOX_TILE_TOKEN to switch the basemap to Mapbox
 * anyway — next.config.ts already allows api.mapbox.com in img-src, so nothing
 * else has to change. That token is necessarily public, so restrict it to the
 * app's hosts in the Mapbox dashboard.
 */

export interface TileConfig {
  url: string
  attribution: string
  maxZoom: number
}

const CARTO_ATTRIBUTION =
  '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CARTO</a>'

const LIGHT: TileConfig = {
  url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  attribution: CARTO_ATTRIBUTION,
  maxZoom: 20,
}

const DARK: TileConfig = {
  url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  attribution: CARTO_ATTRIBUTION,
  maxZoom: 20,
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
  return mapboxTiles(resolvedTheme) ?? (resolvedTheme === 'dark' ? DARK : LIGHT)
}
