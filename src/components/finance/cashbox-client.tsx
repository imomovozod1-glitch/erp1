'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import { Wallet, Plus, Minus, Trash2, Edit2, AlertCircle, Info, Search, TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { NumericInput } from '@/components/ui/numeric-input'
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
  const router = useRouter()
  const searchParams = useSearchParams()

  const [cashboxes, setCashboxes] = useState<Cashbox[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLocalStorageFallback, setIsLocalStorageFallback] = useState(false)
  const [search, setSearch] = useState('')
  const [txSearch, setTxSearch] = useState('')

  // Modal form states for cashbox management
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCashbox, setEditingCashbox] = useState<Cashbox | null>(null)
  const [name, setName] = useState('')
  const [balance, setBalance] = useState('')
  const [description, setDescription] = useState('')

  // Modal states for Kirim (Income) / Chiqim (Expense)
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false)
  const [selectedCashboxForTx, setSelectedCashboxForTx] = useState<Cashbox | null>(null)
  const [txType, setTxType] = useState<'income' | 'expense'>('income')
  const [txAmount, setTxAmount] = useState<number | ''>('')
  const [txCategory, setTxCategory] = useState('')
  const [customCategory, setCustomCategory] = useState('')
  const [txDate, setTxDate] = useState('')
  const [txDescription, setTxDescription] = useState('')

  // Customer debt states
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [customerDebt, setCustomerDebt] = useState<number | null>(null)
  const [isLoadingDebt, setIsLoadingDebt] = useState(false)

  const fetchCustomers = async (fallback: boolean) => {
    try {
      if (fallback) {
        const localCust = localStorage.getItem('erp_customers')
        if (localCust) setCustomers(JSON.parse(localCust))
      } else {
        const { data, error } = await supabase
          .from('customers')
          .select('id, name')
          .eq('is_active', true)
          .order('name', { ascending: true })
        if (!error) setCustomers(data || [])
      }
    } catch (err: any) {
      console.warn('Failed to fetch customers:', err.message)
    }
  }

  const fetchCustomerDebt = async (cId: string, fallback: boolean) => {
    setIsLoadingDebt(true)
    try {
      if (fallback) {
        const localInvoicesStr = localStorage.getItem('erp_invoices')
        let debt = 0
        if (localInvoicesStr) {
          const localInvoices = JSON.parse(localInvoicesStr)
          const customerInvoices = localInvoices.filter((i: any) => i.customer_id === cId && i.status !== 'paid' && i.status !== 'cancelled')
          debt = customerInvoices.reduce((sum: number, i: any) => sum + ((Number(i.total_amount) || 0) - (Number(i.paid_amount) || 0)), 0)
        } else {
          debt = 1200000 // default mock debt
        }
        setCustomerDebt(debt)
      } else {
        const { data, error } = await supabase
          .from('invoices')
          .select('total_amount, paid_amount')
          .eq('customer_id', cId)
          .not('status', 'in', '("paid","cancelled")')
        
        if (error) throw error
        const debt = (data || []).reduce((sum: number, i: any) => sum + ((Number(i.total_amount) || 0) - (Number(i.paid_amount) || 0)), 0)
        setCustomerDebt(debt)
      }
    } catch (err: any) {
      console.error('Error fetching customer debt:', err.message)
      setCustomerDebt(0)
    } finally {
      setIsLoadingDebt(false)
    }
  }

  const fetchCashboxes = async () => {
    setIsLoading(true)
    let fallbackMode = false
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
      fallbackMode = false

      // Fetch transaction logs linked to cash registers
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('reference_type', 'cashbox')
        .order('created_at', { ascending: false })
      
      if (!txError) {
        setTransactions(txData || [])
      }
    } catch (err: any) {
      console.warn('Supabase fetch failed, falling back to LocalStorage:', err.message)
      setIsLocalStorageFallback(true)
      fallbackMode = true

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

      const localTxs = localStorage.getItem('erp_transactions')
      if (localTxs) {
        setTransactions(JSON.parse(localTxs))
      } else {
        setTransactions([])
      }
    } finally {
      setIsLoading(false)
    }
    return fallbackMode
  }

  useEffect(() => {
    fetchCashboxes().then((fallback) => {
      fetchCustomers(fallback)
    })
  }, [])

  // Auto-routing parameters checking
  useEffect(() => {
    if (cashboxes.length === 0) return

    const action = searchParams.get('action')
    const type = searchParams.get('type')
    const customerId = searchParams.get('customerId')

    if (action === 'kirim') {
      const targetCb = cashboxes.find(c => c.name.toLowerCase().includes('asosiy') || c.name.toLowerCase().includes('main')) || cashboxes[0]
      if (targetCb) {
        setSelectedCashboxForTx(targetCb)
        setTxType('income')
        setTxAmount('')
        setTxCategory(type || 'sales')
        setCustomCategory('')
        setTxDate(new Date().toISOString().split('T')[0])
        setTxDescription('')
        setIsTransactionModalOpen(true)
        
        if (type === 'debt_collection' && customerId) {
          setSelectedCustomerId(customerId)
          fetchCustomerDebt(customerId, isLocalStorageFallback)
        }
      }
      
      // Clear URL params to avoid re-triggering on refresh
      const newUrl = window.location.pathname
      window.history.replaceState({}, '', newUrl)
    }
  }, [searchParams, cashboxes, isLocalStorageFallback])

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

  // Kirim/Chiqim modals trigger
  const handleOpenTransactionModal = (cb: Cashbox, type: 'income' | 'expense') => {
    setSelectedCashboxForTx(cb)
    setTxType(type)
    setTxAmount('')
    setTxCategory(type === 'income' ? 'sales' : 'salary')
    setCustomCategory('')
    setTxDate(new Date().toISOString().split('T')[0])
    setTxDescription('')
    setSelectedCustomerId('')
    setCustomerDebt(null)
    setIsTransactionModalOpen(true)
  }

  // Save transaction and adjust balance
  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCashboxForTx || !txAmount || Number(txAmount) <= 0) {
      toast.error(tCommon('required'))
      return
    }

    const numAmount = Number(txAmount)
    
    // Determine category text display name
    let categoryText = ""
    if (txCategory === 'custom') {
      categoryText = customCategory.trim()
    } else if (txCategory === 'debt_collection') {
      categoryText = lang === 'uz' ? "Mijozdan qarzini qaytarib olish" : lang === 'ru' ? "Возврат долга от клиента" : "Customer debt collection"
    } else {
      categoryText = t(`categories.${txCategory}`)
    }
    
    if (!categoryText) {
      toast.error(tCommon('required'))
      return
    }

    setIsLoading(true)
    try {
      const balanceChange = txType === 'income' ? numAmount : -numAmount
      const updatedBalance = Number(selectedCashboxForTx.balance) + balanceChange

      // Special handling for Customer Debt collection - subtract from customer's unpaid invoices
      if (txCategory === 'debt_collection' && selectedCustomerId) {
        let paymentRemaining = numAmount

        if (isLocalStorageFallback) {
          const localInvoicesStr = localStorage.getItem('erp_invoices')
          if (localInvoicesStr) {
            const localInvoices = JSON.parse(localInvoicesStr)
            
            // Filter and sort unpaid invoices for this customer by due date ascending
            const unpaidInvoices = localInvoices
              .filter((i: any) => i.customer_id === selectedCustomerId && i.status !== 'paid' && i.status !== 'cancelled')
              .sort((a: any, b: any) => new Date(a.due_at || a.created_at).getTime() - new Date(b.due_at || b.created_at).getTime())

            for (const inv of unpaidInvoices) {
              if (paymentRemaining <= 0) break
              
              const unpaidAmount = (Number(inv.total_amount) || 0) - (Number(inv.paid_amount) || 0)
              
              if (paymentRemaining >= unpaidAmount) {
                inv.paid_amount = inv.total_amount
                inv.status = 'paid'
                inv.paid_at = txDate
                paymentRemaining -= unpaidAmount
              } else {
                inv.paid_amount = (Number(inv.paid_amount) || 0) + paymentRemaining
                paymentRemaining = 0
              }
            }
            localStorage.setItem('erp_invoices', JSON.stringify(localInvoices))
          }
        } else {
          // Fetch unpaid invoices
          const { data: unpaidInvoices, error: fetchInvErr } = await supabase
            .from('invoices')
            .select('*')
            .eq('customer_id', selectedCustomerId)
            .not('status', 'in', '("paid","cancelled")')
            .order('due_at', { ascending: true })

          if (fetchInvErr) throw fetchInvErr

          for (const inv of (unpaidInvoices || [])) {
            if (paymentRemaining <= 0) break

            const unpaidAmount = (Number(inv.total_amount) || 0) - (Number(inv.paid_amount) || 0)

            if (paymentRemaining >= unpaidAmount) {
              const { error: updateInvErr } = await supabase
                .from('invoices')
                .update({
                  paid_amount: inv.total_amount,
                  status: 'paid',
                  paid_at: txDate
                })
                .eq('id', inv.id)
              
              if (updateInvErr) throw updateInvErr
              paymentRemaining -= unpaidAmount
            } else {
              const newPaidAmount = (Number(inv.paid_amount) || 0) + paymentRemaining
              const { error: updateInvErr } = await supabase
                .from('invoices')
                .update({
                  paid_amount: newPaidAmount
                })
                .eq('id', inv.id)

              if (updateInvErr) throw updateInvErr
              paymentRemaining = 0
            }
          }
        }
      }

      if (isLocalStorageFallback) {
        // Update local cashboxes
        const updatedCashboxes = cashboxes.map(cb => 
          cb.id === selectedCashboxForTx.id ? { ...cb, balance: updatedBalance } : cb
        )
        localStorage.setItem('erp_cashboxes', JSON.stringify(updatedCashboxes));
        setCashboxes(updatedCashboxes);

        // Add local transaction log
        const newTx = {
          id: 'local-tx-' + Math.random().toString(36).substr(2, 9),
          type: txType,
          amount: numAmount,
          category: categoryText,
          description: txDescription.trim() || null,
          reference_type: 'cashbox',
          reference_id: selectedCashboxForTx.id,
          transaction_date: txDate,
          created_at: new Date().toISOString(),
        }
        const updatedTxs = [newTx, ...transactions]
        localStorage.setItem('erp_transactions', JSON.stringify(updatedTxs));
        setTransactions(updatedTxs);

        toast.success(tCommon('success'))
        setIsTransactionModalOpen(false)
      } else {
        const { data: userData } = await supabase.auth.getUser()
        const userId = userData?.user?.id

        if (!userId) {
          toast.error('User session not found')
          return
        }

        // Update cashbox
        const { error: cbErr } = await supabase
          .from('cashboxes')
          .update({ balance: updatedBalance })
          .eq('id', selectedCashboxForTx.id)
        
        if (cbErr) throw cbErr

        // Insert transaction
        const { error: txErr } = await supabase
          .from('transactions')
          .insert([{
            type: txType,
            amount: numAmount,
            category: categoryText,
            description: txDescription.trim() || null,
            reference_type: 'cashbox',
            reference_id: selectedCashboxForTx.id,
            transaction_date: txDate,
            created_by: userId
          }])
        
        if (txErr) throw txErr

        toast.success(tCommon('success'))
        setIsTransactionModalOpen(false)
        fetchCashboxes()
      }
    } catch (err: any) {
      toast.error(err.message || tCommon('error'))
    } finally {
      setIsLoading(false)
    }
  }

  // Delete transaction and revert balance change
  const handleDeleteTransaction = async (tx: any) => {
    const confirmMsg = lang === 'uz' 
      ? "Ushbu tranzaksiyani o'chirishni va tegishli kassa qoldig'ini qayta hisoblashni xohlaysizmi?" 
      : lang === 'ru'
      ? "Вы действительно хотите удалить эту транзакцию и пересчитать баланс кассы?"
      : "Are you sure you want to delete this transaction and recalculate the cash balance?"
    
    if (!confirm(confirmMsg)) {
      return
    }

    setIsLoading(true)
    try {
      const balanceChange = tx.type === 'income' ? -Number(tx.amount) : Number(tx.amount)

      if (isLocalStorageFallback) {
        // Update local cashboxes
        const updatedCashboxes = cashboxes.map(cb => 
          cb.id === tx.reference_id ? { ...cb, balance: Number(cb.balance) + balanceChange } : cb
        )
        localStorage.setItem('erp_cashboxes', JSON.stringify(updatedCashboxes));
        setCashboxes(updatedCashboxes);

        // Update local transactions
        const updatedTxs = transactions.filter(t => t.id !== tx.id)
        localStorage.setItem('erp_transactions', JSON.stringify(updatedTxs));
        setTransactions(updatedTxs);

        toast.success(tCommon('success'))
      } else {
        // Fetch cashbox balance
        const { data: cbData, error: cbFetchErr } = await supabase
          .from('cashboxes')
          .select('balance')
          .eq('id', tx.reference_id)
          .single()
        
        if (cbFetchErr) throw cbFetchErr

        const newBalance = Number(cbData.balance) + balanceChange

        // Update cashbox balance
        const { error: cbErr } = await supabase
          .from('cashboxes')
          .update({ balance: newBalance })
          .eq('id', tx.reference_id)
        
        if (cbErr) throw cbErr

        // Delete transaction
        const { error: txErr } = await supabase
          .from('transactions')
          .delete()
          .eq('id', tx.id)
        
        if (txErr) throw txErr

        toast.success(tCommon('success'))
        fetchCashboxes()
      }
    } catch (err: any) {
      toast.error(err.message || tCommon('error'))
    } finally {
      setIsLoading(false)
    }
  }

  // Predefined categories for UI selects
  const incomeCategories = [
    { key: 'sales', label: t('categories.sales') },
    { key: 'service', label: t('categories.service') },
    { key: 'debt_collection', label: lang === 'uz' ? "Mijozdan qarzini qaytarib olish" : lang === 'ru' ? "Возврат долга от клиента" : "Customer debt collection" },
    { key: 'other_income', label: t('categories.other_income') },
    { key: 'custom', label: lang === 'uz' ? 'Boshqa (Kiritish)' : lang === 'ru' ? 'Другое (Вручную)' : 'Other (Custom)' }
  ]

  const expenseCategories = [
    { key: 'salary', label: t('categories.salary') },
    { key: 'rent', label: t('categories.rent') },
    { key: 'utilities', label: t('categories.utilities') },
    { key: 'marketing', label: t('categories.marketing') },
    { key: 'supplies', label: t('categories.supplies') },
    { key: 'other_expense', label: t('categories.other_expense') },
    { key: 'custom', label: lang === 'uz' ? 'Boshqa (Kiritish)' : lang === 'ru' ? 'Другое (Вручную)' : 'Other (Custom)' }
  ]

  const totalBalance = cashboxes.reduce((sum, cb) => sum + (Number(cb.balance) || 0), 0)
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0)
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0)

  const filteredCashboxes = cashboxes.filter((cb) =>
    cb.name.toLowerCase().includes(search.toLowerCase()) ||
    cb.description.toLowerCase().includes(search.toLowerCase())
  )

  const filteredTransactions = transactions.filter((tx) => {
    const cbName = cashboxes.find(c => c.id === tx.reference_id)?.name || ''
    return (
      (tx.description ?? '').toLowerCase().includes(txSearch.toLowerCase()) ||
      tx.category.toLowerCase().includes(txSearch.toLowerCase()) ||
      cbName.toLowerCase().includes(txSearch.toLowerCase())
    )
  })

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

        <Card className="border-0 shadow-sm bg-emerald-50 text-emerald-900 relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <span className="text-xs uppercase tracking-wider font-medium text-emerald-700">{lang === 'uz' ? 'Jami Kirim' : lang === 'ru' ? 'Всего Приход' : 'Total Income'}</span>
                <h3 className="text-2xl font-extrabold tracking-tight text-emerald-800">
                  {formatCurrency(totalIncome)}
                </h3>
              </div>
              <div className="p-3 bg-emerald-100 rounded-xl text-emerald-700">
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-rose-50 text-rose-900 relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <span className="text-xs uppercase tracking-wider font-medium text-rose-700">{lang === 'uz' ? 'Jami Chiqim' : lang === 'ru' ? 'Всего Расход' : 'Total Expense'}</span>
                <h3 className="text-2xl font-extrabold tracking-tight text-rose-800">
                  {formatCurrency(totalExpense)}
                </h3>
              </div>
              <div className="p-3 bg-rose-100 rounded-xl text-rose-700">
                <TrendingDown className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Main Buttons for quick Kirim/Chiqim */}
      <div className="flex gap-4 p-4 bg-slate-50/50 rounded-xl border border-slate-100/80 flex-wrap">
        <Button
          onClick={() => {
            const targetCb = cashboxes.find(c => c.name.toLowerCase().includes('asosiy') || c.name.toLowerCase().includes('main')) || cashboxes[0];
            if (targetCb) {
              handleOpenTransactionModal(targetCb, 'income')
            } else {
              toast.error(lang === 'uz' ? "Kirim qilish uchun kassa yarating!" : "Создайте кассу для прихода!")
            }
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg flex items-center gap-2 h-10 px-6 transition-all shadow-sm hover:shadow hover:-translate-y-0.5"
        >
          <Plus className="h-5 w-5" />
          {lang === 'uz' ? 'Kirim' : lang === 'ru' ? 'Приход' : 'Kirim (Income)'}
        </Button>
        <Button
          onClick={() => {
            const targetCb = cashboxes.find(c => c.name.toLowerCase().includes('asosiy') || c.name.toLowerCase().includes('main')) || cashboxes[0];
            if (targetCb) {
              handleOpenTransactionModal(targetCb, 'expense')
            } else {
              toast.error(lang === 'uz' ? "Chiqim qilish uchun kassa yarating!" : "Создайте кассу для расхода!")
            }
          }}
          className="bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg flex items-center gap-2 h-10 px-6 transition-all shadow-sm hover:shadow hover:-translate-y-0.5"
        >
          <Minus className="h-5 w-5" />
          {lang === 'uz' ? 'Chiqim' : lang === 'ru' ? 'Расход' : 'Chiqim (Expense)'}
        </Button>
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
                  <th className="p-4 pr-6 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">{lang === 'uz' ? 'Amallar' : lang === 'ru' ? 'Действия' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading && cashboxes.length === 0 ? (
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
                      <td className="p-4 font-bold text-slate-800 text-right text-indigo-600">{formatCurrency(cb.balance)}</td>
                      <td className="p-4 text-sm text-slate-500">{formatDate(cb.created_at)}</td>
                      <td className="p-4 pr-6 flex justify-end items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleOpenTransactionModal(cb, 'income')}
                          className="h-8 border-emerald-200 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100/70 hover:text-emerald-800 font-medium text-xs rounded-lg transition-all px-2.5 hover:-translate-y-0.5"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {lang === 'uz' ? 'Kirim' : lang === 'ru' ? 'Приход' : 'Income'}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleOpenTransactionModal(cb, 'expense')}
                          className="h-8 border-rose-200 text-rose-700 bg-rose-50/50 hover:bg-rose-100/70 hover:text-rose-800 font-medium text-xs rounded-lg transition-all px-2.5 hover:-translate-y-0.5"
                        >
                          <Minus className="h-3 w-3 mr-1" />
                          {lang === 'uz' ? 'Chiqim' : lang === 'ru' ? 'Расход' : 'Expense'}
                        </Button>
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

      {/* Transaction Logs Card */}
      <Card className="border-0 shadow-sm bg-white rounded-xl">
        <CardHeader className="p-6 pb-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-bold text-slate-800">{t('transactions')}</CardTitle>
            <CardDescription>
              {lang === 'uz' 
                ? "Kassalar bo'yicha kirim va chiqim operatsiyalari tarixi" 
                : lang === 'ru'
                ? "История приходных и расходных операций по кассам"
                : "History of incoming and outgoing operations across cash registers"}
            </CardDescription>
          </div>
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`${tCommon('search')}...`}
              value={txSearch}
              onChange={(e) => setTxSearch(e.target.value)}
              className="pl-9 h-9 border-slate-200"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="p-4 pl-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">{tCommon('date')}</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('cashbox')}</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('type')}</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('category')}</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{tCommon('description')}</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">{tCommon('amount')}</th>
                  <th className="p-4 pr-6 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading && transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400 text-sm">
                      {tCommon('loading')}...
                    </td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <TrendingUp className="h-8 w-8 opacity-40 text-slate-400" />
                        <p className="text-sm">{tCommon('noData')}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => {
                    const cbName = cashboxes.find(c => c.id === tx.reference_id)?.name || 'Kassa'
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="p-4 pl-6 text-sm text-slate-500">{formatDate(tx.transaction_date)}</td>
                        <td className="p-4 font-semibold text-slate-800 text-sm">{cbName}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium uppercase ${
                            tx.type === 'income' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                          }`}>
                            {tx.type === 'income' ? '+' : '-'}{tx.type === 'income' ? (lang === 'uz' ? 'Kirim' : 'Приход') : (lang === 'uz' ? 'Chiqim' : 'Расход')}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs bg-slate-100 text-slate-700 font-medium">
                            {tx.category}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-slate-500 max-w-xs truncate">{tx.description || '—'}</td>
                        <td className={`p-4 font-bold text-right text-sm ${
                          tx.type === 'income' ? 'text-emerald-700' : 'text-rose-700'
                        }`}>
                          {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </td>
                        <td className="p-4 pr-6 flex justify-end">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDeleteTransaction(tx)}
                            className="h-8 w-8 text-slate-400 hover:text-rose-600 rounded-md"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Cashbox Add/Edit Modal */}
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

      {/* Kirim (Income) / Chiqim (Expense) Modal */}
      {isTransactionModalOpen && selectedCashboxForTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl border shadow-xl p-6 relative animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${txType === 'income' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              {selectedCashboxForTx.name} &mdash; {
                txType === 'income'
                  ? (lang === 'uz' ? 'Kirim qilish' : lang === 'ru' ? 'Внести приход' : 'Register Income')
                  : (lang === 'uz' ? 'Chiqim qilish' : lang === 'ru' ? 'Внести расход' : 'Register Expense')
              }
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {lang === 'uz' ? 'Joriy kassa qoldigʻi:' : lang === 'ru' ? 'Текущий остаток кассы:' : 'Current cash balance:'} <b>{formatCurrency(selectedCashboxForTx.balance)}</b>
            </p>
            <form onSubmit={handleSaveTransaction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tx_amount">{tCommon('amount')} *</Label>
                <NumericInput
                  id="tx_amount"
                  value={txAmount}
                  onChange={(val) => setTxAmount(val)}
                  placeholder="0.00"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tx_category">{t('category')} *</Label>
                <Select value={txCategory} onValueChange={(val) => {
                  setTxCategory(val || '')
                  if (val !== 'debt_collection') {
                    setSelectedCustomerId('')
                    setCustomerDebt(null)
                  }
                }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('selectType')}>
                      {txCategory === 'custom' 
                        ? (lang === 'uz' ? 'Boshqa (Kiritish)' : lang === 'ru' ? 'Другое (Вручную)' : 'Other (Custom)')
                        : txCategory === 'debt_collection'
                        ? (lang === 'uz' ? "Mijozdan qarzini qaytarib olish" : lang === 'ru' ? "Возврат долга от клиента" : "Customer debt collection")
                        : t(`categories.${txCategory}`)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(txType === 'income' ? incomeCategories : expenseCategories).map((cat) => (
                      <SelectItem key={cat.key} value={cat.key}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {txCategory === 'debt_collection' && (
                <div className="space-y-2">
                  <Label htmlFor="tx_customer">{t('customer')} *</Label>
                  <Select 
                    value={selectedCustomerId} 
                    onValueChange={(val) => {
                      setSelectedCustomerId(val || '')
                      if (val) fetchCustomerDebt(val, isLocalStorageFallback)
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={lang === 'uz' ? 'Mijozni tanlang' : 'Выберите клиента'}>
                        {selectedCustomerId 
                          ? (customers.find(c => c.id === selectedCustomerId)?.name || '')
                          : (lang === 'uz' ? 'Mijozni tanlang' : 'Выберите клиента')}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {selectedCustomerId && (
                    <div className="bg-rose-50/50 border border-rose-100 rounded-lg p-3 mt-2 flex items-center justify-between text-xs text-rose-800 animate-in fade-in duration-200">
                      <span>{lang === 'uz' ? 'Umumiy qarzdorlik summasi:' : 'Общая сумма задолженности:'}</span>
                      <span className="font-bold text-sm">
                        {isLoadingDebt ? '...' : formatCurrency(customerDebt || 0)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {txCategory === 'custom' && (
                <div className="space-y-2">
                  <Label htmlFor="custom_category">{lang === 'uz' ? "Kategoriya nomi" : lang === 'ru' ? "Название категории" : "Category Name"} *</Label>
                  <Input
                    id="custom_category"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder={lang === 'uz' ? "Masalan: Dividend to'lovi" : lang === 'ru' ? "Например: Выплата дивидендов" : "e.g. Dividend payment"}
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="tx_date">{tCommon('date')} *</Label>
                <Input
                  id="tx_date"
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tx_desc">{tCommon('description')}</Label>
                <Textarea
                  id="tx_desc"
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  placeholder={tCommon('description')}
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsTransactionModalOpen(false)}
                  className="rounded-lg h-9"
                >
                  {tCommon('cancel')}
                </Button>
                <Button
                  type="submit"
                  className={`${txType === 'income' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'} text-white rounded-lg h-9`}
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
