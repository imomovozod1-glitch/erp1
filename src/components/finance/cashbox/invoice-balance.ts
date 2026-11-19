export const outstandingOf = (invoice: any) =>
  (Number(invoice.total_amount) || 0) - (Number(invoice.paid_amount) || 0)

export const sumOutstanding = (invoices: any[]) => invoices.reduce((sum, invoice) => sum + outstandingOf(invoice), 0)

export const isOpenInvoiceOf = (customerId: string) => (invoice: any) =>
  invoice.customer_id === customerId && invoice.status !== 'paid' && invoice.status !== 'cancelled'
