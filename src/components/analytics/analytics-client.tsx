'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { BanknotesIcon, ChartBarIcon, ShoppingCartIcon, TagIcon } from '@heroicons/react/24/outline'
import { TrendingUp, Calendar, ChevronDown, Check, ArrowRight } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { SoldProductsTable } from './sold-products-table'
import { RecentOrders } from '@/components/dashboard/recent-orders'
import { LowStockAlert } from '@/components/dashboard/low-stock-alert'

interface AnalyticsClientProps {
  lang: string
  stats: {
    aggregatedProducts: any[]
    totalRevenue: number
    totalProfit: number
    totalSold: number
    totalOrders: number
    avgOrderValue: number
    chartData: { month: string; revenue: number }[]
    rawItems?: any[]
    rawOrders?: any[]
  }
  recentOrders?: any[]
  lowStockRows?: any[]
}

const KPICard = ({ title, value, subtitle, icon: Icon, color }: any) => (
  <Card className="border-0 shadow-sm">
    <CardContent className="p-6">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
          )}
        </div>
      </div>
    </CardContent>
  </Card>
)

const formatDateISO = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function AnalyticsClient({ stats, lang, recentOrders = [], lowStockRows = [] }: AnalyticsClientProps) {
  const t = useTranslations('analytics')
  const tc = useTranslations('common')
  const td = useTranslations('dashboard')

  const [period, setPeriod] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('analytics_period')
      if (saved) return saved
    }
    return 'all'
  })

  const [customStart, setCustomStart] = useState<string>(() => {
    return formatDateISO(new Date()) + 'T00:00'
  })

  const [customEnd, setCustomEnd] = useState<string>(() => {
    return formatDateISO(new Date()) + 'T23:59'
  })

  const [tempPeriod, setTempPeriod] = useState<string>(period)
  const [tempStart, setTempStart] = useState<string>(customStart)
  const [tempEnd, setTempEnd] = useState<string>(customEnd)
  const [isOpen, setIsOpen] = useState(false)

  // Custom date/time picker mode and temp values
  const [tempMode, setTempMode] = useState<'single' | 'range'>('range')
  const [tempSingleDate, setTempSingleDate] = useState<string>(() => formatDateISO(new Date()))
  const [tempSingleStartHour, setTempSingleStartHour] = useState<string>('00:00')
  const [tempSingleEndHour, setTempSingleEndHour] = useState<string>('23:59')

  const [tempStartDateVal, setTempStartDateVal] = useState<string>(() => formatDateISO(new Date()))
  const [tempStartTimeVal, setTempStartTimeVal] = useState<string>('00:00')
  const [tempEndDateVal, setTempEndDateVal] = useState<string>(() => formatDateISO(new Date()))
  const [tempEndTimeVal, setTempEndTimeVal] = useState<string>('23:59')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('analytics_period', period)
    }
  }, [period])

  const getFilteredData = () => {
    const rawItems = stats.rawItems ?? []
    const rawOrders = stats.rawOrders ?? []

    if (period === 'all' || !stats.rawItems || !stats.rawOrders) {
      return {
        aggregatedProducts: stats.aggregatedProducts,
        totalRevenue: stats.totalRevenue,
        totalProfit: stats.totalProfit,
        totalSold: stats.totalSold,
        totalOrders: stats.totalOrders,
        avgOrderValue: stats.avgOrderValue,
        chartData: stats.chartData,
      }
    }

    const today = new Date()
    let start: Date | null = null
    let end: Date | null = null

    if (period === 'today') {
      start = new Date()
      start.setHours(0, 0, 0, 0)
      end = new Date()
      end.setHours(23, 59, 59, 999)
    } else if (period === 'yesterday') {
      start = new Date(today.getTime() - 24 * 60 * 60 * 1000)
      start.setHours(0, 0, 0, 0)
      end = new Date(today.getTime() - 24 * 60 * 60 * 1000)
      end.setHours(23, 59, 59, 999)
    } else if (period === 'week') {
      start = subDays(today, 7)
      start.setHours(0, 0, 0, 0)
      end = new Date()
      end.setHours(23, 59, 59, 999)
    } else if (period === 'month') {
      start = subDays(today, 30)
      start.setHours(0, 0, 0, 0)
      end = new Date()
      end.setHours(23, 59, 59, 999)
    } else if (period === 'thisMonth') {
      start = startOfMonth(today)
      start.setHours(0, 0, 0, 0)
      end = new Date()
      end.setHours(23, 59, 59, 999)
    } else if (period === 'lastMonth') {
      const lastMonth = subMonths(today, 1)
      start = startOfMonth(lastMonth)
      start.setHours(0, 0, 0, 0)
      end = endOfMonth(lastMonth)
      end.setHours(23, 59, 59, 999)
    } else if (period === 'custom') {
      start = customStart ? new Date(customStart.includes('T') ? customStart : customStart + 'T00:00') : null
      end = customEnd ? new Date(customEnd.includes('T') ? customEnd : customEnd + 'T23:59') : null
    }

    const filteredItems = rawItems.filter(item => {
      if (!item.sales_orders?.order_date) return false
      const d = new Date(item.sales_orders.order_date)
      return (!start || d >= start) && (!end || d <= end)
    })

    const filteredOrders = rawOrders.filter(o => {
      if (!o.order_date) return false
      const d = new Date(o.order_date)
      return (!start || d >= start) && (!end || d <= end)
    })

    // Aggregate products. Each sale of the same product can carry a different
    // realized unit_cost (the entire point of FIFO/LIFO/AVECO — later sales draw
    // from different cost layers), so cost must accumulate per line
    // (`quantity * costPrice` summed across every sale), never a single costPrice
    // from whichever line happened to be seen first multiplied by total quantity.
    const productMap: Record<string, { name: string; totalCost: number; sellingPrice: number; quantity: number; totalSum: number }> = {}
    filteredItems.forEach((item: any) => {
      const productName = item.products?.name ?? 'Unknown'
      // Realized cost at time of sale (FIFO/LIFO/AVECO) when available; falls back to
      // the product's current cost_price for sales made before this column existed.
      const costPrice = item.unit_cost ?? item.products?.cost_price ?? 0
      const sellingPrice = item.unit_price ?? item.products?.price ?? 0

      if (!productMap[productName]) {
        productMap[productName] = {
          name: productName,
          totalCost: 0,
          sellingPrice,
          quantity: 0,
          totalSum: 0,
        }
      }
      productMap[productName].quantity += item.quantity
      productMap[productName].totalSum += item.total_price
      productMap[productName].totalCost += costPrice * item.quantity
    })

    const aggregatedProducts = Object.values(productMap).map(p => ({
      ...p,
      // Weighted-average cost across every sale, for display only — profit
      // itself is computed from the accumulated totalCost, not this average.
      costPrice: p.quantity > 0 ? p.totalCost / p.quantity : 0,
      profit: p.totalSum - p.totalCost,
    })).sort((a, b) => b.totalSum - a.totalSum)

    const totalRevenue = aggregatedProducts.reduce((sum, p) => sum + p.totalSum, 0)
    const totalCost = aggregatedProducts.reduce((sum, p) => sum + p.totalCost, 0)
    const totalProfit = totalRevenue - totalCost
    const totalSold = aggregatedProducts.reduce((sum, p) => sum + p.quantity, 0)
    const totalOrdersCount = filteredOrders.length
    const avgOrderValue = totalOrdersCount ? totalRevenue / totalOrdersCount : 0

    // Chart data construction
    let chartData: { month: string; revenue: number }[] = []
    if (period === 'month' || period === 'week') {
      const dailyData: Record<string, number> = {}
      filteredOrders.forEach((o: any) => {
        const day = o.order_date?.split('T')[0] ?? 'unknown'
        if (!dailyData[day]) dailyData[day] = 0
        dailyData[day] += o.total_amount ?? 0
      })
      chartData = Object.entries(dailyData)
        .map(([day, revenue]) => ({
          month: day,
          revenue,
        }))
        .sort((a, b) => a.month.localeCompare(b.month))
    } else if (period === 'custom') {
      const start = customStart ? new Date(customStart) : null
      const end = customEnd ? new Date(customEnd) : null
      const diffMs = (end?.getTime() ?? 0) - (start?.getTime() ?? 0)
      const diffDays = diffMs / (1000 * 60 * 60 * 24)

      if (diffDays <= 2) {
        // Hourly breakdown
        const hourlyData: Record<string, number> = {}
        filteredOrders.forEach((o: any) => {
          if (!o.order_date) return
          const hour = new Date(o.order_date).toLocaleTimeString(lang === 'uz' ? 'uz-UZ' : 'ru-RU', { hour: '2-digit', minute: '2-digit' })
          if (!hourlyData[hour]) hourlyData[hour] = 0
          hourlyData[hour] += o.total_amount ?? 0
        })
        chartData = Object.entries(hourlyData)
          .map(([hour, revenue]) => ({
            month: hour,
            revenue,
          }))
          .sort((a, b) => a.month.localeCompare(b.month))
      } else if (diffDays <= 60) {
        // Daily breakdown
        const dailyData: Record<string, number> = {}
        filteredOrders.forEach((o: any) => {
          const day = o.order_date?.split('T')[0] ?? 'unknown'
          if (!dailyData[day]) dailyData[day] = 0
          dailyData[day] += o.total_amount ?? 0
        })
        chartData = Object.entries(dailyData)
          .map(([day, revenue]) => ({
            month: day,
            revenue,
          }))
          .sort((a, b) => a.month.localeCompare(b.month))
      } else {
        // Monthly breakdown
        const monthlyData: Record<string, number> = {}
        filteredOrders.forEach((o: any) => {
          const month = o.order_date?.slice(0, 7) ?? 'unknown'
          if (!monthlyData[month]) monthlyData[month] = 0
          monthlyData[month] += o.total_amount ?? 0
        })
        chartData = Object.entries(monthlyData)
          .map(([month, revenue]) => ({
            month: month,
            revenue,
          }))
          .sort((a, b) => a.month.localeCompare(b.month))
      }
    } else {
      // Today & Yesterday: Hourly distribution simulation
      chartData = [
        { month: '09:00', revenue: totalRevenue * 0.15 },
        { month: '12:00', revenue: totalRevenue * 0.35 },
        { month: '15:00', revenue: totalRevenue * 0.25 },
        { month: '18:00', revenue: totalRevenue * 0.25 },
      ]
    }

    return {
      aggregatedProducts,
      totalRevenue,
      totalProfit,
      totalSold,
      totalOrders: totalOrdersCount,
      avgOrderValue,
      chartData,
    }
  }

  const {
    aggregatedProducts,
    totalRevenue,
    totalProfit,
    totalSold,
    totalOrders,
    chartData,
  } = getFilteredData()

  const formattedChartData = chartData.map((d) => {
    let label = d.month
    if (d.month.length === 7 && d.month.includes('-')) {
      const monthPart = d.month.slice(5, 7)
      label = tc(`months.${monthPart}`)
    }
    return {
      ...d,
      monthLabel: label,
    }
  })

  // Top 5 products
  const topProducts = aggregatedProducts.slice(0, 5)

  const lowStock = (lowStockRows ?? []).filter((p) => p.stock < p.min_stock).slice(0, 5)

  const PRESETS = [
    { value: 'today', label: t('presets.today') },
    { value: 'yesterday', label: t('presets.yesterday') },
    { value: 'week', label: t('presets.week') },
    { value: 'month', label: t('presets.month') },
    { value: 'thisMonth', label: t('presets.thisMonth') },
    { value: 'lastMonth', label: t('presets.lastMonth') },
    { value: 'all', label: t('presets.all') },
    { value: 'custom', label: t('presets.custom') },
  ]

  const getPeriodDisplayLabel = () => {
    switch (period) {
      case 'today': return t('presets.today')
      case 'yesterday': return t('presets.yesterday')
      case 'week': return t('presets.week')
      case 'month': return t('presets.month')
      case 'thisMonth': return t('presets.thisMonth')
      case 'lastMonth': return t('presets.lastMonth')
      case 'all': return t('presets.all')
      case 'custom':
        const parseDT = (str: string) => {
          if (!str) return { date: '—', time: '—' }
          const parts = str.split('T')
          const datePart = parts[0]
          const timePart = parts[1] || '00:00'
          const dateSubparts = datePart.split('-')
          const formattedDate = dateSubparts.length === 3 ? `${dateSubparts[2]}.${dateSubparts[1]}.${dateSubparts[0]}` : datePart
          return { date: formattedDate, time: timePart }
        }
        const s = parseDT(customStart)
        const e = parseDT(customEnd)
        if (s.date === e.date) {
          return `${s.date} ${s.time} - ${e.time}`
        }
        return `${s.date} ${s.time} - ${e.date} ${e.time}`
      default: return period
    }
  }

  const handlePresetClick = (p: string) => {
    setTempPeriod(p)
    const today = new Date()
    if (p === 'today') {
      setTempStart(formatDateISO(today) + 'T00:00')
      setTempEnd(formatDateISO(today) + 'T23:59')
    } else if (p === 'yesterday') {
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
      setTempStart(formatDateISO(yesterday) + 'T00:00')
      setTempEnd(formatDateISO(yesterday) + 'T23:59')
    } else if (p === 'week') {
      setTempStart(formatDateISO(subDays(today, 7)) + 'T00:00')
      setTempEnd(formatDateISO(today) + 'T23:59')
    } else if (p === 'month') {
      setTempStart(formatDateISO(subDays(today, 30)) + 'T00:00')
      setTempEnd(formatDateISO(today) + 'T23:59')
    } else if (p === 'thisMonth') {
      setTempStart(formatDateISO(startOfMonth(today)) + 'T00:00')
      setTempEnd(formatDateISO(today) + 'T23:59')
    } else if (p === 'lastMonth') {
      const lastMonth = subMonths(today, 1)
      setTempStart(formatDateISO(startOfMonth(lastMonth)) + 'T00:00')
      setTempEnd(formatDateISO(endOfMonth(lastMonth)) + 'T23:59')
    }
    
    if (p !== 'custom') {
      setPeriod(p)
      if (p === 'all') {
        // all time
      } else {
        const today = new Date()
        if (p === 'today') {
          setCustomStart(formatDateISO(today) + 'T00:00')
          setCustomEnd(formatDateISO(today) + 'T23:59')
        } else if (p === 'yesterday') {
          const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
          setCustomStart(formatDateISO(yesterday) + 'T00:00')
          setCustomEnd(formatDateISO(yesterday) + 'T23:59')
        } else if (p === 'week') {
          setCustomStart(formatDateISO(subDays(today, 7)) + 'T00:00')
          setCustomEnd(formatDateISO(today) + 'T23:59')
        } else if (p === 'month') {
          setCustomStart(formatDateISO(subDays(today, 30)) + 'T00:05')
          setCustomEnd(formatDateISO(today) + 'T23:59')
        } else if (p === 'thisMonth') {
          setCustomStart(formatDateISO(startOfMonth(today)) + 'T00:00')
          setCustomEnd(formatDateISO(today) + 'T23:59')
        } else if (p === 'lastMonth') {
          const lastMonth = subMonths(today, 1)
          setCustomStart(formatDateISO(startOfMonth(lastMonth)) + 'T00:00')
          setCustomEnd(formatDateISO(endOfMonth(lastMonth)) + 'T23:59')
        }
      }
      setIsOpen(false)
    }
  }

  const handleApply = () => {
    let finalStart = ''
    let finalEnd = ''
    
    if (tempMode === 'single') {
      finalStart = `${tempSingleDate}T${tempSingleStartHour}`
      finalEnd = `${tempSingleDate}T${tempSingleEndHour}`
    } else {
      finalStart = `${tempStartDateVal}T${tempStartTimeVal}`
      finalEnd = `${tempEndDateVal}T${tempEndTimeVal}`
    }

    setPeriod('custom')
    setCustomStart(finalStart)
    setCustomEnd(finalEnd)
    setIsOpen(false)
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open) {
      setTempPeriod(period)
      setTempStart(customStart)
      setTempEnd(customEnd)

      const startParts = customStart.split('T')
      const endParts = customEnd.split('T')
      
      const startDate = startParts[0] || formatDateISO(new Date())
      const startTime = startParts[1] || '00:00'
      const endDate = endParts[0] || formatDateISO(new Date())
      const endTime = endParts[1] || '23:59'

      setTempStartDateVal(startDate)
      setTempStartTimeVal(startTime)
      setTempEndDateVal(endDate)
      setTempEndTimeVal(endTime)

      if (startDate === endDate) {
        setTempMode('single')
        setTempSingleDate(startDate)
        setTempSingleStartHour(startTime)
        setTempSingleEndHour(endTime)
      } else {
        setTempMode('range')
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Period Selection Bar */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-2xl border shadow-sm">
        <div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-650" />
            {tc('filter')}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {t('subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          {/* Quick presets inline - scrollable horizontally on mobile */}
          <div className="flex items-center gap-1 bg-slate-50/75 p-1 rounded-xl border border-slate-100/80 overflow-x-auto scrollbar-none w-full sm:w-auto">
            {PRESETS.filter((p) => p.value !== 'custom').map((p) => {
              const active = period === p.value
              return (
                <button
                  key={p.value}
                  onClick={() => handlePresetClick(p.value)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-indigo-650 shadow-xs border border-slate-200/50'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                  }`}
                >
                  {p.label}
                </button>
              )
            })}
          </div>

          {/* Custom Date Range selector */}
          <Popover open={isOpen} onOpenChange={handleOpenChange}>
            <PopoverTrigger
              render={
                <button
                  className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold border rounded-xl hover:bg-slate-50 transition-all duration-200 shadow-xs cursor-pointer h-[38px] w-full sm:w-auto justify-center sm:justify-start ${
                    period === 'custom'
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  <Calendar className={`h-4 w-4 ${period === 'custom' ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>
                    {period === 'custom' ? getPeriodDisplayLabel() : t('presets.custom')}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </button>
              }
            />
            <PopoverContent align="end" className="w-[360px] p-4 bg-white border border-slate-150 rounded-2xl shadow-xl overflow-hidden flex flex-col gap-4">
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {t('customFilter.title')}
                </h4>
                
                {/* Mode Selector */}
                <div className="grid grid-cols-2 p-1 bg-slate-100/80 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setTempMode('single')}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      tempMode === 'single' ? 'bg-white text-indigo-650 shadow-xs border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {t('customFilter.singleDay')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTempMode('range')}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      tempMode === 'range' ? 'bg-white text-indigo-650 shadow-xs border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {t('customFilter.dateRange')}
                  </button>
                </div>

                {/* Date Inputs depending on tempMode */}
                {tempMode === 'single' ? (
                  <div className="space-y-3 pt-1">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {t('customFilter.date')}
                      </span>
                      <input
                        type="date"
                        value={tempSingleDate}
                        onChange={(e) => setTempSingleDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-1.5 text-xs text-slate-850 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {t('customFilter.startTime')}
                        </span>
                        <input
                          type="time"
                          value={tempSingleStartHour}
                          onChange={(e) => setTempSingleStartHour(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-1.5 text-xs text-slate-850 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {t('customFilter.endTime')}
                        </span>
                        <input
                          type="time"
                          value={tempSingleEndHour}
                          onChange={(e) => setTempSingleEndHour(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-1.5 text-xs text-slate-850 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {t('customFilter.startDateTime')}
                      </span>
                      <div className="grid grid-cols-5 gap-2">
                        <input
                          type="date"
                          value={tempStartDateVal}
                          onChange={(e) => setTempStartDateVal(e.target.value)}
                          className="col-span-3 bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-1.5 text-xs text-slate-850 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                        <input
                          type="time"
                          value={tempStartTimeVal}
                          onChange={(e) => setTempStartTimeVal(e.target.value)}
                          className="col-span-2 bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-1.5 text-xs text-slate-850 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {t('customFilter.endDateTime')}
                      </span>
                      <div className="grid grid-cols-5 gap-2">
                        <input
                          type="date"
                          value={tempEndDateVal}
                          onChange={(e) => setTempEndDateVal(e.target.value)}
                          className="col-span-3 bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-1.5 text-xs text-slate-850 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                        <input
                          type="time"
                          value={tempEndTimeVal}
                          onChange={(e) => setTempEndTimeVal(e.target.value)}
                          className="col-span-2 bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-1.5 text-xs text-slate-850 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleApply}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-750 text-white rounded-lg transition-all shadow-sm cursor-pointer"
                >
                  {t('customFilter.confirm')}
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title={t('revenue')}
          value={formatCurrency(totalRevenue)}
          subtitle={`${tc('total')} ${t('revenue')}`}
          icon={BanknotesIcon}
          color="bg-emerald-100 text-emerald-600"
        />
        <KPICard
          title={t('sales')}
          value={totalOrders.toString()}
          subtitle={`${tc('total')} ${tc('sum')}`}
          icon={ShoppingCartIcon}
          color="bg-blue-100 text-blue-600"
        />
        <KPICard
          title={tc('profit')}
          value={formatCurrency(totalProfit)}
          subtitle={`${tc('total')} ${tc('profit')}`}
          icon={ChartBarIcon}
          color="bg-indigo-100 text-indigo-600"
        />
        <KPICard
          title={tc('quantity')}
          value={totalSold.toString()}
          subtitle={`${tc('total')} ${tc('pieces')}`}
          icon={TagIcon}
          color="bg-amber-100 text-amber-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Over Time Chart */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-800">{t('revenueOverTime')}</CardTitle>
          </CardHeader>
          <CardContent>
            {formattedChartData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-slate-400 text-sm">
                {tc('noData')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={formattedChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="monthLabel"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    tickFormatter={(v) => {
                      if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
                      if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
                      return v
                    }}
                  />
                  <Tooltip
                    formatter={(value: any) => formatCurrency(value as number)}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    strokeWidth={3}
                    fill="url(#colorRev)"
                    name={t('revenue')}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-800">{t('topProducts')}</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <div className="text-slate-500 text-sm">{tc('noData')}</div>
            ) : (
              <div className="space-y-5">
                {topProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-sm">
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 truncate max-w-[150px]">{p.name}</p>
                        <p className="text-xs text-slate-500">{p.quantity} {tc('pieces')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">{formatCurrency(p.totalSum)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders + Low Stock — moved here from the dashboard */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentOrders orders={recentOrders} lang={lang} title={td('recentOrdersTitle')} />
        </div>
        <LowStockAlert products={lowStock} lang={lang} />
      </div>

      {/* Sold Products Table */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">{t('soldProducts')}</h2>
        <SoldProductsTable products={aggregatedProducts} lang={lang} />
      </div>
    </div>
  )
}
