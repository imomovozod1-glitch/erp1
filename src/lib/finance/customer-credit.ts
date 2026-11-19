export interface CreditApplication {
  appliedCredit: number
  remainingAmount: number
}

const noCredit = (amount: number): CreditApplication => ({ appliedCredit: 0, remainingAmount: amount })

// Spends a customer's credit (haqdorlik) before any of a purchase becomes new debt.
// No cashbox or transaction: the credit was already counted as income when it accrued.
export async function applyCustomerCredit(supabase: any, customerId: string, amount: number): Promise<CreditApplication> {
  const { data: customer, error } = await supabase.from('customers').select('credit_balance').eq('id', customerId).single()
  if (error || !customer) {
    console.warn('Failed to fetch customer credit balance:', error?.message)
    return noCredit(amount)
  }

  const credit = Number(customer.credit_balance) || 0
  if (credit <= 0) return noCredit(amount)

  const appliedCredit = Math.min(credit, amount)
  const { error: updateError } = await supabase
    .from('customers')
    .update({ credit_balance: credit - appliedCredit })
    .eq('id', customerId)
  if (updateError) {
    console.warn('Failed to deduct customer credit balance:', updateError.message)
    return noCredit(amount)
  }
  return { appliedCredit, remainingAmount: amount - appliedCredit }
}
