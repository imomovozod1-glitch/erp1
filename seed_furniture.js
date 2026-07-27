const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

const USER_ID = '282450d3-b5bb-4a96-94bc-e10251ba8faf'; // The existing user ID in auth.users

async function seed() {
  console.log('Starting seed process for Furniture Business ERP...');

  try {
    // 1. Create Profile for the existing user
    console.log('1. Creating user profile...');
    const { error: profileErr } = await supabase
      .from('profiles')
      .upsert({
        id: USER_ID,
        full_name: 'Administrator (Mebel ERP)',
        email: 'a@gmail.com',
        role: 'admin',
        phone: '+998 90 123 45 67',
        is_active: true
      });
    if (profileErr) throw new Error('Error seeding profile: ' + profileErr.message);

    // 2. Clear old data from bottom-up (dependencies first)
    console.log('2. Clearing old transactional data...');
    await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('stock_movements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('invoices').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('sales_order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('sales_orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('purchase_order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('purchase_orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('employees').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('suppliers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('departments').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 3. Departments
    console.log('3. Seeding departments...');
    const { data: depts, error: deptsErr } = await supabase
      .from('departments')
      .insert([
        { name: 'Ishlab chiqarish (Mebel seh)', description: 'Mebel tayyorlash va yig\'ish sehi' },
        { name: 'Sotuv va Marketing', description: 'Mebel shourumi va buyurtmalar bilan ishlash' },
        { name: 'Dizayn va Loyihalash', description: '3D modellashtirish va dizayn bo\'limi' },
        { name: 'Moliya va Buxgalteriya', description: 'Kompaniya xarajatlari va daromadlari nazorati' }
      ])
      .select();
    if (deptsErr) throw new Error('Error seeding departments: ' + deptsErr.message);
    
    const productionDept = depts.find(d => d.name.includes('Ishlab chiqarish'));
    const salesDept = depts.find(d => d.name.includes('Sotuv'));

    // Link admin profile to Moliya dept
    await supabase.from('profiles').update({ department_id: depts.find(d => d.name.includes('Moliya')).id }).eq('id', USER_ID);

    // 4. Employees
    console.log('4. Seeding employees...');
    const { error: empErr } = await supabase
      .from('employees')
      .insert([
        { employee_code: 'EMP-001', position: 'Bosh Mebelsoz', salary: 6500000, hired_at: '2025-01-10', is_active: true, notes: 'Yog\'och va MDF bilan ishlash ustasi' },
        { employee_code: 'EMP-002', position: 'Sotuv Menejeri', salary: 4000000, hired_at: '2025-02-15', is_active: true, notes: 'Mijozlar bilan ishlash bo\'yicha mas\'ul' },
        { employee_code: 'EMP-003', position: 'Mebel Dizayneri', salary: 5500000, hired_at: '2025-03-01', is_active: true, notes: '3D Max va AutoCAD ustasi' }
      ]);
    if (empErr) throw new Error('Error seeding employees: ' + empErr.message);

    // 5. Customers
    console.log('5. Seeding customers...');
    const { data: custs, error: custsErr } = await supabase
      .from('customers')
      .insert([
        { name: 'Sherzod Karimov', email: 'sherzod@mail.ru', phone: '+998 93 321 65 43', address: 'Toshkent sh., Yunusobod t.', city: 'Toshkent', tin: '512984712', is_active: true },
        { name: 'Dilnoza Olimova', email: 'dilnoza@gmail.com', phone: '+998 94 987 65 43', address: 'Samarqand sh., Registon ko\'chasi', city: 'Samarqand', tin: '612348512', is_active: true },
        { name: 'Grand Office MCHJ', email: 'office@grand.uz', phone: '+998 71 200 40 40', address: 'Toshkent sh., Chilonzor t.', city: 'Toshkent', tin: '304918234', is_active: true }
      ])
      .select();
    if (custsErr) throw new Error('Error seeding customers: ' + custsErr.message);

    // 6. Suppliers
    console.log('6. Seeding suppliers...');
    const { data: supps, error: suppsErr } = await supabase
      .from('suppliers')
      .insert([
        { name: 'WoodLand MDF Co', email: 'info@woodland.uz', phone: '+998 90 999 88 77', address: 'Toshkent vil., Zangiota t.', city: 'Toshkent', tin: '201928374', contact_person: 'Jasur Mirzayev', is_active: true },
        { name: 'Premium Fabrics (Mebel Matolari)', email: 'sales@fabrics.uz', phone: '+998 97 777 66 55', address: 'Toshkent sh., Uchtepa t.', city: 'Toshkent', tin: '203849182', contact_person: 'Aziza Rahimova', is_active: true },
        { name: 'MetalLock Hardware (Furnitura)', email: 'hardware@lock.uz', phone: '+998 91 555 44 33', address: 'Farg\'ona sh., Mustaqillik ko\'chasi', city: 'Farg\'ona', tin: '209384812', contact_person: 'Rustam Karimov', is_active: true }
      ])
      .select();
    if (suppsErr) throw new Error('Error seeding suppliers: ' + suppsErr.message);

    // 7. Categories
    console.log('7. Seeding categories...');
    const { data: cats, error: catsErr } = await supabase
      .from('categories')
      .insert([
        { name: 'Mehmonxona mebellari', slug: 'mehmonxona-mebellari', description: 'Divanlar, kreslolar, TV stendlar' },
        { name: 'Yotoqxona mebellari', slug: 'yotoqxona-mebellari', description: 'Krovatlar, shkaflar, tryumolar' },
        { name: 'Ofis mebellari', slug: 'ofis-mebellari', description: 'Ofis stollari, stullari, javonlar' },
        { name: 'Xomashyolar (Laminat, MDF)', slug: 'xomashyolar', description: 'Mebel ishlab chiqarish uchun materiallar' },
        { name: 'Furnitura va Jihozlar', slug: 'furnitura', description: 'Petlyalar, ruchkalar, bolt va mixlar' }
      ])
      .select();
    if (catsErr) throw new Error('Error seeding categories: ' + catsErr.message);

    const livingRoomCat = cats.find(c => c.slug === 'mehmonxona-mebellari');
    const bedroomCat = cats.find(c => c.slug === 'yotoqxona-mebellari');
    const officeCat = cats.find(c => c.slug === 'ofis-mebellari');
    const rawCat = cats.find(c => c.slug === 'xomashyolar');
    const hardwareCat = cats.find(c => c.slug === 'furnitura');

    // 8. Products (Furniture & Materials)
    console.log('8. Seeding products...');
    const { data: prods, error: prodsErr } = await supabase
      .from('products')
      .insert([
        // Finished Goods
        { name: 'Divan Chesterfield Premium', sku: 'FUR-SOF-001', description: 'Tabiiy charmdan tayyorlangan hashamatli divan', category_id: livingRoomCat.id, unit: 'dona', price: 12500000, cost_price: 7200000, incoming_cost: 6500000, stock: 5, min_stock: 2, is_active: true },
        { name: 'Ikki kishilik krovat "Royal"', sku: 'FUR-BED-002', description: 'Ortopedik matrasli, MDF ramkali yotoqxona krovati', category_id: bedroomCat.id, unit: 'dona', price: 6800000, cost_price: 3900000, incoming_cost: 3500000, stock: 8, min_stock: 3, is_active: true },
        { name: 'Yozuv stoli "Loft Oak"', sku: 'FUR-TAB-003', description: 'Metal karkasli, eman usti qoplangan zamonaviy stol', category_id: officeCat.id, unit: 'dona', price: 2900000, cost_price: 1550000, incoming_cost: 1400000, stock: 12, min_stock: 5, is_active: true },
        { name: 'Ofis o\'rindig\'i "ErgoComfort"', sku: 'FUR-CHR-004', description: 'Ergonomik, setkali ortopedik ofis stuli', category_id: officeCat.id, unit: 'dona', price: 1850000, cost_price: 950000, incoming_cost: 850000, stock: 20, min_stock: 8, is_active: true },
        
        // Raw materials & hardware (Usually used in Procurement)
        { name: 'Laminatlangan MDF (18mm, Eman)', sku: 'RAW-MDF-001', description: 'Rossiya mebel laminat listi', category_id: rawCat.id, unit: 'm²', price: 180000, cost_price: 110000, incoming_cost: 110000, stock: 150, min_stock: 50, is_active: true },
        { name: 'Mebel matosi "Turkiya Baxmal"', sku: 'RAW-FAB-002', description: 'Qalin va chidamli divan matosi', category_id: rawCat.id, unit: 'metr', price: 90000, cost_price: 52000, incoming_cost: 52000, stock: 240, min_stock: 100, is_active: true },
        { name: 'Mebel petlyasi (Blum)', sku: 'HW-PET-001', description: 'Yumshoq yopiluvchi mebel eshik petlyasi', category_id: hardwareCat.id, unit: 'dona', price: 25000, cost_price: 14000, incoming_cost: 14000, stock: 600, min_stock: 200, is_active: true }
      ])
      .select();
    if (prodsErr) throw new Error('Error seeding products: ' + prodsErr.message);

    const sofa = prods.find(p => p.sku === 'FUR-SOF-001');
    const bed = prods.find(p => p.sku === 'FUR-BED-002');
    const mdf = prods.find(p => p.sku === 'RAW-MDF-001');
    const hinge = prods.find(p => p.sku === 'HW-PET-001');

    // 9. Sales Orders & Items (Sales history)
    console.log('9. Seeding sales orders...');
    const { data: sOrders, error: sOrdersErr } = await supabase
      .from('sales_orders')
      .insert([
        { order_number: 'SO-90182471', customer_id: custs[0].id, status: 'delivered', total_amount: 19300000, notes: 'Uygacha yetkazib va o\'rnatib berish bepul', created_by: USER_ID, order_date: '2026-07-15' },
        { order_number: 'SO-29384722', customer_id: custs[2].id, status: 'confirmed', total_amount: 14500000, notes: 'Ofis uchun 5 dona stol buyurtmasi', created_by: USER_ID, order_date: '2026-07-25' }
      ])
      .select();
    if (sOrdersErr) throw new Error('Error seeding sales orders: ' + sOrdersErr.message);

    const { error: sItemsErr } = await supabase
      .from('sales_order_items')
      .insert([
        // SO-90182471
        { order_id: sOrders[0].id, product_id: sofa.id, quantity: 1, unit_price: 12500000, total_price: 12500000 },
        { order_id: sOrders[0].id, product_id: bed.id, quantity: 1, unit_price: 6800000, total_price: 6800000 },
        
        // SO-29384722
        { order_id: sOrders[1].id, product_id: prods.find(p => p.sku === 'FUR-TAB-003').id, quantity: 5, unit_price: 2900000, total_price: 14500000 }
      ]);
    if (sItemsErr) throw new Error('Error seeding sales order items: ' + sItemsErr.message);

    // 10. Invoices (Linked to Sales)
    console.log('10. Seeding invoices...');
    const { data: invs, error: invsErr } = await supabase
      .from('invoices')
      .insert([
        { invoice_number: 'INV-100293', order_id: sOrders[0].id, customer_id: custs[0].id, status: 'paid', total_amount: 19300000, paid_amount: 19300000, issued_at: '2026-07-15', due_at: '2026-07-25', paid_at: '2026-07-16', created_by: USER_ID },
        { invoice_number: 'INV-100294', order_id: sOrders[1].id, customer_id: custs[2].id, status: 'sent', total_amount: 14500000, paid_amount: 7000000, issued_at: '2026-07-25', due_at: '2026-08-05', created_by: USER_ID }
      ])
      .select();
    if (invsErr) throw new Error('Error seeding invoices: ' + invsErr.message);

    // 11. Purchase Orders (Procurement of raw materials)
    console.log('11. Seeding purchase orders...');
    const { data: pOrders, error: pOrdersErr } = await supabase
      .from('purchase_orders')
      .insert([
        { po_number: 'PO-88273948', supplier_id: supps[0].id, status: 'received', total_amount: 5500000, notes: 'MDF materiallari qabul qilindi', created_by: USER_ID },
        { po_number: 'PO-10029481', supplier_id: supps[2].id, status: 'sent', total_amount: 2800000, notes: 'Eshik furniturasi uchun yangi buyurtma', created_by: USER_ID }
      ])
      .select();
    if (pOrdersErr) throw new Error('Error seeding purchase orders: ' + pOrdersErr.message);

    const { error: pItemsErr } = await supabase
      .from('purchase_order_items')
      .insert([
        // PO-88273948 (WoodLand MDF Co)
        { po_id: pOrders[0].id, product_id: mdf.id, quantity: 50, unit_cost: 110000, received_qty: 50, total_cost: 5500000 },
        // PO-10029481 (MetalLock Hardware)
        { po_id: pOrders[1].id, product_id: hinge.id, quantity: 200, unit_cost: 14000, received_qty: 0, total_cost: 2800000 }
      ]);
    if (pItemsErr) throw new Error('Error seeding purchase order items: ' + pItemsErr.message);

    // 12. Stock Movements
    console.log('12. Seeding stock movements...');
    const { error: smErr } = await supabase
      .from('stock_movements')
      .insert([
        // Sales outgoing movements
        { product_id: sofa.id, type: 'out', quantity: 1, quantity_before: 6, quantity_after: 5, reference_type: 'sales_order', reference_id: sOrders[0].id, reason: 'Sale SO-90182471', created_by: USER_ID },
        { product_id: bed.id, type: 'out', quantity: 1, quantity_before: 9, quantity_after: 8, reference_type: 'sales_order', reference_id: sOrders[0].id, reason: 'Sale SO-90182471', created_by: USER_ID },
        
        // Purchase incoming movements
        { product_id: mdf.id, type: 'in', quantity: 50, quantity_before: 100, quantity_after: 150, reference_type: 'purchase_order', reference_id: pOrders[0].id, reason: 'Procurement PO-88273948', created_by: USER_ID }
      ]);
    if (smErr) throw new Error('Error seeding stock movements: ' + smErr.message);

    // 13. Transactions (Finance logs)
    console.log('13. Seeding financial transactions...');
    const { error: txErr } = await supabase
      .from('transactions')
      .insert([
        // Sales Incomes
        { type: 'income', amount: 19300000, category: 'sales', description: 'SO-90182471 buyurtma uchun to\'liq to\'lov (Sherzod Karimov)', transaction_date: '2026-07-16', created_by: USER_ID },
        { type: 'income', amount: 7000000, category: 'sales', description: 'SO-29384722 buyurtma uchun avans to\'lovi (Grand Office MCHJ)', transaction_date: '2026-07-26', created_by: USER_ID },
        
        // Procurement Expenses
        { type: 'expense', amount: 5500000, category: 'utilities', description: 'PO-88273948 buyurtma uchun WoodLand Co firmasiga to\'lov', transaction_date: '2026-07-18', created_by: USER_ID },
        
        // Running Expenses
        { type: 'expense', amount: 3500000, category: 'rent', description: 'Mebel shourumi uchun oylik ijara to\'lovi', transaction_date: '2026-07-05', created_by: USER_ID },
        { type: 'expense', amount: 6500000, category: 'salary', description: 'Usta Bosh Mebelsoz (EMP-001) uchun maosh to\'lovi', transaction_date: '2026-07-10', created_by: USER_ID }
      ]);
    if (txErr) throw new Error('Error seeding transactions: ' + txErr.message);

    console.log('Database seeding completed successfully!');
    console.log('Successfully seeded:');
    console.log('- 1 Admin Profile (for user a@gmail.com)');
    console.log('- 4 Departments & 3 Employees');
    console.log('- 3 Customers & 3 Suppliers');
    console.log('- 5 Furniture Categories');
    console.log('- 7 Products (Finished goods and raw materials)');
    console.log('- 2 Sales Orders (1 Delivered, 1 Confirmed)');
    console.log('- 2 Invoices (1 Paid, 1 Sent)');
    console.log('- 2 Purchase Orders');
    console.log('- 3 Stock Movements');
    console.log('- 5 Financial Transactions (2 Income, 3 Expenses)');
    
  } catch (err) {
    console.error('Fatal Seeding Error:', err.message);
    process.exit(1);
  }
}

seed();
