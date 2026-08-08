'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  Wallet, 
  Plus, 
  Minus, 
  Trash2, 
  Edit2, 
  AlertCircle, 
  Info, 
  Search, 
  TrendingUp, 
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Landmark,
  Coins,
  Receipt
} from 'lucide-react'
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

  // Employee payroll states
  const [employees, setEmployees] = useState<any[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')

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

  const fetchEmployees = async (fallback: boolean) => {
    try {
      if (fallback) {
        const localEmp = localStorage.getItem('erp_employees')
        if (localEmp) setEmployees(JSON.parse(localEmp))
      } else {
        const { data, error } = await supabase
          .from('employees')
          .select('id, employee_code, profiles(full_name)')
          .eq('is_active', true)
        if (!error && data) {
          const formatted = data.map((emp: any) => ({
            id: emp.id,
            name: emp.profiles?.full_name || emp.employee_code || 'Xodim'
          }))
          setEmployees(formatted)
        }
      }
    } catch (err: any) {
      console.warn('Failed to fetch employees:', err.message)
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
          debt = 0
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
        const seedData: Cashbox[] = []
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
    // Avoid calling setState synchronously within the effect body
    const timer = setTimeout(() => {
      fetchCashboxes().then((fallback) => {
        fetchCustomers(fallback)
        fetchEmployees(fallback)
      })
    }, 0)
    
    return () => clearTimeout(timer)
  }, [])

  // Auto-routing parameters checking
  useEffect(() => {
    if (cashboxes.length === 0) return

    const action = searchParams.get('action')
    const type = searchParams.get('type')
    const customerId = searchParams.get('customerId')

    if (action === 'kirim') {
      setTimeout(() => {
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
      }, 0)
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
    const cashbox = cashboxes.find(cb => cb.id === id);
    if (cashbox && cashbox.balance > 0) {
      toast.error(lang === 'uz' ? 'Puli bor kassani o\'chirib bo\'lmaydi' : 'Cannot delete cashbox with balance > 0');
      return;
    }
    
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
    setSelectedEmployeeId('')
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

    if (txCategory === 'salary' && !selectedEmployeeId) {
      toast.error(lang === 'uz' ? "Iltimos, xodimni tanlang" : lang === 'ru' ? "Пожалуйста, выберите сотрудника" : "Please select an employee")
      return
    }

    if ((txCategory === 'debt_collection' || (txType === 'expense' && txCategory === 'sales')) && !selectedCustomerId) {
      toast.error(lang === 'uz' ? "Iltimos, mijozni tanlang" : lang === 'ru' ? "Пожалуйста, выберите клиента" : "Please select a customer")
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

    let finalDescription = txDescription.trim() || null
    if (txCategory === 'salary' && selectedEmployeeId) {
      const emp = employees.find(e => e.id === selectedEmployeeId)
      if (emp) {
        finalDescription = txDescription.trim() 
          ? `${txDescription.trim()} (Xodim: ${emp.name})` 
          : `Maosh - ${emp.name}`
      }
    } else if ((txCategory === 'sales' || txCategory === 'debt_collection') && selectedCustomerId) {
      const cust = customers.find(c => c.id === selectedCustomerId)
      if (cust) {
        if (txCategory === 'sales') {
          finalDescription = txDescription.trim()
            ? `${txDescription.trim()} (Mijoz: ${cust.name})`
            : `${lang === 'uz' ? 'Sotuv' : lang === 'ru' ? 'Продажа' : 'Sales'} - ${cust.name}`
        }
      }
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
          description: finalDescription,
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
            description: finalDescription,
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
    { key: 'sales', label: t('categories.sales') },
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
        <div className="flex gap-3 bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl text-sm animate-in fade-in slide-in-from-top-1 duration-200">
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
        {/* Total Balance Card */}
        <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 text-white rounded-3xl p-6 shadow-xl shadow-indigo-500/10 relative overflow-hidden group hover:scale-[1.02] hover:shadow-indigo-500/20 transition-all duration-300">
          <div className="absolute right-0 top-0 h-32 w-32 translate-x-4 -translate-y-4 rounded-full bg-white/10 blur-xl group-hover:scale-110 transition-transform duration-300" />
          <div className="flex justify-between items-start">
            <div className="space-y-2.5">
              <span className="text-xs uppercase tracking-wider font-semibold text-indigo-200/90">{t('balance')} ({t('cashboxes')})</span>
              <h3 className="text-3xl font-extrabold tracking-tight">
                {formatCurrency(totalBalance)}
              </h3>
            </div>
            <div className="p-3 bg-white/15 backdrop-blur-md rounded-2xl text-white shadow-inner">
              <Wallet className="h-6 w-6 animate-pulse" />
            </div>
          </div>
          <div className="mt-6 flex items-center gap-1.5 text-xs text-indigo-200">
            <Coins className="h-4 w-4" />
            <span className="font-medium">{cashboxes.length} {t('cashboxes').toLowerCase()}</span>
          </div>
        </div>

        {/* Total Income Card */}
        <div className="bg-gradient-to-br from-emerald-50 via-emerald-100/80 to-teal-50 text-emerald-955 rounded-3xl p-6 border border-emerald-250/50 shadow-md relative overflow-hidden group hover:scale-[1.02] hover:shadow-lg transition-all duration-300">
          <div className="absolute right-0 top-0 h-32 w-32 translate-x-4 -translate-y-4 rounded-full bg-emerald-500/5 blur-xl group-hover:scale-110 transition-transform duration-300" />
          <div className="flex justify-between items-start">
            <div className="space-y-2.5">
              <span className="text-xs uppercase tracking-wider font-semibold text-emerald-700">{lang === 'uz' ? 'Jami Kirim' : lang === 'ru' ? 'Всего Приход' : 'Total Income'}</span>
              <h3 className="text-2xl font-extrabold tracking-tight text-emerald-900">
                {formatCurrency(totalIncome)}
              </h3>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-700 border border-emerald-500/10">
              <ArrowUpRight className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
          <div className="mt-6 flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
            <TrendingUp className="h-4 w-4" />
            <span>{lang === 'uz' ? 'Moliya oqimi' : 'Денежный приток'}</span>
          </div>
        </div>

        {/* Total Expense Card */}
        <div className="bg-gradient-to-br from-rose-50 via-rose-100/80 to-orange-50 text-rose-955 rounded-3xl p-6 border border-rose-250/50 shadow-md relative overflow-hidden group hover:scale-[1.02] hover:shadow-lg transition-all duration-300">
          <div className="absolute right-0 top-0 h-32 w-32 translate-x-4 -translate-y-4 rounded-full bg-rose-500/5 blur-xl group-hover:scale-110 transition-transform duration-300" />
          <div className="flex justify-between items-start">
            <div className="space-y-2.5">
              <span className="text-xs uppercase tracking-wider font-semibold text-rose-700">{lang === 'uz' ? 'Jami Chiqim' : lang === 'ru' ? 'Всего Расход' : 'Total Expense'}</span>
              <h3 className="text-2xl font-extrabold tracking-tight text-rose-900">
                {formatCurrency(totalExpense)}
              </h3>
            </div>
            <div className="p-3 bg-rose-500/10 rounded-2xl text-rose-700 border border-rose-500/10">
              <ArrowDownRight className="h-6 w-6 text-rose-600" />
            </div>
          </div>
          <div className="mt-6 flex items-center gap-1.5 text-xs text-rose-600 font-semibold">
            <TrendingDown className="h-4 w-4" />
            <span>{lang === 'uz' ? 'Moliya chiqishi' : 'Денежный отток'}</span>
          </div>
        </div>
      </div>

      {/* Top Main Buttons for quick Kirim/Chiqim */}
      <div className="flex items-center justify-between p-5 bg-white rounded-3xl border border-slate-100 shadow-sm flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-slate-800">{lang === 'uz' ? 'Tezkor tranzaksiya operatsiyalari' : 'Быстрые транзакционные операции'}</span>
          <span className="text-xs text-muted-foreground">{lang === 'uz' ? 'Kassalarga tezkor ravishda kirim yoki chiqim kiritish' : 'Быстрое внесение прихода или расхода в кассы'}</span>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => {
              const targetCb = cashboxes.find(c => c.name.toLowerCase().includes('asosiy') || c.name.toLowerCase().includes('main')) || cashboxes[0];
              if (targetCb) {
                handleOpenTransactionModal(targetCb, 'income')
              } else {
                toast.error(lang === 'uz' ? "Kirim qilish uchun kassa yarating!" : "Создайте кассу для прихода!")
              }
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl flex items-center gap-2 h-10 px-5 transition-all shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" />
            {lang === 'uz' ? 'Kirim kiritish' : lang === 'ru' ? 'Внести приход' : 'Kirim'}
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
            className="bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl flex items-center gap-2 h-10 px-5 transition-all shadow-md shadow-rose-500/10 hover:shadow-rose-500/20 hover:-translate-y-0.5"
          >
            <Minus className="h-4 w-4" />
            {lang === 'uz' ? 'Chiqim kiritish' : lang === 'ru' ? 'Внести расход' : 'Chiqim'}
          </Button>
        </div>
      </div>

      {/* Actions and List Grid */}
      <Card className="border border-slate-100 shadow-sm bg-white rounded-3xl overflow-hidden">
        <CardHeader className="p-6 pb-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Landmark className="h-5 w-5 text-indigo-600" />
              {t('cashboxes')}
            </CardTitle>
            <CardDescription className="text-xs">{lang === 'uz' ? "Moliya kassalari va ularning qoldiqlari ro'yxati" : "Список касс и их остатков"}</CardDescription>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder={`${tCommon('search')}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 border-slate-200 rounded-xl text-xs"
              />
            </div>
            <Button onClick={handleOpenAddModal} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-9 px-4 rounded-xl text-xs font-semibold shadow-sm shadow-indigo-500/10 hover:shadow-indigo-500/25">
              <Plus className="h-4 w-4" />
              {t('addCashbox')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100">
                  <th className="p-4 pl-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('cashboxName')}</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{tCommon('description')}</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">{t('balance')}</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{tCommon('date')}</th>
                  <th className="p-4 pr-6 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">{lang === 'uz' ? 'Amallar' : lang === 'ru' ? 'Действия' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {isLoading && cashboxes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-400 text-sm">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                        <span>{tCommon('loading')}...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredCashboxes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-400">
                      <div className="flex flex-col items-center gap-2 py-4">
                        <Wallet className="h-10 w-10 opacity-30 text-slate-400" />
                        <p className="text-sm font-semibold">{tCommon('noData')}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCashboxes.map((cb) => {
                    const isMain = cb.name.toLowerCase().includes('asosiy') || cb.name.toLowerCase().includes('main')
                    return (
                      <tr key={cb.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="p-4 pl-6 font-semibold text-slate-800">
                          <div className="flex items-center gap-2.5">
                            <div className={`p-1.5 rounded-lg ${isMain ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-105 text-slate-600'}`}>
                              <Landmark className="h-4 w-4" />
                            </div>
                            <span className="group-hover:text-indigo-600 transition-colors">{cb.name}</span>
                          </div>
                        </td>
                        <td className="p-4 text-xs text-slate-500 max-w-xs truncate">{cb.description || '—'}</td>
                        <td className="p-4 font-bold text-right text-indigo-600 text-base">{formatCurrency(cb.balance)}</td>
                        <td className="p-4 text-xs text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{formatDate(cb.created_at)}</span>
                          </div>
                        </td>
                        <td className="p-4 pr-6 flex justify-end items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleOpenTransactionModal(cb, 'income')}
                            className="h-8 border-emerald-100 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-800 font-semibold text-xs rounded-xl transition-all px-3 hover:-translate-y-0.5 shadow-sm"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            {lang === 'uz' ? 'Kirim' : lang === 'ru' ? 'Приход' : 'Income'}
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleOpenTransactionModal(cb, 'expense')}
                            className="h-8 border-rose-100 text-rose-700 bg-rose-50 hover:bg-rose-100 hover:text-rose-800 font-semibold text-xs rounded-xl transition-all px-3 hover:-translate-y-0.5 shadow-sm"
                          >
                            <Minus className="h-3 w-3 mr-1" />
                            {lang === 'uz' ? 'Chiqim' : lang === 'ru' ? 'Расход' : 'Expense'}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleOpenEditModal(cb)}
                            className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDelete(cb.id)}
                            className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

      {/* Transaction History Card */}
      <Card className="border border-slate-100 shadow-sm bg-white rounded-3xl overflow-hidden">
        <CardHeader className="p-6 pb-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Receipt className="h-5 w-5 text-indigo-600" />
              {t('transactions')}
            </CardTitle>
            <CardDescription className="text-xs">
              {lang === 'uz' 
                ? "Kassalar bo'yicha kirim va chiqim operatsiyalari tarixi" 
                : lang === 'ru'
                ? "История приходных и расходных операций по кассам"
                : "History of incoming and outgoing operations across cash registers"}
            </CardDescription>
          </div>
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={`${tCommon('search')}...`}
              value={txSearch}
              onChange={(e) => setTxSearch(e.target.value)}
              className="pl-9 h-9 border-slate-200 rounded-xl text-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100">
                  <th className="p-4 pl-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{tCommon('date')}</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('cashbox')}</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('type')}</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('category')}</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{tCommon('description')}</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">{tCommon('amount')}</th>
                  <th className="p-4 pr-6 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {isLoading && transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400 text-sm">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                        <span>{tCommon('loading')}...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      <div className="flex flex-col items-center gap-2 py-4">
                        <TrendingUp className="h-10 w-10 opacity-30 text-slate-400" />
                        <p className="text-sm font-semibold">{tCommon('noData')}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => {
                    const cbName = cashboxes.find(c => c.id === tx.reference_id)?.name || 'Kassa'
                    const isIncome = tx.type === 'income'
                    return (
                      <tr 
                        key={tx.id} 
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                        onClick={() => router.push(`/${lang}/finance/transactions/${tx.id}/edit`)}
                      >
                        <td className="p-4 pl-6 text-xs text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            <span>{formatDate(tx.transaction_date)}</span>
                          </div>
                        </td>
                        <td className="p-4 font-semibold text-slate-800">{cbName}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                            isIncome 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' 
                              : 'bg-rose-50 text-rose-700 border border-rose-200/50'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isIncome ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            {isIncome ? (lang === 'uz' ? 'Kirim' : 'Приход') : (lang === 'uz' ? 'Chiqim' : 'Расход')}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs bg-slate-105 text-slate-750 font-semibold border border-slate-200/30">
                            {tx.category}
                          </span>
                        </td>
                        <td className="p-4 text-xs text-slate-500 max-w-xs truncate">{tx.description || '—'}</td>
                        <td className={`p-4 font-extrabold text-right text-base ${
                          isIncome ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                        </td>
                        {/* <td className="p-4 pr-6 flex justify-end">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDeleteTransaction(tx)}
                            className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td> */}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-100 shadow-2xl p-7 relative animate-in zoom-in-95 duration-300 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Landmark className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  {editingCashbox ? (lang === 'uz' ? "Kassani tahrirlash" : "Редактировать кассу") : t('addCashbox')}
                </h3>
                <p className="text-xs text-muted-foreground">{lang === 'uz' ? "Kassa ma'lumotlarini kiriting" : "Введите параметры кассы"}</p>
              </div>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="cb_name" className="text-xs font-semibold text-slate-600">{t('cashboxName')} *</Label>
                <Input
                  id="cb_name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={lang === 'uz' ? "Masalan: Asosiy G'azna" : "Например: Основная Касса"}
                  required
                  className="rounded-xl border-slate-200 focus-visible:ring-indigo-500"
                />
              </div>

              {!editingCashbox && (
                <div className="space-y-1.5">
                  <Label htmlFor="cb_balance" className="text-xs font-semibold text-slate-600">{t('initialBalance')}</Label>
                  <NumericInput
                    id="cb_balance"
                    value={balance}
                    onChange={(val) => setBalance(val.toString())}
                    placeholder="0"
                    className="rounded-xl border-slate-200 focus-visible:ring-indigo-500"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="cb_desc" className="text-xs font-semibold text-slate-600">{tCommon('description')}</Label>
                <Textarea
                  id="cb_desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={tCommon('description')}
                  rows={3}
                  className="rounded-xl border-slate-200 focus-visible:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl h-10 px-4 font-semibold text-xs"
                >
                  {tCommon('cancel')}
                </Button>
                <Button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 px-5 font-semibold text-xs shadow-sm shadow-indigo-500/10 hover:shadow-indigo-500/25"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-100 shadow-2xl p-7 relative animate-in zoom-in-95 duration-300 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className={`p-2.5 rounded-xl ${txType === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {txType === 'income' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  {selectedCashboxForTx.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {txType === 'income'
                    ? (lang === 'uz' ? 'Kirim operatsiyasini kiritish' : lang === 'ru' ? 'Внести приходную операцию' : 'Register Income')
                    : (lang === 'uz' ? 'Chiqim operatsiyasini kiritish' : lang === 'ru' ? 'Внести расходную операцию' : 'Register Expense')
                  }
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded-2xl border border-slate-100/50 flex items-center justify-between text-xs text-slate-600">
              <span>{lang === 'uz' ? 'Joriy kassa qoldigʻi:' : lang === 'ru' ? 'Текущий остаток:' : 'Current balance:'}</span>
              <span className="font-bold text-slate-900 text-sm">{formatCurrency(selectedCashboxForTx.balance)}</span>
            </div>

            <form onSubmit={handleSaveTransaction} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="tx_category" className="text-xs font-semibold text-slate-600">{t('category')} *</Label>
                <Select value={txCategory} onValueChange={(val) => {
                  setTxCategory(val || '')
                  if (val !== 'debt_collection' && val !== 'sales') {
                    setSelectedCustomerId('')
                    setCustomerDebt(null)
                  }
                  if (val !== 'salary') {
                    setSelectedEmployeeId('')
                  }
                }}>
                  <SelectTrigger className="w-full rounded-xl border-slate-200 focus:ring-indigo-500">
                    <SelectValue placeholder={t('selectType')}>
                      {txCategory === 'custom' 
                        ? (lang === 'uz' ? 'Boshqa (Kiritish)' : lang === 'ru' ? 'Другое (Вручную)' : 'Other (Custom)')
                        : txCategory === 'debt_collection'
                        ? (lang === 'uz' ? "Mijozdan qarzini qaytarib olish" : lang === 'ru' ? "Возврат долга от клиента" : "Customer debt collection")
                        : t(`categories.${txCategory}`)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {(txType === 'income' ? incomeCategories : expenseCategories).map((cat) => (
                      <SelectItem key={cat.key} value={cat.key} className="rounded-lg">
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(txCategory === 'debt_collection' || (txType === 'expense' && txCategory === 'sales')) && (
                <div className="space-y-2 animate-in fade-in duration-200">
                  <Label htmlFor="tx_customer" className="text-xs font-semibold text-slate-600">{t('customer')} *</Label>
                  <Select 
                    value={selectedCustomerId} 
                    onValueChange={(val) => {
                      setSelectedCustomerId(val || '')
                      if (val && txCategory === 'debt_collection') fetchCustomerDebt(val, isLocalStorageFallback)
                    }}
                  >
                    <SelectTrigger className="w-full rounded-xl border-slate-200">
                      <SelectValue placeholder={lang === 'uz' ? 'Mijozni tanlang' : 'Выберите клиента'}>
                        {selectedCustomerId 
                          ? (customers.find(c => c.id === selectedCustomerId)?.name || '')
                          : (lang === 'uz' ? 'Mijozni tanlang' : 'Выберите клиента')}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="rounded-lg">
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {txCategory === 'debt_collection' && selectedCustomerId && (
                    <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3.5 mt-2 flex items-center justify-between text-xs text-rose-800 animate-in slide-in-from-top-1 duration-200">
                      <span className="font-medium">{lang === 'uz' ? 'Umumiy qarzdorlik summasi:' : 'Общая сумма задолженности:'}</span>
                      <span className="font-extrabold text-sm">
                        {isLoadingDebt ? '...' : formatCurrency(customerDebt || 0)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {txCategory === 'salary' && (
                <div className="space-y-1.5 animate-in fade-in duration-200">
                  <Label htmlFor="tx_employee" className="text-xs font-semibold text-slate-600">
                    {lang === 'uz' ? 'Xodim' : lang === 'ru' ? 'Сотрудник' : 'Employee'} *
                  </Label>
                  <Select 
                    value={selectedEmployeeId} 
                    onValueChange={(val) => setSelectedEmployeeId(val || '')}
                  >
                    <SelectTrigger className="w-full rounded-xl border-slate-200">
                      <SelectValue placeholder={lang === 'uz' ? 'Xodimni tanlang' : 'Выберите сотрудника'}>
                        {selectedEmployeeId 
                          ? (employees.find(e => e.id === selectedEmployeeId)?.name || '')
                          : (lang === 'uz' ? 'Xodimni tanlang' : 'Выберите сотрудника')}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id} className="rounded-lg">
                          {emp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {txCategory === 'custom' && (
                <div className="space-y-1.5 animate-in fade-in duration-200">
                  <Label htmlFor="custom_category" className="text-xs font-semibold text-slate-600">{lang === 'uz' ? "Kategoriya nomi" : lang === 'ru' ? "Название категории" : "Category Name"} *</Label>
                  <Input
                    id="custom_category"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder={lang === 'uz' ? "Masalan: Dividend to'lovi" : lang === 'ru' ? "Например: Выплата дивидендов" : "e.g. Dividend payment"}
                    required
                    className="rounded-xl border-slate-200"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="tx_amount" className="text-xs font-semibold text-slate-600">{tCommon('amount')} *</Label>
                <NumericInput
                  id="tx_amount"
                  value={txAmount}
                  onChange={(val) => setTxAmount(val)}
                  placeholder="0.00"
                  required
                  autoFocus
                  className="rounded-xl border-slate-200 text-lg font-extrabold focus-visible:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tx_date" className="text-xs font-semibold text-slate-600">{tCommon('date')} *</Label>
                <div className="relative">
                  <Input
                    id="tx_date"
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    required
                    className="rounded-xl border-slate-200"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tx_desc" className="text-xs font-semibold text-slate-600">{tCommon('description')}</Label>
                <Textarea
                  id="tx_desc"
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  placeholder={tCommon('description')}
                  rows={2}
                  className="rounded-xl border-slate-200 focus-visible:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsTransactionModalOpen(false)}
                  className="rounded-xl h-10 px-4 font-semibold text-xs"
                >
                  {tCommon('cancel')}
                </Button>
                <Button
                  type="submit"
                  className={`${txType === 'income' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/10'} text-white rounded-xl h-10 px-5 font-semibold text-xs shadow-md transition-all hover:scale-[1.01]`}
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
