
'use client'

import { useState, useRef } from 'react'
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
import { useTranslations } from 'next-intl'
import { errorMessage } from '@/lib/error-message'
import { createClient } from '@/lib/supabase/client'
import { invalidateProducts, invalidateMovements } from '@/lib/data/revalidate'
import { recordCostLayer } from '@/lib/inventory-costing'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
  lang?: string
}

export function AIStockScannerModal({
  open,
  onOpenChange,
  categories = [],
}: AIStockScannerModalProps) {
  const tRoot = useTranslations()
  const tCommon = useTranslations('common')
  const t = useTranslations('inventory')
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
        toast.error(t('aiScanner.imagesOnly'))
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
          // A non-JSON failure is the platform's own HTML error page (413 on
          // an oversized body, 5xx otherwise) — name it, never show its HTML.
          throw new Error(response.status === 413 ? 'image_too_large' : 'server_error')
        }
        toast.error(t('aiScanner.unexpectedResponse'))
        return
      }

      if (!response.ok) {
        throw new Error(String(data.error || 'image_unreadable'))
      }

      if (!Array.isArray(data.items) || data.items.length === 0) {
        toast.error(t('aiScanner.noItemsDetected'))
        return
      }

      // Format items with temporary unique keys
      const productLabel = t('aiScanner.defaultProductName')
      const unitLabel = t('aiScanner.defaultUnit')
      const formatted: ParsedStockItem[] = data.items.map((raw: Record<string, unknown>, index: number) => ({
        id: `scanned-${Date.now()}-${index}`,
        name: String(raw.name || `${productLabel} #${index + 1}`),
        sku: String(raw.sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`),
        unit: String(raw.unit || unitLabel),
        stock: Number(raw.stock) || 1,
        price: Number(raw.price) || 0,
        cost_price: Number(raw.cost_price) || 0,
        category: String(raw.category || ''),
      }))

      setItems(formatted)
      setScanStep('review')
      toast.success(t('aiScanner.extracted', { count: formatted.length }))
    } catch (error) {
      console.error(error)
      toast.error(errorMessage(tRoot, error, t('aiScanner.scanError')))
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
      unit: t('aiScanner.defaultUnit'),
      stock: 1,
      price: 0,
      cost_price: 0,
    }
    setItems((prev) => [...prev, newItem])
  }

  const handleSaveToWarehouse = async () => {
    if (items.length === 0) {
      toast.error(t('aiScanner.atLeastOne'))
      return
    }

    // Validation check
    const invalidItems = items.filter((item) => !item.name.trim() || !item.sku.trim())
    if (invalidItems.length > 0) {
      toast.error(t('aiScanner.nameAndSkuRequired'))
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

      const { data: { user } } = await supabase.auth.getUser()
      const { data: newProducts, error } = await supabase.from('products').insert(payload).select()
      if (error) throw error

      // Every scanned line is a brand-new product, so its stock movement/cost layer is
      // always an "in" from zero — same shape as a manual create in the product form.
      for (const product of newProducts ?? []) {
        const initialStock = Number(product.stock) || 0
        if (initialStock <= 0) continue

        const unitCost = Number(product.cost_price) || 0
        await supabase.from('stock_movements').insert({
          product_id: product.id,
          type: 'in',
          quantity: initialStock,
          quantity_before: 0,
          quantity_after: initialStock,
          reference_type: 'ai_scan',
          reason: 'AI stock scanner — new product',
          unit_cost: unitCost,
          total_cost: initialStock * unitCost,
          created_by: user?.id ?? null,
        })

        await recordCostLayer(supabase, {
          productId: product.id,
          quantity: initialStock,
          unitCost,
          sourceType: 'ai_scan',
        })
      }

      toast.success(t('aiScanner.saved', { count: items.length }))
      await invalidateProducts()
      await invalidateMovements()
      onOpenChange(false)
      handleReset()
    } catch (error) {
      console.error('Save error:', error)
      toast.error(
        errorMessage(tRoot, error, t('aiScanner.saveError'))
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
            <div className="p-2 bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 rounded-lg">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {t('aiScanner.title')}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t('aiScanner.description')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {scanStep === 'upload' ? (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Dropzone */}
              <div className="flex flex-col h-full min-h-75">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  {t('aiScanner.imageLabel')}
                </label>
                <div
                  className={`flex-1 relative border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 transition-all ${
                    preview
                      ? 'border-violet-300 dark:border-violet-800 bg-violet-50/20 dark:bg-violet-950/20'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-violet-400 dark:hover:border-violet-700 hover:bg-slate-100/50 dark:hover:bg-slate-800/70'
                  }`}
                >
                  {preview ? (
                    <div className="relative w-full h-full min-h-55 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={preview}
                        alt={t('aiScanner.previewAlt')}
                        className="max-h-65 w-auto object-contain rounded-lg shadow-sm"
                      />
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                      <div className="h-14 w-14 bg-white dark:bg-slate-900 rounded-full shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center mb-3 text-violet-600 dark:text-violet-400">
                        <UploadCloud className="h-7 w-7" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 text-center">
                        {t('aiScanner.uploadPrompt')}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 text-center">
                        {t('aiScanner.formatsHint')}
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
                      className="text-slate-600 dark:text-slate-300 text-xs"
                    >
                      {t('aiScanner.chooseAnother')}
                    </Button>
                  </div>
                )}
              </div>

              {/* Guide Card */}
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-3">
                    <FileSpreadsheet className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                    {t('aiScanner.howItWorks')}
                  </h4>
                  <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                    <li className="flex items-start gap-2">
                      <span className="bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-400 font-bold rounded-full h-4 w-4 flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                        1
                      </span>
                      {t('aiScanner.step1')}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-400 font-bold rounded-full h-4 w-4 flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                        2
                      </span>
                      {t('aiScanner.step2')}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-400 font-bold rounded-full h-4 w-4 flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                        3
                      </span>
                      {t('aiScanner.step3')}
                    </li>
                  </ul>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/50 rounded-lg p-3 mt-4 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    {t('aiScanner.qualityTip')}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Review & Edit Table Step */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50 text-xs px-2.5 py-0.5">
                    {t('aiScanner.detected', { count: items.length })}
                  </Badge>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {t('aiScanner.editHint')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleAddRow} className="h-8 gap-1 text-xs">
                    <Plus className="h-3.5 w-3.5" /> {t('aiScanner.addRow')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setScanStep('upload')} className="h-8 text-xs text-slate-500 dark:text-slate-400">
                    {t('aiScanner.scanAgain')}
                  </Button>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-100 overflow-y-auto shadow-xs bg-white dark:bg-slate-900">
                <Table>
                  <TableHeader className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-10 text-xs font-semibold text-center">#</TableHead>
                      <TableHead className="w-[30%] text-xs font-semibold">{t('productName')}</TableHead>
                      <TableHead className="w-[15%] text-xs font-semibold">{t('sku')}</TableHead>
                      <TableHead className="w-[12%] text-xs font-semibold">{t('unit')}</TableHead>
                      <TableHead className="w-[12%] text-xs font-semibold text-right">{t('quantity')}</TableHead>
                      <TableHead className="w-[15%] text-xs font-semibold text-right">{t('price')}</TableHead>
                      <TableHead className="w-[15%] text-xs font-semibold text-right">{t('costPrice')}</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, idx) => (
                      <TableRow key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/70">
                        <TableCell className="text-center text-xs text-slate-500 dark:text-slate-400">{idx + 1}</TableCell>
                        <TableCell className="p-2">
                          <Input
                            value={item.name}
                            onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                            placeholder={t('productName')}
                            className="h-8 text-xs border-slate-200 dark:border-slate-700"
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            value={item.sku}
                            onChange={(e) => handleUpdateItem(item.id, 'sku', e.target.value)}
                            placeholder="SKU-001"
                            className="h-8 text-xs font-mono border-slate-200 dark:border-slate-700"
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            value={item.unit}
                            onChange={(e) => handleUpdateItem(item.id, 'unit', e.target.value)}
                            placeholder={t('aiScanner.defaultUnit')}
                            className="h-8 text-xs border-slate-200 dark:border-slate-700"
                          />
                        </TableCell>
                        <TableCell className="p-2 text-right">
                          <Input
                            type="number"
                            value={item.stock}
                            onChange={(e) => handleUpdateItem(item.id, 'stock', Number(e.target.value))}
                            className="h-8 text-xs text-right border-slate-200 dark:border-slate-700 font-semibold"
                          />
                        </TableCell>
                        <TableCell className="p-2 text-right">
                          <Input
                            type="number"
                            value={item.price}
                            onChange={(e) => handleUpdateItem(item.id, 'price', Number(e.target.value))}
                            className="h-8 text-xs text-right border-slate-200 dark:border-slate-700"
                          />
                        </TableCell>
                        <TableCell className="p-2 text-right">
                          <Input
                            type="number"
                            value={item.cost_price}
                            onChange={(e) => handleUpdateItem(item.id, 'cost_price', Number(e.target.value))}
                            className="h-8 text-xs text-right border-slate-200 dark:border-slate-700"
                          />
                        </TableCell>
                        <TableCell className="p-2 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveRow(item.id)}
                            className="h-7 w-7 text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
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
        <DialogFooter className="-mx-6 -mb-6 mt-auto rounded-b-xl px-6 py-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isScanning || isSaving}
          >
            {tCommon('close')}
          </Button>

          {scanStep === 'upload' ? (
            <Button
              onClick={handleScanImage}
              disabled={!file || isScanning}
            >
              {isScanning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('aiScanner.analyzing')}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {t('aiScanner.readWithAi')}
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleSaveToWarehouse}
              disabled={isSaving || items.length === 0}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {tCommon('saving')}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {t('aiScanner.saveAll')}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
