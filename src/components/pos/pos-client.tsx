'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import {
  Search,
  Plus,
  Minus,
  Trash2,
  UserPlus,
  Printer,
  CreditCard,
  Wallet,
  ArrowRightLeft,
  AlertTriangle,
  Percent,
  CheckCircle2,
  ShoppingBag,
  Scale,
  MapPin,
  Loader2
} from 'lucide-react'
import dynamic from 'next/dynamic'

// Load MapPicker dynamically for Next.js SSR compatibility
const MapPicker = dynamic(() => import('@/components/sales/map-picker').then(mod => mod.MapPicker), {
  ssr: false,
  loading: () => (
    <div className="w-full h-70 bg-slate-50 border border-dashed rounded-xl flex flex-col items-center justify-center space-y-2">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
    </div>
  )
})
import { createClient } from '@/lib/supabase/client'
import { adjustCashboxBalance } from '@/lib/finance-helpers'
import {
  invalidateProducts,
  invalidateOrders,
  invalidateOrderItems,
  invalidateTransactions,
  invalidateMovements,
  invalidateCustomers
} from '@/lib/data/revalidate'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSidebar } from '@/components/ui/sidebar'
import { StatusBadge } from '@/components/shared/status-badge'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'

// Module-level pure helper functions to satisfy strict React compiler rules
function generatePOSOrderNumber(): string {
  return `SO-POS-${Date.now().toString().slice(-6)}`
}

function generatePOSInvoiceNumber(): string {
  return `INV-POS-${Date.now().toString().slice(-6)}`
}

function getPOSDateString(): string {
  return new Date().toISOString().split('T')[0]
}

interface POSClientProps {
  initialProducts: any[]
  initialCategories: any[]
  initialCustomers: any[]
  lang: string
}

interface CartItem {
  product: any
  quantity: number
  discountPercent: number
}

