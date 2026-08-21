'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Trash2, Scale, Info, Pencil, Check, X } from 'lucide-react'
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
  const [editingUnit, setEditingUnit] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const totalPages = Math.ceil(customUnits.length / itemsPerPage)
  const paginated = customUnits.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true)
    try {
      const saved = localStorage.getItem('measurement_units')
      if (saved) {
        setCustomUnits(JSON.parse(saved))
      } else {
        // Ships with 4 defaults (dona/litr/metr/kg) so the product form's
        // unit dropdown isn't empty out of the box — mirrors the fallback
        // in src/lib/units.ts. Anything beyond these 4 only ever appears
        // once actually added below via "Add unit".
        const defaults = [
          lang === 'uz' ? 'Dona' : lang === 'ru' ? 'Шт' : 'Pcs',
          lang === 'uz' ? 'Litr' : lang === 'ru' ? 'Литр' : 'Liter',
          lang === 'uz' ? 'Metr' : lang === 'ru' ? 'Метр' : 'Meter',
          lang === 'uz' ? 'Kg' : lang === 'ru' ? 'Кг' : 'Kg',
        ]
        setCustomUnits(defaults)
        localStorage.setItem('measurement_units', JSON.stringify(defaults))
      }
    } catch (e) {
      console.error(e)
    }
  }, [lang])

  const handleAddUnit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newUnit.trim()
    if (!trimmed) return

    if (customUnits.includes(trimmed)) {
      toast.error(lang === 'uz' ? 'Bu o\'lchov birligi allaqachon mavjud' : lang === 'ru' ? 'Эта единица измерения уже существует' : 'This unit already exists')
      return
    }

    const updated = [trimmed, ...customUnits]
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

  const handleSaveEdit = (oldUnit: string) => {
    const trimmed = editingValue.trim()
    if (!trimmed) return

    if (trimmed === oldUnit) {
      setEditingUnit(null)
      return
    }

    if (customUnits.includes(trimmed) && trimmed !== oldUnit) {
      toast.error(lang === 'uz' ? 'Bu o\'lchov birligi allaqachon mavjud' : lang === 'ru' ? 'Эта единица измерения уже существует' : 'This unit already exists')
      return
    }

    const updated = customUnits.map((u) => u === oldUnit ? trimmed : u)
    setCustomUnits(updated)
    localStorage.setItem('measurement_units', JSON.stringify(updated))
    setEditingUnit(null)
    setEditingValue('')
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
          <div className="text-center">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {lang === 'uz' ? 'Jami o\'lchov birliklari' : lang === 'ru' ? 'Всего единиц' : 'Total Units'}
            </p>
            <p className="text-2xl font-bold text-slate-800">
              {customUnits.length}
            </p>
            <p className="text-xs text-slate-500 font-normal">
              {lang === 'uz' ? 'Foydalanuvchi birliklari' : lang === 'ru' ? 'Пользовательские единицы' : 'User-defined units'}
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
                  <TableHead className="w-10 text-center font-semibold text-slate-600">#</TableHead>
                  <TableHead className="font-semibold text-slate-600">{lang === 'uz' ? 'O\'lchov birligi nomi' : lang === 'ru' ? 'Название единицы' : 'Unit Name'}</TableHead>
                  <TableHead className="w-[100px] font-semibold text-slate-600 text-right">{lang === 'uz' ? 'Harakatlar' : lang === 'ru' ? 'Действия' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customUnits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Scale className="h-8 w-8 opacity-40" />
                        <p className="text-sm">{tCommon('noData')}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((u, index) => {
                    const isEditing = editingUnit === u
                    return (
                      <TableRow key={u} className="hover:bg-slate-50/30 transition-colors">
                        <TableCell className="text-center font-medium text-slate-500 text-xs">
                          {(currentPage - 1) * itemsPerPage + index + 1}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-800 text-sm">
                          {isEditing ? (
                            <Input
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              className="h-8 py-1 px-2 text-sm border-slate-200 focus-visible:ring-indigo-500 max-w-[200px]"
                              autoFocus
                            />
                          ) : (
                            u
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleSaveEdit(u)}
                                className="h-8 w-8 text-emerald-600 hover:text-emerald-900 hover:bg-emerald-50 cursor-pointer"
                                title={tCommon('save') || 'Save'}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingUnit(null)
                                  setEditingValue('')
                                }}
                                className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer"
                                title={tCommon('cancel') || 'Cancel'}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingUnit(u)
                                  setEditingValue(u)
                                }}
                                className="h-8 w-8 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 cursor-pointer"
                                title={tCommon('edit') || 'Edit'}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteUnit(u)}
                                className="h-8 w-8 text-rose-600 hover:text-rose-900 hover:bg-rose-50 cursor-pointer"
                                title={tCommon('delete') || 'Delete'}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="cursor-pointer"
                >
                  {lang === 'uz' ? 'Orqaga' : lang === 'ru' ? 'Назад' : 'Previous'}
                </Button>
                <span className="text-xs text-muted-foreground font-medium">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="cursor-pointer"
                >
                  {lang === 'uz' ? 'Oldinga' : lang === 'ru' ? 'Вперед' : 'Next'}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>


    </div>
  )
}
