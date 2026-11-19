export interface ScannedItem {
  id: string
  name: string
  sku: string
  unit: string
  stock: number
  price: number
  cost_price: number
  category?: string
}

export interface ScanLabels {
  product: string
  unit: string
}

const MAX_DIMENSION = 1400
const JPEG_QUALITY = 0.85

export const randomSku = () => `SKU-${Math.floor(1000 + Math.random() * 9000)}`

export const isImageFile = (file: File) => file.type.startsWith('image/') || file.name.endsWith('.avif')

function fitWithin(width: number, height: number) {
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

function loadImage(file: File): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    image.onload = () => resolve(image)
    image.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    image.src = url
  })
}

const canvasBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))

export async function downscaleToJpeg(file: File): Promise<File> {
  const image = await loadImage(file)
  if (!image) return file
  URL.revokeObjectURL(image.src)
  const { width, height } = fitWithin(image.width, image.height)
  const canvas = Object.assign(document.createElement('canvas'), { width, height })
  const context = canvas.getContext('2d')
  if (!context) return file
  context.fillStyle = '#FFFFFF'
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)
  const blob = await canvasBlob(canvas)
  return blob ? new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.jpg', { type: 'image/jpeg' }) : file
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    if (!response.ok) throw new Error(response.status === 413 ? 'image_too_large' : 'server_error')
    return null
  }
}

/** The raw rows the AI read off the image, or null when the server answered something unreadable. */
export async function scanStockImage(file: File): Promise<Record<string, unknown>[] | null> {
  const body = new FormData()
  body.append('file', await downscaleToJpeg(file))
  const response = await fetch('/api/inventory/scan', { method: 'POST', body })
  const data = await readJson(response)
  if (!data) return null
  if (!response.ok) throw new Error(String(data.error || 'image_unreadable'))
  return Array.isArray(data.items) ? data.items : []
}

export const toScannedItems = (rows: Record<string, unknown>[], labels: ScanLabels): ScannedItem[] =>
  rows.map((raw, index) => ({
    id: `scanned-${Date.now()}-${index}`,
    name: String(raw.name || `${labels.product} #${index + 1}`),
    sku: String(raw.sku || randomSku()),
    unit: String(raw.unit || labels.unit),
    stock: Number(raw.stock) || 1,
    price: Number(raw.price) || 0,
    cost_price: Number(raw.cost_price) || 0,
    category: String(raw.category || ''),
  }))

export const blankItem = (unit: string): ScannedItem => ({
  id: `manual-${Date.now()}`,
  name: '',
  sku: randomSku(),
  unit,
  stock: 1,
  price: 0,
  cost_price: 0,
})
