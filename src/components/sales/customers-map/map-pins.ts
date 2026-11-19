import L from 'leaflet'

export const DEFAULT_CENTER: [number, number] = [41.2995, 69.2401]

export const customerPin = L.divIcon({
  html: `<div class="flex items-center justify-center w-8 h-8 rounded-full bg-violet-600 shadow-lg border-2 border-white">
           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
         </div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
})

export const numberedPin = (position: number) =>
  L.divIcon({
    html: `<div class="flex items-center justify-center w-7 h-7 rounded-full bg-violet-600 shadow-lg border-2 border-white text-white text-[11px] font-bold leading-none">${position}</div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })

// A different shape and colour from the customer pins, so "you" is told apart at a glance.
export const myPositionPin = L.divIcon({
  html: `<div class="relative flex items-center justify-center w-5 h-5">
           <span class="absolute inline-flex w-5 h-5 rounded-full bg-sky-500/30"></span>
           <span class="relative inline-flex w-3.5 h-3.5 rounded-full bg-sky-600 border-2 border-white shadow"></span>
         </div>`,
  className: '',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

export interface MappableCustomer {
  id: string
  name: string
  phone: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  assigned_to?: string | null
  total_debt?: number
}

export const isLocated = (c: MappableCustomer) => typeof c.latitude === 'number' && typeof c.longitude === 'number'
export const pointOf = (c: MappableCustomer): [number, number] => [c.latitude as number, c.longitude as number]
