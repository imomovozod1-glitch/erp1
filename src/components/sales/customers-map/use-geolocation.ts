'use client'

import { useEffect, useState } from 'react'

const OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 10000 }
const toPoint = (position: GeolocationPosition): [number, number] => [position.coords.latitude, position.coords.longitude]

/** The browser's position, asked for once on mount; `locate` asks again and hands the point back. */
export function useGeolocation() {
  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator
  const [position, setPosition] = useState<[number, number] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!supported) return
    let cancelled = false
    navigator.geolocation.getCurrentPosition(
      (found) => {
        if (cancelled) return
        setPosition(toPoint(found))
        setFailed(false)
      },
      () => !cancelled && setFailed(true),
      OPTIONS
    )
    return () => {
      cancelled = true
    }
  }, [supported])

  const locate = (onFound: (point: [number, number]) => void) => {
    if (position) return onFound(position)
    if (!supported) return setFailed(true)
    navigator.geolocation.getCurrentPosition(
      (found) => {
        const point = toPoint(found)
        setPosition(point)
        setFailed(false)
        onFound(point)
      },
      () => setFailed(true),
      OPTIONS
    )
  }

  return { supported, position, failed, locate }
}
