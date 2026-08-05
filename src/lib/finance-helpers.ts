import { createClient } from '@/lib/supabase/client';

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
    console.warn('Supabase cashboxes update failed, falling back to LocalStorage:', err);
    // If Supabase failed or table doesn't exist, we fall back to updating localStorage
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
          console.error('Failed to update local cashboxes fallback:', e);
        }
      }
    }
  }
}
