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
