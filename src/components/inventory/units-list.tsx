'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Trash2, Scale, Pencil, Check, X } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import { invalidateProducts } from '@/lib/data/revalidate'

interface UnitsListProps {
  lang: string
}

interface UnitRow {
  id: string
  name: string
}

export function UnitsList({ lang }: UnitsListProps) {
  const t = useTranslations('inventory')
  const tCommon = useTranslations('common')
  const supabase = createClient() as any
  const [isLoading, setIsLoading] = useState(true)
  const [units, setUnits] = useState<UnitRow[]>([])
  const [newUnit, setNewUnit] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const totalPages = Math.ceil(units.length / itemsPerPage)
  const paginated = units.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const alreadyExistsMessage =
    lang === 'uz' ? "Bu o'lchov birligi allaqachon mavjud" : lang === 'ru' ? 'Эта единица измерения уже существует' : 'This unit already exists'

  useEffect(() => {
    supabase
      .from('measurement_units')
      .select('id, name')
      .order('name', { ascending: true })
      .then(({ data, error }: any) => {
        if (!error && data) setUnits(data)
        setIsLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Case/whitespace-insensitive — "Dona" and "dona" are the same unit. The
  // database also enforces this (unique index on LOWER(name)) so a race
  // between two admins can't slip a duplicate through either.
  const existsCaseInsensitive = (value: string, excludeId?: string) =>
    units.some((u) => u.id !== excludeId && u.name.trim().toLowerCase() === value.trim().toLowerCase())

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newUnit.trim()
    if (!trimmed) return

    if (existsCaseInsensitive(trimmed)) {
      toast.error(alreadyExistsMessage)
      return
    }

    setIsAdding(true)
    try {
      const { data, error } = await supabase.from('measurement_units').insert({ name: trimmed }).select('id, name').single()
      if (error) {
        toast.error(error.code === '23505' ? alreadyExistsMessage : error.message || tCommon('error'))
        return
      }
      setUnits((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewUnit('')
      toast.success(tCommon('success'))
    } finally {
      setIsAdding(false)
    }
  }

  const handleDeleteUnit = async (id: string) => {
    const { error } = await supabase.from('measurement_units').delete().eq('id', id)
    if (error) {
      toast.error(error.message || tCommon('error'))
      return
    }
    setUnits((prev) => prev.filter((u) => u.id !== id))
    toast.success(tCommon('success'))
  }

  const handleSaveEdit = async (unit: UnitRow) => {
    const trimmed = editingValue.trim()
    if (!trimmed) return

    if (trimmed === unit.name) {
      setEditingId(null)
      return
    }

    if (existsCaseInsensitive(trimmed, unit.id)) {
      toast.error(alreadyExistsMessage)
      return
    }

    const { error } = await supabase.from('measurement_units').update({ name: trimmed }).eq('id', unit.id)
    if (error) {
      toast.error(error.code === '23505' ? alreadyExistsMessage : error.message || tCommon('error'))
      return
    }
    setUnits((prev) => prev.map((u) => (u.id === unit.id ? { ...u, name: trimmed } : u)).sort((a, b) => a.name.localeCompare(b.name)))
    setEditingId(null)
    setEditingValue('')
    toast.success(tCommon('success'))
    // Product form dropdowns (and the Excel template/import unit matching)
    // read this list from the database — nothing to invalidate there since
    // they query fresh on each mount, but existing products keep whatever
    // unit string they were saved with regardless of a rename here.
    await invalidateProducts()
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-slate-200/60 dark:border-slate-700 shadow-sm p-6">
            <Skeleton className="h-6 w-1/3 mb-2" />
            <Skeleton className="h-8 w-1/2" />
          </Card>
          <Card className="border-slate-200/60 dark:border-slate-700 shadow-sm p-6">
            <Skeleton className="h-6 w-1/3 mb-2" />
            <Skeleton className="h-10 w-full" />
          </Card>
        </div>
        <Card className="border-slate-200/60 dark:border-slate-700 shadow-sm p-6">
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
        <Card className="border-slate-200/60 dark:border-slate-700 shadow-sm flex items-center p-6 gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="p-3 bg-violet-50 dark:bg-violet-950/50 rounded-xl text-violet-600 dark:text-violet-400">
            <Scale className="h-6 w-6" />
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {lang === 'uz' ? 'Jami o\'lchov birliklari' : lang === 'ru' ? 'Всего единиц' : 'Total Units'}
            </p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">
              {units.length}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
              {lang === 'uz' ? 'Kompaniya birliklari' : lang === 'ru' ? 'Единицы компании' : 'Company-wide units'}
            </p>
          </div>
        </Card>

        {/* Add Unit Form */}
        <Card className="border-slate-200/60 dark:border-slate-700 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {lang === 'uz' ? 'Yangi o\'lchov birligi qo\'shish' : lang === 'ru' ? 'Добавить единицу измерения' : 'Add New Unit'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <form onSubmit={handleAddUnit} className="flex gap-2">
              <Input
                placeholder={lang === 'uz' ? 'Masalan: Juft, Quti' : lang === 'ru' ? 'Например: Коробка, Пара' : 'e.g. Pair, Box'}
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                className="border-slate-200 dark:border-slate-700 focus-visible:ring-violet-500 flex-1"
              />
              <Button
                type="submit"
                disabled={!newUnit.trim() || isAdding}
                className="bg-violet-600 hover:bg-violet-700 text-white shrink-0 cursor-pointer disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4 mr-1" />
                {tCommon('add') || 'Add'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* List Table */}
      <Card className="border-slate-200/60 dark:border-slate-700 shadow-sm animate-in fade-in duration-300">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-200">
            {t('unit')}
          </CardTitle>
          <CardDescription>
            {lang === 'uz' ? 'Tizimda mavjud barcha o\'lchov birliklari ro\'yxati' : lang === 'ru' ? 'Список всех единиц измерения в системе' : 'Directory of all active measurement units'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-slate-100 dark:border-slate-700 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
                <TableRow>
                  <TableHead className="w-10 text-center font-semibold text-slate-600 dark:text-slate-300">#</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-300">{lang === 'uz' ? 'O\'lchov birligi nomi' : lang === 'ru' ? 'Название единицы' : 'Unit Name'}</TableHead>
                  <TableHead className="w-[100px] font-semibold text-slate-600 dark:text-slate-300 text-right">{lang === 'uz' ? 'Harakatlar' : lang === 'ru' ? 'Действия' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.length === 0 ? (
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
                    const isEditing = editingId === u.id
                    return (
                      <TableRow key={u.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/30 transition-colors">
                        <TableCell className="text-center font-medium text-slate-500 dark:text-slate-400 text-xs">
                          {(currentPage - 1) * itemsPerPage + index + 1}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                          {isEditing ? (
                            <Input
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              className="h-8 py-1 px-2 text-sm border-slate-200 dark:border-slate-700 focus-visible:ring-violet-500 max-w-[200px]"
                              autoFocus
                            />
                          ) : (
                            u.name
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleSaveEdit(u)}
                                className="h-8 w-8 text-emerald-600 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer"
                                title={tCommon('save') || 'Save'}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingId(null)
                                  setEditingValue('')
                                }}
                                className="h-8 w-8 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
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
                                  setEditingId(u.id)
                                  setEditingValue(u.name)
                                }}
                                className="h-8 w-8 text-violet-600 dark:text-violet-400 hover:text-violet-900 dark:hover:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30 cursor-pointer"
                                title={tCommon('edit') || 'Edit'}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteUnit(u.id)}
                                className="h-8 w-8 text-rose-600 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
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