export function POSClient({
  initialProducts,
  initialCategories,
  initialCustomers,
  lang
}: POSClientProps) {
  const t = useTranslations('pos')
  const tCommon = useTranslations('common')
  const { state: sidebarState, isMobile: isSidebarMobile } = useSidebar()

  // State
  const [products, setProducts] = useState(initialProducts)
  const [categories] = useState(initialCategories)
  const [customers, setCustomers] = useState(initialCustomers)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [cart, setCart] = useState<CartItem[]>([])
  
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [generalDiscountType, setGeneralDiscountType] = useState<'percent' | 'flat'>('flat')
  const [generalDiscountValue, setGeneralDiscountValue] = useState<number>(0)
  const [taxActive, setTaxActive] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'debt'>('cash')

  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false)
  const [checkoutSuccessOrder, setCheckoutSuccessOrder] = useState<any>(null)
  
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [newCustomerAddress, setNewCustomerAddress] = useState('')
  const [newCustomerLat, setNewCustomerLat] = useState<number | null>(null)
  const [newCustomerLng, setNewCustomerLng] = useState<number | null>(null)
  const [isCustomerMapOpen, setIsCustomerMapOpen] = useState(false)

  const searchInputRef = useRef<HTMLInputElement>(null)

  // Focus search input on mount for barcode scanner readiness
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [])

  // Filtered products list
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory =
      selectedCategory === 'all' || p.category_id === selectedCategory
    return matchesSearch && matchesCategory
  })

  // Cart operations
  const addToCart = (product: any) => {
    if (product.stock <= 0) {
      toast.error(t('insufficientStock'))
      return
    }

    const existingIndex = cart.findIndex((item) => item.product.id === product.id)
    if (existingIndex > -1) {
      const existingItem = cart[existingIndex]
      if (existingItem.quantity >= product.stock) {
        toast.error(t('insufficientStock'))
        return
      }
      const updated = [...cart]
      updated[existingIndex].quantity += 1
      setCart(updated)
    } else {
      setCart([...cart, { product, quantity: 1, discountPercent: 0 }])
    }
  }

  const updateQuantity = (productId: string, quantity: number) => {
    const item = cart.find((i) => i.product.id === productId)
    if (!item) return

    if (quantity > item.product.stock) {
      toast.error(t('insufficientStock'))
      return
    }

    if (quantity <= 0) {
      removeFromCart(productId)
      return
    }

    setCart(cart.map((i) => (i.product.id === productId ? { ...i, quantity } : i)))
  }

  const updateItemDiscount = (productId: string, discountPercent: number) => {
    const val = Math.max(0, Math.min(100, discountPercent))
    setCart(cart.map((i) => (i.product.id === productId ? { ...i, discountPercent: val } : i)))
  }

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product.id !== productId))
  }

  const clearCart = () => {
    setCart([])
    setSelectedCustomer(null)
    setGeneralDiscountValue(0)
    setTaxActive(false)
    setPaymentMethod('cash')
  }

  // Auto-add product if SKU is exact barcode scanner match on Enter
  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const trimmed = searchQuery.trim()
      if (!trimmed) return

      const matched = products.find(
        (p) => p.sku.toLowerCase() === trimmed.toLowerCase()
      )

      if (matched) {
        addToCart(matched)
        setSearchQuery('')
        toast.success(`${matched.name} ${tCommon('success')}`)
      } else {
        toast.error(lang === 'uz' ? 'Mahsulot topilmadi' : 'Product not found')
      }
    }
  }

  // Financial calculations
  const subtotal = cart.reduce((sum, item) => {
    const originalPrice = item.product.price * item.quantity
    const itemDiscount = originalPrice * (item.discountPercent / 100)
    return sum + (originalPrice - itemDiscount)
  }, 0)

  const calculatedDiscount =
    generalDiscountType === 'percent'
      ? subtotal * (generalDiscountValue / 100)
      : Math.min(subtotal, generalDiscountValue)

  const postDiscountTotal = subtotal - calculatedDiscount
  const calculatedTax = 0
  const totalPayable = postDiscountTotal

  // Save new customer quick add
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCustomerName.trim()) return

    const supabase = createClient() as any
    const { data, error } = await supabase
      .from('customers')
      .insert({
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim() || null,
        address: newCustomerAddress.trim() || null,
        latitude: newCustomerLat,
        longitude: newCustomerLng,
        is_active: true
      })
      .select()
      .single()

    if (error) {
      toast.error(error.message)
    } else {
      toast.success(tCommon('success'))
      setCustomers([...customers, data])
      setSelectedCustomer(data)
      setIsAddCustomerOpen(false)
      setNewCustomerName('')
      setNewCustomerPhone('')
      setNewCustomerAddress('')
      setNewCustomerLat(null)
      setNewCustomerLng(null)
      await invalidateCustomers()
    }
  }

  // POS Checkout Transaction Process
  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error(t('emptyCart'))
      return
    }

    // Debt requires a customer
    if (paymentMethod === 'debt' && !selectedCustomer) {
      toast.error(lang === 'uz' ? 'Qarzga sotish uchun mijozni tanlang!' : 'Select customer for debt sale!')
      return
    }

    setIsLoadingCheckout(true)
    const supabase = createClient() as any

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error(tCommon('sessionNotFound'))

      // 1 & 2. Fetch cashier profile and current stock for all cart items in parallel
      const [{ data: profile }, { data: freshProducts }] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', user.id).single(),
        supabase.from('products').select('id, stock').in('id', cart.map((item) => item.product.id)),
      ])

      const cashierName = profile?.full_name || 'Cashier'

      // Validate current stock values just before inserting
      const stockById = new Map<string, number>((freshProducts || []).map((p: any) => [p.id, Number(p.stock)]))
      for (const item of cart) {
        const currentStock = stockById.get(item.product.id)
        if (currentStock === undefined || currentStock < item.quantity) {
          throw new Error(`${t('insufficientStock')}: ${item.product.name}`)
        }
      }

      const generatedOrderNumber = generatePOSOrderNumber()
      const orderDateStr = getPOSDateString()

      // 3. Create Sales Order
      const { data: orderData, error: orderErr } = await supabase
        .from('sales_orders')
        .insert({
          order_number: generatedOrderNumber,
          customer_id: selectedCustomer ? selectedCustomer.id : null,
          status: 'confirmed',
          total_amount: totalPayable,
          discount_amount: calculatedDiscount,
          tax_amount: calculatedTax,
          notes: `POS Sale - Paid via ${paymentMethod.toUpperCase()}`,
          created_by: user.id,
          order_date: orderDateStr
        })
        .select()
        .single()

      if (orderErr) throw orderErr

      // 4-7. Everything below only depends on orderData.id, not on each other —
      // fire them all in parallel instead of awaiting one round-trip at a time.
      const itemsToInsert = cart.map((item) => ({
        order_id: orderData.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price,
        discount_percent: item.discountPercent,
        total_price: (item.product.price * (1 - item.discountPercent / 100)) * item.quantity
      }))

      const stockAndMovementUpdates = cart.flatMap((item) => {
        const newStock = item.product.stock - item.quantity
        return [
          supabase
            .from('products')
            .update({ stock: newStock })
            .eq('id', item.product.id)
            .then(({ error }: any) => { if (error) throw error }),
          supabase.from('stock_movements').insert({
            product_id: item.product.id,
            type: 'out',
            quantity: item.quantity,
            quantity_before: item.product.stock,
            quantity_after: newStock,
            reference_type: 'sales_orders',
            reference_id: orderData.id,
            reason: 'POS Sale',
            created_by: user.id
          }).then(({ error }: any) => { if (error) throw error }),
        ]
      })

      const generatedInvoiceNumber = paymentMethod !== 'debt' ? generatePOSInvoiceNumber() : null

      await Promise.all([
        supabase.from('sales_order_items').insert(itemsToInsert).then(({ error }: any) => { if (error) throw error }),
        supabase.from('transactions').insert({
          type: 'income',
          amount: totalPayable,
          category: 'Sales',
          description: `POS Sale - Order #${orderData.order_number}`,
          reference_type: 'sales_orders',
          reference_id: orderData.id,
          transaction_date: orderDateStr,
          created_by: user.id
        }).then(({ error }: any) => { if (error) throw error }),
        ...stockAndMovementUpdates,
        // Auto-create Invoice if paid (Cash, Card, Transfer) and update cash register balance
        generatedInvoiceNumber
          ? supabase.from('invoices').insert({
              invoice_number: generatedInvoiceNumber,
              order_id: orderData.id,
              customer_id: selectedCustomer ? selectedCustomer.id : null,
              status: 'paid',
              total_amount: totalPayable,
              paid_amount: totalPayable,
              issued_at: orderDateStr,
              due_at: orderDateStr,
              paid_at: orderDateStr,
              notes: `Paid instantly on POS via ${paymentMethod}`,
              created_by: user.id
            }).then(({ error }: any) => { if (error) throw error })
          : Promise.resolve(),
        paymentMethod !== 'debt' ? adjustCashboxBalance(totalPayable, 'income', supabase) : Promise.resolve(),
      ])

      // Success
      toast.success(t('orderSuccess'))

      // Set state to trigger printing modal
      setCheckoutSuccessOrder({
        orderNumber: generatedOrderNumber,
        date: new Date().toLocaleString(),
        cashier: cashierName,
        customerName: selectedCustomer ? selectedCustomer.name : t('walkInCustomer'),
        items: cart.map((i) => ({
          name: i.product.name,
          quantity: i.quantity,
          price: i.product.price,
          discount: i.discountPercent,
          total: (i.product.price * (1 - i.discountPercent / 100)) * i.quantity
        })),
        subtotal,
        discount: calculatedDiscount,
        tax: calculatedTax,
        total: totalPayable,
        paymentMethod
      })

      // Update local product stocks state
      const updatedProducts = products.map((p) => {
        const cartItem = cart.find((ci) => ci.product.id === p.id)
        if (cartItem) {
          return { ...p, stock: p.stock - cartItem.quantity }
        }
        return p
      })
      setProducts(updatedProducts)

      // Revalidate cache
      await Promise.all([
        invalidateProducts(),
        invalidateOrders(),
        invalidateOrderItems(),
        invalidateTransactions(),
        invalidateMovements(),
        invalidateCustomers()
      ])

      // Reset cart
      setCart([])
      setSelectedCustomer(null)
      setGeneralDiscountValue(0)
      setTaxActive(false)
      setPaymentMethod('cash')

    } catch (error: any) {
      toast.error(error.message || tCommon('error'))
    } finally {
      setIsLoadingCheckout(false)
    }
  }

  // Native POS Printing trigger
  const triggerPrintReceipt = () => {
    window.print()
  }

  return (
    <div
      className={`relative select-none md:fixed md:top-16 md:right-0 md:bottom-0 md:flex md:flex-col md:overflow-hidden md:p-6 transition-[left] duration-200 ease-linear ${
        isSidebarMobile ? 'md:left-0' : sidebarState === 'expanded' ? 'md:left-(--sidebar-width)' : 'md:left-(--sidebar-width-icon)'
      }`}
    >
      {/* Print & Scrollbar Style Injection */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #pos-thermal-receipt, #pos-thermal-receipt * {
            visibility: visible;
          }
          #pos-thermal-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            padding: 4mm;
            background: white;
            color: black;
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
          }
          .no-print {
            display: none !important;
          }
        }
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-thin::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 9999px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print items-stretch md:h-full md:min-h-0 md:flex-1 overflow-hidden">
        {/* Left Side: Product catalog and search — the ONLY area that scrolls */}
        <div className="md:col-span-2 md:h-full md:flex md:flex-col md:min-h-0 space-y-5">
          <div className="shrink-0 space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              {/* SKU & Title Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  ref={searchInputRef}
                  placeholder={t('searchProduct')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyPress}
                  className="pl-10 h-12 bg-slate-100/50 border-0 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-indigo-500/10 focus-visible:border-indigo-500 rounded-xl transition-all shadow-inner text-sm text-slate-800"
                />
              </div>
              
              {/* Category Select */}
              <Select value={selectedCategory} onValueChange={(val) => setSelectedCategory(val || 'all')}>
                <SelectTrigger className="w-full md:w-56 h-12 bg-slate-100/50 border-0 rounded-xl shadow-inner focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-xs font-semibold text-slate-700">
                  <SelectValue placeholder={t('selectCategory')}>
                    {selectedCategory === 'all'
                      ? t('selectCategory')
                      : categories.find((c) => c.id === selectedCategory)?.name || selectedCategory}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100 shadow-xl bg-white">
                  <SelectItem value="all" className="text-xs font-medium">{t('selectCategory')}</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs font-medium">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category Tabs Scrollbar (Billz / Bito style) */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                onClick={() => setSelectedCategory('all')}
                className={`rounded-full shrink-0 text-xs px-4 h-9 shadow-xs transition-all duration-200 border-0 ${
                  selectedCategory === 'all'
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold shadow-[0_4px_12px_rgba(99,102,241,0.25)]'
                    : 'bg-slate-100/70 hover:bg-slate-200/80 text-slate-600 hover:text-slate-800'
                }`}
              >
                {t('selectCategory')}
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.id ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`rounded-full shrink-0 text-xs px-4 h-9 shadow-xs transition-all duration-200 border-0 ${
                    selectedCategory === cat.id
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold shadow-[0_4px_12px_rgba(99,102,241,0.25)]'
                      : 'bg-slate-100/70 hover:bg-slate-200/80 text-slate-600 hover:text-slate-800'
                  }`}
                >
                  {cat.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Products Grid Wrapper — the only scrollable region on this page */}
          <div className="md:flex-1 md:overflow-y-auto md:min-h-0 pr-1 pb-4 scrollbar-thin">
            {filteredProducts.length === 0 ? (
              <Card className="border-0 shadow-[0_8px_30px_rgba(0,0,0,0.02)] py-20 text-center bg-white rounded-2xl">
                <CardContent className="flex flex-col items-center gap-3">
                  <Scale className="h-10 w-10 text-slate-300" />
                  <p className="text-slate-400 font-semibold text-sm">{t('noProducts')}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map((p) => {
                  const isOutOfStock = p.stock <= 0
                  const isLowStock = p.stock > 0 && p.stock <= p.min_stock
                  return (
                    <Card
                      key={p.id}
                      onClick={() => !isOutOfStock && addToCart(p)}
                      className={`border border-slate-200 hover:border-indigo-300 hover:-translate-y-0.5 shadow-sm hover:shadow-md transition-all duration-200 rounded-xl cursor-pointer bg-white overflow-hidden group select-none py-0 ${
                        isOutOfStock ? 'opacity-50 pointer-events-none' : ''
                      }`}
                    >
                      <CardContent className="p-3.5 flex flex-col justify-between h-34 gap-2">
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-800 text-xs sm:text-sm line-clamp-2 leading-snug group-hover:text-indigo-700 transition-colors">
                            {p.name}
                          </p>
                          <code className="text-[10px] text-slate-400 font-mono tracking-wider">
                            {p.sku}
                          </code>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <p className="font-bold text-indigo-700 text-sm md:text-base">
                            {formatCurrency(p.price)}
                          </p>

                          {isOutOfStock ? (
                            <StatusBadge tone="rose" label={t('outOfStock')} />
                          ) : (
                            <StatusBadge
                              tone={isLowStock ? 'amber' : 'emerald'}
                              label={`${p.stock} ${p.unit || tCommon('pieces')}`}
                              className="px-1.5 py-0 text-[10px]"
                            />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Cart, customer selector, checkout — fixed to the viewport, never scrolls as a whole */}
        <div className="md:col-span-1 md:h-full md:flex md:flex-col md:min-h-0 overflow-hidden">
          <Card className="border border-slate-100/60 shadow-[0_8px_30px_rgba(0,0,0,0.03)] rounded-2xl bg-white flex flex-col h-full min-h-0 overflow-hidden">
            {/* Cart Header */}
            <CardHeader className="shrink-0 p-4 bg-gradient-to-br from-indigo-50/70 via-white to-white border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-xl shadow-[0_4px_10px_rgba(99,102,241,0.25)]">
                  <ShoppingBag className="h-4.5 w-4.5" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-800">{t('cart')}</CardTitle>
                  <span className="inline-flex items-center mt-0.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md">
                    {cart.length} {tCommon('rows')}
                  </span>
                </div>
              </div>
              {cart.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearCart}
                  className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-xs px-2.5 h-8 rounded-lg cursor-pointer transition-all"
                >
                  {tCommon('clear')}
                </Button>
              )}
            </CardHeader>

            {/* Cart Items — reserved for at least 3 cards before this ever needs to scroll */}
            <div className="flex-1 min-h-58 overflow-y-auto scrollbar-thin p-3 space-y-2">
              {cart.length === 0 ? (
                <div className="h-full min-h-52 flex flex-col items-center justify-center text-center text-slate-400 gap-3">
                  <div className="p-5 rounded-full border-2 border-dashed border-slate-200 animate-pulse">
                    <ShoppingBag className="h-7 w-7 text-slate-300" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-500">{t('emptyCart')}</p>
                    <p className="text-[11px] text-slate-350">
                      {lang === 'uz' ? "Mahsulotni bosing yoki SKU'ni skanerlang" : lang === 'ru' ? 'Нажмите на товар или отсканируйте SKU' : 'Click a product or scan its SKU'}
                    </p>
                  </div>
                </div>
              ) : (
                cart.map((item) => {
                  const finalPrice = item.product.price * (1 - item.discountPercent / 100)
                  return (
                    <div
                      key={item.product.id}
                      className="p-2.5 bg-slate-50/30 hover:bg-slate-50/60 transition-all border border-slate-100/70 rounded-xl shadow-2xs"
                    >
                      <div className="flex justify-between items-center gap-2">
                        <p className="text-xs font-bold text-slate-800 leading-tight truncate">
                          {item.product.name}
                          <span className="font-medium text-slate-400"> · {formatCurrency(item.product.price)}</span>
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFromCart(item.product.id)}
                          className="h-6 w-6 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <div className="flex items-center justify-between gap-1.5 mt-1.5">
                        {/* Quantity picker */}
                        <div className="flex items-center border border-slate-200/50 bg-white rounded-lg overflow-hidden h-7 shadow-3xs shrink-0">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            className="px-2 h-full text-slate-500 hover:bg-slate-50 transition-colors border-r border-slate-100"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={item.quantity === 0 ? '' : item.quantity}
                            onChange={(e) => {
                              const rawVal = e.target.value
                              if (rawVal === '') {
                                setCart(cart.map((i) => (i.product.id === item.product.id ? { ...i, quantity: 0 } : i)))
                                return
                              }
                              const val = parseInt(rawVal, 10)
                              if (!isNaN(val)) {
                                updateQuantity(item.product.id, val)
                              }
                            }}
                            onBlur={() => {
                              if (item.quantity <= 0) {
                                removeFromCart(item.product.id)
                              }
                            }}
                            className="w-8 text-center text-xs font-bold text-slate-800 focus:outline-none focus:bg-slate-50 h-full border-0 p-0"
                          />
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                            className="px-2 h-full text-slate-500 hover:bg-slate-50 transition-colors border-l border-slate-100"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        {/* Item discount input */}
                        <div className="flex items-center gap-1 shrink-0">
                          <Percent className="h-3 w-3 text-slate-400" />
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={item.discountPercent || ''}
                            onChange={(e) => updateItemDiscount(item.product.id, Number(e.target.value))}
                            placeholder="0"
                            className="w-9 h-7 text-xs text-center border border-slate-200/50 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all p-1 shadow-3xs"
                          />
                        </div>

                        <p className="text-xs font-bold text-slate-800 ml-auto truncate">
                          {formatCurrency(finalPrice * item.quantity)}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Checkout Totals & Settings — compact "options" style footer, fixed, never scrolls or shrinks */}
            <div className="shrink-0 p-3 border-t border-slate-100 bg-slate-50/10 space-y-2">
              {/* Linked Customer Selection — select + add button on one row, no separate label line */}
              <div className="flex items-center gap-1.5">
                <Select
                  value={selectedCustomer ? selectedCustomer.id : 'walk-in'}
                  onValueChange={(val) => {
                    if (val === 'walk-in') {
                      setSelectedCustomer(null)
                    } else {
                      const cust = customers.find((c) => c.id === val)
                      setSelectedCustomer(cust)
                    }
                  }}
                >
                  <SelectTrigger className="flex-1 min-w-0 h-8 bg-slate-100/50 border-0 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 shadow-2xs font-medium text-slate-700">
                    <SelectValue placeholder={t('walkInCustomer')}>
                      {selectedCustomer
                        ? `${selectedCustomer.name}${selectedCustomer.phone ? ` (${selectedCustomer.phone})` : ''}`
                        : t('walkInCustomer')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-100 bg-white">
                    <SelectItem value="walk-in" className="text-xs font-medium">{t('walkInCustomer')}</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs font-medium">
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddCustomerOpen(true)}
                  title={t('addCustomer')}
                  className="h-8 w-8 p-0 shrink-0 border-slate-200 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 rounded-lg cursor-pointer transition-all"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* General Discount — inline label, no separate row */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide w-14 shrink-0">
                  {t('generalDiscount')}
                </span>
                <Input
                  type="number"
                  min="0"
                  value={generalDiscountValue || ''}
                  onChange={(e) => setGeneralDiscountValue(Number(e.target.value))}
                  placeholder="0"
                  className="h-8 flex-1 min-w-0 text-xs border-0 bg-slate-100/50 rounded-lg focus-visible:ring-2 focus-visible:ring-indigo-500/10 focus-visible:border-indigo-500 shadow-2xs text-slate-800"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setGeneralDiscountType(generalDiscountType === 'flat' ? 'percent' : 'flat')}
                  className="h-8 px-2.5 shrink-0 text-xs border-0 bg-slate-100 hover:bg-slate-200/80 text-slate-600 rounded-lg transition-all cursor-pointer font-bold shadow-2xs"
                >
                  {generalDiscountType === 'percent' ? '%' : 'so\'m'}
                </Button>
              </div>

              {/* Totals Breakdown — receipt-style summary card */}
              <div className="rounded-lg bg-slate-50/70 border border-slate-100 p-2.5 space-y-1">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{t('subtotal')}</span>
                  <span className="font-medium text-slate-600">{formatCurrency(subtotal)}</span>
                </div>
                {calculatedDiscount > 0 && (
                  <div className="flex justify-between text-xs text-rose-600 font-medium">
                    <span>{t('discount')}</span>
                    <span>-{formatCurrency(calculatedDiscount)}</span>
                  </div>
                )}
                {taxActive && (
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{t('tax')}</span>
                    <span className="font-medium text-slate-600">{formatCurrency(calculatedTax)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm font-bold text-slate-800 pt-1 border-t border-dashed border-slate-200 mt-1">
                  <span>{t('total')}</span>
                  <span className="text-indigo-600 text-base font-extrabold">{formatCurrency(totalPayable)}</span>
                </div>
              </div>

              {/* Payment Method — minimal segmented control */}
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{t('paymentMethod')}</span>
                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100/70 rounded-lg">
                  {[
                    { key: 'cash', label: t('cash'), icon: Wallet },
                    { key: 'card', label: t('card'), icon: CreditCard },
                    { key: 'transfer', label: t('transfer'), icon: ArrowRightLeft },
                    { key: 'debt', label: t('debt'), icon: AlertTriangle }
                  ].map((pm) => {
                    const Icon = pm.icon
                    const isSelected = paymentMethod === pm.key
                    return (
                      <button
                        key={pm.key}
                        type="button"
                        onClick={() => setPaymentMethod(pm.key as any)}
                        title={pm.label}
                        className={`flex flex-col items-center justify-center gap-0.5 h-9 rounded-md text-[9px] font-bold transition-all duration-150 cursor-pointer ${
                          isSelected
                            ? 'bg-white text-indigo-700 shadow-[0_1px_4px_rgba(15,23,42,0.08)]'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        <Icon className="h-3 w-3" />
                        <span className="leading-none truncate max-w-full px-0.5">{pm.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Checkout Button */}
              <Button
                onClick={handleCheckout}
                disabled={cart.length === 0 || isLoadingCheckout}
                className="w-full h-10 gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm rounded-xl cursor-pointer transition-all duration-250 shadow-[0_6px_18px_rgba(16,185,129,0.3)] active:scale-[0.98] border-0"
              >
                {isLoadingCheckout ? tCommon('saving') : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    {t('checkout')}
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* QUICK ADD CUSTOMER DIALOG */}
      <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white border-0 shadow-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-800">{t('quickAddCustomer')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddCustomer} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="custName">{t('customerName')} *</Label>
              <Input
                id="custName"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="Sherzod Karimov"
                required
                className="border-slate-200 focus-visible:ring-indigo-500 rounded-lg"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="custPhone">{t('customerPhone')}</Label>
              <Input
                id="custPhone"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
                className="border-slate-200 focus-visible:ring-indigo-500 rounded-lg"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="custAddress" className="flex items-center gap-1.5">
                {t('customerAddress')}
                {typeof newCustomerLat === 'number' && typeof newCustomerLng === 'number' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                    <MapPin className="h-2.5 w-2.5" />
                    {lang === 'uz' ? 'Xaritada belgilangan' : lang === 'ru' ? 'Отмечено на карте' : 'Pinned'}
                  </span>
                )}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="custAddress"
                  value={newCustomerAddress}
                  onChange={(e) => setNewCustomerAddress(e.target.value)}
                  placeholder="Toshkent sh., Chilonzor t."
                  className="border-slate-200 focus-visible:ring-indigo-500 rounded-lg flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCustomerMapOpen(true)}
                  className="h-9 w-9 p-0 border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-indigo-600 rounded-lg shrink-0"
                  title={lang === 'uz' ? 'Xaritadan belgilash' : lang === 'ru' ? 'Отметить на карте' : 'Pick on map'}
                >
                  <MapPin className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddCustomerOpen(false)}
                className="border-slate-200 hover:bg-slate-50 rounded-lg"
              >
                {tCommon('cancel')}
              </Button>
              <Button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
              >
                {tCommon('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {isCustomerMapOpen && (
        <Dialog open={isCustomerMapOpen} onOpenChange={setIsCustomerMapOpen}>
          <DialogContent className="max-w-2xl rounded-2xl bg-white border-0 shadow-xl p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-indigo-600" />
                {lang === 'uz' ? 'Manzilni xaritadan belgilang' : lang === 'ru' ? 'Отметьте адрес на карте' : 'Pick address on map'}
              </DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <MapPicker
                onLocationSelect={(address, lat, lng) => {
                  setNewCustomerAddress(address)
                  setNewCustomerLat(lat)
                  setNewCustomerLng(lng)
                }}
                initialAddress={newCustomerAddress}
                initialLat={newCustomerLat}
                initialLng={newCustomerLng}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                onClick={() => setIsCustomerMapOpen(false)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
              >
                {tCommon('save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* POS THERMAL RECEIPT SUCCESS DIALOG */}
      <Dialog
        open={checkoutSuccessOrder !== null}
        onOpenChange={(val) => {
          if (!val) setCheckoutSuccessOrder(null)
        }}
      >
        <DialogContent className="max-w-md rounded-2xl bg-slate-100 border-0 shadow-2xl p-6">
          <DialogHeader className="no-print">
            <div className="flex items-center gap-2 text-emerald-600 mb-1">
              <CheckCircle2 className="h-5 w-5" />
              <DialogTitle className="text-lg font-bold">{t('orderSuccess')}</DialogTitle>
            </div>
          </DialogHeader>

          {/* Receipt container */}
          <div
            id="pos-thermal-receipt"
            className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs mx-auto max-w-[320mm]"
          >
            <div className="text-center space-y-1 mb-4">
              <h2 className="text-base font-bold text-slate-800">MEBEL ERP SYSTEM</h2>
              <p className="text-[10px] text-slate-400">123 Furkat Street, Tashkent, Uzbekistan</p>
              <p className="text-[10px] text-slate-400">Tel: +998 71 200 40 40</p>
              <div className="border-b border-dashed border-slate-200 my-2" />
            </div>

            <div className="space-y-1 text-xs text-slate-600 mb-3">
              <div className="flex justify-between">
                <span>Receipt:</span>
                <span className="font-bold text-slate-800">#{checkoutSuccessOrder?.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{checkoutSuccessOrder?.date}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('cashier')}:</span>
                <span>{checkoutSuccessOrder?.cashier}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('customer')}:</span>
                <span className="font-medium text-slate-700">{checkoutSuccessOrder?.customerName}</span>
              </div>
            </div>

            <div className="border-b border-dashed border-slate-200 my-2" />

            {/* Cart Items List */}
            <div className="space-y-2 text-xs mb-3">
              {checkoutSuccessOrder?.items.map((item: any, idx: number) => (
                <div key={idx} className="space-y-0.5">
                  <div className="flex justify-between text-slate-800 font-medium">
                    <span>{item.name}</span>
                    <span>{formatCurrency(item.total)}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 flex justify-between">
                    <span>
                      {item.quantity} x {formatCurrency(item.price)}
                      {item.discount > 0 ? ` (-${item.discount}%)` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-b border-dashed border-slate-200 my-2" />

            {/* Totals Summary */}
            <div className="space-y-1.5 text-xs text-slate-600 mb-4">
              <div className="flex justify-between">
                <span>{t('subtotal')}:</span>
                <span>{formatCurrency(checkoutSuccessOrder?.subtotal || 0)}</span>
              </div>
              {checkoutSuccessOrder?.discount > 0 && (
                <div className="flex justify-between text-rose-500">
                  <span>{t('discount')}:</span>
                  <span>-{formatCurrency(checkoutSuccessOrder.discount)}</span>
                </div>
              )}
              {checkoutSuccessOrder?.tax > 0 && (
                <div className="flex justify-between">
                  <span>{t('tax')}:</span>
                  <span>{formatCurrency(checkoutSuccessOrder.tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-slate-800 pt-1 border-t border-slate-100">
                <span>{t('total')}:</span>
                <span>{formatCurrency(checkoutSuccessOrder?.total || 0)}</span>
              </div>
              <div className="flex justify-between text-[11px] font-semibold text-slate-500">
                <span>{t('paymentMethod')}:</span>
                <span className="uppercase">{checkoutSuccessOrder?.paymentMethod}</span>
              </div>
            </div>

            {/* Footer barcode mockup */}
            <div className="text-center space-y-1.5 pt-2 border-t border-dashed border-slate-200">
              <div className="inline-block tracking-widest font-mono text-[9px] bg-slate-100 text-slate-500 px-3 py-1 rounded">
                |||| | ||||| | || |||| | | ||| | |||
              </div>
              <p className="text-[10px] text-slate-400">Rahmat! Xaridingiz bilan tabriklaymiz.</p>
              <p className="text-[9px] text-slate-400 font-bold">powered by ERP System</p>
            </div>
          </div>

          <DialogFooter className="no-print pt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setCheckoutSuccessOrder(null)}
              className="border-slate-200 hover:bg-slate-50 rounded-xl flex-1 h-11"
            >
              {tCommon('close')}
            </Button>
            <Button
              onClick={triggerPrintReceipt}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex-1 h-11"
            >
              <Printer className="h-4 w-4 mr-2" />
              {t('printReceipt')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
