import type { MovementType, NamedRow, PersonType, TransactionCategory } from './cashbox-types'

export type { MovementType, PersonType }

export interface CashboxTransactionForm {
  type: MovementType
  amount: number | ''
  categoryId: string
  date: string
  description: string
  customerId: string
  employeeId: string
  supplierId: string
}

export const emptyTransactionForm: CashboxTransactionForm = {
  type: 'income',
  amount: '',
  categoryId: '',
  date: '',
  description: '',
  customerId: '',
  employeeId: '',
  supplierId: '',
}

export interface MovementInput {
  cashboxId: string
  currentBalance: number
  type: MovementType
  amount: number
  category: string
  description: string | null
  personType: PersonType
  personId: string | null
  date: string
}

export function movementRow(input: MovementInput) {
  return {
    type: input.type,
    amount: input.amount,
    category: input.category,
    description: input.description,
    reference_type: 'cashbox',
    reference_id: input.cashboxId,
    employee_id: input.personType === 'employee' ? input.personId : null,
    supplier_id: input.personType === 'supplier' ? input.personId : null,
    customer_id: input.personType === 'customer' ? input.personId : null,
    transaction_date: input.date,
  }
}

export const balanceAfter = ({ currentBalance, type, amount }: Pick<MovementInput, 'currentBalance' | 'type' | 'amount'>) =>
  Number(currentBalance) + (type === 'income' ? amount : -amount)

export function personIdOf(form: CashboxTransactionForm, personType: PersonType): string | null {
  if (personType === 'employee') return form.employeeId
  if (personType === 'supplier') return form.supplierId
  if (personType === 'customer') return form.customerId
  return null
}

export type MovementProblem =
  | { key: 'required' }
  | { key: 'insufficient'; balance: number }
  | { key: 'selectEmployeeRequired' | 'selectSupplierRequired' | 'selectCustomerRequired' }

const PERSON_REQUIRED = {
  employee: 'selectEmployeeRequired',
  supplier: 'selectSupplierRequired',
  customer: 'selectCustomerRequired',
} as const

export function movementProblem(
  form: CashboxTransactionForm,
  balance: number,
  category: TransactionCategory | undefined
): MovementProblem | null {
  const amount = Number(form.amount)
  if (!form.amount || amount <= 0 || !category) return { key: 'required' }
  if (form.type === 'expense' && amount > Number(balance)) return { key: 'insufficient', balance }
  const personType = category.person_type
  if (personType !== 'none' && !personIdOf(form, personType)) return { key: PERSON_REQUIRED[personType] }
  return null
}

export function describeMovement(
  form: CashboxTransactionForm,
  category: TransactionCategory,
  person: NamedRow | undefined,
  personLabel: string
): string | null {
  const note = form.description.trim()
  if (!person) return note || null
  return note ? `${note} (${personLabel}: ${person.name})` : `${category.name} - ${person.name}`
}

export interface MovementSource {
  cashbox: { id: string; balance: number }
  form: CashboxTransactionForm
  category: TransactionCategory
  person: NamedRow | undefined
  personLabel: string
}

export const buildMovement = ({ cashbox, form, category, person, personLabel }: MovementSource): MovementInput => ({
  cashboxId: cashbox.id,
  currentBalance: Number(cashbox.balance),
  type: form.type,
  amount: Number(form.amount),
  category: category.name,
  description: describeMovement(form, category, person, personLabel),
  personType: category.person_type,
  personId: personIdOf(form, category.person_type),
  date: form.date,
})

export const debtSettlement = (form: CashboxTransactionForm, category: TransactionCategory) =>
  form.type === 'income' && category.person_type === 'customer' && form.customerId
    ? { customerId: form.customerId, amount: Number(form.amount), paidAt: form.date }
    : null

export const keepPersonOnly = (form: CashboxTransactionForm, keep: PersonType) => ({
  customerId: keep === 'customer' ? form.customerId : '',
  employeeId: keep === 'employee' ? form.employeeId : '',
  supplierId: keep === 'supplier' ? form.supplierId : '',
})
