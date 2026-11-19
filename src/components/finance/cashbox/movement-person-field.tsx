'use client'

import { useTranslations } from 'next-intl'
import { NameSelect } from '@/components/shared/name-select'
import { formatCurrency } from '@/lib/utils'
import type { CashboxPageData, PersonType } from './cashbox-types'
import { BalanceNote, Field, type NoteTone } from './movement-fields'
import type { CashboxMovement } from './use-cashbox-movement'

type Person = Exclude<PersonType, 'none'>

const PERSON_COPY: Record<Person, { label: string; placeholder: string }> = {
  customer: { label: 'personTypeCustomer', placeholder: 'selectCustomerPlaceholder' },
  employee: { label: 'personTypeEmployee', placeholder: 'selectEmployeePlaceholder' },
  supplier: { label: 'personTypeSupplier', placeholder: 'selectSupplierPlaceholder' },
}

interface PersonFieldProps {
  movement: CashboxMovement
  snapshot: CashboxPageData
}

export function PersonField({ movement, snapshot }: PersonFieldProps) {
  const t = useTranslations('finance')
  const personType = movement.category?.person_type ?? 'none'
  if (personType === 'none') return null
  const copy = PERSON_COPY[personType]
  const value = movement.form[`${personType}Id`]
  return (
    <div className="space-y-2 animate-in duration-200 fade-in">
      <Field id={`tx_${personType}`} label={`${t(copy.label)} *`}>
        <NameSelect
          id={`tx_${personType}`}
          value={value}
          onChange={(id) => movement.choosePerson(personType, id)}
          options={snapshot[`${personType}s`]}
          placeholder={t(copy.placeholder)}
        />
      </Field>
      {value && personType === 'customer' && <CustomerBalance movement={movement} />}
      {value && personType === 'supplier' && movement.form.type === 'expense' && <SupplierBalance movement={movement} />}
    </div>
  )
}

function CustomerBalance({ movement }: { movement: CashboxMovement }) {
  const t = useTranslations('finance')
  const { customer, loadingCustomer } = movement.debts
  const net = (customer?.credit ?? 0) - (customer?.debt ?? 0)
  const [tone, label]: [NoteTone, string] =
    net > 0 ? ['emerald', 'customerCreditLabel'] : net < 0 ? ['rose', 'customerDebtLabel'] : ['slate', 'customerSettledLabel']
  return <BalanceNote tone={tone} label={t(label)} value={loadingCustomer ? '...' : formatCurrency(Math.abs(net))} />
}

function SupplierBalance({ movement }: { movement: CashboxMovement }) {
  const t = useTranslations('finance')
  const { supplierDebt, loadingSupplier } = movement.debts
  const tone: NoteTone = supplierDebt === null ? 'slate' : supplierDebt > 0 ? 'rose' : 'emerald'
  const value = loadingSupplier || supplierDebt === null ? '...' : formatCurrency(Math.abs(supplierDebt))
  return <BalanceNote tone={tone} label={t((supplierDebt ?? 0) < 0 ? 'supplierOverpaid' : 'supplierOwed')} value={value} />
}
