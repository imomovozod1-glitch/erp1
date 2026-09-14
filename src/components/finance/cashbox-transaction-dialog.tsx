'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowDownRight, ArrowUpRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NumericInput } from '@/components/ui/numeric-input'
import { Textarea } from '@/components/ui/textarea'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import type { CashboxTransactionForm } from '@/components/finance/cashbox-operations'

interface NamedRow {
  id: string
  name: string
}

/**
 * Only the three fields the dialog reads. Generic over the caller's own row
 * type so switching cashbox hands back exactly what was passed in, rather than
 * a narrowed copy the caller then has to widen again.
 */
interface CashboxRow {
  id: string
  name: string
  balance: number
}

interface CategoryRow {
  id: string
  name: string
  type: 'income' | 'expense'
  person_type: 'employee' | 'supplier' | 'customer' | 'none'
}

/**
 * Recording money in or out of a cashbox.
 *
 * Controlled: the form is one `value`/`onChange` pair rather than eight fields
 * and eight setters, because the caller fills it in as a whole — the invoices
 * page's "collect debt" link arrives with the type, the category and the
 * customer already chosen.
 *
 * The person picker underneath the category is not decoration: a category
 * carries a `person_type`, and an expense categorised as a supplier payment
 * has to say WHICH supplier, or the money leaves the books attached to nobody.
 */
