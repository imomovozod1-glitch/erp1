'use client'

import { useState } from 'react'
import { loadCustomerBalance, loadSupplierDebt, type CustomerBalance } from './cashbox-debts'

export interface CashboxDebts {
  customer: CustomerBalance | null
  supplierDebt: number | null
  loadingCustomer: boolean
  loadingSupplier: boolean
  selectCustomer: (customerId: string) => void
  selectSupplier: (supplierId: string) => void
  reset: () => void
}

export function useCashboxDebts(supabase: any, offline: boolean): CashboxDebts {
  const [customer, setCustomer] = useState<CustomerBalance | null>(null)
  const [supplierDebt, setSupplierDebt] = useState<number | null>(null)
  const [loadingCustomer, setLoadingCustomer] = useState(false)
  const [loadingSupplier, setLoadingSupplier] = useState(false)

  const selectCustomer = async (customerId: string) => {
    if (!customerId) return setCustomer(null)
    setLoadingCustomer(true)
    try {
      setCustomer(await loadCustomerBalance(supabase, customerId, offline))
    } catch (error) {
      console.error('Customer debt lookup failed:', error)
      setCustomer({ debt: 0, credit: 0 })
    } finally {
      setLoadingCustomer(false)
    }
  }

  const selectSupplier = async (supplierId: string) => {
    if (!supplierId) return setSupplierDebt(null)
    setLoadingSupplier(true)
    try {
      setSupplierDebt(await loadSupplierDebt(supabase, supplierId, offline))
    } catch (error) {
      console.error('Supplier debt lookup failed:', error)
      setSupplierDebt(null)
    } finally {
      setLoadingSupplier(false)
    }
  }

  const reset = () => {
    setCustomer(null)
    setSupplierDebt(null)
  }

  return { customer, supplierDebt, loadingCustomer, loadingSupplier, selectCustomer, selectSupplier, reset }
}
