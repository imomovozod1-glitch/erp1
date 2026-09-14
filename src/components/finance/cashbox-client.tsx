'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { 
  Wallet, 
  Plus, 
  Minus, 
  Trash2, 
  Edit2, 
  AlertCircle, 
  Search, 
  Calendar,
  Landmark,
  Coins,
  CreditCard,
  ArrowLeftRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/shared/page-header'
import { CustomDateRangePicker } from '@/components/shared/custom-date-range-picker'
import { CashboxTransactionsCard } from '@/components/finance/cashbox-transactions-card'
import { CashboxFormDialog, type CashboxFormValues } from '@/components/finance/cashbox-form-dialog'
import { CashboxTransactionDialog } from '@/components/finance/cashbox-transaction-dialog'
import { formatCurrency, formatDateTime, isoDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { invalidateCashbox, invalidateTransactions, invalidateSuppliers, invalidateEmployees, invalidateCustomers, invalidateInvoices } from '@/lib/data/revalidate'
import {
  emptyTransactionForm,
  type CashboxTransactionForm,
  commitCashboxMovement,
  commitCashboxMovementOffline,
  settleCustomerDebt,
  settleCustomerDebtOffline,
} from '@/components/finance/cashbox-operations'
import { fireTelegramNotification } from '@/lib/integrations/notify-client'
import { toast } from 'sonner'

type CashboxType = 'cash' | 'card' | 'transfer' | 'other'
type Period = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'

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

/** Everything the server hands this screen — see `getCachedCashboxPageData`. */
export interface CashboxPageData {
  /** True when the cashboxes read itself failed, i.e. Supabase is unreachable. */
  failed: boolean
  cashboxes: Cashbox[]
  transactions: any[]
  customers: { id: string; name: string }[]
  employees: { id: string; name: string }[]
  suppliers: { id: string; name: string }[]
  categories: TransactionCategory[]
}

/**
 * The cashbox screen.
 *
 * Composition root: it holds the screen's state — the server snapshot, the
 * period in the URL, which dialog is open — and wires the pieces together.
 * The pieces live beside it:
 *
 *   cashbox-operations.ts        what a kirim/chiqim does to the books
 *   cashbox-transactions-card    the movement history
 *   cashbox-form-dialog          create / rename a cashbox
 *   cashbox-transaction-dialog   record money in or out
 *
 * It was one 1600-line file holding all of that at once.
 */
export function CashboxClient({
  lang,
  initialData,
  period,
  customStart,
  customEnd,
}: {
  lang: string
  initialData: CashboxPageData
  /** Resolved from the URL by the page; the history arrives already filtered. */
  period: Period
  customStart: string
  customEnd: string
}) {
  const tCommon = useTranslations('common')
  const tInfo = useTranslations('pageInfo')
  const tDash = useTranslations('dashboard')
  const t = useTranslations('finance')
  const supabase = createClient() as any
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // The six lists arrive as props, already fetched and cached on the server.
  // They are held in state anyway because the offline path below rewrites them
  // from the localStorage mirror, and every kirim/chiqim handler in this file
  // edits them in place when Supabase is unreachable.
  //
  // Re-seeded during render rather than from an effect when the server sends a
  // fresh copy (after `router.refresh()`), which is React's documented way to
  // adjust state to a changed prop — an effect would render the stale list once
  // first, and this project's lint rules forbid setState inside one anyway.
  const [snapshot, setSnapshot] = useState<CashboxPageData>(initialData)
  const [lastServerData, setLastServerData] = useState<CashboxPageData>(initialData)
  if (lastServerData !== initialData) {
    setLastServerData(initialData)
    if (!snapshot.failed) setSnapshot(initialData)
  }

  const { cashboxes, transactions, customers, employees, suppliers, categories } = snapshot
  const isLocalStorageFallback = snapshot.failed

  const patchSnapshot = <K extends keyof CashboxPageData>(key: K, value: CashboxPageData[K]) =>
    setSnapshot((prev) => ({ ...prev, [key]: value }))
  const setCashboxes = (value: Cashbox[]) => patchSnapshot('cashboxes', value)
  const setTransactions = (value: any[]) => patchSnapshot('transactions', value)

  const [isLoading, setIsLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [txSearch, setTxSearch] = useState('')

  // Time filter for the transaction history (and the Income/Expense stat cards).
  // It writes to the URL rather than to component state + sessionStorage: the
  // history is now filtered by Postgres, so changing the period has to re-run a
  // server query, and a range in the URL is linkable and survives a reload —
  // which the sessionStorage version could only approximate.
  const setParams = useCallback(
    (next: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(next)) {
        if (value === null || value === '') params.delete(key)
        else params.set(key, value)
      }
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const handlePeriodChange = (next: Period) => {
    // Always written out, never dropped for a "default" value: the default here
    // is the last 30 days, so an absent param does not mean "all".
    setParams({ period: next, from: null, to: null })
  }

  const handleApplyCustomRange = (start: string, end: string) => {
    setParams({ period: 'custom', from: start || null, to: end || null })
  }

  // Modal form states for cashbox management
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCashbox, setEditingCashbox] = useState<Cashbox | null>(null)
  const [isSavingCashbox, setIsSavingCashbox] = useState(false)

  // Modal states for Kirim (Income) / Chiqim (Expense)
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false)
  const [selectedCashboxForTx, setSelectedCashboxForTx] = useState<Cashbox | null>(null)
  // One object rather than eight `useState`s: every field below is filled in
  // together (opening the dialog, or arriving from the invoices page's "collect
  // debt" link), submitted together and cleared together, and the dialog takes
  // them as a single `value`/`onChange` pair instead of sixteen props.
  const [txForm, setTxForm] = useState<CashboxTransactionForm>(emptyTransactionForm)
  const patchTxForm = (patch: Partial<CashboxTransactionForm>) =>
    setTxForm((form) => ({ ...form, ...patch }))

  // Customer debt states — the customer list itself comes from the server (see
  // `snapshot` above); only the selection and the looked-up debt live here.
  const [customerDebt, setCustomerDebt] = useState<number | null>(null)
  const [isLoadingDebt, setIsLoadingDebt] = useState(false)

  // Employee payroll states

  // Supplier payment states

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

  /**
   * Pulls a fresh copy of the server data after a write.
   *
   * `invalidateCashbox()` is a Server Action, so it drops both the server-side
   * cache entry and the client Router Cache; `router.refresh()` then re-renders
   * this route and the new lists arrive as props. This replaces a hand-rolled
   * re-fetch that issued its own two queries and left every other screen's
   * cached copy stale.
   */
  const refreshFromServer = async () => {
    await invalidateCashbox()
    router.refresh()
  }

  // Offline mirror. Only runs when the server could not read the cashboxes at
  // all — an empty tenant is not a failure and must not be overwritten with
  // whatever this browser last cached. Deferred by a 0 ms timer so no state is
  // set synchronously inside the effect (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!initialData.failed) return
    const timer = setTimeout(() => {
      const read = (key: string) => {
        try {
          const raw = localStorage.getItem(key)
          return raw ? JSON.parse(raw) : null
        } catch {
          return null
        }
      }
      setSnapshot({
        failed: true,
        cashboxes: read('erp_cashboxes') ?? [],
        transactions: read('erp_transactions') ?? [],
        customers: read('erp_customers') ?? [],
        employees: read('erp_employees') ?? [],
        suppliers: read('erp_suppliers') ?? [],
        categories: read('erp_transaction_categories') ?? [],
      })
    }, 0)
    return () => clearTimeout(timer)
  }, [initialData.failed])

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

          const prefillCustomerId =
            type === 'debt_collection' && customerId ? customerId : ''
          setSelectedCashboxForTx(targetCb)
          setTxForm({
            ...emptyTransactionForm,
            type: actionTxType,
            categoryId: targetCategory?.id || '',
            date: isoDate(),
            customerId: prefillCustomerId,
          })
          setIsTransactionModalOpen(true)

          if (prefillCustomerId) {
            fetchCustomerDebt(prefillCustomerId, isLocalStorageFallback)
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
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (cb: Cashbox) => {
    setEditingCashbox(cb)
    setIsModalOpen(true)
  }

  const handleSave = async (values: CashboxFormValues) => {
    if (isSavingCashbox) return
    if (!values.name) {
      toast.error(tCommon('required'))
      return
    }
    const { name, type: cbType, description } = values

    setIsSavingCashbox(true)
    const numBalance = values.initialBalance
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
                name,
                type: cbType,
                description,
              }
            : cb
        )
      } else {
        const newId = 'local-' + Math.random().toString(36).substr(2, 9)
        const newCb: Cashbox = {
          id: newId,
          name,
          balance: numBalance,
          type: cbType,
          description,
          created_at: new Date().toISOString(),
        }
        updated = [newCb, ...cashboxes]
        if (numBalance > 0) {
          newTxs.push({
            id: 'local-tx-' + Math.random().toString(36).substr(2, 9),
            type: 'income',
            amount: numBalance,
            category: initialBalanceLabel,
            description: `${initialBalanceLabel} - ${name}`,
            reference_type: 'cashbox',
            reference_id: newId,
            transaction_date: isoDate(),
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
              name,
              type: cbType,
              description,
            })
            .eq('id', editingCashbox.id)
          if (error) throw error
        } else {
          const { data: newCb, error } = await supabase
            .from('cashboxes')
            .insert([
              {
                name,
                balance: numBalance,
                type: cbType,
                description,
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
              description: `${initialBalanceLabel} - ${name}`,
              reference_type: 'cashbox',
              reference_id: newCb.id,
              transaction_date: isoDate(),
              created_by: userId,
            })
            if (txErr) throw txErr
            await invalidateTransactions()
          }
        }
        toast.success(tCommon('success'))
        setIsModalOpen(false)
        refreshFromServer()
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
          refreshFromServer()
        } catch (err: any) {
          toast.error(err.message || tCommon('error'))
        }
      }
    }
  }

  // Kirim/Chiqim modals trigger
  const handleOpenTransactionModal = (cb: Cashbox, type: 'income' | 'expense') => {
    setSelectedCashboxForTx(cb)
    setTxForm({
      ...emptyTransactionForm,
      type,
      categoryId: categories.find((c) => c.type === type)?.id || '',
      date: isoDate(),
    })
    setCustomerDebt(null)
    setIsTransactionModalOpen(true)
  }

  const selectedCategoryObj = categories.find(c => c.id === txForm.categoryId)
  const personType = selectedCategoryObj?.person_type ?? 'none'

  // Save transaction and adjust balance
  const handleSaveTransaction = async (e: React.SubmitEvent) => {
    e.preventDefault()
    // Guard against double-submit (double-click, slow network + repeat click) creating
    // the same income/expense twice — isLoading is set below, but the button's own
    // disabled state can lag a render behind the click, so re-check it here too.
    if (isLoading) return
    if (!selectedCashboxForTx || !txForm.amount || Number(txForm.amount) <= 0) {
      toast.error(tCommon('required'))
      return
    }

    if (txForm.type === 'expense' && Number(txForm.amount) > Number(selectedCashboxForTx.balance)) {
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

    if (personType === 'employee' && !txForm.employeeId) {
      toast.error(lang === 'uz' ? "Iltimos, xodimni tanlang" : lang === 'ru' ? "Пожалуйста, выберите сотрудника" : "Please select an employee")
      return
    }

    if (personType === 'supplier' && !txForm.supplierId) {
      toast.error(lang === 'uz' ? "Iltimos, yetkazib beruvchini tanlang" : lang === 'ru' ? "Пожалуйста, выберите поставщика" : "Please select a supplier")
      return
    }

    if (personType === 'customer' && !txForm.customerId) {
      toast.error(lang === 'uz' ? "Iltimos, mijozni tanlang" : lang === 'ru' ? "Пожалуйста, выберите клиента" : "Please select a customer")
      return
    }

    const numAmount = Number(txForm.amount)
    const categoryText = selectedCategoryObj.name

    let finalDescription = txForm.description.trim() || null
    if (personType === 'employee' && txForm.employeeId) {
      const emp = employees.find(e => e.id === txForm.employeeId)
      if (emp) {
        finalDescription = txForm.description.trim()
          ? `${txForm.description.trim()} (${lang === 'uz' ? 'Xodim' : lang === 'ru' ? 'Сотрудник' : 'Employee'}: ${emp.name})`
          : `${categoryText} - ${emp.name}`
      }
    } else if (personType === 'supplier' && txForm.supplierId) {
      const sup = suppliers.find(s => s.id === txForm.supplierId)
      if (sup) {
        finalDescription = txForm.description.trim()
          ? `${txForm.description.trim()} (${lang === 'uz' ? 'Yetkazib beruvchi' : lang === 'ru' ? 'Поставщик' : 'Supplier'}: ${sup.name})`
          : `${categoryText} - ${sup.name}`
      }
    } else if (personType === 'customer' && txForm.customerId) {
      const cust = customers.find(c => c.id === txForm.customerId)
      if (cust) {
        finalDescription = txForm.description.trim()
          ? `${txForm.description.trim()} (${lang === 'uz' ? 'Mijoz' : lang === 'ru' ? 'Клиент' : 'Customer'}: ${cust.name})`
          : `${categoryText} - ${cust.name}`
      }
    }

    setIsLoading(true)
    try {
      // The session is resolved BEFORE anything is written. It used to be read
      // inside the Supabase branch, after the invoice paydown below had already
      // marked invoices as paid — so a missing session left invoices settled
      // with no cashbox update and no transaction recorded against them.
      let userId: string | undefined
      if (!isLocalStorageFallback) {
        const { data: userData } = await supabase.auth.getUser()
        userId = userData?.user?.id
        if (!userId) {
          toast.error(
            lang === 'uz'
              ? 'Foydalanuvchi seansi topilmadi'
              : lang === 'ru'
                ? 'Сессия пользователя не найдена'
                : 'User session not found'
          )
          return
        }
      }

      const movement = {
        cashboxId: selectedCashboxForTx.id,
        currentBalance: Number(selectedCashboxForTx.balance),
        type: txForm.type,
        amount: numAmount,
        category: categoryText,
        description: finalDescription,
        personType,
        personId:
          personType === 'employee'
            ? txForm.employeeId
            : personType === 'supplier'
              ? txForm.supplierId
              : personType === 'customer'
                ? txForm.customerId
                : null,
        date: txForm.date,
      }

      // Money received from a customer settles their debt first — see
      // cashbox-operations.ts.
      const settlesDebt = txForm.type === 'income' && personType === 'customer' && !!txForm.customerId

      if (isLocalStorageFallback) {
        if (settlesDebt) {
          settleCustomerDebtOffline({
            customerId: txForm.customerId,
            amount: numAmount,
            paidAt: txForm.date,
          })
        }
        const next = commitCashboxMovementOffline({ ...movement, cashboxes, transactions })
        setCashboxes(next.cashboxes)
        setTransactions(next.transactions)
      } else {
        if (settlesDebt) {
          await settleCustomerDebt({
            supabase,
            customerId: txForm.customerId,
            amount: numAmount,
            paidAt: txForm.date,
          })
        }
        await commitCashboxMovement({ ...movement, supabase, userId: userId as string })
      }

      await invalidateTransactions()
      if (personType === 'supplier') await invalidateSuppliers()
      if (personType === 'employee') await invalidateEmployees()
      if (personType === 'customer') {
        await invalidateCustomers()
        await invalidateInvoices()
      }

      toast.success(tCommon('success'))
      setIsTransactionModalOpen(false)

      if (!isLocalStorageFallback) {
        refreshFromServer()

        // Telegram (Settings → Integrations), only for money actually collected
        // from a customer — the debt payment the settlement above just applied.
        // Fire-and-forget: the transaction is already committed.
        if (settlesDebt) {
          fireTelegramNotification({
            event: 'debt_payment',
            data: {
              customerName: customers.find((c) => c.id === txForm.customerId)?.name ?? '—',
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



  // Categories are managed at /finance/categories (like inventory categories)

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

  // Period filtering happens in Postgres — `transactions` is already the
  // selected range, and this only applies the history search box on top.
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
                onClick={() => handlePeriodChange(p)}
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

      <CashboxTransactionsCard
        transactions={filteredTransactions}
        cashboxes={cashboxes}
        search={txSearch}
        onSearchChange={setTxSearch}
        lang={lang}
      />

      {/* Keyed on the row being edited so opening the dialog mounts it with
          that cashbox's values — no prop-to-state syncing inside it. */}
      {isModalOpen && (
        <CashboxFormDialog
          key={editingCashbox?.id ?? 'new'}
          onOpenChange={setIsModalOpen}
          cashbox={editingCashbox}
          onSubmit={handleSave}
          isSaving={isSavingCashbox}
          lang={lang}
        />
      )}

      {isTransactionModalOpen && selectedCashboxForTx && (
        <CashboxTransactionDialog
          cashbox={selectedCashboxForTx}
          cashboxes={cashboxes}
          onCashboxChange={setSelectedCashboxForTx}
          value={txForm}
          onChange={patchTxForm}
          categories={categories}
          customers={customers}
          employees={employees}
          suppliers={suppliers}
          customerDebt={customerDebt}
          isLoadingDebt={isLoadingDebt}
          onCustomerSelected={(customerId) => {
            if (customerId && txForm.type === 'income') {
              fetchCustomerDebt(customerId, isLocalStorageFallback)
            } else {
              setCustomerDebt(null)
            }
          }}
          onSubmit={handleSaveTransaction}
          onClose={() => setIsTransactionModalOpen(false)}
          isSaving={isLoading}
          lang={lang}
        />
      )}
    </div>
  )
}
