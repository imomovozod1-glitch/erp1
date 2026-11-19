'use client'

import { useState, type ChangeEvent } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/error-message'
import { createClient } from '@/lib/supabase/client'
import { invalidateMovements, invalidateProducts } from '@/lib/data/revalidate'
import { blankItem, isImageFile, scanStockImage, toScannedItems, type ScannedItem } from './scan-image'
import { hasMissingIdentity, saveScannedItems, type NamedCategory } from './scan-save'

export type ScanStep = 'upload' | 'review'

export function useStockScanner(categories: NamedCategory[], onDone: () => void) {
  const t = useTranslations()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [items, setItems] = useState<ScannedItem[]>([])
  const [step, setStep] = useState<ScanStep>('upload')
  const [scanning, setScanning] = useState(false)
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setFile(null)
    setPreview(null)
    setItems([])
    setStep('upload')
  }

  const pickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (!picked) return
    if (!isImageFile(picked)) return void toast.error(t('inventory.aiScanner.imagesOnly'))
    setFile(picked)
    setPreview(URL.createObjectURL(picked))
  }

  const showScan = (rows: Record<string, unknown>[] | null) => {
    if (rows === null) return void toast.error(t('inventory.aiScanner.unexpectedResponse'))
    if (!rows.length) return void toast.error(t('inventory.aiScanner.noItemsDetected'))
    const scanned = toScannedItems(rows, {
      product: t('inventory.aiScanner.defaultProductName'),
      unit: t('inventory.aiScanner.defaultUnit'),
    })
    setItems(scanned)
    setStep('review')
    toast.success(t('inventory.aiScanner.extracted', { count: scanned.length }))
  }

  const scan = async () => {
    if (!file) return
    setScanning(true)
    try {
      showScan(await scanStockImage(file))
    } catch (error) {
      toast.error(errorMessage(t, error, t('inventory.aiScanner.scanError')))
    } finally {
      setScanning(false)
    }
  }

  const updateItem = (id: string, patch: Partial<ScannedItem>) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))

  const removeItem = (id: string) => setItems((current) => current.filter((item) => item.id !== id))
  const addItem = () => setItems((current) => [...current, blankItem(t('inventory.aiScanner.defaultUnit'))])

  const save = async () => {
    if (!items.length) return void toast.error(t('inventory.aiScanner.atLeastOne'))
    if (hasMissingIdentity(items)) return void toast.error(t('inventory.aiScanner.nameAndSkuRequired'))
    setSaving(true)
    try {
      await saveScannedItems(createClient(), items, categories)
      toast.success(t('inventory.aiScanner.saved', { count: items.length }))
      await invalidateProducts()
      await invalidateMovements()
      reset()
      onDone()
    } catch (error) {
      toast.error(errorMessage(t, error, t('inventory.aiScanner.saveError')))
    } finally {
      setSaving(false)
    }
  }

  return { file, preview, items, step, setStep, scanning, saving, reset, pickFile, scan, updateItem, removeItem, addItem, save }
}

export type StockScanner = ReturnType<typeof useStockScanner>
