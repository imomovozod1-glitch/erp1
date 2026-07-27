
'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles,
  UploadCloud,
  Loader2,
  Trash2,
  Plus,
  CheckCircle2,
  FileSpreadsheet,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { invalidateProducts } from '@/lib/data/revalidate'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export interface ParsedStockItem {
  id: string
  name: string
  sku: string
  unit: string
  stock: number
  price: number
  cost_price: number
  category?: string
}

interface CategoryItem {
  id: string
  name: string
}

interface AIStockScannerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories?: CategoryItem[]
}

export function AIStockScannerModal({
  open,
  onOpenChange,
  categories = [],
}: AIStockScannerModalProps) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [items, setItems] = useState<ParsedStockItem[]>([])
  const [scanStep, setScanStep] = useState<'upload' | 'review'>('upload')

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleReset = () => {
    setFile(null)
    setPreview(null)
    setItems([])
    setScanStep('upload')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      if (!selected.type.startsWith('image/') && !selected.name.endsWith('.avif')) {
        toast.error("Faqat rasm fayllari (JPG, PNG, WEBP, AVIF) qo'llab-quvvatlanadi")
        return
      }
      setFile(selected)
      setPreview(URL.createObjectURL(selected))
    }
  }

  const convertImageToJpeg = (inputFile: File): Promise<File> => {
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(inputFile)

      img.onload = () => {
        // Resize high-res images to max 1400px to ensure fast processing and small payload
        const MAX_DIM = 1400
        let width = img.width
        let height = img.height

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width)
            width = MAX_DIM
          } else {
            width = Math.round((width * MAX_DIM) / height)
            height = MAX_DIM
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, width, height)
          ctx.drawImage(img, 0, 0, width, height)
          canvas.toBlob(
            (blob) => {
              URL.revokeObjectURL(url)
              if (blob) {
                const converted = new File(
                  [blob],
                  inputFile.name.replace(/\.[^/.]+$/, '') + '.jpg',
                  { type: 'image/jpeg' }
                )
                resolve(converted)
              } else {
                resolve(inputFile)
              }
            },
            'image/jpeg',
            0.85
          )
        } else {
          URL.revokeObjectURL(url)
          resolve(inputFile)
        }
      }

      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(inputFile)
      }

      img.src = url
    })
  }

  const handleScanImage = async () => {
    if (!file) return

    setIsScanning(true)
    try {
      const imageToSend = await convertImageToJpeg(file)
      const formData = new FormData()
      formData.append('file', imageToSend)

      const response = await fetch('/api/inventory/scan', {
        method: 'POST',
        body: formData,
      })

      const rawText = await response.text()
      let data: Record<string, unknown> = {}
      try {
        data = JSON.parse(rawText)
      } catch {
        if (!response.ok) {
          if (response.status === 413) {
            throw new Error('Rasm hajmi juda katta. Iltimos kichikroq rasm yuklang.')
          }
          const match = rawText.match(/<title>(.*?)<\/title>/i) || rawText.match(/<h1>(.*?)<\/h1>/i)
          const errorTitle = match ? match[1].replace(/<[^>]+>/g, '').trim() : ''
          throw new Error(`Server xatosi (${response.status}): ${errorTitle || 'Xatolik yuz berdi'}`)
        }
        throw new Error('Serverdan kutilmagan javob qaytdi. Qayta urinib ko`ring.')
      }

      if (!response.ok) {
        throw new Error(String(data.error || 'Rasmni AI o`qiy olmadi'))
      }

      if (!Array.isArray(data.items) || data.items.length === 0) {
        toast.error("Rasmdan hech qanday mahsulot ma'lumoti aniqlanmadi")
        return
      }

      // Format items with temporary unique keys
      const formatted: ParsedStockItem[] = data.items.map((raw: Record<string, unknown>, index: number) => ({
        id: `scanned-${Date.now()}-${index}`,
        name: String(raw.name || `Mahsulot #${index + 1}`),
        sku: String(raw.sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`),
        unit: String(raw.unit || 'dona'),
        stock: Number(raw.stock) || 1,
        price: Number(raw.price) || 0,
        cost_price: Number(raw.cost_price) || 0,
        category: String(raw.category || ''),
      }))

      setItems(formatted)
      setScanStep('review')
      toast.success(`AI rasmdan ${formatted.length} ta mahsulotni ajratib oldi!`)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Scanirovka qilishda xatolik yuz berdi')
    } finally {
      setIsScanning(false)
    }
  }

  const handleUpdateItem = (
    id: string,
    field: keyof ParsedStockItem,
    value: string | number
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return { ...item, [field]: value }
        }
        return item
      })
    )
  }

  const handleRemoveRow = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handleAddRow = () => {
    const newItem: ParsedStockItem = {
      id: `manual-${Date.now()}`,
      name: '',
      sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      unit: 'dona',
      stock: 1,
      price: 0,
      cost_price: 0,
    }
    setItems((prev) => [...prev, newItem])
  }

  const handleSaveToWarehouse = async () => {
    if (items.length === 0) {
      toast.error('Saqlash uchun kamida 1 ta mahsulot bo`lishi kerak')
      return
    }

    // Validation check
    const invalidItems = items.filter((item) => !item.name.trim() || !item.sku.trim())
    if (invalidItems.length > 0) {
      toast.error('Barcha mahsulotlar nomi va SKU (Artikul) to`ldirilgan bo`lishi shart')
      return
    }

    setIsSaving(true)
    try {
      const supabase = createClient() as any

      // Find matching category ID if category name matches
      const payload = items.map((item) => {
        let categoryId: string | null = null
        if (item.category && categories.length > 0) {
          const matched = categories.find(
            (c) => c.name.toLowerCase() === item.category?.toLowerCase()
          )
          if (matched) categoryId = matched.id
        }

        return {
          name: item.name.trim(),
          sku: item.sku.trim(),
          unit: item.unit.trim() || 'dona',
          stock: Number(item.stock) || 0,
          min_stock: 5,
          price: Number(item.price) || 0,
          cost_price: Number(item.cost_price) || 0,
          category_id: categoryId,
          is_active: true,
        }
      })

      const { error } = await supabase.from('products').insert(payload)
      if (error) throw error

      toast.success(`${items.length} ta mahsulot omborga muvaffaqiyatli saqlandi!`)
      await invalidateProducts()
      router.refresh()
      onOpenChange(false)
      handleReset()
    } catch (error) {
      console.error('Save error:', error)
      toast.error(
        error instanceof Error ? error.message : 'Mahsulotlarni saqlashda xatolik yuz berdi'
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900">
                AI Ombor Rasmidan Yuklash (Image-to-Table)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Kelgan tovarlar ro&apos;yxati yoki nakladnoy rasmini yuklang, AI avtomatik jadvalga o&apos;tkazib beradi.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {scanStep === 'upload' ? (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Dropzone */}
              <div className="flex flex-col h-full min-h-[300px]">
                <label className="text-xs font-semibold text-slate-700 mb-2">
                  Hujjat / Tovarlar rasmi:
                </label>
                <div
                  className={`flex-1 relative border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 transition-all ${
                    preview
                      ? 'border-indigo-300 bg-indigo-50/20'
                      : 'border-slate-200 bg-slate-50 hover:border-indigo-400 hover:bg-slate-100/50'
                  }`}
                >
                  {preview ? (
                    <div className="relative w-full h-full min-h-[220px] flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={preview}
                        alt="Scanned doc preview"
                        className="max-h-[260px] w-auto object-contain rounded-lg shadow-sm"
                      />
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                      <div className="h-14 w-14 bg-white rounded-full shadow-sm border border-slate-100 flex items-center justify-center mb-3 text-indigo-600">
                        <UploadCloud className="h-7 w-7" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700 text-center">
                        Rasmni bu yerga yuklang yoki tanlang
                      </p>
                      <p className="text-xs text-slate-400 mt-1 text-center">
                        PNG, JPG, WEBP formatlari qo&apos;llab-quvvatlanadi
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </label>
                  )}
                </div>

                {file && (
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleReset}
                      className="text-slate-600 text-xs"
                    >
                      Boshqa rasm tanlash
                    </Button>
                  </div>
                )}
              </div>

              {/* Guide Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-3">
                    <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
                    Qanday ishlaydi?
                  </h4>
                  <ul className="space-y-2.5 text-xs text-slate-600">
                    <li className="flex items-start gap-2">
                      <span className="bg-indigo-100 text-indigo-700 font-bold rounded-full h-4 w-4 flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                        1
                      </span>
                      Omborga kelgan yuk, nakladnoy yoki ro&apos;yxat rasmini yuklaysiz.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-indigo-100 text-indigo-700 font-bold rounded-full h-4 w-4 flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                        2
                      </span>
                      Sun&apos;iy intellekt (Gemini Vision AI) rasmdagi barcha tovarlarni tahlil qilib, Jadval shaklida o&apos;qib beradi.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-indigo-100 text-indigo-700 font-bold rounded-full h-4 w-4 flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                        3
                      </span>
                      Hosil bo&apos;lgan jadvaldagi narxlar va miqdorlarni ko&apos;rib chiqasiz hamda bir tugma bilan Omborga saqlaysiz.
                    </li>
                  </ul>
                </div>

                <div className="bg-amber-50 border border-amber-200/60 rounded-lg p-3 mt-4 text-[11px] text-amber-800 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Rasm sifatli va yorug&apos; joyda olingan bo&apos;lsa, AI ma&apos;lumotlarni aniqroq o&apos;qiydi.
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Review & Edit Table Step */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs px-2.5 py-0.5">
                    {items.length} ta mahsulot aniqlandi
                  </Badge>
                  <span className="text-xs text-slate-500">
                    Jadvaldagi katakchalarni bevosita tahrirlashingiz mumkin.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleAddRow} className="h-8 gap-1 text-xs">
                    <Plus className="h-3.5 w-3.5" /> Qator qo&apos;shish
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setScanStep('upload')} className="h-8 text-xs text-slate-500">
                    Qayta scan qilish
                  </Button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[400px] overflow-y-auto shadow-xs bg-white">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-[30%] text-xs font-semibold">Mahsulot nomi</TableHead>
                      <TableHead className="w-[15%] text-xs font-semibold">Artikul (SKU)</TableHead>
                      <TableHead className="w-[12%] text-xs font-semibold">Birligi</TableHead>
                      <TableHead className="w-[12%] text-xs font-semibold text-right">Miqdori</TableHead>
                      <TableHead className="w-[15%] text-xs font-semibold text-right">Sotish narxi</TableHead>
                      <TableHead className="w-[15%] text-xs font-semibold text-right">Tan narxi</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id} className="hover:bg-slate-50/70">
                        <TableCell className="p-2">
                          <Input
                            value={item.name}
                            onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                            placeholder="Mahsulot nomi"
                            className="h-8 text-xs border-slate-200"
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            value={item.sku}
                            onChange={(e) => handleUpdateItem(item.id, 'sku', e.target.value)}
                            placeholder="SKU-001"
                            className="h-8 text-xs font-mono border-slate-200"
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            value={item.unit}
                            onChange={(e) => handleUpdateItem(item.id, 'unit', e.target.value)}
                            placeholder="dona"
                            className="h-8 text-xs border-slate-200"
                          />
                        </TableCell>
                        <TableCell className="p-2 text-right">
                          <Input
                            type="number"
                            value={item.stock}
                            onChange={(e) => handleUpdateItem(item.id, 'stock', Number(e.target.value))}
                            className="h-8 text-xs text-right border-slate-200 font-semibold"
                          />
                        </TableCell>
                        <TableCell className="p-2 text-right">
                          <Input
                            type="number"
                            value={item.price}
                            onChange={(e) => handleUpdateItem(item.id, 'price', Number(e.target.value))}
                            className="h-8 text-xs text-right border-slate-200"
                          />
                        </TableCell>
                        <TableCell className="p-2 text-right">
                          <Input
                            type="number"
                            value={item.cost_price}
                            onChange={(e) => handleUpdateItem(item.id, 'cost_price', Number(e.target.value))}
                            className="h-8 text-xs text-right border-slate-200"
                          />
                        </TableCell>
                        <TableCell className="p-2 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveRow(item.id)}
                            className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="pt-4 border-t flex items-center justify-between mt-auto">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isScanning || isSaving}
            className="text-xs"
          >
            Yopish
          </Button>

          {scanStep === 'upload' ? (
            <Button
              onClick={handleScanImage}
              disabled={!file || isScanning}
              className="bg-indigo-600 hover:bg-indigo-500 text-xs gap-2 h-10 px-5 rounded-lg"
            >
              {isScanning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  AI Tahlil qilmoqda...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Rasmni AI bilan o&apos;qish
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleSaveToWarehouse}
              disabled={isSaving || items.length === 0}
              className="bg-emerald-600 hover:bg-emerald-500 text-xs gap-2 h-10 px-5 rounded-lg"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saqlanmoqda...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Barcha tovarlarni omborga saqlash
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
