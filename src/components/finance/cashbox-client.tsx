'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  Wallet, 
  Plus, 
  Minus, 
  Trash2, 
  Edit2, 
  AlertCircle, 
  Search, 
  TrendingUp, 
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Landmark,
  Coins,
  Receipt,
  CreditCard,
  ArrowLeftRight,
  X
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { NumericInput } from '@/components/ui/numeric-input'
import { DatePicker } from '@/components/ui/date-picker'
import { PageHeader } from '@/components/shared/page-header'
import { CustomDateRangePicker } from '@/components/shared/custom-date-range-picker'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { invalidateTransactions, invalidateSuppliers, invalidateEmployees, invalidateCustomers, invalidateInvoices } from '@/lib/data/revalidate'
import { fireTelegramNotification } from '@/lib/integrations/notify-client'
import { toast } from 'sonner'

type CashboxType = 'cash' | 'card' | 'transfer' | 'other'
type Period = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'

const formatDateISO = (d: Date) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

interface Cashbox {
  id: string
  name: string
  balance: number
  type: CashboxType
  description: string
  created_at: string
}

interface TransactionCategory {
  id: string
  name: string
  type: 'income' | 'expense'
  person_type: 'employee' | 'supplier' | 'customer' | 'none'
}

export function CashboxClient({ lang }: { lang: string }) {
  const t = useTranslations('finance')
  const tCommon = useTranslations('common')
  const tInfo = useTranslations('pageInfo')
  const tDash = useTranslations('dashboard')
  const supabase = createClient() as any
  const router = useRouter()
  const searchParams = useSearchParams()

  const [cashboxes, setCashboxes] = useState<Cashbox[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLocalStorageFallback, setIsLocalStorageFallback] = useState(false)
  const [search, setSearch] = useState('')
  const [txSearch, setTxSearch] = useState('')

  // Time filter for the transaction history (and the Income/Expense stat cards),
  // same tab-style preset + CustomDateRangePicker combo as the dashboard.
  // `now` is captured once via a lazy initializer, not called bare in the render body,
  // since a fresh `new Date()` on every render trips the project's purity lint rule.
  const [now] = useState(() => new Date())
  const [period, setPeriod] = useState<Period>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('cashbox_period')
      if (saved === 'today' || saved === 'yesterday' || saved === 'week' || saved === 'month' || saved === 'all' || saved === 'custom') {
        return saved
      }
    }
    return 'all'
  })
  const [customStart, setCustomStart] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('cashbox_custom_start')
      if (saved) return saved
    }
    return formatDateISO(new Date()) + 'T00:00'
  })
  const [customEnd, setCustomEnd] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('cashbox_custom_end')
      if (saved) return saved
    }
    return formatDateISO(new Date()) + 'T23:59'
  })

  useEffect(() => {
    sessionStorage.setItem('cashbox_period', period)
    sessionStorage.setItem('cashbox_custom_start', customStart)
    sessionStorage.setItem('cashbox_custom_end', customEnd)
  }, [period, customStart, customEnd])

  const handleApplyCustomRange = (start: string, end: string) => {
    setCustomStart(start)
    setCustomEnd(end)
    setPeriod('custom')
  }

  // Modal form states for cashbox management
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCashbox, setEditingCashbox] = useState<Cashbox | null>(null)
  const [name, setName] = useState('')
  const [balance, setBalance] = useState('')
  const [cbType, setCbType] = useState<CashboxType>('cash')
  const [description, setDescription] = useState('')
  const [isSavingCashbox, setIsSavingCashbox] = useState(false)

  // Transaction categories (manageable, like inventory categories — see /finance/categories)
  const [categories, setCategories] = useState<TransactionCategory[]>([])

  // Modal states for Kirim (Income) / Chiqim (Expense)
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false)
  const [selectedCashboxForTx, setSelectedCashboxForTx] = useState<Cashbox | null>(null)
  const [txType, setTxType] = useState<'income' | 'expense'>('income')
  const [txAmount, setTxAmount] = useState<number | ''>('')
  const [txCategory, setTxCategory] = useState('')
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

  // Supplier payment states
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState('')

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

  const fetchSuppliers = async (fallback: boolean) => {
    try {
      if (fallback) {
        const localSup = localStorage.getItem('erp_suppliers')
        if (localSup) setSuppliers(JSON.parse(localSup))
      } else {
        const { data, error } = await supabase
          .from('suppliers')
          .select('id, name')
          .order('name', { ascending: true })
        if (!error) setSuppliers(data || [])
      }
    } catch (err: any) {
      console.warn('Failed to fetch suppliers:', err.message)
    }
  }

  const fetchCategories = async (fallback: boolean) => {
    try {
      if (fallback) {
        const localCat = localStorage.getItem('erp_transaction_categories')
        if (localCat) setCategories(JSON.parse(localCat))
      } else {
        const { data, error } = await supabase
          .from('transaction_categories')
          .select('id, name, type, person_type')
          .order('name', { ascending: true })
        if (!error) setCategories(data || [])
      }
    } catch (err: any) {
      console.warn('Failed to fetch transaction categories:', err.message)
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
        fetchSuppliers(fallback)
        fetchCategories(fallback)
      })
    }, 0)
    
    return () => clearTimeout(timer)
  }, [])

  // Auto-routing parameters checking (e.g. "collect debt" button on the invoices page)
  useEffect(() => {
    if (cashboxes.length === 0 || categories.length === 0) return

    const action = searchParams.get('action')
    const type = searchParams.get('type')
    const customerId = searchParams.get('customerId')

    if (action === 'kirim' || action === 'chiqim') {
      setTimeout(() => {
        const targetCb = cashboxes.find(c => c.name.toLowerCase().includes('asosiy') || c.name.toLowerCase().includes('main')) || cashboxes[0]
        if (targetCb) {
          const actionTxType = action === 'kirim' ? 'income' : 'expense'
          // "debt_collection" resolves to whichever income category is linked to customers —
          // that's the one that pays down unpaid invoices (see handleSaveTransaction).
          const targetCategory = type === 'debt_collection'
            ? categories.find(c => c.type === 'income' && c.person_type === 'customer')
            : categories.find(c => c.type === actionTxType)

          setSelectedCashboxForTx(targetCb)
          setTxType(actionTxType)
          setTxAmount('')
          setTxCategory(targetCategory?.id || '')
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
  }, [searchParams, cashboxes, categories, isLocalStorageFallback])

  // Escape closes whichever modal is open — the standard affordance was
  // missing entirely (no close button, no backdrop-click, no Escape).
  useEffect(() => {
    if (!isTransactionModalOpen && !isModalOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsTransactionModalOpen(false)
        setIsModalOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isTransactionModalOpen, isModalOpen])

  const handleOpenAddModal = () => {
    setEditingCashbox(null)
    setName('')
    setBalance('0')
    setCbType('cash')
    setDescription('')
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (cb: Cashbox) => {
    setEditingCashbox(cb)
    setName(cb.name)
    setBalance(cb.balance.toString())
    setCbType(cb.type || 'cash')
    setDescription(cb.description)
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSavingCashbox) return
    if (!name.trim()) {
      toast.error(tCommon('required'))
      return
    }

    setIsSavingCashbox(true)
    const numBalance = Number(balance) || 0
    const initialBalanceLabel = lang === 'uz' ? "Boshlang'ich balans" : lang === 'ru' ? 'Начальный баланс' : 'Initial balance'

    if (isLocalStorageFallback) {
      let updated: Cashbox[]
      const newTxs: any[] = []

      if (editingCashbox) {
        // Balance is intentionally not editable here — it may only change via a
        // categorized kirim/chiqim transaction, which keeps a proper audit trail.
        updated = cashboxes.map((cb) =>
          cb.id === editingCashbox.id
            ? {
                ...cb,
                name: name.trim(),
                type: cbType,
                description: description.trim(),
              }
            : cb
        )
      } else {
        const newId = 'local-' + Math.random().toString(36).substr(2, 9)
        const newCb: Cashbox = {
          id: newId,
          name: name.trim(),
          balance: numBalance,
          type: cbType,
          description: description.trim(),
          created_at: new Date().toISOString(),
        }
        updated = [newCb, ...cashboxes]
        if (numBalance > 0) {
          newTxs.push({
            id: 'local-tx-' + Math.random().toString(36).substr(2, 9),
            type: 'income',
            amount: numBalance,
            category: initialBalanceLabel,
            description: `${initialBalanceLabel} - ${name.trim()}`,
            reference_type: 'cashbox',
            reference_id: newId,
            transaction_date: new Date().toISOString().split('T')[0],
            created_at: new Date().toISOString(),
          })
        }
      }
      localStorage.setItem('erp_cashboxes', JSON.stringify(updated))
      setCashboxes(updated)
      if (newTxs.length > 0) {
        const updatedTxs = [...newTxs, ...transactions]
        localStorage.setItem('erp_transactions', JSON.stringify(updatedTxs))
        setTransactions(updatedTxs)
        await invalidateTransactions()
      }
      toast.success(tCommon('success'))
      setIsModalOpen(false)
      setIsSavingCashbox(false)
    } else {
      try {
        const { data: userData } = await supabase.auth.getUser()
        const userId = userData?.user?.id

        if (editingCashbox) {
          // Balance is intentionally not editable here — it may only change via a
          // categorized kirim/chiqim transaction, which keeps a proper audit trail.
          const { error } = await supabase
            .from('cashboxes')
            .update({
              name: name.trim(),
              type: cbType,
              description: description.trim(),
            })
            .eq('id', editingCashbox.id)
          if (error) throw error
        } else {
          const { data: newCb, error } = await supabase
            .from('cashboxes')
            .insert([
              {
                name: name.trim(),
                balance: numBalance,
                type: cbType,
                description: description.trim(),
              },
            ])
            .select()
            .single()
          if (error) throw error

          if (numBalance > 0 && userId && newCb) {
            const { error: txErr } = await supabase.from('transactions').insert({
              type: 'income',
              amount: numBalance,
              category: initialBalanceLabel,
              description: `${initialBalanceLabel} - ${name.trim()}`,
              reference_type: 'cashbox',
              reference_id: newCb.id,
              transaction_date: new Date().toISOString().split('T')[0],
              created_by: userId,
            })
            if (txErr) throw txErr
            await invalidateTransactions()
          }
        }
        toast.success(tCommon('success'))
        setIsModalOpen(false)
        fetchCashboxes()
      } catch (err: any) {
        toast.error(err.message || tCommon('error'))
      } finally {
        setIsSavingCashbox(false)
      }
    }
  }

  const handleDelete = async (id: string) => {
    const cashbox = cashboxes.find(cb => cb.id === id);
    if (cashbox && cashbox.balance > 0) {
      toast.error(lang === 'uz' ? 'Puli bor kassani o\'chirib bo\'lmaydi' : lang === 'ru' ? 'Нельзя удалить кассу с положительным балансом' : 'Cannot delete cashbox with balance > 0');
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
    const defaultCategory = categories.find(c => c.type === type)
    setTxCategory(defaultCategory?.id || '')
    setTxDate(new Date().toISOString().split('T')[0])
    setTxDescription('')
    setSelectedCustomerId('')
    setSelectedEmployeeId('')
    setSelectedSupplierId('')
    setCustomerDebt(null)
    setIsTransactionModalOpen(true)
  }

  const selectedCategoryObj = categories.find(c => c.id === txCategory)
  const personType = selectedCategoryObj?.person_type ?? 'none'

  // Save transaction and adjust balance
  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    // Guard against double-submit (double-click, slow network + repeat click) creating
    // the same income/expense twice — isLoading is set below, but the button's own
    // disabled state can lag a render behind the click, so re-check it here too.
    if (isLoading) return
    if (!selectedCashboxForTx || !txAmount || Number(txAmount) <= 0) {
      toast.error(tCommon('required'))
      return
    }

    if (txType === 'expense' && Number(txAmount) > Number(selectedCashboxForTx.balance)) {
      toast.error(
        lang === 'uz'
          ? `Yetarli mablag' yo'q. Kassada faqat ${formatCurrency(selectedCashboxForTx.balance)} mavjud`
          : lang === 'ru'
          ? `Недостаточно средств. В кассе доступно только ${formatCurrency(selectedCashboxForTx.balance)}`
          : `Insufficient funds. Only ${formatCurrency(selectedCashboxForTx.balance)} available in this cashbox`
      )
      return
    }

    if (!selectedCategoryObj) {
      toast.error(tCommon('required'))
      return
    }

    if (personType === 'employee' && !selectedEmployeeId) {
      toast.error(lang === 'uz' ? "Iltimos, xodimni tanlang" : lang === 'ru' ? "Пожалуйста, выберите сотрудника" : "Please select an employee")
      return
    }

    if (personType === 'supplier' && !selectedSupplierId) {
      toast.error(lang === 'uz' ? "Iltimos, yetkazib beruvchini tanlang" : lang === 'ru' ? "Пожалуйста, выберите поставщика" : "Please select a supplier")
      return
    }

    if (personType === 'customer' && !selectedCustomerId) {
      toast.error(lang === 'uz' ? "Iltimos, mijozni tanlang" : lang === 'ru' ? "Пожалуйста, выберите клиента" : "Please select a customer")
      return
    }

    const numAmount = Number(txAmount)
    const categoryText = selectedCategoryObj.name

    let finalDescription = txDescription.trim() || null
    if (personType === 'employee' && selectedEmployeeId) {
      const emp = employees.find(e => e.id === selectedEmployeeId)
      if (emp) {
        finalDescription = txDescription.trim()
          ? `${txDescription.trim()} (${lang === 'uz' ? 'Xodim' : lang === 'ru' ? 'Сотрудник' : 'Employee'}: ${emp.name})`
          : `${categoryText} - ${emp.name}`
      }
    } else if (personType === 'supplier' && selectedSupplierId) {
      const sup = suppliers.find(s => s.id === selectedSupplierId)
      if (sup) {
        finalDescription = txDescription.trim()
          ? `${txDescription.trim()} (${lang === 'uz' ? 'Yetkazib beruvchi' : lang === 'ru' ? 'Поставщик' : 'Supplier'}: ${sup.name})`
          : `${categoryText} - ${sup.name}`
      }
    } else if (personType === 'customer' && selectedCustomerId) {
      const cust = customers.find(c => c.id === selectedCustomerId)
      if (cust) {
        finalDescription = txDescription.trim()
          ? `${txDescription.trim()} (${lang === 'uz' ? 'Mijoz' : lang === 'ru' ? 'Клиент' : 'Customer'}: ${cust.name})`
          : `${categoryText} - ${cust.name}`
      }
    }

    setIsLoading(true)
    try {
      const balanceChange = txType === 'income' ? numAmount : -numAmount
      const updatedBalance = Number(selectedCashboxForTx.balance) + balanceChange

      // Resolve the session up front. This used to happen only in the Supabase
      // branch *after* the invoice paydown below had already marked invoices as
      // paid — so a missing session left invoices settled with no cashbox
      // update and no transaction ever recorded against them.
      let userId: string | undefined
      if (!isLocalStorageFallback) {
        const { data: userData } = await supabase.auth.getUser()
        userId = userData?.user?.id
        if (!userId) {
          toast.error(lang === 'uz' ? 'Foydalanuvchi seansi topilmadi' : lang === 'ru' ? 'Сессия пользователя не найдена' : 'User session not found')
          return
        }
      }

      // Any income received from a customer pays down their oldest unpaid invoices first
      // (this is what makes the "collect debt" button on the invoices page work).
      if (txType === 'income' && personType === 'customer' && selectedCustomerId) {
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

          // Overpayment beyond all debt accrues as the customer's credit/deposit balance (haqdorlik)
          if (paymentRemaining > 0) {
            const localCustStr = localStorage.getItem('erp_customers')
            if (localCustStr) {
              const localCustomers = JSON.parse(localCustStr)
              const idx = localCustomers.findIndex((c: any) => c.id === selectedCustomerId)
              if (idx !== -1) {
                localCustomers[idx].credit_balance = (Number(localCustomers[idx].credit_balance) || 0) + paymentRemaining
                localStorage.setItem('erp_customers', JSON.stringify(localCustomers))
              }
            }
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

          // Overpayment beyond all debt accrues as the customer's credit/deposit balance (haqdorlik)
          if (paymentRemaining > 0) {
            const { data: custRow, error: custFetchErr } = await supabase
              .from('customers')
              .select('credit_balance')
              .eq('id', selectedCustomerId)
              .single()
            if (!custFetchErr && custRow) {
              const { error: custUpdateErr } = await supabase
                .from('customers')
                .update({ credit_balance: (Number(custRow.credit_balance) || 0) + paymentRemaining })
                .eq('id', selectedCustomerId)
              if (custUpdateErr) throw custUpdateErr
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
          employee_id: personType === 'employee' ? selectedEmployeeId : null,
          supplier_id: personType === 'supplier' ? selectedSupplierId : null,
          customer_id: personType === 'customer' ? selectedCustomerId : null,
          transaction_date: txDate,
          created_at: new Date().toISOString(),
        }
        const updatedTxs = [newTx, ...transactions]
        localStorage.setItem('erp_transactions', JSON.stringify(updatedTxs));
        setTransactions(updatedTxs);

        await invalidateTransactions()
        if (personType === 'supplier') await invalidateSuppliers()
        if (personType === 'employee') await invalidateEmployees()
        if (personType === 'customer') {
          await invalidateCustomers()
          await invalidateInvoices()
        }

        toast.success(tCommon('success'))
        setIsTransactionModalOpen(false)
      } else {
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
            employee_id: personType === 'employee' ? selectedEmployeeId : null,
            supplier_id: personType === 'supplier' ? selectedSupplierId : null,
          customer_id: personType === 'customer' ? selectedCustomerId : null,
            transaction_date: txDate,
            created_by: userId
          }])

        if (txErr) throw txErr

        await invalidateTransactions()
        if (personType === 'supplier') await invalidateSuppliers()
        if (personType === 'employee') await invalidateEmployees()
        if (personType === 'customer') {
          await invalidateCustomers()
          await invalidateInvoices()
        }

        toast.success(tCommon('success'))
        setIsTransactionModalOpen(false)
        fetchCashboxes()

        // Telegram notification (Settings → Integrations). Only for money
        // actually collected from a customer — that's the "debt payment" the
        // invoice paydown above just applied. Fire-and-forget: the
        // transaction is already committed at this point.
        if (txType === 'income' && personType === 'customer' && selectedCustomerId) {
          fireTelegramNotification({
            event: 'debt_payment',
            data: {
              customerName: customers.find((c) => c.id === selectedCustomerId)?.name ?? '—',
              amount: numAmount,
            },
          })
        }
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

        await invalidateTransactions()
        if (tx.supplier_id) await invalidateSuppliers()
        if (tx.employee_id) await invalidateEmployees()

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

        await invalidateTransactions()
        if (tx.supplier_id) await invalidateSuppliers()
        if (tx.employee_id) await invalidateEmployees()

        toast.success(tCommon('success'))
        fetchCashboxes()
      }
    } catch (err: any) {
      toast.error(err.message || tCommon('error'))
    } finally {
      setIsLoading(false)
    }
  }

  // Categories are managed at /finance/categories (like inventory categories)
  const incomeCategories = categories.filter(c => c.type === 'income')
  const expenseCategories = categories.filter(c => c.type === 'expense')

  // Time-filtered transactions (period only, independent of the text search box below) —
  // drives the transaction history table.
  const todayStr = formatDateISO(now)
  const yesterdayStr = formatDateISO(new Date(now.getTime() - 24 * 60 * 60 * 1000))
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const customStartDate = customStart ? new Date(customStart) : null
  const customEndDate = customEnd ? new Date(customEnd) : null

  const periodTransactions = transactions.filter((tx) => {
    if (period === 'today') return tx.transaction_date === todayStr
    if (period === 'yesterday') return tx.transaction_date === yesterdayStr
    if (period === 'week') return new Date(tx.transaction_date) >= weekAgo
    if (period === 'month') return new Date(tx.transaction_date) >= monthAgo
    if (period === 'custom') {
      const d = new Date(tx.transaction_date)
      return (!customStartDate || d >= customStartDate) && (!customEndDate || d <= customEndDate)
    }
    return true
  })

  const CASHBOX_TYPES: { key: CashboxType; label: string; icon: typeof Coins }[] = [
    { key: 'cash', label: t('cashboxTypeCash'), icon: Coins },
    { key: 'card', label: t('cashboxTypeCard'), icon: CreditCard },
    { key: 'transfer', label: t('cashboxTypeTransfer'), icon: ArrowLeftRight },
    { key: 'other', label: t('cashboxTypeOther'), icon: Wallet },
  ]

  // `description` is nullable (and is always null on cashboxes auto-created
  // for an employee in hr/employee-form.tsx), so it must be coalesced before
  // .toLowerCase() — otherwise typing anything into the search box throws.
  const filteredCashboxes = cashboxes.filter((cb) =>
    (cb.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (cb.description ?? '').toLowerCase().includes(search.toLowerCase())
  )

  // Sum of the rows actually on screen, so the figure always agrees with the
  // list above it when a search filter is narrowing the set.
  const totalCashboxBalance = filteredCashboxes.reduce(
    (sum, cb) => sum + (Number(cb.balance) || 0),
    0
  )

  const filteredTransactions = periodTransactions.filter((tx) => {
    const cbName = cashboxes.find(c => c.id === tx.reference_id)?.name || ''
    return (
      (tx.description ?? '').toLowerCase().includes(txSearch.toLowerCase()) ||
      tx.category.toLowerCase().includes(txSearch.toLowerCase()) ||
      cbName.toLowerCase().includes(txSearch.toLowerCase())
    )
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('cashbox')}
        subtitle={t('title')}
        info={tInfo('cashbox')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') },
          { label: t('cashbox') },
        ]}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 shadow-inner border">
            {(['today', 'yesterday', 'week', 'month', 'all'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 cursor-pointer ${
                  period === p ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {tDash(p)}
              </button>
            ))}
          </div>
          <CustomDateRangePicker
            isActive={period === 'custom'}
            start={customStart}
            end={customEnd}
            onApply={handleApplyCustomRange}
            lang={lang}
          />
        </div>
      </PageHeader>

      {isLocalStorageFallback && (
        <div className="flex gap-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 p-4 rounded-2xl text-sm animate-in fade-in slide-in-from-top-1 duration-200">
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

      {/* Actions and List Grid */}
      <Card className="border border-slate-100 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
        <CardHeader className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Landmark className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              {t('cashboxes')}
            </CardTitle>
            <CardDescription className="text-xs">{lang === 'uz' ? "Moliya kassalari va ularning qoldiqlari ro'yxati" : lang === 'ru' ? "Список касс и их остатков" : "List of cashboxes and their balances"}</CardDescription>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder={`${tCommon('search')}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>
            <Button onClick={handleOpenAddModal} className="bg-violet-600 hover:bg-violet-700 text-white gap-2 h-9 px-4 rounded-xl text-xs font-semibold shadow-sm shadow-violet-500/10 hover:shadow-violet-500/25">
              <Plus className="h-4 w-4" />
              {t('addCashbox')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 dark:bg-slate-800/70 border-b border-slate-100 dark:border-slate-800">
                  <th className="p-4 pl-6 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t('cashboxName')}</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{tCommon('description')}</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">{t('balance')}</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{tCommon('date')}</th>
                  <th className="p-4 pr-6 text-right text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{lang === 'uz' ? 'Amallar' : lang === 'ru' ? 'Действия' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {isLoading && cashboxes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-6 w-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
                        <span>{tCommon('loading')}...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredCashboxes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-400 dark:text-slate-500">
                      <div className="flex flex-col items-center gap-2 py-4">
                        <Wallet className="h-10 w-10 opacity-30 text-slate-400" />
                        <p className="text-sm font-semibold">{tCommon('noData')}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCashboxes.map((cb) => {
                    const isMain = cb.name.toLowerCase().includes('asosiy') || cb.name.toLowerCase().includes('main')
                    const typeInfo = CASHBOX_TYPES.find((ct) => ct.key === (cb.type || 'cash'))
                    return (
                      <tr key={cb.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                        <td className="p-4 pl-6 font-semibold text-slate-800 dark:text-slate-200">
                          <div className="flex items-center gap-2.5">
                            <div className={`p-1.5 rounded-lg ${isMain ? 'bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                              <Landmark className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col">
                              <span className="group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">{cb.name}</span>
                              {typeInfo && (
                                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase">{typeInfo.label}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">{cb.description || '—'}</td>
                        <td className="p-4 font-bold text-right text-violet-600 dark:text-violet-400 text-base">{formatCurrency(cb.balance)}</td>
                        <td className="p-4 text-xs text-slate-400 dark:text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{formatDateTime(cb.created_at)}</span>
                          </div>
                        </td>
                        <td className="p-4 pr-6 flex justify-end items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenTransactionModal(cb, 'income')}
                            className="h-8 border-emerald-100 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 hover:text-emerald-800 dark:hover:text-emerald-300 font-semibold text-xs rounded-xl transition-all px-3 hover:-translate-y-0.5 shadow-sm"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            {lang === 'uz' ? 'Kirim' : lang === 'ru' ? 'Приход' : 'Income'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenTransactionModal(cb, 'expense')}
                            className="h-8 border-rose-100 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/60 hover:text-rose-800 dark:hover:text-rose-300 font-semibold text-xs rounded-xl transition-all px-3 hover:-translate-y-0.5 shadow-sm"
                          >
                            <Minus className="h-3 w-3 mr-1" />
                            {lang === 'uz' ? 'Chiqim' : lang === 'ru' ? 'Расход' : 'Expense'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEditModal(cb)}
                            className="h-8 w-8 text-slate-400 dark:text-slate-500 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(cb.id)}
                            className="h-8 w-8 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              {filteredCashboxes.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50">
                    <td className="p-4 pl-6 font-bold text-slate-800 dark:text-slate-200" colSpan={2}>
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400">
                          <Wallet className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                          <span>{t('totalBalance')}</span>
                          <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase">
                            {t('cashboxCount', { count: filteredCashboxes.length })}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-right text-lg font-extrabold text-violet-600 dark:text-violet-400 tabular-nums">
                      {formatCurrency(totalCashboxBalance)}
                    </td>
                    <td className="p-4" />
                    <td className="p-4 pr-6" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History Card */}
      <Card className="border border-slate-100 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
        <CardHeader className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Receipt className="h-5 w-5 text-violet-600 dark:text-violet-400" />
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
              className="pl-9 h-9 border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 dark:bg-slate-800/70 border-b border-slate-100 dark:border-slate-800">
                  <th className="p-4 pl-6 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{tCommon('date')}</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t('cashbox')}</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t('category')}</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{tCommon('description')}</th>
                  <th className="p-4 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider text-right">
                    {lang === 'uz' ? 'Kirim' : lang === 'ru' ? 'Приход' : 'Income'}
                  </th>
                  <th className="p-4 pr-6 text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider text-right">
                    {lang === 'uz' ? 'Chiqim' : lang === 'ru' ? 'Расход' : 'Expense'}
                  </th>
                  {/* No trailing actions column: the per-row delete button below is
                      commented out, and an extra header cell here left every body row one
                      cell short of the header, skewing the whole table. Restore both
                      together if row actions come back. */}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {isLoading && transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-6 w-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
                        <span>{tCommon('loading')}...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400 dark:text-slate-500">
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
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                        onClick={() => router.push(`/${lang}/finance/transactions/${tx.id}/edit`)}
                      >
                        <td className="p-4 pl-6 text-xs text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            <span>{formatDateTime(tx.created_at)}</span>
                          </div>
                        </td>
                        <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">{cbName}</td>
                        <td className="p-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200/30 dark:border-slate-700">
                            {tx.category}
                          </span>
                        </td>
                        <td className="p-4 text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">{tx.description || '—'}</td>
                        <td className="p-4 font-extrabold text-right text-base text-emerald-600 dark:text-emerald-400">
                          {isIncome ? formatCurrency(tx.amount) : '—'}
                        </td>
                        <td className="p-4 pr-6 font-extrabold text-right text-base text-rose-600 dark:text-rose-400">
                          {!isIncome ? formatCurrency(tx.amount) : '—'}
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
              {filteredTransactions.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 font-bold">
                    {/* The label spans the first four columns (date, cashbox, category,
                        description) so each total sits under its own header — a shorter
                        span plus a trailing filler cell shifted both one column left. */}
                    <td className="p-4 pl-6" colSpan={4}>
                      {tCommon('total')}
                    </td>
                    <td className="p-4 text-right text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(filteredTransactions.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + Number(tx.amount), 0))}
                    </td>
                    <td className="p-4 pr-6 text-right text-rose-600 dark:text-rose-400">
                      {formatCurrency(filteredTransactions.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + Number(tx.amount), 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Cashbox Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl p-7 relative animate-in zoom-in-95 duration-300 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2 bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 rounded-xl">
                <Landmark className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  {editingCashbox ? (lang === 'uz' ? "Kassani tahrirlash" : lang === 'ru' ? "Редактировать кассу" : "Edit cashbox") : t('addCashbox')}
                </h3>
                <p className="text-xs text-muted-foreground">{lang === 'uz' ? "Kassa ma'lumotlarini kiriting" : lang === 'ru' ? "Введите параметры кассы" : "Enter the cashbox details"}</p>
              </div>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="cb_name" className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t('cashboxName')} *</Label>
                <Input
                  id="cb_name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={lang === 'uz' ? "Masalan: Asosiy G'azna" : lang === 'ru' ? "Например: Основная Касса" : "e.g. Main Cashbox"}
                  required
                  className="rounded-xl border-slate-200 dark:border-slate-700 focus-visible:ring-violet-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cb_type" className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t('cashboxType')} *</Label>
                <Select value={cbType} onValueChange={(val: any) => setCbType(val || 'cash')}>
                  <SelectTrigger className="w-full rounded-xl border-slate-200 dark:border-slate-700 focus:ring-violet-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="cash" className="rounded-lg">{t('cashboxTypeCash')}</SelectItem>
                    <SelectItem value="card" className="rounded-lg">{t('cashboxTypeCard')}</SelectItem>
                    <SelectItem value="transfer" className="rounded-lg">{t('cashboxTypeTransfer')}</SelectItem>
                    <SelectItem value="other" className="rounded-lg">{t('cashboxTypeOther')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editingCashbox ? (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {lang === 'uz' ? 'Joriy balans' : lang === 'ru' ? 'Текущий баланс' : 'Current balance'}
                  </Label>
                  <div className="h-9 px-3 flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-500 dark:text-slate-400">
                    {formatCurrency(editingCashbox.balance)}
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-snug">
                    {lang === 'uz'
                      ? "Balansni o'zgartirish uchun \"Kirim\" yoki \"Chiqim\" tugmasidan foydalaning"
                      : lang === 'ru'
                      ? 'Чтобы изменить баланс, используйте кнопку "Приход" или "Расход"'
                      : 'To change the balance, use the "Income" or "Expense" button'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="cb_balance" className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t('initialBalance')}</Label>
                  <NumericInput
                    id="cb_balance"
                    value={balance}
                    onChange={(val) => setBalance(val.toString())}
                    placeholder="0"
                    className="rounded-xl border-slate-200 dark:border-slate-700 focus-visible:ring-violet-500"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="cb_desc" className="text-xs font-semibold text-slate-600 dark:text-slate-300">{tCommon('description')}</Label>
                <Textarea
                  id="cb_desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={tCommon('description')}
                  rows={3}
                  className="rounded-xl border-slate-200 dark:border-slate-700 focus-visible:ring-violet-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSavingCashbox}
                  className="rounded-xl h-10 px-4 font-semibold text-xs"
                >
                  {tCommon('cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingCashbox}
                  className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl h-10 px-5 font-semibold text-xs shadow-sm shadow-violet-500/10 hover:shadow-violet-500/25 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSavingCashbox ? tCommon('saving') : tCommon('save')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Kirim (Income) / Chiqim (Expense) Modal */}
      {isTransactionModalOpen && selectedCashboxForTx && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300"
          onClick={() => setIsTransactionModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl p-7 relative animate-in zoom-in-95 duration-300 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsTransactionModalOpen(false)}
              aria-label={tCommon('cancel')}
              className="absolute right-5 top-5 rounded-full p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-3 pb-3 pr-8 border-b border-slate-100 dark:border-slate-800">
              <div className={`p-2.5 rounded-xl ${txType === 'income' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'}`}>
                {txType === 'income' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                {cashboxes.length > 1 ? (
                  <Select
                    value={selectedCashboxForTx.id}
                    onValueChange={(val) => {
                      const cb = cashboxes.find(c => c.id === val)
                      if (cb) setSelectedCashboxForTx(cb)
                    }}
                  >
                    <SelectTrigger className="h-8 w-full border-0 bg-transparent p-0 shadow-none font-bold text-base text-slate-800 dark:text-slate-100 hover:bg-transparent focus:ring-0 [&_svg]:opacity-60">
                      <SelectValue>{selectedCashboxForTx.name}</SelectValue>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {cashboxes.map((cb) => (
                        <SelectItem key={cb.id} value={cb.id} className="rounded-lg">
                          {cb.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    {selectedCashboxForTx.name}
                  </h3>
                )}
                <p className="text-xs text-muted-foreground">
                  {txType === 'income'
                    ? (lang === 'uz' ? 'Kirim operatsiyasini kiritish' : lang === 'ru' ? 'Внести приходную операцию' : 'Register Income')
                    : (lang === 'uz' ? 'Chiqim operatsiyasini kiritish' : lang === 'ru' ? 'Внести расходную операцию' : 'Register Expense')
                  }
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-100/50 dark:border-slate-700/50 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
              <span>{lang === 'uz' ? 'Joriy kassa qoldigʻi:' : lang === 'ru' ? 'Текущий остаток:' : 'Current balance:'}</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{formatCurrency(selectedCashboxForTx.balance)}</span>
            </div>

            <form onSubmit={handleSaveTransaction} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tx_category" className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t('category')} *</Label>
                  <Link href={`/${lang}/finance/categories`} className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 hover:underline">
                    {t('txCategories')}
                  </Link>
                </div>
                <Select value={txCategory} onValueChange={(val) => {
                  setTxCategory(val || '')
                  const cat = categories.find(c => c.id === val)
                  if (cat?.person_type !== 'customer') {
                    setSelectedCustomerId('')
                    setCustomerDebt(null)
                  }
                  if (cat?.person_type !== 'employee') {
                    setSelectedEmployeeId('')
                  }
                  if (cat?.person_type !== 'supplier') {
                    setSelectedSupplierId('')
                  }
                }}>
                  <SelectTrigger className="w-full rounded-xl border-slate-200 dark:border-slate-700 focus:ring-violet-500">
                    <SelectValue placeholder={t('selectType')}>
                      {selectedCategoryObj?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {(txType === 'income' ? incomeCategories : expenseCategories).length === 0 ? (
                      <div className="px-3 py-4 text-xs text-slate-400 text-center">{tCommon('noData')}</div>
                    ) : (
                      (txType === 'income' ? incomeCategories : expenseCategories).map((cat) => (
                        <SelectItem key={cat.id} value={cat.id} className="rounded-lg">
                          {cat.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {personType === 'customer' && (
                <div className="space-y-2 animate-in fade-in duration-200">
                  <Label htmlFor="tx_customer" className="text-xs font-semibold text-slate-600 dark:text-slate-300">{lang === 'uz' ? 'Mijoz' : lang === 'ru' ? 'Клиент' : 'Customer'} *</Label>
                  <Select
                    value={selectedCustomerId}
                    onValueChange={(val) => {
                      setSelectedCustomerId(val || '')
                      if (val && txType === 'income') fetchCustomerDebt(val, isLocalStorageFallback)
                    }}
                  >
                    <SelectTrigger className="w-full rounded-xl border-slate-200 dark:border-slate-700">
                      <SelectValue placeholder={lang === 'uz' ? 'Mijozni tanlang' : lang === 'ru' ? 'Выберите клиента' : 'Select a customer'}>
                        {selectedCustomerId
                          ? (customers.find(c => c.id === selectedCustomerId)?.name || '')
                          : (lang === 'uz' ? 'Mijozni tanlang' : lang === 'ru' ? 'Выберите клиента' : 'Select a customer')}
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

                  {txType === 'income' && selectedCustomerId && (
                    <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/50 rounded-2xl p-3.5 mt-2 flex items-center justify-between text-xs text-rose-800 dark:text-rose-300 animate-in slide-in-from-top-1 duration-200">
                      <span className="font-medium">{lang === 'uz' ? 'Umumiy qarzdorlik summasi:' : lang === 'ru' ? 'Общая сумма задолженности:' : 'Total debt amount:'}</span>
                      <span className="font-extrabold text-sm">
                        {isLoadingDebt ? '...' : formatCurrency(customerDebt || 0)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {personType === 'employee' && (
                <div className="space-y-1.5 animate-in fade-in duration-200">
                  <Label htmlFor="tx_employee" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {lang === 'uz' ? 'Xodim' : lang === 'ru' ? 'Сотрудник' : 'Employee'} *
                  </Label>
                  <Select
                    value={selectedEmployeeId}
                    onValueChange={(val) => setSelectedEmployeeId(val || '')}
                  >
                    <SelectTrigger className="w-full rounded-xl border-slate-200 dark:border-slate-700">
                      <SelectValue placeholder={lang === 'uz' ? 'Xodimni tanlang' : lang === 'ru' ? 'Выберите сотрудника' : 'Select an employee'}>
                        {selectedEmployeeId
                          ? (employees.find(e => e.id === selectedEmployeeId)?.name || '')
                          : (lang === 'uz' ? 'Xodimni tanlang' : lang === 'ru' ? 'Выберите сотрудника' : 'Select an employee')}
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

              {personType === 'supplier' && (
                <div className="space-y-1.5 animate-in fade-in duration-200">
                  <Label htmlFor="tx_supplier" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {lang === 'uz' ? 'Yetkazib beruvchi' : lang === 'ru' ? 'Поставщик' : 'Supplier'} *
                  </Label>
                  <Select
                    value={selectedSupplierId}
                    onValueChange={(val) => setSelectedSupplierId(val || '')}
                  >
                    <SelectTrigger className="w-full rounded-xl border-slate-200 dark:border-slate-700">
                      <SelectValue placeholder={lang === 'uz' ? 'Yetkazib beruvchini tanlang' : lang === 'ru' ? 'Выберите поставщика' : 'Select a supplier'}>
                        {selectedSupplierId
                          ? (suppliers.find(s => s.id === selectedSupplierId)?.name || '')
                          : (lang === 'uz' ? 'Yetkazib beruvchini tanlang' : lang === 'ru' ? 'Выберите поставщика' : 'Select a supplier')}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id} className="rounded-lg">
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="tx_amount" className="text-xs font-semibold text-slate-600 dark:text-slate-300">{tCommon('amount')} *</Label>
                <NumericInput
                  id="tx_amount"
                  value={txAmount}
                  onChange={(val) => setTxAmount(val)}
                  placeholder="0.00"
                  required
                  autoFocus
                  className="rounded-xl border-slate-200 dark:border-slate-700 text-lg font-extrabold focus-visible:ring-violet-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tx_date" className="text-xs font-semibold text-slate-600 dark:text-slate-300">{tCommon('date')} *</Label>
                <DatePicker
                  id="tx_date"
                  value={txDate}
                  onChange={setTxDate}
                  lang={lang}
                  placeholder={tCommon('date')}
                  className="rounded-xl border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tx_desc" className="text-xs font-semibold text-slate-600 dark:text-slate-300">{tCommon('description')}</Label>
                <Textarea
                  id="tx_desc"
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  placeholder={tCommon('description')}
                  rows={2}
                  className="rounded-xl border-slate-200 dark:border-slate-700 focus-visible:ring-violet-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsTransactionModalOpen(false)}
                  disabled={isLoading}
                  className="rounded-xl h-10 px-4 font-semibold text-xs"
                >
                  {tCommon('cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className={`${txType === 'income' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/10'} text-white rounded-xl h-10 px-5 font-semibold text-xs shadow-md transition-all hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {isLoading ? tCommon('saving') : tCommon('save')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
