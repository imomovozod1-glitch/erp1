import { createClient } from '@/lib/supabase/client';

class InsufficientFundsError extends Error {
  constructor(balance: number, amount: number) {
    super(`Insufficient funds: cashbox balance is ${balance}, cannot withdraw ${amount}`);
    this.name = 'InsufficientFundsError';
  }
}

export const CASHBOX_TYPE_NAMES: Record<string, string> = {
  cash: 'Naqd kassa',
  card: 'Karta kassasi',
  transfer: "O'tkazma kassasi",
  other: 'Boshqa kassa',
};

/**
 * Picks which cashbox a payment should land in: prefer one matching
 * `cashboxType` (e.g. a card payment goes into the "card" cashbox), then the
 * main/first cashbox. Returns `null` when a specific `cashboxType` was
 * requested but no cashbox of that type exists yet — the caller must create
 * one rather than silently crediting an unrelated cashbox (a card sale
 * landing in the cash drawer's balance was a real reported bug: with no
 * "card" cashbox configured, every payment method funneled into whichever
 * cashbox happened to be first).
 */
function pickTargetCashbox(cashboxes: any[], cashboxType?: string) {
  if (cashboxType) {
    return cashboxes.find((c: any) => c.type === cashboxType) || null;
  }
  return cashboxes.find((c: any) =>
    c.name.toLowerCase().includes('asosiy') ||
    c.name.toLowerCase().includes('main')
  ) || cashboxes[0] || null;
}

function updateLocalCashboxes(change: number, amount: number, type: 'income' | 'expense', cashboxType?: string) {
  if (typeof window === 'undefined') return;

  const localData = localStorage.getItem('erp_cashboxes');
  if (!localData) return;

  try {
    const localCashboxes = JSON.parse(localData);
    if (localCashboxes.length === 0) return;

    const target = pickTargetCashbox(localCashboxes, cashboxType);

    if (!target) {
      // No cashbox of the requested type exists locally either — create one
      // rather than silently crediting an unrelated cashbox.
      if (type === 'expense' && amount > 0) {
        throw new InsufficientFundsError(0, amount);
      }
      localCashboxes.push({
        id: `local-${Date.now()}`,
        name: CASHBOX_TYPE_NAMES[cashboxType || 'other'] || 'Boshqa kassa',
        type: cashboxType || 'other',
        balance: change,
        description: 'Sotuvlar va tolovlar uchun avtomatik yaratilgan kassa',
      });
      localStorage.setItem('erp_cashboxes', JSON.stringify(localCashboxes));
      return;
    }

    const index = localCashboxes.findIndex((c: any) => c.id === target.id);
    const currentBalance = Number(localCashboxes[index].balance) || 0;

    // A cashbox can never go negative — block any expense larger than what's actually in it
    if (type === 'expense' && amount > currentBalance) {
      throw new InsufficientFundsError(currentBalance, amount);
    }

    localCashboxes[index].balance = currentBalance + change;
    localStorage.setItem('erp_cashboxes', JSON.stringify(localCashboxes));
  } catch (e) {
    if (e instanceof InsufficientFundsError) throw e;
    console.error('Failed to update local cashboxes:', e);
  }
}

/**
 * Consumes a customer's existing credit/deposit balance (haqdorlik) against a new
 * purchase, before any of it is allowed to become new debt (qarz). This is what
 * makes "customer overpaid last time, now buys on credit" net out correctly instead
 * of showing both a credit balance and a fresh debt at the same time.
 *
 * Returns how much of the purchase was covered by existing credit, and how much
 * remains to be invoiced as new debt. Does NOT touch the cashbox or create a
 * transaction — the credit was already recorded as income when it first accrued,
 * so spending it down here must not double-count that revenue.
 */
