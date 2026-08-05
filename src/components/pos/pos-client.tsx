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
  Store,
  Scale
} from 'lucide-react'
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

      // 1. Fetch current profile to get cashier name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      const cashierName = profile?.full_name || 'Cashier'

      // 2. Validate current stock values just before inserting
      for (const item of cart) {
        const { data: freshProd } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.product.id)
          .single()
        
        if (!freshProd || freshProd.stock < item.quantity) {
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

      // 4. Create Order Items
      const itemsToInsert = cart.map((item) => ({
        order_id: orderData.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price,
        discount_percent: item.discountPercent,
        total_price: (item.product.price * (1 - item.discountPercent / 100)) * item.quantity
      }))

      const { error: itemsErr } = await supabase.from('sales_order_items').insert(itemsToInsert)
      if (itemsErr) throw itemsErr

      // 5. Create Financial Transaction Entry
      const { error: txErr } = await supabase.from('transactions').insert({
        type: 'income',
        amount: totalPayable,
        category: 'Sales',
        description: `POS Sale - Order #${orderData.order_number}`,
        reference_type: 'sales_orders',
        reference_id: orderData.id,
        transaction_date: orderDateStr,
        created_by: user.id
      })
      if (txErr) throw txErr

      // 6. Loop to update stock levels and insert stock movements log
      for (const item of cart) {
        const newStock = item.product.stock - item.quantity

        const { error: prodErr } = await supabase
          .from('products')
          .update({ stock: newStock })
          .eq('id', item.product.id)
        if (prodErr) throw prodErr

        const { error: moveErr } = await supabase.from('stock_movements').insert({
          product_id: item.product.id,
          type: 'out',
          quantity: item.quantity,
          quantity_before: item.product.stock,
          quantity_after: newStock,
          reference_type: 'sales_orders',
          reference_id: orderData.id,
          reason: 'POS Sale',
          created_by: user.id
        })
        if (moveErr) throw moveErr
      }

      // 7. Auto-create Invoice if paid (Cash, Card, Transfer) and update cash register balance
      if (paymentMethod !== 'debt') {
        const generatedInvoiceNumber = generatePOSInvoiceNumber()
        await supabase.from('invoices').insert({
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
        })
        await adjustCashboxBalance(totalPayable, 'income', supabase)
      }

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
    <div className="space-y-6">
      {/* Print Style Injection */}
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
      `}</style>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
        {/* Left Side: Product catalog and search */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            {/* SKU & Title Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder={t('searchProduct')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyPress}
                className="pl-9 h-11 bg-white border-slate-200 focus-visible:ring-indigo-500 rounded-xl"
              />
            </div>
            
            {/* Category Select */}
            <Select value={selectedCategory} onValueChange={(val) => setSelectedCategory(val || 'all')}>
              <SelectTrigger className="w-full md:w-56 h-11 bg-white border-slate-200 rounded-xl">
                <SelectValue placeholder={t('selectCategory')}>
                  {selectedCategory === 'all'
                    ? t('selectCategory')
                    : categories.find((c) => c.id === selectedCategory)?.name || selectedCategory}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('selectCategory')}</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
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
              className={`rounded-full shrink-0 text-xs ${
                selectedCategory === 'all'
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              {t('selectCategory')}
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(cat.id)}
                className={`rounded-full shrink-0 text-xs ${
                  selectedCategory === cat.id
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                {cat.name}
              </Button>
            ))}
          </div>

          {/* Products Grid */}
          {filteredProducts.length === 0 ? (
            <Card className="border-0 shadow-sm py-16 text-center bg-white rounded-2xl">
              <CardContent className="flex flex-col items-center gap-3">
                <Scale className="h-10 w-10 text-slate-300" />
                <p className="text-slate-500 font-medium">{t('noProducts')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {filteredProducts.map((p) => {
                const isOutOfStock = p.stock <= 0
                const isLowStock = p.stock > 0 && p.stock <= p.min_stock
                return (
                  <Card
                    key={p.id}
                    onClick={() => !isOutOfStock && addToCart(p)}
                    className={`border border-slate-100 hover:border-indigo-100 shadow-xs hover:shadow-md transition-all rounded-2xl cursor-pointer bg-white overflow-hidden group select-none ${
                      isOutOfStock ? 'opacity-50 pointer-events-none' : ''
                    }`}
                  >
                    <CardContent className="p-4 flex flex-col justify-between h-36">
                      <div className="space-y-1">
                        <div className="flex justify-between items-start gap-2">
                          <p className="font-semibold text-slate-800 line-clamp-2 text-sm group-hover:text-indigo-600 transition-colors">
                            {p.name}
                          </p>
                        </div>
                        <code className="text-[10px] text-slate-400 font-mono tracking-wider">
                          {p.sku}
                        </code>
                      </div>

                      <div className="flex items-end justify-between mt-2 pt-2 border-t border-slate-50">
                        <p className="font-bold text-slate-900 text-sm md:text-base">
                          {formatCurrency(p.price)}
                        </p>
                        
                        <div>
                          {isOutOfStock ? (
                            <Badge variant="destructive" className="text-[10px] py-0 px-1.5 font-semibold bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-50">
                              {t('outOfStock')}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className={`text-[10px] py-0 px-1.5 font-semibold ${
                                isLowStock
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              {p.stock} {p.unit || tCommon('pieces')}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Side: Cart list, customer selector, checkout */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-0 shadow-sm rounded-2xl bg-white flex flex-col min-h-[580px] justify-between">
            {/* Cart Header */}
            <CardHeader className="p-4 border-b flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-slate-800">{t('cart')}</CardTitle>
                  <CardDescription className="text-[10px]">{cart.length} {tCommon('rows')}</CardDescription>
                </div>
              </div>
              {cart.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearCart}
                  className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 text-xs px-2 h-8 rounded-lg cursor-pointer"
                >
                  {tCommon('clear')}
                </Button>
              )}
            </CardHeader>

            {/* Cart Scrollable Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[320px]">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400 space-y-2">
                  <Store className="h-8 w-8 opacity-30" />
                  <p className="text-xs font-medium">{t('emptyCart')}</p>
                </div>
              ) : (
                cart.map((item) => {
                  const finalPrice = item.product.price * (1 - item.discountPercent / 100)
                  return (
                    <div
                      key={item.product.id}
                      className="p-3 bg-slate-50/50 hover:bg-slate-50 transition-colors border border-slate-100 rounded-xl space-y-2.5"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold text-slate-800 leading-tight">
                            {item.product.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {formatCurrency(item.product.price)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFromCart(item.product.id)}
                          className="h-6 w-6 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        {/* Quantity picker */}
                        <div className="flex items-center border border-slate-200 bg-white rounded-lg overflow-hidden h-7">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            className="px-2 h-full text-slate-500 hover:bg-slate-50 transition-colors border-r"
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
                            className="w-9 text-center text-xs font-bold text-slate-800 focus:outline-none focus:bg-slate-50 h-full border-0 p-0"
                          />
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                            className="px-2 h-full text-slate-500 hover:bg-slate-50 transition-colors border-l"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        {/* Item discount input */}
                        <div className="flex items-center gap-1.5">
                          <Percent className="h-3.5 w-3.5 text-slate-400" />
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={item.discountPercent || ''}
                            onChange={(e) => updateItemDiscount(item.product.id, Number(e.target.value))}
                            placeholder="0"
                            className="w-12 h-7 text-xs text-center border-slate-200 bg-white rounded-lg p-0.5"
                          />
                          <span className="text-[10px] text-slate-400 font-bold">%</span>
                        </div>

                        <p className="text-xs font-bold text-slate-800">
                          {formatCurrency(finalPrice * item.quantity)}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Checkout Totals & Settings */}
            <div className="p-4 border-t bg-slate-50/20 space-y-4">
              {/* Linked Customer Selection */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-600">{t('customer')}</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddCustomerOpen(true)}
                    className="h-6 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-1.5 rounded cursor-pointer"
                  >
                    <UserPlus className="h-3 w-3 mr-1" />
                    {t('addCustomer')}
                  </Button>
                </div>

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
                  <SelectTrigger className="w-full h-9 bg-white border-slate-200 rounded-lg text-xs">
                    <SelectValue placeholder={t('walkInCustomer')}>
                      {selectedCustomer
                        ? `${selectedCustomer.name}${selectedCustomer.phone ? ` (${selectedCustomer.phone})` : ''}`
                        : t('walkInCustomer')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="walk-in">{t('walkInCustomer')}</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* General Discount */}
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-slate-500">{t('generalDiscount')}</Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min="0"
                    value={generalDiscountValue || ''}
                    onChange={(e) => setGeneralDiscountValue(Number(e.target.value))}
                    placeholder="0"
                    className="h-8 text-xs border-slate-200 bg-white rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setGeneralDiscountType(generalDiscountType === 'flat' ? 'percent' : 'flat')}
                    className="h-8 px-2 text-xs border-slate-200 bg-white rounded-lg"
                  >
                    {generalDiscountType === 'percent' ? '%' : 'so\'m'}
                  </Button>
                </div>
              </div>

              {/* Totals Breakdown */}
              <div className="space-y-1.5 pt-2 border-t border-dashed border-slate-200">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{t('subtotal')}</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {calculatedDiscount > 0 && (
                  <div className="flex justify-between text-xs text-rose-500">
                    <span>{t('discount')}</span>
                    <span>-{formatCurrency(calculatedDiscount)}</span>
                  </div>
                )}
                {taxActive && (
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{t('tax')}</span>
                    <span>{formatCurrency(calculatedTax)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-slate-800 pt-1">
                  <span>{t('total')}</span>
                  <span className="text-indigo-600 text-base">{formatCurrency(totalPayable)}</span>
                </div>
              </div>

              {/* Payment Methods Grid */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-semibold text-slate-500">{t('paymentMethod')}</Label>
                <div className="grid grid-cols-4 gap-1.5">
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
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border text-[9px] font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                            : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className="h-4 w-4 mb-1" />
                        <span className="text-center leading-none">{pm.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Checkout Button */}
              <Button
                onClick={handleCheckout}
                disabled={cart.length === 0 || isLoadingCheckout}
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl cursor-pointer transition-colors shadow-sm"
              >
                {isLoadingCheckout ? tCommon('saving') : t('checkout')}
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
              <Label htmlFor="custAddress">{t('customerAddress')}</Label>
              <Input
                id="custAddress"
                value={newCustomerAddress}
                onChange={(e) => setNewCustomerAddress(e.target.value)}
                placeholder="Toshkent sh., Chilonzor t."
                className="border-slate-200 focus-visible:ring-indigo-500 rounded-lg"
              />
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
