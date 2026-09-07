import type { TelegramEvent } from '@/lib/integrations/telegram-events'

type NotifyPayload =
  | { event: 'sale'; data: { orderNumber: string; total: number; paymentMethod: string; itemCount: number; customerName?: string | null } }
  | { event: 'new_order'; data: { orderNumber: string; total: number; customerName?: string | null } }
  | { event: 'low_stock'; data: { productName: string; sku: string; stock: number; minStock: number } }
  | { event: 'debt_payment'; data: { customerName: string; amount: number } }

/**
 * Fires a Telegram notification from a client component, after the business
 * write it describes has already succeeded.
 *
 * Fire-and-forget by contract: it never throws and never rejects. A sale must
 * complete even if the tenant's bot token was revoked or Telegram is down, so
 * the caller should NOT await this inside its own try/catch success path — a
 * rejected promise there would surface as a failed sale to the cashier.
 *
 * Only a structured payload is sent; the message wording is built server-side
 * (see /api/integrations/telegram/notify) so the endpoint can't be used to
 * make the tenant's bot post arbitrary text.
 */
export function fireTelegramNotification(payload: NotifyPayload): void {
  try {
    void fetch('/api/integrations/telegram/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Never let a notification break the flow that triggered it.
  }
}

export type { TelegramEvent }
