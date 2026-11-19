'use client'

import { useState } from 'react'
import type { PosPaymentMethod } from '@/components/pos/checkout'

/** Who the sale is for and how it is paid — chosen beside the basket, reset with it. */
export function usePosSale(initialCustomers: any[]) {
  const [customers, setCustomers] = useState(initialCustomers)
  const [customer, setCustomer] = useState<any | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>('cash')

  const addCustomer = (created: any) => {
    setCustomers((current) => [...current, created])
    setCustomer(created)
  }

  const reset = () => {
    setCustomer(null)
    setPaymentMethod('cash')
  }

  const chooseCustomer = (id: string) => setCustomer(customers.find((c) => c.id === id) ?? null)

  return { customers, customer, chooseCustomer, addCustomer, paymentMethod, setPaymentMethod, reset, blocked: paymentMethod === 'debt' && !customer }
}

export type PosSale = ReturnType<typeof usePosSale>
