'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

interface Sale {
  id: string
  employee_name: string
  branch: string
  amount: number
  product?: string
  notes?: string
  payment_method?: 'cash' | 'visa' | 'instapay'
  customer_name?: string
  customer_phone?: string
  created_at: string
}

interface Expense {
  id: string
  title: string
  category: string
  amount: number
  branch: string
  employee_name: string
  notes?: string
  created_at: string
}

interface EmployeeDraw {
  id: string
  employee_name: string
  amount: number
  date: string
  status: 'pending' | 'approved' | 'settled'
  notes?: string
  created_at: string
}

type Timeframe = 'today' | 'week' | 'month' | 'custom'

export default function FinancePage() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'ledger' | 'expenses' | 'draws'>('ledger')
  const [timeframe, setTimeframe] = useState<Timeframe>('month')
  
  // Custom date picker range
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  // Datasets
  const [sales, setSales] = useState<Sale[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [draws, setDraws] = useState<EmployeeDraw[]>([])
  const [branches, setBranches] = useState<{ id: string, name: string }[]>([])
  const [employees, setEmployees] = useState<{ id: string, name: string, branch: string }[]>([])

  // Modal states for Expenses CRUD
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [expenseForm, setExpenseForm] = useState({ title: '', category: 'أخرى', amount: '', branch: '', employee_name: '', notes: '' })
  const [savingExpense, setSavingExpense] = useState(false)
  const [expenseError, setExpenseError] = useState('')

  // Modal states for Drawings CRUD
  const [showDrawModal, setShowDrawModal] = useState(false)
  const [editingDrawId, setEditingDrawId] = useState<string | null>(null)
  const [drawForm, setDrawForm] = useState({ employee_name: '', amount: '', date: '', notes: '', status: 'approved' as 'pending' | 'approved' | 'settled' })
  const [savingDraw, setSavingDraw] = useState(false)
  const [drawError, setDrawError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [
        { data: salesData },
        { data: expensesData },
        { data: drawsData },
        { data: branchData },
        { data: empData }
      ] = await Promise.all([
        supabase.from('sales').select('*'),
        supabase.from('expenses').select('*'),
        supabase.from('employee_draws').select('*'),
        supabase.from('branches').select('id, name'),
        supabase.from('employees').select('id, name, branch')
      ])

      setSales(salesData ?? [])
      setExpenses(expensesData ?? [])
      setDraws(drawsData ?? [])
      setBranches(branchData ?? [])
      setEmployees(empData ?? [])
    } catch (e) {
      console.error('Error fetching financial data:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Date Filtering Helper
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

  // Filtered Datasets
  const filteredSales = useMemo(() => sales.filter(s => filterByDate(s.created_at)), [sales, filterByDate])
  const filteredExpenses = useMemo(() => expenses.filter(e => filterByDate(e.created_at)), [expenses, filterByDate])
  const filteredDraws = useMemo(() => draws.filter(d => filterByDate(new Date(d.date))), [draws, filterByDate])

  // --- Financial Metrics Calculations ---

  // Sales Totals and Payment Method Breakdowns
  const salesMetrics = useMemo(() => {
    let total = 0
    let cash = 0
    let visa = 0
    let instapay = 0
    filteredSales.forEach(s => {
      total += s.amount
      const method = s.payment_method || 'cash'
      if (method === 'cash') cash += s.amount
      else if (method === 'visa') visa += s.amount
      else if (method === 'instapay') instapay += s.amount
    })
    return { total, cash, visa, instapay }
  }, [filteredSales])

  // Expenses totals
  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + (e.amount ?? 0), 0)
  }, [filteredExpenses])

  // Employee Draws/Advances totals
  const totalDraws = useMemo(() => {
    return filteredDraws.reduce((sum, d) => sum + (d.amount ?? 0), 0)
  }, [filteredDraws])

  // Net Profit
  const netProfit = salesMetrics.total - totalExpenses - totalDraws

  // Today's Sales totals & breakdowns
  const todayMetrics = useMemo(() => {
    const todaySales = sales.filter(s => {
      const date = new Date(s.created_at)
      const today = new Date()
      return date.getFullYear() === today.getFullYear() &&
             date.getMonth() === today.getMonth() &&
             date.getDate() === today.getDate()
    })

    let total = 0
    let cash = 0
    let visa = 0
    let instapay = 0
    todaySales.forEach(s => {
      total += s.amount
      const method = s.payment_method || 'cash'
      if (method === 'cash') cash += s.amount
      else if (method === 'visa') visa += s.amount
      else if (method === 'instapay') instapay += s.amount
    })
    return { total, cash, visa, instapay }
  }, [sales])

  // General Cash Ledger / Movement Log (combined entries)
  const cashLedger = useMemo(() => {
    const entries: {
      id: string
      type: 'income' | 'expense' | 'draw'
      title: string
      amount: number
      reference: string // e.g. cash, visa, instapay, employee name
      branch: string
      date: string
      notes?: string
    }[] = []

    // 1. Sales
    filteredSales.forEach(s => {
      entries.push({
        id: `sale-${s.id}`,
        type: 'income',
        title: `مبيعات: ${s.product || 'فاتورة POS'}`,
        amount: s.amount,
        reference: s.payment_method === 'cash' ? 'كاش 💵' : s.payment_method === 'visa' ? 'فيزا 💳' : 'انستا باي ⚡',
        branch: s.branch || '—',
        date: s.created_at,
        notes: s.customer_name ? `العميل: ${s.customer_name} ${s.customer_phone ? `(${s.customer_phone})` : ''}` : ''
      })
    })

    // 2. Expenses
    filteredExpenses.forEach(e => {
      entries.push({
        id: `exp-${e.id}`,
        type: 'expense',
        title: `مصروف: ${e.title}`,
        amount: e.amount,
        reference: e.category,
        branch: e.branch || '—',
        date: e.created_at,
        notes: e.notes
      })
    })

    // 3. Employee drawings
    filteredDraws.forEach(d => {
      entries.push({
        id: `draw-${d.id}`,
        type: 'draw',
        title: `سلفة موظف: ${d.employee_name}`,
        amount: d.amount,
        reference: d.status === 'approved' ? 'معتمدة' : d.status === 'pending' ? 'معلقة' : 'تم تسويتها',
        branch: employees.find(e => e.name === d.employee_name)?.branch || '—',
        date: d.created_at || new Date(d.date).toISOString(),
        notes: d.notes
      })
    })

    // Sort by date descending
    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [filteredSales, filteredExpenses, filteredDraws, employees])

  // --- CSV Exporter Helper ---
  const exportToCSV = (headers: string[], rows: any[][], filename: string) => {
    let csvContent = '\uFEFF' // UTF-8 BOM
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

  // Exports
  const handleExportLedger = () => {
    const headers = ['الحركة', 'نوع المعاملة', 'المبلغ', 'طريقة الدفع / المرجع', 'الفرع', 'التاريخ', 'تفاصيل وملاحظات']
    const rows = cashLedger.map(l => [
      l.title,
      l.type === 'income' ? 'دخل (+)' : l.type === 'expense' ? 'مصروف (-)' : 'سلفة موظف (-)',
      l.amount,
      l.reference,
      l.branch,
      new Date(l.date).toLocaleString('ar-EG'),
      l.notes || ''
    ])
    exportToCSV(headers, rows, `دفتر_الخزينة_${timeframe}_${new Date().toISOString().split('T')[0]}`)
  }

  const handleExportExpenses = () => {
    const headers = ['بند المصروف', 'الفئة', 'المبلغ', 'الفرع', 'المسؤول', 'التاريخ', 'ملاحظات']
    const rows = filteredExpenses.map(e => [
      e.title,
      e.category,
      e.amount,
      e.branch,
      e.employee_name,
      new Date(e.created_at).toLocaleDateString('ar-EG'),
      e.notes || ''
    ])
    exportToCSV(headers, rows, `تقرير_المصروفات_${timeframe}_${new Date().toISOString().split('T')[0]}`)
  }

  const handleExportDraws = () => {
    const headers = ['اسم الموظف', 'المبلغ المسحوب', 'التاريخ', 'الحالة', 'ملاحظات']
    const rows = filteredDraws.map(d => [
      d.employee_name,
      d.amount,
      d.date,
      d.status === 'approved' ? 'معتمدة' : d.status === 'pending' ? 'معلقة' : 'تم تسويتها',
      d.notes || ''
    ])
    exportToCSV(headers, rows, `سجل_السلفيات_${timeframe}_${new Date().toISOString().split('T')[0]}`)
  }

  // --- Expenses Actions (CRUD) ---
  const openAddExpenseModal = () => {
    setEditingExpenseId(null)
    setExpenseForm({ title: '', category: 'أخرى', amount: '', branch: branches[0]?.name || '', employee_name: employees[0]?.name || '', notes: '' })
    setExpenseError('')
    setShowExpenseModal(true)
  }

  const openEditExpenseModal = (exp: Expense) => {
    setEditingExpenseId(exp.id)
    setExpenseForm({
      title: exp.title,
      category: exp.category,
      amount: exp.amount.toString(),
      branch: exp.branch,
      employee_name: exp.employee_name,
      notes: exp.notes || ''
    })
    setExpenseError('')
    setShowExpenseModal(true)
  }

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!expenseForm.title.trim() || !expenseForm.amount || !expenseForm.branch || !expenseForm.employee_name) {
      setExpenseError('يرجى ملء جميع الحقول المطلوبة')
      return
    }

    setSavingExpense(true)
    setExpenseError('')

    const payload = {
      title: expenseForm.title.trim(),
      category: expenseForm.category,
      amount: parseFloat(expenseForm.amount),
      branch: expenseForm.branch,
      employee_name: expenseForm.employee_name,
      notes: expenseForm.notes.trim()
    }

    try {
      if (editingExpenseId) {
        await supabase.from('expenses').update(payload).eq('id', editingExpenseId)
      } else {
        await supabase.from('expenses').insert(payload)
      }
      setShowExpenseModal(false)
      await loadData()
    } catch (err: any) {
      setExpenseError(err.message || 'حدث خطأ أثناء حفظ المصروف.')
    } finally {
      setSavingExpense(false)
    }
  }

  const handleExpenseDelete = async (id: string) => {
    if (!confirm('هل تريد حذف هذا المصروف نهائياً؟')) return
    await supabase.from('expenses').delete().eq('id', id)
    await loadData()
  }

  // --- Draws/Advances Actions (CRUD) ---
  const openAddDrawModal = () => {
    setEditingDrawId(null)
    setDrawForm({ employee_name: employees[0]?.name || '', amount: '', date: new Date().toISOString().split('T')[0], notes: '', status: 'approved' })
    setDrawError('')
    setShowDrawModal(true)
  }

  const openEditDrawModal = (draw: EmployeeDraw) => {
    setEditingDrawId(draw.id)
    setDrawForm({
      employee_name: draw.employee_name,
      amount: draw.amount.toString(),
      date: draw.date,
      notes: draw.notes || '',
      status: draw.status
    })
    setDrawError('')
    setShowDrawModal(true)
  }

  const handleDrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!drawForm.employee_name || !drawForm.amount || !drawForm.date) {
      setDrawError('يرجى ملء جميع الحقول المطلوبة')
      return
    }

    setSavingDraw(true)
    setDrawError('')

    const payload = {
      employee_name: drawForm.employee_name,
      amount: parseFloat(drawForm.amount),
      date: drawForm.date,
      status: drawForm.status,
      notes: drawForm.notes.trim()
    }

    try {
      if (editingDrawId) {
        await supabase.from('employee_draws').update(payload).eq('id', editingDrawId)
      } else {
        await supabase.from('employee_draws').insert(payload)
      }
      setShowDrawModal(false)
      await loadData()
    } catch (err: any) {
      setDrawError(err.message || 'حدث خطأ أثناء الحفظ.')
    } finally {
      setSavingDraw(false)
    }
  }

  const handleDrawDelete = async (id: string) => {
    if (!confirm('هل تريد حذف سجل السلفة هذا؟')) return
    await supabase.from('employee_draws').delete().eq('id', id)
    await loadData()
  }

  return (
    <div className="fade-in" style={{ direction: 'rtl' }}>
      {/* Title Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>💳 الإدارة المالية والحسابات</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>تتبع الخزينة العامة، المصروفات التشغيلية، وسحبيات وسلف الموظفين.</p>
        </div>
        <button 
          onClick={loadData}
          style={{
            padding: '8px 14px', fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-secondary)', cursor: 'pointer'
          }}
        >
          🔄 تحديث البيانات
        </button>
      </div>

      {/* Control Panel: Timeframe Filter */}
      <div className="glass-card" style={{ padding: 16, marginBottom: 24, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>تصفية الفترة الحالية:</span>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 10, padding: 3, gap: 2 }}>
            {(['today', 'week', 'month', 'custom'] as const).map((t) => {
              const label = t === 'today' ? 'اليوم' : t === 'week' ? 'آخر 7 أيام' : t === 'month' ? 'آخر 30 يوم' : 'فترة مخصصة'
              const active = timeframe === t
              return (
                <button
                  key={t}
                  onClick={() => setTimeframe(t)}
                  style={{
                    padding: '6px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 8,
                    background: active ? 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))' : 'none',
                    color: active ? 'white' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {timeframe === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }} className="fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>من:</span>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-field" style={{ padding: '6px 10px', fontSize: 12, width: 130 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>إلى:</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-field" style={{ padding: '6px 10px', fontSize: 12, width: 130 }} />
            </div>
          </div>
        )}
      </div>

      {/* Financial Overview Metrics Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 28 }}>
        
        {/* Income Card with payment breakdown */}
        <div style={{
          padding: '20px 24px', borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.07), rgba(16, 185, 129, 0.02))',
          border: '1px solid rgba(16, 185, 129, 0.15)',
          display: 'flex', flexDirection: 'column', gap: 12
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--accent-emerald)', fontWeight: 600, marginBottom: 4 }}>💰 إجمالي الدخل (مبيعات الفترة)</div>
              <div style={{ fontSize: 28, fontWeight: 850, color: 'var(--text-primary)' }}>
                {salesMetrics.total.toLocaleString('ar-EG')} <span style={{ fontSize: 13, fontWeight: 500 }}>ج.م</span>
              </div>
            </div>
            <span style={{ fontSize: 30 }}>💸</span>
          </div>
          <div style={{ borderTop: '1px dashed rgba(16, 185, 129, 0.2)', paddingTop: 8, display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
            <div>كاش: <strong>{salesMetrics.cash.toLocaleString('ar-EG')}</strong></div>
            <div>فيزا: <strong>{salesMetrics.visa.toLocaleString('ar-EG')}</strong></div>
            <div>انستا باي: <strong>{salesMetrics.instapay.toLocaleString('ar-EG')}</strong></div>
          </div>
        </div>

        {/* Expenses Card */}
        <div style={{
          padding: '20px 24px', borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.07), rgba(239, 68, 68, 0.02))',
          border: '1px solid rgba(239, 68, 68, 0.15)',
          display: 'flex', flexDirection: 'column', justifySelf: 'stretch', justifyContent: 'space-between', height: '100%'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--accent-red)', fontWeight: 600, marginBottom: 4 }}>📤 إجمالي المصروفات التشغيلية</div>
              <div style={{ fontSize: 28, fontWeight: 850, color: 'var(--text-primary)' }}>
                {totalExpenses.toLocaleString('ar-EG')} <span style={{ fontSize: 13, fontWeight: 500 }}>ج.م</span>
              </div>
            </div>
            <span style={{ fontSize: 30 }}>📉</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>تشمل فواتير صيانة وتأجير وفروع.</div>
        </div>

        {/* Employee advances/drawings */}
        <div style={{
          padding: '20px 24px', borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.07), rgba(139, 92, 246, 0.02))',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          display: 'flex', flexDirection: 'column', justifySelf: 'stretch', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--accent-purple)', fontWeight: 600, marginBottom: 4 }}>👥 سلفيات ومسحوبات الموظفين</div>
              <div style={{ fontSize: 28, fontWeight: 850, color: 'var(--text-primary)' }}>
                {totalDraws.toLocaleString('ar-EG')} <span style={{ fontSize: 13, fontWeight: 500 }}>ج.م</span>
              </div>
            </div>
            <span style={{ fontSize: 30 }}>👥</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>المبالغ المخصومة لاحقاً من الرواتب.</div>
        </div>

        {/* Remaining / Net Balance */}
        <div style={{
          padding: '20px 24px', borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.07), rgba(245, 158, 11, 0.02))',
          border: '1px solid rgba(245, 158, 11, 0.15)',
          display: 'flex', flexDirection: 'column', justifySelf: 'stretch', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--accent-amber)', fontWeight: 600, marginBottom: 4 }}>⚖️ صافي الرصيد المتبقي (الأرباح)</div>
              <div style={{ fontSize: 28, fontWeight: 850, color: netProfit >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)' }}>
                {netProfit.toLocaleString('ar-EG')} <span style={{ fontSize: 13, fontWeight: 500 }}>ج.م</span>
              </div>
            </div>
            <span style={{ fontSize: 30 }}>⚖️</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>صافي الحساب الكلي لفترة الفلترة.</div>
        </div>

        {/* Daily Revenue breakdown */}
        <div style={{
          padding: '20px 24px', borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(59, 130, 246, 0.02))',
          border: '1px solid rgba(59, 130, 246, 0.15)',
          display: 'flex', flexDirection: 'column', gap: 12,
          gridColumn: 'span 2'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600, marginBottom: 4 }}>📅 إيرادات اليوم الحالي (Daily Revenue)</div>
              <div style={{ fontSize: 28, fontWeight: 850, color: 'var(--text-primary)' }}>
                {todayMetrics.total.toLocaleString('ar-EG')} <span style={{ fontSize: 13, fontWeight: 500 }}>ج.م</span>
              </div>
            </div>
            <span style={{ fontSize: 30 }}>📅</span>
          </div>
          <div style={{ borderTop: '1px dashed rgba(59, 130, 246, 0.2)', paddingTop: 8, display: 'flex', gap: 24, fontSize: 12, color: 'var(--text-secondary)' }}>
            <div>كاش اليوم: <strong>{todayMetrics.cash.toLocaleString('ar-EG')} ج.م</strong></div>
            <div>فيزا اليوم: <strong>{todayMetrics.visa.toLocaleString('ar-EG')} ج.م</strong></div>
            <div>انستا باي اليوم: <strong>{todayMetrics.instapay.toLocaleString('ar-EG')} ج.م</strong></div>
          </div>
        </div>

      </div>

      {/* Tabs Switcher */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 28, gap: 16 }}>
        {(['ledger', 'expenses', 'draws'] as const).map(tab => {
          const label = tab === 'ledger' ? '💵 الخزينة العامة وحركة المال' : tab === 'expenses' ? '🧾 المصروفات التشغيلية' : '👥 سلفيات الموظفين'
          const active = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 16px', fontSize: 14, fontWeight: 700, background: 'none', border: 'none',
                borderBottom: active ? '3px solid var(--accent-blue)' : '3px solid transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s', marginBottom: -1
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          جاري جلب البيانات المالية وتحليل الخزينة...
        </div>
      ) : (
        <div>
          {/* ========================================================================= */}
          {/* TAB: GENERAL CASH LEDGER */}
          {/* ========================================================================= */}
          {activeTab === 'ledger' && (
            <div className="fade-in">
              <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>📝 حركة الخزينة التفصيلية (دفتر الحسابات العام)</h3>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>تسلسل زمني لجميع عمليات الدخل، الصرف، وسلفيات الموظفين.</p>
                  </div>
                  <button 
                    onClick={handleExportLedger}
                    className="btn-primary" 
                    style={{ padding: '8px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    📥 تصدير دفتر الخزينة لـ Excel
                  </button>
                </div>

                {cashLedger.length === 0 ? (
                  <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>لا توجد حركات مالية مسجلة للفترة المحددة</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>الحركة / البند</th>
                          <th>نوع المعاملة</th>
                          <th>المبلغ</th>
                          <th>المرجع / طريقة الدفع</th>
                          <th>الفرع</th>
                          <th>التاريخ والوقت</th>
                          <th>تفاصيل إضافية</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cashLedger.map(item => {
                          const isIncome = item.type === 'income'
                          const isExpense = item.type === 'expense'
                          return (
                            <tr key={item.id}>
                              <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</td>
                              <td>
                                <span style={{
                                  padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                                  background: isIncome ? 'rgba(16, 185, 129, 0.1)' : isExpense ? 'rgba(239, 68, 68, 0.1)' : 'rgba(139, 92, 246, 0.1)',
                                  color: isIncome ? '#34d399' : isExpense ? '#f87171' : '#a78bfa'
                                }}>
                                  {isIncome ? 'دخل (+)' : isExpense ? 'مصروف (-)' : 'سلفة موظف (-)'}
                                </span>
                              </td>
                              <td style={{ fontWeight: 750, color: isIncome ? 'var(--accent-emerald)' : 'var(--accent-red)' }}>
                                {isIncome ? '+' : '-'}{item.amount.toLocaleString('ar-EG')} ج.م
                              </td>
                              <td style={{ fontSize: 12 }}>{item.reference}</td>
                              <td>{item.branch}</td>
                              <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {new Date(item.date).toLocaleString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.notes || '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: OPERATIONAL EXPENSES */}
          {/* ========================================================================= */}
          {activeTab === 'expenses' && (
            <div className="fade-in">
              <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>🧾 سجل المصروفات التشغيلية</h3>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>إدارة المصاريف المتنوعة مثل فواتير الفروع والصيانة.</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button 
                      onClick={handleExportExpenses}
                      className="btn-primary" 
                      style={{ padding: '8px 14px', fontSize: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                    >
                      📦 تصدير قائمة المصروفات
                    </button>
                    <button 
                      onClick={openAddExpenseModal}
                      className="btn-primary" 
                      style={{ padding: '8px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      ➕ تسجيل مصروف جديد
                    </button>
                  </div>
                </div>

                {filteredExpenses.length === 0 ? (
                  <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>لا توجد مصروفات مسجلة للفترة المحددة</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>بند المصروف</th>
                          <th>الفئة</th>
                          <th>المبلغ</th>
                          <th>الفرع</th>
                          <th>المسؤول (الموظف)</th>
                          <th>التاريخ</th>
                          <th>ملاحظات</th>
                          <th>إجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredExpenses.map(exp => (
                          <tr key={exp.id}>
                            <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{exp.title}</td>
                            <td>
                              <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: 6 }}>
                                {exp.category}
                              </span>
                            </td>
                            <td style={{ fontWeight: 750, color: 'var(--accent-red)' }}>{exp.amount.toLocaleString('ar-EG')} ج.م</td>
                            <td>{exp.branch}</td>
                            <td>{exp.employee_name}</td>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {new Date(exp.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{exp.notes || '—'}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => openEditExpenseModal(exp)} style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(91,110,245,0.1)', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: 11 }}>تعديل</button>
                                <button onClick={() => handleExpenseDelete(exp.id)} style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 11 }}>حذف</button>
                              </div>
                            </td>
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
          {/* TAB: EMPLOYEE DRAWS (SALARY ADVANCES) */}
          {/* ========================================================================= */}
          {activeTab === 'draws' && (
            <div className="fade-in">
              <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>👥 سجل سلفيات ومسحوبات الموظفين</h3>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>متابعة المبالغ المالية التي يسحبها الموظفون وتسجل كخصومات من الراتب.</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button 
                      onClick={handleExportDraws}
                      className="btn-primary" 
                      style={{ padding: '8px 14px', fontSize: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                    >
                      📦 تصدير قائمة السلفيات
                    </button>
                    <button 
                      onClick={openAddDrawModal}
                      className="btn-primary" 
                      style={{ padding: '8px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      ➕ تسجيل سلفة لموظف
                    </button>
                  </div>
                </div>

                {filteredDraws.length === 0 ? (
                  <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>لا توجد سلفيات مسجلة للفترة المحددة</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>اسم الموظف</th>
                          <th>المبلغ المسحوب</th>
                          <th>تاريخ السحب</th>
                          <th>حالة السلفة</th>
                          <th>ملاحظات</th>
                          <th>إجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDraws.map(draw => (
                          <tr key={draw.id}>
                            <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{draw.employee_name}</td>
                            <td style={{ fontWeight: 750, color: 'var(--accent-purple)' }}>{draw.amount.toLocaleString('ar-EG')} ج.م</td>
                            <td style={{ fontSize: 12 }}>{draw.date}</td>
                            <td>
                              <span style={{
                                padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                                background: draw.status === 'approved' ? 'rgba(16, 185, 129, 0.1)' : draw.status === 'pending' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255,255,255,0.05)',
                                color: draw.status === 'approved' ? '#34d399' : draw.status === 'pending' ? '#fbbf24' : 'var(--text-muted)'
                              }}>
                                {draw.status === 'approved' ? 'معتمدة ومخصومة' : draw.status === 'pending' ? 'معلقة للاعتماد' : 'تمت تسويتها'}
                              </span>
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{draw.notes || '—'}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => openEditDrawModal(draw)} style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(91,110,245,0.1)', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: 11 }}>تعديل</button>
                                <button onClick={() => handleDrawDelete(draw.id)} style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 11 }}>حذف</button>
                              </div>
                            </td>
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

      {/* ========================================================================= */}
      {/* EXPENSE CRUD MODAL */}
      {/* ========================================================================= */}
      {showExpenseModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowExpenseModal(false) }}>
          <div className="modal-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                {editingExpenseId ? 'تعديل بيانات المصروف' : 'تسجيل مصروف تشغيلي جديد'}
              </h2>
              <button onClick={() => setShowExpenseModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            {expenseError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#f87171', marginBottom: 16 }}>{expenseError}</div>}
            
            <form onSubmit={handleExpenseSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>بند المصروف (العنوان)</label>
                  <input type="text" placeholder="مثال: فاتورة مياه فرع الجيزة" value={expenseForm.title} onChange={e => setExpenseForm(f => ({ ...f, title: e.target.value }))} className="input-field" style={{ padding: '10px 12px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>المبلغ (ج.م)</label>
                  <input type="number" placeholder="500" value={expenseForm.amount} onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))} className="input-field" style={{ padding: '10px 12px' }} min="0" step="0.01" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>فئة المصروف</label>
                  <select value={expenseForm.category} onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value }))} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', width: '100%' }}>
                    <option value="فواتير">فواتير (كهرباء/مياه/إنترنت)</option>
                    <option value="إيجار">إيجارات</option>
                    <option value="صيانة">صيانة وإصلاحات</option>
                    <option value="بضائع">بضائع ومشتريات</option>
                    <option value="أخرى">أخرى / مصاريف نثرية</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>الفرع المنسوب إليه</label>
                  <select value={expenseForm.branch} onChange={e => setExpenseForm(f => ({ ...f, branch: e.target.value }))} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', width: '100%' }}>
                    <option value="">اختر الفرع</option>
                    {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>الموظف المسؤول عن الصرف</label>
                  <select value={expenseForm.employee_name} onChange={e => setExpenseForm(f => ({ ...f, employee_name: e.target.value }))} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', width: '100%' }}>
                    <option value="">اختر الموظف</option>
                    {employees.map(emp => <option key={emp.id} value={emp.name}>{emp.name} ({emp.branch})</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>تفاصيل / ملاحظات إضافية</label>
                <textarea placeholder="أي تفاصيل أو أرقام إيصالات..." value={expenseForm.notes} onChange={e => setExpenseForm(f => ({ ...f, notes: e.target.value }))} className="input-field" style={{ padding: '10px 12px', resize: 'vertical', minHeight: 80 }} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                <button type="button" onClick={() => setShowExpenseModal(false)} style={{ flex: 1, padding: '11px', borderRadius: 'var(--radius)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}>إلغاء</button>
                <button type="submit" disabled={savingExpense} className="btn-primary" style={{ flex: 1, padding: '11px', fontSize: 14 }}>
                  {savingExpense ? 'جاري التسجيل...' : (editingExpenseId ? 'حفظ التغييرات' : 'سجل المصروف')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DRAW/ADVANCE CRUD MODAL */}
      {/* ========================================================================= */}
      {showDrawModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowDrawModal(false) }}>
          <div className="modal-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                {editingDrawId ? 'تعديل سلفة الموظف' : 'تسجيل سلفة موظف (Drawing) جديدة'}
              </h2>
              <button onClick={() => setShowDrawModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            {drawError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#f87171', marginBottom: 16 }}>{drawError}</div>}
            
            <form onSubmit={handleDrawSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>الموظف الحاصل على السلفة</label>
                  <select value={drawForm.employee_name} onChange={e => setDrawForm(f => ({ ...f, employee_name: e.target.value }))} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', width: '100%' }}>
                    <option value="">اختر الموظف</option>
                    {employees.map(emp => <option key={emp.id} value={emp.name}>{emp.name} ({emp.branch})</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>مبلغ السلفة (ج.م)</label>
                  <input type="number" placeholder="1000" value={drawForm.amount} onChange={e => setDrawForm(f => ({ ...f, amount: e.target.value }))} className="input-field" style={{ padding: '10px 12px' }} min="0" step="0.01" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>تاريخ السحب</label>
                  <input type="date" value={drawForm.date} onChange={e => setDrawForm(f => ({ ...f, date: e.target.value }))} className="input-field" style={{ padding: '8px 12px', fontSize: 13 }} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>حالة السلفة</label>
                  <select value={drawForm.status} onChange={e => setDrawForm(f => ({ ...f, status: e.target.value as any }))} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', width: '100%' }}>
                    <option value="approved">معتمدة (ستخصم من الراتب القادم)</option>
                    <option value="pending">معلقة (في انتظار الموافقة)</option>
                    <option value="settled">تمت تسويتها (دُفعت نقداً أو تم تسوية الحساب)</option>
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>ملاحظات وتبريرات</label>
                <textarea placeholder="مثال: سلفة طارئة لشراء دواء..." value={drawForm.notes} onChange={e => setDrawForm(f => ({ ...f, notes: e.target.value }))} className="input-field" style={{ padding: '10px 12px', resize: 'vertical', minHeight: 80 }} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                <button type="button" onClick={() => setShowDrawModal(false)} style={{ flex: 1, padding: '11px', borderRadius: 'var(--radius)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}>إلغاء</button>
                <button type="submit" disabled={savingDraw} className="btn-primary" style={{ flex: 1, padding: '11px', fontSize: 14 }}>
                  {savingDraw ? 'جاري التسجيل...' : (editingDrawId ? 'حفظ التغييرات' : 'سجل السلفة')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
