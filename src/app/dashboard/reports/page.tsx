'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface Sale {
  id: string
  tenant_id: string
  employee_name: string
  branch: string
  amount: number
  product?: string
  notes?: string
  created_at: string
}

interface Product {
  id: string
  barcode: string
  name: string
  category: string
  unit_type: string
  quantity: number
  price: number
  branch: string
  created_at: string
}

interface InventoryMovement {
  id: string
  product_id: string
  product_name: string
  type: 'inbound' | 'outbound' | 'transfer'
  quantity: number
  branch: string
  notes?: string
  created_at: string
}

interface Attendance {
  id: string
  employee_name: string
  branch: string
  date: string
  check_in: string
  check_out: string
  status: 'present' | 'absent' | 'late'
  notes?: string
}

type Timeframe = 'today' | 'week' | 'month' | 'custom'

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'sales' | 'inventory' | 'attendance'>('sales')
  const [timeframe, setTimeframe] = useState<Timeframe>('month')
  
  // Custom date range state
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  // Raw data from DB
  const [sales, setSales] = useState<Sale[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [
        { data: salesData },
        { data: productsData },
        { data: movementsData },
        { data: attendanceData }
      ] = await Promise.all([
        supabase.from('sales').select('*'),
        supabase.from('products').select('*'),
        supabase.from('inventory_movements').select('*'),
        supabase.from('attendance').select('*')
      ])

      setSales(salesData ?? [])
      setProducts(productsData ?? [])
      setMovements(movementsData ?? [])
      setAttendance(attendanceData ?? [])
    } catch (e) {
      console.error('Error loading reports data:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Helper to filter by date range
  const filterByDate = useCallback((itemDate: string | Date) => {
    const date = new Date(itemDate)
    const now = new Date()

    if (timeframe === 'today') {
      const today = new Date()
      return date.getFullYear() === today.getFullYear() &&
             date.getMonth() === today.getMonth() &&
             date.getDate() === today.getDate()
    } else if (timeframe === 'week') {
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(now.getDate() - 7)
      return date >= oneWeekAgo
    } else if (timeframe === 'month') {
      const oneMonthAgo = new Date()
      oneMonthAgo.setDate(now.getDate() - 30)
      return date >= oneMonthAgo
    } else if (timeframe === 'custom') {
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      return date >= start && date <= end
    }
    return true
  }, [timeframe, startDate, endDate])

  // Filtered datasets
  const filteredSales = sales.filter(s => filterByDate(s.created_at))
  const filteredMovements = movements.filter(m => filterByDate(m.created_at))
  
  // Attendance table uses 'date' column formatted as YYYY-MM-DD
  const filteredAttendance = attendance.filter(a => {
    // If it's custom or other periods, parse 'date' string
    const dateObj = new Date(a.date)
    return filterByDate(dateObj)
  })

  // --- Calculations ---

  // Sales Stats
  const totalSalesAmount = filteredSales.reduce((sum, s) => sum + (s.amount ?? 0), 0)
  const salesCount = filteredSales.length
  const averageSaleValue = salesCount > 0 ? totalSalesAmount / salesCount : 0

  // Sales by Branch
  const salesByBranch = filteredSales.reduce((acc: Record<string, number>, s) => {
    const branchName = s.branch || 'غير محدد'
    acc[branchName] = (acc[branchName] || 0) + s.amount
    return acc
  }, {})

  // Sales by Employee
  const salesByEmployee = filteredSales.reduce((acc: Record<string, number>, s) => {
    const empName = s.employee_name || 'غير محدد'
    acc[empName] = (acc[empName] || 0) + s.amount
    return acc
  }, {})

  // Top Selling Products based on sales description or amount
  const salesByProduct = filteredSales.reduce((acc: Record<string, { amount: number, count: number }>, s) => {
    const prodName = s.product || 'أخرى / مبيعة عامة'
    if (!acc[prodName]) {
      acc[prodName] = { amount: 0, count: 0 }
    }
    acc[prodName].amount += s.amount
    acc[prodName].count += 1
    return acc
  }, {})

  const topProducts = Object.entries(salesByProduct)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  // Inventory Stats
  const totalUniqueProducts = products.length
  const totalInventoryValue = products.reduce((sum, p) => sum + ((p.quantity ?? 0) * (p.price ?? 0)), 0)
  const lowStockCount = products.filter(p => (p.quantity ?? 0) <= 5).length

  // Inventory Stock by Branch
  const stockByBranch = products.reduce((acc: Record<string, number>, p) => {
    const branchName = p.branch || 'غير محدد'
    acc[branchName] = (acc[branchName] || 0) + (p.quantity ?? 0)
    return acc
  }, {})

  // Attendance Stats
  const totalAttendanceDays = filteredAttendance.length
  const presentCount = filteredAttendance.filter(a => a.status === 'present').length
  const lateCount = filteredAttendance.filter(a => a.status === 'late').length
  const absentCount = filteredAttendance.filter(a => a.status === 'absent').length

  const onTimeRate = totalAttendanceDays > 0 
    ? (presentCount / totalAttendanceDays) * 100 
    : 0

  // CSV Exporter Helper
  const exportToCSV = (headers: string[], rows: any[][], filename: string) => {
    let csvContent = '\uFEFF' // UTF-8 BOM for perfect Arabic display in Excel
    csvContent += headers.join(',') + '\n'

    rows.forEach(row => {
      const rowStr = row.map(val => {
        let cleanVal = val === null || val === undefined ? '' : String(val)
        cleanVal = cleanVal.replace(/"/g, '""')
        if (cleanVal.includes(',') || cleanVal.includes('\n') || cleanVal.includes('"')) {
          cleanVal = `"${cleanVal}"`
        }
        return cleanVal
      }).join(',')
      csvContent += rowStr + '\n'
    })

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `${filename}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // --- Export Triggers ---
  const handleExportSales = () => {
    const headers = ['الموظف', 'المنتج', 'الفرع', 'المبلغ (ج.م)', 'التاريخ', 'ملاحظات']
    const rows = filteredSales.map(s => [
      s.employee_name,
      s.product || '—',
      s.branch || '—',
      s.amount,
      new Date(s.created_at).toLocaleDateString('ar-EG'),
      s.notes || ''
    ])
    exportToCSV(headers, rows, `تقرير_المبيعات_${timeframe}_${new Date().toISOString().split('T')[0]}`)
  }

  const handleExportInventory = () => {
    const headers = ['كود المنتج', 'اسم المنتج', 'الفئة', 'الكمية الحالية', 'سعر الوحدة (ج.م)', 'القيمة الإجمالية', 'الفرع', 'تاريخ الإضافة']
    const rows = products.map(p => [
      p.barcode,
      p.name,
      p.category,
      p.quantity,
      p.price,
      p.quantity * p.price,
      p.branch,
      new Date(p.created_at).toLocaleDateString('ar-EG')
    ])
    exportToCSV(headers, rows, `تقرير_المخزون_${new Date().toISOString().split('T')[0]}`)
  }

  const handleExportMovements = () => {
    const headers = ['اسم المنتج', 'نوع الحركة', 'الكمية', 'الفرع', 'التاريخ', 'ملاحظات']
    const rows = filteredMovements.map(m => [
      m.product_name,
      m.type === 'inbound' ? 'وارد' : m.type === 'outbound' ? 'منصرف' : 'تحويل',
      m.quantity,
      m.branch,
      new Date(m.created_at).toLocaleDateString('ar-EG'),
      m.notes || ''
    ])
    exportToCSV(headers, rows, `سجل_حركة_المخزون_${timeframe}_${new Date().toISOString().split('T')[0]}`)
  }

  const handleExportAttendance = () => {
    const headers = ['اسم الموظف', 'الفرع', 'التاريخ', 'حالة الحضور', 'وقت الحضور', 'وقت الانصراف', 'ملاحظات']
    const rows = filteredAttendance.map(a => [
      a.employee_name,
      a.branch,
      a.date,
      a.status === 'present' ? 'حاضر' : a.status === 'late' ? 'متأخر' : 'غائب',
      a.check_in || '—',
      a.check_out || '—',
      a.notes || ''
    ])
    exportToCSV(headers, rows, `تقرير_الحضور_${timeframe}_${new Date().toISOString().split('T')[0]}`)
  }

  return (
    <div className="fade-in" style={{ direction: 'rtl' }}>
      {/* Title Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>📈 التقارير والتحليلات الشاملة</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>تابع أداء مبيعاتك، حركة مخزونك، وحضور الموظفين بكل دقة وفلترة زمنية.</p>
        </div>
        
        {/* Sync Data Button */}
        <button 
          onClick={loadData}
          style={{
            padding: '8px 14px',
            fontSize: 12,
            fontWeight: 600,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.15s ease'
          }}
          onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
          onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
        >
          🔄 تحديث البيانات
        </button>
      </div>

      {/* Control Panel: Timeframe Filter */}
      <div className="glass-card" style={{ padding: 16, marginBottom: 24, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>تصفية الفترة:</span>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 10, padding: 3, gap: 2 }}>
            {(['today', 'week', 'month', 'custom'] as const).map((t) => {
              const label = t === 'today' ? 'اليوم' : t === 'week' ? 'آخر 7 أيام' : t === 'month' ? 'آخر 30 يوم' : 'فترة مخصصة'
              const active = timeframe === t
              return (
                <button
                  key={t}
                  onClick={() => setTimeframe(t)}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: 8,
                    background: active ? 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))' : 'none',
                    color: active ? 'white' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Custom date range picker */}
        {timeframe === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }} className="fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>من:</span>
              <input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)} 
                className="input-field" 
                style={{ padding: '6px 10px', fontSize: 12, width: 130 }} 
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>إلى:</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)} 
                className="input-field" 
                style={{ padding: '6px 10px', fontSize: 12, width: 130 }} 
              />
            </div>
          </div>
        )}
      </div>

      {/* Tabs Switcher */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 28, gap: 16 }}>
        {(['sales', 'inventory', 'attendance'] as const).map(tab => {
          const label = tab === 'sales' ? '📊 تقرير المبيعات' : tab === 'inventory' ? '📦 تقرير المخزون' : '📅 تقرير الحضور'
          const active = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 16px',
                fontSize: 14,
                fontWeight: 700,
                background: 'none',
                border: 'none',
                borderBottom: active ? '3px solid var(--accent-blue)' : '3px solid transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                marginBottom: -1
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Loader */}
      {loading ? (
        <div style={{ padding: '100px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          جاري تحليل البيانات وتحضير التقارير...
        </div>
      ) : (
        <div>
          {/* ========================================================================= */}
          {/* TABS CONTENT: SALES */}
          {/* ========================================================================= */}
          {activeTab === 'sales' && (
            <div className="fade-in">
              {/* Sales Stats Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 28 }}>
                {/* Stat Card 1 */}
                <div style={{
                  padding: '20px 24px', borderRadius: 16,
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.02))',
                  border: '1px solid rgba(16, 185, 129, 0.15)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--accent-emerald)', fontWeight: 600, marginBottom: 6 }}>💰 إجمالي الإيرادات</div>
                    <div style={{ fontSize: 26, fontWeight: 850, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                      {totalSalesAmount.toLocaleString('ar-EG')} <span style={{ fontSize: 13, fontWeight: 500 }}>ج.م</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 36, opacity: 0.8 }}>💸</div>
                </div>

                {/* Stat Card 2 */}
                <div style={{
                  padding: '20px 24px', borderRadius: 16,
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(59, 130, 246, 0.02))',
                  border: '1px solid rgba(59, 130, 246, 0.15)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600, marginBottom: 6 }}>🧾 عدد الفواتير / المعاملات</div>
                    <div style={{ fontSize: 26, fontWeight: 850, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                      {salesCount.toLocaleString('ar-EG')} <span style={{ fontSize: 13, fontWeight: 500 }}>عملية</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 36, opacity: 0.8 }}>🧾</div>
                </div>

                {/* Stat Card 3 */}
                <div style={{
                  padding: '20px 24px', borderRadius: 16,
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(245, 158, 11, 0.02))',
                  border: '1px solid rgba(245, 158, 11, 0.15)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--accent-amber)', fontWeight: 600, marginBottom: 6 }}>📈 متوسط قيمة الفاتورة</div>
                    <div style={{ fontSize: 26, fontWeight: 850, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                      {Math.round(averageSaleValue).toLocaleString('ar-EG')} <span style={{ fontSize: 13, fontWeight: 500 }}>ج.م</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 36, opacity: 0.8 }}>📊</div>
                </div>
              </div>

              {/* Sales Charts Layout */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 24, marginBottom: 28 }}>
                {/* Branch Sales Chart */}
                <div className="glass-card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 18, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    🏢 المبيعات حسب الفروع
                  </h3>
                  {Object.keys(salesByBranch).length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>لا توجد بيانات مبيعات في هذه الفترة</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {Object.entries(salesByBranch).map(([branch, amount]) => {
                        const pct = totalSalesAmount > 0 ? (amount / totalSalesAmount) * 100 : 0
                        return (
                          <div key={branch} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600 }}>
                              <span style={{ color: 'var(--text-secondary)' }}>{branch}</span>
                              <span style={{ color: 'var(--text-primary)' }}>
                                {amount.toLocaleString('ar-EG')} ج.م ({pct.toFixed(1)}%)
                              </span>
                            </div>
                            <div style={{ width: '100%', height: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 5, overflow: 'hidden' }}>
                              <div style={{
                                width: `${pct}%`, height: '100%',
                                background: 'linear-gradient(90deg, var(--accent-purple), var(--accent-blue))',
                                borderRadius: 5, transition: 'width 0.5s ease-in-out'
                              }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Top Selling Products */}
                <div className="glass-card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 18, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    🛍️ المنتجات الأكثر مبيعاً (بالإيرادات)
                  </h3>
                  {topProducts.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>لا توجد بيانات مبيعات في هذه الفترة</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {topProducts.map((prod, idx) => {
                        const pct = totalSalesAmount > 0 ? (prod.amount / totalSalesAmount) * 100 : 0
                        return (
                          <div key={prod.name} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600 }}>
                              <span style={{ color: 'var(--text-secondary)' }}>
                                <strong style={{ color: 'var(--accent-amber)', marginLeft: 6 }}>#{idx + 1}</strong>
                                {prod.name}
                              </span>
                              <span style={{ color: 'var(--text-primary)' }}>
                                {prod.amount.toLocaleString('ar-EG')} ج.م ({prod.count} فواتير)
                              </span>
                            </div>
                            <div style={{ width: '100%', height: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 5, overflow: 'hidden' }}>
                              <div style={{
                                width: `${pct}%`, height: '100%',
                                background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-emerald))',
                                borderRadius: 5, transition: 'width 0.5s ease-in-out'
                              }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Sales by Employee */}
              <div className="glass-card" style={{ padding: 24, marginBottom: 28 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 18, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  👥 أداء المبيعات حسب الموظفين
                </h3>
                {Object.keys(salesByEmployee).length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>لا توجد بيانات مبيعات في هذه الفترة</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                    {Object.entries(salesByEmployee).map(([employee, amount]) => {
                      const pct = totalSalesAmount > 0 ? (amount / totalSalesAmount) * 100 : 0
                      return (
                        <div key={employee} style={{
                          padding: 16, borderRadius: 12,
                          background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)',
                          display: 'flex', flexDirection: 'column', gap: 8
                        }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{employee}</span>
                          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent-emerald)' }}>
                            {amount.toLocaleString('ar-EG')} ج.م
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>يمثل {pct.toFixed(1)}% من المبيعات</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Transactions List */}
              <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottom: '1px solid var(--border)' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>📑 تفاصيل فواتير الفترة</h3>
                  <button 
                    onClick={handleExportSales}
                    className="btn-primary" 
                    style={{ padding: '8px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    📥 تصدير المبيعات كشيت Excel
                  </button>
                </div>

                {filteredSales.length === 0 ? (
                  <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>لا توجد سجلات مبيعات للفترة المحددة</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>الموظف</th>
                          <th>المنتجات المباعة</th>
                          <th>الفرع</th>
                          <th>قيمة الفاتورة</th>
                          <th>تاريخ العملية</th>
                          <th>ملاحظات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSales.map(s => (
                          <tr key={s.id}>
                            <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.employee_name}</td>
                            <td>{s.product || '—'}</td>
                            <td>{s.branch || '—'}</td>
                            <td style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>{s.amount.toLocaleString('ar-EG')} ج.م</td>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {new Date(s.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TABS CONTENT: INVENTORY */}
          {/* ========================================================================= */}
          {activeTab === 'inventory' && (
            <div className="fade-in">
              {/* Inventory Stats Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 28 }}>
                {/* Card 1 */}
                <div style={{
                  padding: '20px 24px', borderRadius: 16,
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(59, 130, 246, 0.02))',
                  border: '1px solid rgba(59, 130, 246, 0.15)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600, marginBottom: 6 }}>📦 أصناف المنتجات الكلية</div>
                    <div style={{ fontSize: 26, fontWeight: 850, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                      {totalUniqueProducts.toLocaleString('ar-EG')} <span style={{ fontSize: 13, fontWeight: 500 }}>صنف</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 36, opacity: 0.8 }}>📦</div>
                </div>

                {/* Card 2 */}
                <div style={{
                  padding: '20px 24px', borderRadius: 16,
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(245, 158, 11, 0.02))',
                  border: '1px solid rgba(245, 158, 11, 0.15)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--accent-amber)', fontWeight: 600, marginBottom: 6 }}>💰 القيمة المالية الكلية للمخزون</div>
                    <div style={{ fontSize: 26, fontWeight: 850, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                      {totalInventoryValue.toLocaleString('ar-EG')} <span style={{ fontSize: 13, fontWeight: 500 }}>ج.م</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 36, opacity: 0.8 }}>💵</div>
                </div>

                {/* Card 3 */}
                <div style={{
                  padding: '20px 24px', borderRadius: 16,
                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(239, 68, 68, 0.02))',
                  border: '1px solid rgba(239, 68, 68, 0.15)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--accent-red)', fontWeight: 600, marginBottom: 6 }}>⚠️ منتجات منخفضة المخزون</div>
                    <div style={{ fontSize: 26, fontWeight: 850, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                      {lowStockCount.toLocaleString('ar-EG')} <span style={{ fontSize: 13, fontWeight: 500 }}>أصناف (≤ 5)</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 36, opacity: 0.8 }}>🚨</div>
                </div>
              </div>

              {/* Branch Stock Distribution */}
              <div className="glass-card" style={{ padding: 24, marginBottom: 28 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 18, color: 'var(--text-primary)' }}>🏢 توزيع المنتجات وكمياتها على الفروع</h3>
                {Object.keys(stockByBranch).length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>لا توجد منتجات مسجلة بالمخزن بعد</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                    {Object.entries(stockByBranch).map(([branch, qty]) => {
                      return (
                        <div key={branch} style={{
                          padding: 16, borderRadius: 12,
                          background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)',
                          display: 'flex', flexDirection: 'column', gap: 8
                        }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{branch}</span>
                          <span style={{ fontSize: 20, fontWeight: 850, color: 'var(--accent-blue)' }}>
                            {qty.toLocaleString('ar-EG')} قطعة
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Low Stock Warning Alert Table */}
              <div className="glass-card" style={{ padding: 24, marginBottom: 28, border: lowStockCount > 0 ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid var(--border)' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 18, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  ⚠️ تقرير المنتجات التي شارفت على النفاد
                </h3>
                {products.filter(p => (p.quantity ?? 0) <= 5).length === 0 ? (
                  <div style={{ color: 'var(--accent-emerald)', fontSize: 13, padding: '10px 0', fontWeight: 600 }}>🟢 جميع مستويات المخازن آمنة (لا توجد منتجات كميتها ≤ 5)</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>المنتج</th>
                          <th>الباركود</th>
                          <th>الفرع</th>
                          <th>الكمية المتوفرة</th>
                          <th>سعر الوحدة</th>
                          <th>حالة الإنذار</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.filter(p => (p.quantity ?? 0) <= 5).map(p => (
                          <tr key={p.id}>
                            <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</td>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.barcode}</td>
                            <td>{p.branch}</td>
                            <td style={{ fontWeight: 700, color: 'var(--accent-red)' }}>{p.quantity}</td>
                            <td>{p.price.toLocaleString('ar-EG')} ج.م</td>
                            <td>
                              <span style={{
                                padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                                background: p.quantity === 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                color: p.quantity === 0 ? '#f87171' : '#fbbf24'
                              }}>
                                {p.quantity === 0 ? 'نفد بالكامل ❌' : 'مخزون حرج ⚠️'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Inventory Movements Log */}
              <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>🔄 سجل حركة المخزون بالفترة</h3>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>الوارد (Inbound)، المنصرف (Outbound) والتحويلات المباشرة.</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button 
                      onClick={handleExportInventory}
                      className="btn-primary" 
                      style={{ padding: '8px 14px', fontSize: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                      onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                      onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    >
                      📦 تصدير قائمة المنتجات الكلية
                    </button>
                    <button 
                      onClick={handleExportMovements}
                      className="btn-primary" 
                      style={{ padding: '8px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      📥 تصدير حركات المخزن بالفترة
                    </button>
                  </div>
                </div>

                {filteredMovements.length === 0 ? (
                  <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>لا توجد حركات مخزنية مسجلة للفترة المحددة</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>المنتج</th>
                          <th>نوع الحركة</th>
                          <th>الكمية</th>
                          <th>الفرع</th>
                          <th>التاريخ والوقت</th>
                          <th>ملاحظات الحركة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMovements.map(m => (
                          <tr key={m.id}>
                            <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.product_name}</td>
                            <td>
                              <span style={{
                                padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                                background: m.type === 'inbound' ? 'rgba(16, 185, 129, 0.1)' : m.type === 'outbound' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(139, 92, 246, 0.1)',
                                color: m.type === 'inbound' ? '#34d399' : m.type === 'outbound' ? '#f87171' : '#a78bfa'
                              }}>
                                {m.type === 'inbound' ? 'وارد 📥' : m.type === 'outbound' ? 'منصرف 📤' : 'تحويل 🔄'}
                              </span>
                            </td>
                            <td style={{ fontWeight: 700 }}>{m.quantity}</td>
                            <td>{m.branch}</td>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {new Date(m.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TABS CONTENT: ATTENDANCE */}
          {/* ========================================================================= */}
          {activeTab === 'attendance' && (
            <div className="fade-in">
              {/* Attendance Stats Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 28 }}>
                {/* Card 1 */}
                <div style={{
                  padding: '20px 24px', borderRadius: 16,
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(59, 130, 246, 0.02))',
                  border: '1px solid rgba(59, 130, 246, 0.15)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600, marginBottom: 6 }}>👥 إجمالي أيام تسجيل الحضور</div>
                    <div style={{ fontSize: 26, fontWeight: 850, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                      {totalAttendanceDays.toLocaleString('ar-EG')} <span style={{ fontSize: 13, fontWeight: 500 }}>سجل</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 36, opacity: 0.8 }}>📅</div>
                </div>

                {/* Card 2 */}
                <div style={{
                  padding: '20px 24px', borderRadius: 16,
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.02))',
                  border: '1px solid rgba(16, 185, 129, 0.15)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--accent-emerald)', fontWeight: 600, marginBottom: 6 }}>⏰ نسبة الالتزام بالمواعيد (حاضر في موعده)</div>
                    <div style={{ fontSize: 26, fontWeight: 850, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                      {onTimeRate.toFixed(1)}%
                    </div>
                  </div>
                  <div style={{ fontSize: 36, opacity: 0.8 }}>⏰</div>
                </div>

                {/* Card 3 */}
                <div style={{
                  padding: '20px 24px', borderRadius: 16,
                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(239, 68, 68, 0.02))',
                  border: '1px solid rgba(239, 68, 68, 0.15)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--accent-red)', fontWeight: 600, marginBottom: 6 }}>🚨 إجمالي أيام الغياب</div>
                    <div style={{ fontSize: 26, fontWeight: 850, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                      {absentCount.toLocaleString('ar-EG')} <span style={{ fontSize: 13, fontWeight: 500 }}>أيام</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 36, opacity: 0.8 }}>👤</div>
                </div>
              </div>

              {/* Attendance Status Summary Bar */}
              <div className="glass-card" style={{ padding: 24, marginBottom: 28 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 18, color: 'var(--text-primary)' }}>📊 نسب حالات الحضور بالفترة</h3>
                {totalAttendanceDays === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '10px 0', textAlign: 'center' }}>لا توجد سجلات حضور مسجلة للفترة المحددة</div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', height: 24, borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
                      <div style={{
                        width: `${(presentCount / totalAttendanceDays) * 100}%`,
                        background: 'var(--accent-emerald)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontSize: 11, fontWeight: 700
                      }} title="حاضر في الموعد">
                        {presentCount > 0 && `حاضر (${Math.round((presentCount / totalAttendanceDays) * 100)}%)`}
                      </div>
                      <div style={{
                        width: `${(lateCount / totalAttendanceDays) * 100}%`,
                        background: 'var(--accent-amber)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontSize: 11, fontWeight: 700
                      }} title="متأخر">
                        {lateCount > 0 && `متأخر (${Math.round((lateCount / totalAttendanceDays) * 100)}%)`}
                      </div>
                      <div style={{
                        width: `${(absentCount / totalAttendanceDays) * 100}%`,
                        background: 'var(--accent-red)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontSize: 11, fontWeight: 700
                      }} title="غائب">
                        {absentCount > 0 && `غائب (${Math.round((absentCount / totalAttendanceDays) * 100)}%)`}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--accent-emerald)' }} />
                        <span style={{ color: 'var(--text-secondary)' }}>حاضر في الموعد: <strong>{presentCount} يوم</strong></span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--accent-amber)' }} />
                        <span style={{ color: 'var(--text-secondary)' }}>حضور متأخر: <strong>{lateCount} يوم</strong></span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--accent-red)' }} />
                        <span style={{ color: 'var(--text-secondary)' }}>غياب: <strong>{absentCount} يوم</strong></span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Detailed Attendance List */}
              <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottom: '1px solid var(--border)' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>📑 تفاصيل الحضور والانصراف اليومي</h3>
                  <button 
                    onClick={handleExportAttendance}
                    className="btn-primary" 
                    style={{ padding: '8px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    📥 تصدير سجل الحضور كشيت Excel
                  </button>
                </div>

                {filteredAttendance.length === 0 ? (
                  <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>لا توجد سجلات حضور للفترة المحددة</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>اسم الموظف</th>
                          <th>الفرع</th>
                          <th>التاريخ</th>
                          <th>الحالة</th>
                          <th>وقت الحضور</th>
                          <th>وقت الانصراف</th>
                          <th>ملاحظات ومبررات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAttendance.map(a => (
                          <tr key={a.id}>
                            <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{a.employee_name}</td>
                            <td>{a.branch}</td>
                            <td style={{ fontSize: 12 }}>{a.date}</td>
                            <td>
                              <span style={{
                                padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                                background: a.status === 'present' ? 'rgba(16, 185, 129, 0.1)' : a.status === 'late' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                color: a.status === 'present' ? '#34d399' : a.status === 'late' ? '#fbbf24' : '#f87171'
                              }}>
                                {a.status === 'present' ? 'منتظم ✅' : a.status === 'late' ? 'متأخر ⏰' : 'غائب ❌'}
                              </span>
                            </td>
                            <td style={{ fontFamily: 'monospace' }}>{a.check_in || '—'}</td>
                            <td style={{ fontFamily: 'monospace' }}>{a.check_out || '—'}</td>
                            <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{a.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
