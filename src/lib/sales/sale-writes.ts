export const raise = (error: { message: string } | null | undefined) => {
  if (error) throw new Error(error.message, { cause: error })
}

export async function addToCustomerCredit(supabase: any, customerId: string | null, amount: number) {
  if (!customerId || amount <= 0) return
  const { data, error } = await supabase.from('customers').select('credit_balance').eq('id', customerId).single()
  raise(error)
  const { error: updateError } = await supabase
    .from('customers')
    .update({ credit_balance: (Number(data?.credit_balance) || 0) + amount })
    .eq('id', customerId)
  raise(updateError)
}
