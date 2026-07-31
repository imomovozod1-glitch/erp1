'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Wallet, Plus, Trash2, Edit2, AlertCircle, Info, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface Cashbox {
  id: string
  name: string
  balance: number
  description: string
  created_at: string
}

export function CashboxClient({ lang }: { lang: string }) {
  const t = useTranslations('finance')
  const tCommon = useTranslations('common')
  const supabase = createClient() as any

  const [cashboxes, setCashboxes] = useState<Cashbox[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLocalStorageFallback, setIsLocalStorageFallback] = useState(false)
  const [search, setSearch] = useState('')

  // Modal form states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCashbox, setEditingCashbox] = useState<Cashbox | null>(null)
  const [name, setName] = useState('')
  const [balance, setBalance] = useState('')
  const [description, setDescription] = useState('')

  const fetchCashboxes = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('cashboxes')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(error.message)
      }

      setCashboxes(data || [])
      setIsLocalStorageFallback(false)
    } catch (err: any) {
      console.warn('Supabase fetch failed, falling back to LocalStorage:', err.message)
      setIsLocalStorageFallback(true)

      const localData = localStorage.getItem('erp_cashboxes')
      if (localData) {
        setCashboxes(JSON.parse(localData))
      } else {
        const seedData: Cashbox[] = [
          {
            id: 'local-1',
            name: 'Asosiy Kassa',
            balance: 15000000,
            description: "Kompaniyaning asosiy naqd pul g'aznasi",
            created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: 'local-2',
            name: 'Filial Kassasi (Yunusobod)',
            balance: 5000000,
            description: 'Yunusobod filialining naqd pul aylanmasi uchun',
            created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ]
        localStorage.setItem('erp_cashboxes', JSON.stringify(seedData))
        setCashboxes(seedData)
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCashboxes()
  }, [])

  const handleOpenAddModal = () => {
    setEditingCashbox(null)
    setName('')
    setBalance('0')
    setDescription('')
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (cb: Cashbox) => {
    setEditingCashbox(cb)
    setName(cb.name)
    setBalance(cb.balance.toString())
    setDescription(cb.description)
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error(tCommon('required'))
      return
    }

    const numBalance = Number(balance) || 0

    if (isLocalStorageFallback) {
      let updated: Cashbox[]
      if (editingCashbox) {
        updated = cashboxes.map((cb) =>
          cb.id === editingCashbox.id
            ? {
                ...cb,
                name: name.trim(),
                description: description.trim(),
              }
            : cb
        )
      } else {
        const newCb: Cashbox = {
          id: 'local-' + Math.random().toString(36).substr(2, 9),
          name: name.trim(),
          balance: numBalance,
          description: description.trim(),
          created_at: new Date().toISOString(),
        }
        updated = [newCb, ...cashboxes]
      }
      localStorage.setItem('erp_cashboxes', JSON.stringify(updated))
      setCashboxes(updated)
      toast.success(tCommon('success'))
      setIsModalOpen(false)
    } else {
      try {
        if (editingCashbox) {
          const { error } = await supabase
            .from('cashboxes')
            .update({
              name: name.trim(),
              description: description.trim(),
            })
            .eq('id', editingCashbox.id)
          if (error) throw error
        } else {
          const { error } = await supabase.from('cashboxes').insert([
            {
              name: name.trim(),
              balance: numBalance,
              description: description.trim(),
            },
          ])
          if (error) throw error
        }
        toast.success(tCommon('success'))
        setIsModalOpen(false)
        fetchCashboxes()
      } catch (err: any) {
        toast.error(err.message || tCommon('error'))
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm(lang === 'uz' ? "Ushbu kassani o'chirishni xohlaysizmi?" : lang === 'ru' ? "Удалить эту кассу?" : "Are you sure you want to delete this cashbox?")) {
      if (isLocalStorageFallback) {
        const updated = cashboxes.filter((cb) => cb.id !== id)
        localStorage.setItem('erp_cashboxes', JSON.stringify(updated))
        setCashboxes(updated)
        toast.success(tCommon('success'))
      } else {
        try {
          const { error } = await supabase.from('cashboxes').delete().eq('id', id)
          if (error) throw error
          toast.success(tCommon('success'))
          fetchCashboxes()
        } catch (err: any) {
          toast.error(err.message || tCommon('error'))
        }
      }
    }
  }

  const totalBalance = cashboxes.reduce((sum, cb) => sum + (Number(cb.balance) || 0), 0)

  const filteredCashboxes = cashboxes.filter((cb) =>
    cb.name.toLowerCase().includes(search.toLowerCase()) ||
    cb.description.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {isLocalStorageFallback && (
        <div className="flex gap-3 bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-sm animate-in fade-in slide-in-from-top-1 duration-200">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="space-y-1">
            <p className="font-semibold">
              {lang === 'uz' 
                ? "Supabase ma'lumotlar bazasida 'cashboxes' jadvali topilmadi."
                : lang === 'ru'
                ? "В базе данных Supabase не найдена таблица 'cashboxes'."
                : "The 'cashboxes' table was not found in your Supabase database."}
            </p>
            <p className="opacity-90">
              {lang === 'uz'
                ? "Ushbu sahifa hozirda brauzerning LocalStorage xotirasidan foydalanmoqda. Ma'lumotlarni doimiy saqlash uchun supabase/schema.sql fayli oxiridagi SQL kodini Supabase SQL Editor orqali ishga tushiring."
                : lang === 'ru'
                ? "Эта страница временно работает через локальное хранилище LocalStorage. Для полноценного сохранения данных выполните SQL скрипт в конце файла supabase/schema.sql в редакторе SQL в панели управления Supabase."
                : "This page is temporarily running on local LocalStorage. For persistent cloud storage, run the SQL script appended to supabase/schema.sql in your Supabase SQL Editor."}
            </p>
          </div>
        </div>
      )}

      {/* Aggregate Stats Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-indigo-500 to-indigo-600 text-white relative overflow-hidden group">
          <div className="absolute right-0 top-0 h-28 w-28 translate-x-4 -translate-y-4 rounded-full bg-white opacity-10 group-hover:scale-110 transition-transform duration-300" />
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <span className="text-xs uppercase tracking-wider font-medium text-indigo-100">{t('balance')} ({t('cashboxes')})</span>
                <h3 className="text-3xl font-extrabold tracking-tight">
                  {formatCurrency(totalBalance)}
                </h3>
              </div>
              <div className="p-3 bg-white/10 rounded-xl text-white">
                <Wallet className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-indigo-100 opacity-90">
              <span>{cashboxes.length} {t('cashboxes').toLowerCase()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions and List Grid */}
      <Card className="border-0 shadow-sm bg-white rounded-xl">
        <CardHeader className="p-6 pb-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-bold text-slate-800">{t('cashboxes')}</CardTitle>
            <CardDescription>{lang === 'uz' ? "Moliya kassalari va ularning qoldiqlari ro'yxati" : "Список касс и их остатков"}</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`${tCommon('search')}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 border-slate-200"
              />
            </div>
            <Button onClick={handleOpenAddModal} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-9 rounded-lg">
              <Plus className="h-4 w-4" />
              {t('addCashbox')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="p-4 pl-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('cashboxName')}</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{tCommon('description')}</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">{t('balance')}</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{tCommon('date')}</th>
                  <th className="p-4 pr-6 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-400 text-sm">
                      {tCommon('loading')}...
                    </td>
                  </tr>
                ) : filteredCashboxes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <Wallet className="h-8 w-8 opacity-40 text-slate-400" />
                        <p className="text-sm">{tCommon('noData')}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCashboxes.map((cb) => (
                    <tr key={cb.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="p-4 pl-6 font-semibold text-slate-800">{cb.name}</td>
                      <td className="p-4 text-sm text-slate-500 max-w-xs truncate">{cb.description || '—'}</td>
                      <td className="p-4 font-bold text-slate-800 text-right text-emerald-600">{formatCurrency(cb.balance)}</td>
                      <td className="p-4 text-sm text-slate-500">{formatDate(cb.created_at)}</td>
                      <td className="p-4 pr-6 flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleOpenEditModal(cb)}
                          className="h-8 w-8 text-slate-500 hover:text-indigo-600 rounded-md"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDelete(cb.id)}
                          className="h-8 w-8 text-slate-500 hover:text-rose-600 rounded-md"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl border shadow-xl p-6 relative animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4">
              {editingCashbox ? (lang === 'uz' ? "Kassani tahrirlash" : "Редактировать кассу") : t('addCashbox')}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cb_name">{t('cashboxName')} *</Label>
                <Input
                  id="cb_name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={lang === 'uz' ? "Masalan: Asosiy G'azna" : "Например: Основная Касса"}
                  required
                />
              </div>

              {!editingCashbox && (
                <div className="space-y-2">
                  <Label htmlFor="cb_balance">{t('initialBalance')}</Label>
                  <Input
                    id="cb_balance"
                    type="number"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    min="0"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="cb_desc">{tCommon('description')}</Label>
                <Textarea
                  id="cb_desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={tCommon('description')}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg h-9"
                >
                  {tCommon('cancel')}
                </Button>
                <Button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-9"
                >
                  {tCommon('save')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
