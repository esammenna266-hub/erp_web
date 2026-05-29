'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Stats {
  employees: number
  branches: number
  salesCount: number
  salesAmount: number
  attendance: number
}

interface RecentEmployee {
  id: string
  name: string
  email: string
  role: string
  branch: string
  created_at: string
}

interface SaleRecord {
  branch: string
  amount: number
  created_at: string
}

interface AttendanceRecord {
  status: string
  date: string
}

interface ProductRecord {
  id: string
  name: string
  quantity: number
  unit_type: 'piece' | 'weight'
  branch?: string
  price?: number
}

export default function DashboardPage() {
  // Period filter: today, 7days, month, all
  const [period, setPeriod] = useState<'today' | '7days' | 'month' | 'all'>('7days')
  
  // RAW Data from Supabase
  const [totalEmployees, setTotalEmployees] = useState(0)
  const [totalBranches, setTotalBranches] = useState(0)
  const [recent, setRecent] = useState<RecentEmployee[]>([])
  
  const [allEmployees, setAllEmployees] = useState<{ role: string }[]>([])
  const [allSales, setAllSales] = useState<SaleRecord[]>([])
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([])
  const [allProducts, setAllProducts] = useState<ProductRecord[]>([])
  
  const [loading, setLoading] = useState(true)

  // Load database tables
  async function loadData() {
    setLoading(true)
    const [
      { count: empCount },
      { count: branchCount },
      { data: recentData },
      { data: empData },
      { data: salesData },
      { data: attData },
      { data: prodData }
    ] = await Promise.all([
      supabase.from('employees').select('*', { count: 'exact', head: true }),
      supabase.from('branches').select('*', { count: 'exact', head: true }),
      supabase.from('employees').select('id, name, email, role, branch, created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('employees').select('role'),
      supabase.from('sales').select('branch, amount, created_at'),
      supabase.from('attendance').select('status, date'),
      supabase.from('products').select('id, name, quantity, unit_type, branch, price')
    ])
    
    setTotalEmployees(empCount ?? 0)
    setTotalBranches(branchCount ?? 0)
    setRecent(recentData ?? [])
    setAllEmployees(empData ?? [])
    setAllSales(salesData ?? [])
    setAllAttendance(attData ?? [])
    setAllProducts(prodData ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  // Date filters utilities
  const filterDateRanges = useMemo(() => {
    const now = new Date()
    
    // Today
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    // Last 7 Days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(now.getDate() - 7)
    
    // This Month
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    
    return {
      todayStart,
      sevenDaysAgo,
      thisMonthStart
    }
  }, [])

  // Filter Sales based on Selected Period
  const filteredSales = useMemo(() => {
    return allSales.filter(sale => {
      const saleDate = new Date(sale.created_at)
      if (period === 'today') {
        return saleDate >= filterDateRanges.todayStart
      } else if (period === '7days') {
        return saleDate >= filterDateRanges.sevenDaysAgo
      } else if (period === 'month') {
        return saleDate >= filterDateRanges.thisMonthStart
      }
      return true // 'all'
    })
  }, [allSales, period, filterDateRanges])

  // Filter Attendance based on Selected Period
  const filteredAttendance = useMemo(() => {
    return allAttendance.filter(att => {
      const attDate = new Date(att.date)
      if (period === 'today') {
        return attDate >= filterDateRanges.todayStart
      } else if (period === '7days') {
        return attDate >= filterDateRanges.sevenDaysAgo
      } else if (period === 'month') {
        return attDate >= filterDateRanges.thisMonthStart
      }
      return true // 'all'
    })
  }, [allAttendance, period, filterDateRanges])

  // Compute Stats cards
  const stats = useMemo<Stats>(() => {
    const totalSalesAmount = filteredSales.reduce((sum, s) => sum + (s.amount ?? 0), 0)
    
    return {
      employees: totalEmployees,
      branches: totalBranches,
      salesCount: filteredSales.length,
      salesAmount: totalSalesAmount,
      attendance: filteredAttendance.length
    }
  }, [totalEmployees, totalBranches, filteredSales, filteredAttendance])

  // Top Branches Sales (dynamically calculated for current period)
  const salesByBranchData = useMemo(() => {
    const salesByBranch = filteredSales.reduce((acc: Record<string, number>, sale) => {
      const branch = sale.branch || 'غير محدد'
      acc[branch] = (acc[branch] || 0) + (sale.amount || 0)
      return acc
    }, {})
    
    return Object.entries(salesByBranch)
      .map(([branch, amount]) => ({ branch, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5) // top 5
  }, [filteredSales])

  // Employee Roles Distribution (constant based on total employees)
  const roleDistributionData = useMemo(() => {
    const rolesCount = allEmployees.reduce((acc: Record<string, number>, emp) => {
      acc[emp.role] = (acc[emp.role] || 0) + 1
      return acc
    }, {})
    return Object.entries(rolesCount).map(([role, count]) => ({ role, count }))
  }, [allEmployees])

  // Low Stock Alerts (quantity < 10)
  const lowStockProducts = useMemo(() => {
    return allProducts
      .filter(p => p.quantity < 10)
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 4) // top 4 critical products
  }, [allProducts])

  // Today's Attendance Rate (radial progress)
  const todayAttendanceRate = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    const todayRecords = allAttendance.filter(r => r.date === todayStr)
    if (todayRecords.length === 0 || totalEmployees === 0) return 0
    
    const presentCount = todayRecords.filter(r => r.status === 'present' || r.status === 'late').length
    return Math.round((presentCount / totalEmployees) * 100)
  }, [allAttendance, totalEmployees])

  // Daily Sales SVG Line Chart generator
  const salesChartData = useMemo(() => {
    // Generate dates representing the current period
    const now = new Date()
    let daysCount = 7
    if (period === 'today') daysCount = 1
    else if (period === 'month') daysCount = 30
    else if (period === 'all') daysCount = 30 // display last 30 days max for standard visualization
    
    const datesList: string[] = []
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(now.getDate() - i)
      datesList.push(d.toISOString().split('T')[0])
    }

    // Map sales to each date
    const salesMap = filteredSales.reduce((acc: Record<string, number>, sale) => {
      const dateStr = new Date(sale.created_at).toISOString().split('T')[0]
      acc[dateStr] = (acc[dateStr] || 0) + (sale.amount || 0)
      return acc
    }, {})

    // Format chart points
    const points = datesList.map(dateStr => {
      const label = new Date(dateStr).toLocaleDateString('ar-EG', { month: 'numeric', day: 'numeric' })
      const amount = salesMap[dateStr] || 0
      return { label, amount }
    })

    const amounts = points.map(p => p.amount)
    const maxAmount = Math.max(...amounts, 1000) // avoid division by zero, min scale of 1000 EGP

    return {
      points,
      maxAmount
    }
  }, [filteredSales, period])

  // Constants mapping
  const roleLabel: Record<string, string> = {
    admin: 'مسؤول', supervisor: 'مشرف', employee: 'موظف'
  }
  const roleBadge: Record<string, string> = {
    admin: 'badge-red', supervisor: 'badge-amber', employee: 'badge-blue'
  }

  const statCards = [
    { label: 'إجمالي الموظفين', value: stats.employees, subtitle: 'موظف نشط', icon: '👥', color: '#5b6ef5', glow: 'rgba(91,110,245,0.2)', href: '/dashboard/employees' },
    { label: 'الفروع النشطة', value: stats.branches, subtitle: 'فروع إدارية', icon: '🏢', color: '#10d9a0', glow: 'rgba(16,217,160,0.2)', href: '/dashboard/branches' },
    { label: 'إجمالي المبيعات', value: stats.salesAmount, subtitle: `${stats.salesCount} عملية بيع`, icon: '💰', color: '#f59e0b', glow: 'rgba(245,158,11,0.2)', href: '/dashboard/sales', isCurrency: true },
    { label: 'سجلات الحضور', value: stats.attendance, subtitle: 'عمليات مسجلة', icon: '📅', color: '#9b59f8', glow: 'rgba(155,89,248,0.2)', href: '/dashboard/attendance' },
  ]

  // Render Line SVG Chart Paths
  const svgWidth = 500
  const svgHeight = 200
  const chartPadding = { top: 20, bottom: 30, left: 50, right: 20 }
  const chartWidth = svgWidth - chartPadding.left - chartPadding.right
  const chartHeight = svgHeight - chartPadding.top - chartPadding.bottom

  const svgPaths = useMemo(() => {
    const pts = salesChartData.points
    const max = salesChartData.maxAmount
    if (pts.length <= 1) return { line: '', area: '', dots: [] }

    const mappedPoints = pts.map((pt, i) => {
      const x = chartPadding.left + (i * (chartWidth / (pts.length - 1)))
      const y = chartPadding.top + chartHeight - ((pt.amount / max) * chartHeight)
      return { x, y, amount: pt.amount, label: pt.label }
    })

    // Construct Line Path M x0 y0 L x1 y1 ...
    const linePath = mappedPoints.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ')

    // Construct Area Path (glowing fill underneath line)
    const areaPath = `
      ${linePath} 
      L ${mappedPoints[mappedPoints.length - 1].x} ${chartPadding.top + chartHeight} 
      L ${mappedPoints[0].x} ${chartPadding.top + chartHeight} 
      Z
    `

    return {
      line: linePath,
      area: areaPath,
      dots: mappedPoints
    }
  }, [salesChartData, chartWidth, chartHeight, chartPadding.left, chartPadding.top])

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* Header and Period Filter Tab Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
            لوحة تحليلات النظام
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
            متابعة فورية للمبيعات، حضور الموظفين، وحالة المخازن بالفروع
          </p>
        </div>

        {/* Date period selector tabs */}
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 4,
          gap: 4
        }}>
          {[
            { id: 'today', label: 'اليوم' },
            { id: '7days', label: 'آخر 7 أيام' },
            { id: 'month', label: 'هذا الشهر' },
            { id: 'all', label: 'الكل' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setPeriod(tab.id as any)}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                background: period === tab.id ? 'var(--accent-blue)' : 'transparent',
                color: period === tab.id ? 'white' : 'var(--text-secondary)',
                transition: 'all 0.15s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {statCards.map((card, i) => (
          <Link key={card.label} href={card.href} style={{ textDecoration: 'none' }}>
            <div className={`stat-card fade-in stagger-${i + 1}`} style={{ cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{card.label}</span>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, fontSize: 18,
                    background: card.glow, display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {card.icon}
                  </div>
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: 4 }}>
                  {loading ? '—' : card.isCurrency ? `${card.value.toLocaleString('ar-EG')} ج.م` : card.value.toLocaleString('ar-EG')}
                </div>
              </div>
              
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{card.subtitle}</span>
                <span style={{ color: card.color }}>عرض التفاصيل ←</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Main Charts & Widgets Workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)', gap: 16 }}>
        
        {/* LEFT COMPONENT: Sales Trend Line Chart */}
        <div className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>💡 اتجاه حجم المبيعات اليومية</h2>
            <span style={{ fontSize: 11, background: 'rgba(245,158,11,0.1)', color: 'var(--accent-amber)', padding: '2px 8px', borderRadius: 6 }}>
              مخطط بياني خطي
            </span>
          </div>

          {loading ? (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="spinner" />
            </div>
          ) : salesChartData.points.length === 0 ? (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              لا توجد عمليات بيع مسجلة في هذه الفترة
            </div>
          ) : (
            <div style={{ position: 'relative', width: '100%', direction: 'ltr' }}>
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                <defs>
                  {/* Glowing line filter */}
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#5b6ef5" floodOpacity="0.4" />
                  </filter>
                  {/* Fill Area Gradient */}
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5b6ef5" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#5b6ef5" stopOpacity="0.00" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
                  const y = chartPadding.top + chartHeight * ratio
                  const val = Math.round(salesChartData.maxAmount * (1 - ratio))
                  return (
                    <g key={index}>
                      <line 
                        x1={chartPadding.left} 
                        y1={y} 
                        x2={chartPadding.left + chartWidth} 
                        y2={y} 
                        stroke="rgba(255,255,255,0.04)" 
                        strokeWidth="1" 
                      />
                      <text 
                        x={chartPadding.left - 8} 
                        y={y + 4} 
                        fill="var(--text-muted)" 
                        fontSize="9" 
                        textAnchor="end"
                        fontFamily="monospace"
                      >
                        {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                      </text>
                    </g>
                  )
                })}

                {/* Area under the line */}
                {svgPaths.area && (
                  <path d={svgPaths.area} fill="url(#areaGradient)" />
                )}

                {/* Main Trend Line */}
                {svgPaths.line && (
                  <path 
                    d={svgPaths.line} 
                    fill="none" 
                    stroke="var(--accent-blue)" 
                    strokeWidth="3.5" 
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#glow)"
                  />
                )}

                {/* Circles & Labels on each data point */}
                {svgPaths.dots.map((dot, idx) => (
                  <g key={idx} className="chart-dot-group" style={{ cursor: 'pointer' }}>
                    <circle 
                      cx={dot.x} 
                      cy={dot.y} 
                      r="4.5" 
                      fill="var(--bg-primary)" 
                      stroke="var(--accent-blue)" 
                      strokeWidth="2.5" 
                    />
                    
                    {/* Tooltip background & text shown on hover via CSS */}
                    <g className="chart-tooltip" style={{ opacity: 0, pointerEvents: 'none', transition: 'opacity 0.15s' }}>
                      <rect 
                        x={dot.x - 40} 
                        y={dot.y - 32} 
                        width="80" 
                        height="20" 
                        rx="4" 
                        fill="#161622" 
                        stroke="var(--border)" 
                        strokeWidth="1" 
                      />
                      <text 
                        x={dot.x} 
                        y={dot.y - 18} 
                        fill="white" 
                        fontSize="9" 
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {dot.amount.toLocaleString('ar-EG')} ج.م
                      </text>
                    </g>

                    {/* X axis date label */}
                    <text 
                      x={dot.x} 
                      y={chartPadding.top + chartHeight + 18} 
                      fill="var(--text-muted)" 
                      fontSize="9" 
                      textAnchor="middle"
                      fontFamily="monospace"
                    >
                      {dot.label}
                    </text>
                  </g>
                ))}
              </svg>
              
              {/* CSS Rule for showing Tooltips on Hover */}
              <style jsx>{`
                svg :global(.chart-dot-group:hover .chart-tooltip) {
                  opacity: 1 !important;
                }
                svg :global(.chart-dot-group:hover circle) {
                  r: 6.5;
                  fill: var(--accent-blue) !important;
                  stroke: white !important;
                }
              `}</style>
            </div>
          )}
        </div>

        {/* RIGHT COMPONENT: Today's Attendance Ring Chart */}
        <div className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', width: '100%', marginBottom: 16, textAlign: 'right' }}>
            📅 نسبة حضور الموظفين اليوم
          </h2>

          {loading ? (
            <div style={{ height: 160, display: 'flex', alignItems: 'center' }}>
              <div className="spinner" />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '10px 0' }}>
              <div style={{ position: 'relative', width: 120, height: 120 }}>
                {/* SVG Donut Circle */}
                <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="40" 
                    fill="transparent" 
                    stroke="rgba(255,255,255,0.03)" 
                    strokeWidth="10" 
                  />
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="40" 
                    fill="transparent" 
                    stroke="var(--accent-purple)" 
                    strokeWidth="10" 
                    strokeDasharray="251.3"
                    strokeDashoffset={251.3 - (todayAttendanceRate / 100) * 251.3}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
                  />
                </svg>
                
                {/* Inner Center Text */}
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
                    {todayAttendanceRate}%
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>معدل اليوم</span>
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {allAttendance.filter(r => r.date === new Date().toISOString().split('T')[0] && (r.status === 'present' || r.status === 'late')).length} حاضرين من أصل {totalEmployees}
                </p>
                <Link href="/dashboard/attendance" style={{ display: 'inline-block', fontSize: 11, color: 'var(--accent-purple)', textDecoration: 'none', marginTop: 4, fontWeight: 500 }}>
                  تسجيل كشف الحضور والغياب اليوم ←
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grid for Table and Alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1.8fr)', gap: 16 }}>
        
        {/* LEFT PANEL: Low Stock Warnings */}
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>🚨 تنبيهات المخزون المنخفض</h2>
            <Link href="/dashboard/products" style={{ fontSize: 12, color: 'var(--accent-blue)', textDecoration: 'none' }}>تعديل الكميات</Link>
          </div>

          {loading ? (
            <div style={{ padding: 30, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : lowStockProducts.length === 0 ? (
            <div style={{ padding: '30px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
              <p style={{ color: 'var(--accent-emerald)', fontSize: 13, fontWeight: 600 }}>المخزون ممتاز في جميع الفروع!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {lowStockProducts.map(prod => (
                <div key={prod.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{prod.name}</span>
                    <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>
                      {prod.quantity} {prod.unit_type === 'piece' ? 'قطعة' : 'كجم'} متبقية
                    </span>
                  </div>
                  {/* Mini warning progress bar */}
                  <div className="progress-bar" style={{ height: 5, background: 'rgba(255,255,255,0.03)' }}>
                    <div 
                      className="progress-fill" 
                      style={{ 
                        width: `${Math.max(10, (prod.quantity / 10) * 100)}%`, 
                        background: 'linear-gradient(90deg, var(--accent-red), #f87171)' 
                      }} 
                    />
                  </div>
                  {prod.branch && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>مخزن: {prod.branch}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Top 5 Selling Branches & Employee Distribution */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          
          {/* Top selling branches */}
          <div className="glass-card" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>🏢 أعلى الفروع مبيعاً</h2>
            
            {loading ? (
              <div style={{ textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
            ) : salesByBranchData.length === 0 ? (
              <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                لا توجد مبيعات في هذه الفترة
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {salesByBranchData.map((item, idx) => {
                  const maxAmt = Math.max(...salesByBranchData.map(s => s.amount), 1)
                  const percent = (item.amount / maxAmt) * 100
                  return (
                    <div key={item.branch}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{item.branch}</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {item.amount.toLocaleString('ar-EG')} ج.م
                        </span>
                      </div>
                      <div className="progress-bar" style={{ height: 6 }}>
                        <div className="progress-fill" style={{ width: `${percent}%`, background: 'linear-gradient(90deg, var(--accent-amber), #fbbf24)' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Roles distribution */}
          <div className="glass-card" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>👥 توزيع أدوار الموظفين</h2>
            
            {loading ? (
              <div style={{ textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
            ) : roleDistributionData.length === 0 ? (
              <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                لا توجد بيانات موظفين مسجلة
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {roleDistributionData.map(item => {
                  const percent = totalEmployees > 0 ? (item.count / totalEmployees) * 100 : 0
                  const colorMap: Record<string, string> = {
                    admin: 'var(--accent-red)',
                    supervisor: 'var(--accent-amber)',
                    employee: 'var(--accent-blue)'
                  }
                  const color = colorMap[item.role] || 'var(--accent-emerald)'
                  return (
                    <div key={item.role}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{roleLabel[item.role] ?? item.role}</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {item.count} ({percent.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="progress-bar" style={{ height: 6, background: 'rgba(255,255,255,0.03)' }}>
                        <div className="progress-fill" style={{ width: `${percent}%`, background: color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Bottom Panel: Recent Hired Employees */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>آخر الموظفين المضافين للنظام</h2>
          <Link href="/dashboard/employees" style={{ fontSize: 12, color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 500 }}>
            إدارة الموظفين ←
          </Link>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : recent.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>لا يوجد موظفون مضافون حالياً</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>البريد الإلكتروني</th>
                  <th>الدور</th>
                  <th>الفرع</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(emp => (
                  <tr key={emp.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: 6,
                          background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0
                        }}>
                          {emp.name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{emp.name}</span>
                      </div>
                    </td>
                    <td>{emp.email}</td>
                    <td><span className={`badge ${roleBadge[emp.role] ?? 'badge-blue'}`}>{roleLabel[emp.role] ?? emp.role}</span></td>
                    <td>{emp.branch ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
