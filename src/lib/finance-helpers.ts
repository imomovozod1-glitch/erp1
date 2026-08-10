import { createClient } from '@/lib/supabase/client';

class InsufficientFundsError extends Error {
  constructor(balance: number, amount: number) {
    super(`Insufficient funds: cashbox balance is ${balance}, cannot withdraw ${amount}`);
    this.name = 'InsufficientFundsError';
  }
}

function updateLocalCashboxes(change: number, amount: number, type: 'income' | 'expense') {
  if (typeof window === 'undefined') return;

  const localData = localStorage.getItem('erp_cashboxes');
  if (!localData) return;

  try {
    const localCashboxes = JSON.parse(localData);
    if (localCashboxes.length === 0) return;

    const mainIndex = localCashboxes.findIndex((c: any) =>
      c.name.toLowerCase().includes('asosiy') ||
      c.name.toLowerCase().includes('main')
    );
    const index = mainIndex !== -1 ? mainIndex : 0;
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

export async function adjustCashboxBalance(amount: number, type: 'income' | 'expense', supabaseInput?: any) {
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
      // Find the primary or main cashbox, or use the first one
      const mainCb = cashboxes.find((c: any) =>
        c.name.toLowerCase().includes('asosiy') ||
        c.name.toLowerCase().includes('main')
      ) || cashboxes[0];
      targetCashboxId = mainCb.id;
      currentBalance = Number(mainCb.balance) || 0;
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
            const mainIndex = localCashboxes.findIndex((c: any) =>
              c.name.toLowerCase().includes('asosiy') ||
              c.name.toLowerCase().includes('main')
            );
            const index = mainIndex !== -1 ? mainIndex : 0;
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
    updateLocalCashboxes(change, amount, type);
  }
}
