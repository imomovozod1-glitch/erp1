'use client'

import { useState, useRef } from 'react'
import { UploadCloud, FileText, Loader2, Image as ImageIcon, Copy, Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
export function ScannerInterface() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      if (!selected.type.startsWith('image/')) {
        toast.error("Faqat rasm fayllari (JPG, PNG) qo'llab-quvvatlanadi")
        return
      }
      setFile(selected)
      setPreview(URL.createObjectURL(selected))
      setResult(null)
    }
  }

  const handleScan = async () => {
    if (!file) return

    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      })

      const rawText = await response.text()
      let data: Record<string, unknown> = {}
      try {
        data = JSON.parse(rawText)
      } catch {
        throw new Error("Serverdan kutilmagan javob qaytdi. Rasm hajmi yoki formati mos kelmadi.")
      }

      if (!response.ok) {
        throw new Error(String(data.error || 'Xatolik yuz berdi'))
      }

      setResult(String(data.result || ''))
      toast.success('Hujjat muvaffaqiyatli tahlil qilindi')
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Xatolik yuz berdi')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success('Nusxa olindi')
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Upload Section */}
      <Card className="border-0 shadow-sm flex flex-col h-full min-h-125">
        <CardContent className="p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 text-lg">Hujjat rasmi</h3>
            {file && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFile(null)
                  setPreview(null)
                  setResult(null)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
                className="text-red-500 hover:text-red-600"
              >
                Tozalash
              </Button>
            )}
          </div>

          <div className="flex-1 relative border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 flex flex-col items-center justify-center overflow-hidden transition-colors hover:border-indigo-300">
            {preview ? (
              <div className="relative w-full h-full p-2 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="Preview"
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer p-6">
                <div className="h-16 w-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 text-indigo-500">
                  <UploadCloud className="h-8 w-8" />
                </div>
                <p className="text-sm font-medium text-slate-700">
                  Rasmni yuklang yoki bu yerga tashlang
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG, WEBP (Maksimal 5MB)
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

          <Button
            onClick={handleScan}
            disabled={!file || isLoading}
            className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 h-12 text-sm font-semibold rounded-xl gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ImageIcon className="h-5 w-5" />
            )}
            {isLoading ? 'Tahlil qilinmoqda...' : 'Tahlil qilish (OCR)'}
          </Button>
        </CardContent>
      </Card>

      {/* Result Section */}
      <Card className="border-0 shadow-sm min-h-125">
        <CardContent className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-600" />
              <h3 className="font-semibold text-slate-800 text-lg">Natija</h3>
            </div>
            {result && (
              <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 rounded-lg h-8">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Nusxalandi' : 'Nusxa olish'}
              </Button>
            )}
          </div>

          <div className="flex-1 bg-slate-50 rounded-xl border border-slate-100 p-4 overflow-auto">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-75" />
                  <div className="relative bg-white p-3 rounded-full shadow-sm text-indigo-600">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                </div>
                <p className="text-sm font-medium">Sun&apos;iy intellekt tahlil qilmoqda...</p>
              </div>
            ) : result ? (
              <div className="prose prose-sm prose-slate max-w-none dark:prose-invert">
                <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 bg-transparent p-0 m-0 border-0">
                  {result}
                </pre>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60">
                <FileText className="h-10 w-10 mb-3 text-slate-300" />
                <p className="text-sm">Natija bu yerda ko&apos;rsatiladi</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
