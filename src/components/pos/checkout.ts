import { generateDocumentNumber, isoDate } from '@/lib/utils'
import { debtDueDate, PosSaleError, type PosSaleInput, type PosSaleResult } from '@/components/pos/checkout-shared'
import { createSaleRpc, SaleCreateError } from '@/lib/sale-create'
import { submitPosSaleInBrowser } from '@/components/pos/checkout-in-browser'
import { lineTotal } from '@/components/pos/pos-sale-model'

/**
 * Committing a POS sale: one `create_sale` call — one transaction, stock rows locked so two
 * tills cannot sell the same last unit. Failures are thrown worded from `messages`.
 */

export { PosSaleError, type PosPaymentMethod, type PosSaleInput, type PosSaleResult } from '@/components/pos/checkout-shared'

export async function submitPosSale(input: PosSaleInput): Promise<PosSaleResult> {
  const { supabase, orderNumber, items, customer, paymentMethod, totals, messages } = input
  const invoiceNumber = generateDocumentNumber('INV-POS')
  const orderDate = isoDate()

  try {
    const sale = await createSaleRpc(supabase, {
      channel: 'pos',
      orderNumber,
      invoiceNumber,
      customerId: customer?.id ?? null,
      paymentMethod,
      totals,
      orderDate,
      dueDate: debtDueDate(),
      items: items.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        unitPrice: item.product.price,
        discountPercent: item.discountPercent,
        totalPrice: lineTotal(item),
      })),
    })
    if (sale) {
      return {
        orderId: sale.orderId,
        invoiceNumber: sale.invoiceNumber,
        orderDate,
        stockBefore: sale.stockBefore,
        appliedCredit: sale.appliedCredit,
      }
    }
  } catch (error) {
    if (error instanceof SaleCreateError) {
      if (error.code === 'insufficient_stock') {
        const name =
          items.find((item) => item.product.id === error.details.productId)?.product.name ??
          error.details.productName ??
          ''
        throw new PosSaleError(`${messages.insufficientStock}: ${name}`)
      }
      throw new PosSaleError(error.code === 'forbidden' ? messages.forbidden : messages.customerRequired)
    }
    throw error
  }

  return submitPosSaleInBrowser(input, invoiceNumber, orderDate)
}
