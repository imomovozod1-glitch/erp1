import { createClient } from '@/lib/supabase/client';

class InsufficientFundsError extends Error {
  constructor(balance: number, amount: number) {
    super(`Insufficient funds: cashbox balance is ${balance}, cannot withdraw ${amount}`);
    this.name = 'InsufficientFundsError';
  }
}

/** Picks which cashbox a payment should land in: prefer one matching `cashboxType`
 *  (e.g. a card payment goes into the "card" cashbox), then the main/first cashbox. */
function pickTargetCashbox(cashboxes: any[], cashboxType?: string) {
  if (cashboxType) {
    const typed = cashboxes.find((c: any) => c.type === cashboxType);
    if (typed) return typed;
  }
  return cashboxes.find((c: any) =>
    c.name.toLowerCase().includes('asosiy') ||
    c.name.toLowerCase().includes('main')
  ) || cashboxes[0];
}

function updateLocalCashboxes(change: number, amount: number, type: 'income' | 'expense', cashboxType?: string) {
  if (typeof window === 'undefined') return;

  const localData = localStorage.getItem('erp_cashboxes');
  if (!localData) return;

  try {
    const localCashboxes = JSON.parse(localData);
    if (localCashboxes.length === 0) return;

    const target = pickTargetCashbox(localCashboxes, cashboxType);
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

    let targetCashboxId = null;
    let currentBalance = 0;

    if (cashboxes && cashboxes.length > 0) {
      // Prefer a cashbox matching the payment method (e.g. card payment → the "card" cashbox),
      // falling back to the primary/first cashbox when none matches.
      const targetCb = pickTargetCashbox(cashboxes, cashboxType);
      targetCashboxId = targetCb.id;
      currentBalance = Number(targetCb.balance) || 0;
    }

    // A cashbox can never go negative — block any expense larger than what's actually in it
    if (type === 'expense' && amount > currentBalance) {
      throw new InsufficientFundsError(currentBalance, amount);
    }

    const newBalance = currentBalance + change;

    if (targetCashboxId) {
      // Update existing cashbox
      const { error: updateErr } = await supabase
        .from('cashboxes')
        .update({ balance: newBalance })
        .eq('id', targetCashboxId);

      if (updateErr) throw updateErr;
    } else {
      // Insert a new cashbox if none exists
      const { error: insertErr } = await supabase
        .from('cashboxes')
        .insert({
          name: 'Asosiy Kassa',
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
          if (localCashboxes.length > 0) {
            const target = pickTargetCashbox(localCashboxes, cashboxType);
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