export async function applyCustomerCredit(supabase: any, customerId: string, amount: number): Promise<{ appliedCredit: number; remainingAmount: number }> {
  const { data: customer, error } = await supabase
    .from('customers')
    .select('credit_balance')
    .eq('id', customerId)
    .single();

  if (error || !customer) {
    console.warn('Failed to fetch customer credit balance:', error?.message);
    return { appliedCredit: 0, remainingAmount: amount };
  }

  const currentCredit = Number(customer.credit_balance) || 0;
  if (currentCredit <= 0) {
    return { appliedCredit: 0, remainingAmount: amount };
  }

  const appliedCredit = Math.min(currentCredit, amount);
  const { error: updateErr } = await supabase
    .from('customers')
    .update({ credit_balance: currentCredit - appliedCredit })
    .eq('id', customerId);

  if (updateErr) {
    console.warn('Failed to deduct customer credit balance:', updateErr.message);
    return { appliedCredit: 0, remainingAmount: amount };
  }

  return { appliedCredit, remainingAmount: amount - appliedCredit };
}

export async function adjustCashboxBalance(amount: number, type: 'income' | 'expense', supabaseInput?: any, cashboxType?: 'cash' | 'card' | 'transfer' | 'other') {
  const supabase = supabaseInput || createClient();
  const change = type === 'income' ? amount : -amount;

  try {
    // 1. Fetch cashboxes
    const { data: cashboxes, error } = await supabase
      .from('cashboxes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase cashboxes query error:', error.message);
      throw error;
    }

    // Prefer a cashbox matching the payment method (e.g. card payment → the
    // "card" cashbox), falling back to the primary/first cashbox only when
    // no `cashboxType` was requested. `null` here means either no cashboxes
    // exist yet, or none of them match the requested type — both cases need
    // a new cashbox created rather than crediting an unrelated one.
    const targetCb = cashboxes && cashboxes.length > 0 ? pickTargetCashbox(cashboxes, cashboxType) : null;
    const currentBalance = targetCb ? Number(targetCb.balance) || 0 : 0;

    // A cashbox can never go negative — block any expense larger than what's actually in it
    if (type === 'expense' && amount > currentBalance) {
      throw new InsufficientFundsError(currentBalance, amount);
    }

    if (targetCb) {
      const { error: updateErr } = await supabase
        .from('cashboxes')
        .update({ balance: currentBalance + change })
        .eq('id', targetCb.id);

      if (updateErr) throw updateErr;
    } else {
      // No cashbox exists yet for this payment method — create one instead
      // of silently mixing the funds into whichever cashbox happens to be first.
      const resolvedType = cashboxType || 'cash';
      const { error: insertErr } = await supabase
        .from('cashboxes')
        .insert({
          name: CASHBOX_TYPE_NAMES[resolvedType] || 'Asosiy Kassa',
          type: resolvedType,
          balance: change,
          description: 'Sotuvlar va tolovlar uchun avtomatik yaratilgan kassa'
        });

      if (insertErr) throw insertErr;
    }

    // Update localStorage to stay in sync with cashbox-client fallback
    if (typeof window !== 'undefined') {
      const localData = localStorage.getItem('erp_cashboxes');
      if (localData) {
        try {
          const localCashboxes = JSON.parse(localData);
          const target = localCashboxes.length > 0 ? pickTargetCashbox(localCashboxes, cashboxType) : null;
          if (target) {
            const index = localCashboxes.findIndex((c: any) => c.id === target.id);
            localCashboxes[index].balance = (Number(localCashboxes[index].balance) || 0) + change;
            localStorage.setItem('erp_cashboxes', JSON.stringify(localCashboxes));
          }
        } catch (e) {
          console.error('Failed to update local cashboxes:', e);
        }
      }
    }
  } catch (err) {
    // A validation failure (insufficient funds) is a real rejection, not a connectivity
    // problem — it must never be silently swallowed by the offline fallback below.
    if (err instanceof InsufficientFundsError) {
      throw err;
    }

    console.warn('Supabase cashboxes update failed, falling back to LocalStorage:', err);
    // If Supabase failed or table doesn't exist, we fall back to updating localStorage
    updateLocalCashboxes(change, amount, type, cashboxType);
  }
}