export function CashboxTransactionDialog<T extends CashboxRow>({
  cashbox,
  cashboxes,
  onCashboxChange,
  value,
  onChange,
  categories,
  customers,
  employees,
  suppliers,
  customerDebt,
  isLoadingDebt,
  onCustomerSelected,
  onSubmit,
  onClose,
  isSaving,
  lang,
}: {
  cashbox: T
  /** All cashboxes, so the cashier can switch without closing the dialog. */
  cashboxes: T[]
  onCashboxChange: (cashbox: T) => void
  value: CashboxTransactionForm
  onChange: (patch: Partial<CashboxTransactionForm>) => void
  categories: CategoryRow[]
  customers: NamedRow[]
  employees: NamedRow[]
  suppliers: NamedRow[]
  /** Outstanding debt of the selected customer, or null when not looked up. */
  customerDebt: number | null
  isLoadingDebt: boolean
  /** Called when a customer is picked (or cleared) so the caller can read their debt. */
  onCustomerSelected: (customerId: string) => void
  onSubmit: (e: React.SubmitEvent) => void
  onClose: () => void
  isSaving: boolean
  lang: string
}) {
  const tCommon = useTranslations('common')
  const t = useTranslations('finance')

  const incomeCategories = categories.filter((c) => c.type === 'income')
  const expenseCategories = categories.filter((c) => c.type === 'expense')
  const selectedCategory = categories.find((c) => c.id === value.categoryId)
  const personType = selectedCategory?.person_type ?? 'none'

  const handleSubmit = (e: React.SubmitEvent) => {
    e.preventDefault()
    onSubmit(e)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300"
      onClick={() => onClose()}
    >
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl p-7 relative animate-in zoom-in-95 duration-300 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onClose()}
          aria-label={tCommon('cancel')}
          className="absolute right-5 top-5 rounded-full p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-3 pb-3 pr-8 border-b border-slate-100 dark:border-slate-800">
          <div className={`p-2.5 rounded-xl ${value.type === 'income' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'}`}>
            {value.type === 'income' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
          </div>
          <div className="flex-1 min-w-0">
            {cashboxes.length > 1 ? (
              <Select
                value={cashbox.id}
                onValueChange={(val) => {
                  const cb = cashboxes.find(c => c.id === val)
                  if (cb) onCashboxChange(cb)
                }}
              >
                <SelectTrigger className="h-8 w-full border-0 bg-transparent p-0 shadow-none font-bold text-base text-slate-800 dark:text-slate-100 hover:bg-transparent focus:ring-0 [&_svg]:opacity-60">
                  <SelectValue>{cashbox.name}</SelectValue>
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
                {cashbox.name}
              </h3>
            )}
            <p className="text-xs text-muted-foreground">
              {value.type === 'income'
                ? (lang === 'uz' ? 'Kirim operatsiyasini kiritish' : lang === 'ru' ? 'Внести приходную операцию' : 'Register Income')
                : (lang === 'uz' ? 'Chiqim operatsiyasini kiritish' : lang === 'ru' ? 'Внести расходную операцию' : 'Register Expense')
              }
            </p>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-100/50 dark:border-slate-700/50 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
          <span>{lang === 'uz' ? 'Joriy kassa qoldigʻi:' : lang === 'ru' ? 'Текущий остаток:' : 'Current balance:'}</span>
          <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{formatCurrency(cashbox.balance)}</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="tx_category" className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t('category')} *</Label>
              <Link href={`/${lang}/finance/categories`} className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 hover:underline">
                {t('txCategories')}
              </Link>
            </div>
            <Select value={value.categoryId} onValueChange={(val) => {
              onChange({ categoryId: val || '' })
              const cat = categories.find(c => c.id === val)
              if (cat?.person_type !== 'customer') {
                onChange({ customerId: '' })
                onCustomerSelected('')
              }
              if (cat?.person_type !== 'employee') {
                onChange({ employeeId: '' })
              }
              if (cat?.person_type !== 'supplier') {
                onChange({ supplierId: '' })
              }
            }}>
              <SelectTrigger className="w-full rounded-xl border-slate-200 dark:border-slate-700 focus:ring-violet-500">
                <SelectValue placeholder={t('selectType')}>
                  {selectedCategory?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {(value.type === 'income' ? incomeCategories : expenseCategories).length === 0 ? (
                  <div className="px-3 py-4 text-xs text-slate-400 text-center">{tCommon('noData')}</div>
                ) : (
                  (value.type === 'income' ? incomeCategories : expenseCategories).map((cat) => (
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
                value={value.customerId}
                onValueChange={(val) => {
                  onChange({ customerId: val || '' })
                  if (val && value.type === 'income') onCustomerSelected(val)
                }}
              >
                <SelectTrigger className="w-full rounded-xl border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder={lang === 'uz' ? 'Mijozni tanlang' : lang === 'ru' ? 'Выберите клиента' : 'Select a customer'}>
                    {value.customerId
                      ? (customers.find(c => c.id === value.customerId)?.name || '')
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

              {value.type === 'income' && value.customerId && (
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
                value={value.employeeId}
                onValueChange={(val) => onChange({ employeeId: val || '' })}
              >
                <SelectTrigger className="w-full rounded-xl border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder={lang === 'uz' ? 'Xodimni tanlang' : lang === 'ru' ? 'Выберите сотрудника' : 'Select an employee'}>
                    {value.employeeId
                      ? (employees.find(e => e.id === value.employeeId)?.name || '')
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
                value={value.supplierId}
                onValueChange={(val) => onChange({ supplierId: val || '' })}
              >
                <SelectTrigger className="w-full rounded-xl border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder={lang === 'uz' ? 'Yetkazib beruvchini tanlang' : lang === 'ru' ? 'Выберите поставщика' : 'Select a supplier'}>
                    {value.supplierId
                      ? (suppliers.find(s => s.id === value.supplierId)?.name || '')
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
              value={value.amount}
              onChange={(val) => onChange({ amount: val })}
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
              value={value.date}
              onChange={(value: string) => onChange({ date: value })}
              lang={lang}
              placeholder={tCommon('date')}
              className="rounded-xl border-slate-200 dark:border-slate-700"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tx_desc" className="text-xs font-semibold text-slate-600 dark:text-slate-300">{tCommon('description')}</Label>
            <Textarea
              id="tx_desc"
              value={value.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder={tCommon('description')}
              rows={2}
              className="rounded-xl border-slate-200 dark:border-slate-700 focus-visible:ring-violet-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose()}
              disabled={isSaving}
              className="rounded-xl h-10 px-4 font-semibold text-xs"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className={`${value.type === 'income' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/10'} text-white rounded-xl h-10 px-5 font-semibold text-xs shadow-md transition-all hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {isSaving ? tCommon('saving') : tCommon('save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
