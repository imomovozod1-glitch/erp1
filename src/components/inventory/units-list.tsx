'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Trash2, Scale, Info } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'

interface UnitsListProps {
  lang: string
}

export function UnitsList({ lang }: UnitsListProps) {
  const t = useTranslations('inventory')
  const tCommon = useTranslations('common')
  const [isMounted, setIsMounted] = useState(false)
  const [customUnits, setCustomUnits] = useState<string[]>([])
  const [newUnit, setNewUnit] = useState('')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true)
    try {
      const saved = localStorage.getItem('measurement_units')
      if (saved) {
        setCustomUnits(JSON.parse(saved))
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  const defaultUnits = [
    t('piece') || 'Dona',
    t('kg') || 'Kg',
    t('liter') || 'Litr',
    t('meter') || 'Metr',
    t('package') || 'Qop',
    t('ton') || 'Tonna',
  ]

  const handleAddUnit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newUnit.trim()
    if (!trimmed) return

    if (defaultUnits.includes(trimmed) || customUnits.includes(trimmed)) {
      toast.error(lang === 'uz' ? 'Bu o\'lchov birligi allaqachon mavjud' : lang === 'ru' ? 'Эта единица измерения уже существует' : 'This unit already exists')
      return
    }

    const updated = [...customUnits, trimmed]
    setCustomUnits(updated)
    localStorage.setItem('measurement_units', JSON.stringify(updated))
    setNewUnit('')
    toast.success(tCommon('success'))
  }

  const handleDeleteUnit = (unitToDelete: string) => {
    const updated = customUnits.filter((u) => u !== unitToDelete)
    setCustomUnits(updated)
    localStorage.setItem('measurement_units', JSON.stringify(updated))
    toast.success(tCommon('success'))
  }

  if (!isMounted) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-slate-200/60 shadow-sm p-6">
            <Skeleton className="h-6 w-1/3 mb-2" />
            <Skeleton className="h-8 w-1/2" />
          </Card>
          <Card className="border-slate-200/60 shadow-sm p-6">
            <Skeleton className="h-6 w-1/3 mb-2" />
            <Skeleton className="h-10 w-full" />
          </Card>
        </div>
        <Card className="border-slate-200/60 shadow-sm p-6">
          <Skeleton className="h-10 w-full mb-4" />
          <Skeleton className="h-20 w-full" />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats and Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Statistics Card */}
        <Card className="border-slate-200/60 shadow-sm flex items-center p-6 gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
            <Scale className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {lang === 'uz' ? 'Jami o\'lchov birliklari' : lang === 'ru' ? 'Всего единиц' : 'Total Units'}
            </p>
            <p className="text-2xl font-bold text-slate-800">
              {defaultUnits.length + customUnits.length}
            </p>
            <p className="text-xs text-slate-500 font-normal">
              {defaultUnits.length} {lang === 'uz' ? 'tizim' : lang === 'ru' ? 'системных' : 'default'} • {customUnits.length} {lang === 'uz' ? 'maxsus' : lang === 'ru' ? 'пользовательских' : 'custom'}
            </p>
          </div>
        </Card>

        {/* Add Unit Form */}
        <Card className="border-slate-200/60 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-bold text-slate-800">
              {lang === 'uz' ? 'Yangi o\'lchov birligi qo\'shish' : lang === 'ru' ? 'Добавить единицу измерения' : 'Add New Unit'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <form onSubmit={handleAddUnit} className="flex gap-2">
              <Input
                placeholder={lang === 'uz' ? 'Masalan: Juft, Quti' : lang === 'ru' ? 'Например: Коробка, Пара' : 'e.g. Pair, Box'}
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                className="border-slate-200 focus-visible:ring-indigo-500 flex-1"
              />
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 cursor-pointer">
                <Plus className="h-4 w-4 mr-1" />
                {tCommon('add') || 'Add'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* List Table */}
      <Card className="border-slate-200/60 shadow-sm animate-in fade-in duration-300">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-slate-800">
            {t('unit')}
          </CardTitle>
          <CardDescription>
            {lang === 'uz' ? 'Tizimda mavjud barcha o\'lchov birliklari ro\'yxati' : lang === 'ru' ? 'Список всех единиц измерения в системе' : 'Directory of all active measurement units'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-slate-100 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="font-semibold text-slate-600">Unit Name</TableHead>
                  <TableHead className="w-[150px] font-semibold text-slate-600">Type</TableHead>
                  <TableHead className="w-[100px] font-semibold text-slate-600 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Default Units */}
                {defaultUnits.map((u) => (
                  <TableRow key={u} className="hover:bg-slate-50/30 transition-colors">
                    <TableCell className="font-semibold text-slate-800 text-sm">
                      {u}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {lang === 'uz' ? 'Tizim' : lang === 'ru' ? 'Системный' : 'Default'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-xs text-slate-400 font-normal italic">Locked</span>
                    </TableCell>
                  </TableRow>
                ))}

                {/* Custom Units */}
                {customUnits.map((u) => (
                  <TableRow key={u} className="hover:bg-slate-50/30 transition-colors">
                    <TableCell className="font-semibold text-slate-800 text-sm">
                      {u}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {lang === 'uz' ? 'Foydalanuvchi' : lang === 'ru' ? 'Пользовательский' : 'Custom'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteUnit(u)}
                        className="h-8 w-8 text-rose-600 hover:text-rose-900 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Informative footer card */}
      <Card className="border-slate-100 bg-slate-50/50">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="p-1.5 bg-white rounded border border-slate-100 text-indigo-600 mt-0.5">
            <Info className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-700">Dynamic Product Unit Binding</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Any custom measurement unit added here will automatically populate the unit options dropdown inside the product creation and editing forms.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
