'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface Product {
  id: string
  barcode?: string
  name: string
  category: string
  unit_type: 'piece' | 'weight'
  quantity: number
  price?: number
  branch?: string
  created_at: string
}

interface InventoryMovement {
  id: string
  product_id: string
  product_name: string
  type: 'inbound' | 'outbound' | 'transfer'
  quantity: number
  branch: string
  target_branch?: string
  notes?: string
  created_at: string
}

const unitLabel: Record<string, string> = { piece: 'قطعة', weight: 'كجم' }
const unitBadge: Record<string, string> = { piece: 'badge-blue', weight: 'badge-amber' }

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  
  const [activeTab, setActiveTab] = useState<'levels' | 'movements'>('levels')
  
  const [search, setSearch] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  
  const [adjustForm, setAdjustForm] = useState({
    productId: '',
    type: 'inbound',
    quantity: '',
    notes: ''
  })
  
  const [transferForm, setTransferForm] = useState({
    productId: '',
    targetBranch: '',
    quantity: '',
    notes: ''
  })
  
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [
        { data: pData },
        { data: mData },
        { data: bData }
      ] = await Promise.all([
        supabase.from('products').select('*').order('name', { ascending: true }),
        supabase.from('inventory_movements').select('*').order('created_at', { ascending: false }),
        supabase.from('branches').select('id, name')
      ])
      
      setProducts(pData ?? [])
      setMovements(mData ?? [])
      setBranches(bData ?? [])
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const categories = Array.from(new Set(products.map(p => p.category))).filter(Boolean)

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(search.toLowerCase()) || 
                          p.barcode?.toLowerCase().includes(search.toLowerCase())
    const matchesBranch = selectedBranch ? p.branch === selectedBranch : true
    const matchesCategory = selectedCategory ? p.category === selectedCategory : true
    return matchesSearch && matchesBranch && matchesCategory
  })

  const filteredMovements = movements.filter(m => {
    const matchesSearch = m.product_name?.toLowerCase().includes(search.toLowerCase())
    const matchesBranch = selectedBranch ? (m.branch === selectedBranch || m.target_branch === selectedBranch) : true
    return matchesSearch && matchesBranch
  })

  const totalProductsCount = products.length
  const totalStockQuantity = products.reduce((sum, p) => sum + (p.quantity || 0), 0)
  const lowStockCount = products.filter(p => p.quantity < 10).length
  const totalInventoryValue = products.reduce((sum, p) => sum + ((p.quantity || 0) * (p.price || 0)), 0)

  const openAdjustModal = (productId: string = '') => {
    setError('')
    setSuccess('')
    setAdjustForm({
      productId,
      type: 'inbound',
      quantity: '',
      notes: ''
    })
    setShowAdjustModal(true)
  }

  const openTransferModal = (productId: string = '') => {
    setError('')
    setSuccess('')
    setTransferForm({
      productId,
      targetBranch: '',
      quantity: '',
      notes: ''
    })
    setShowTransferModal(true)
  }

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adjustForm.productId || !adjustForm.quantity) {
      setError('يرجى اختيار المنتج وتحديد الكمية')
      return
    }

    const qtyVal = parseFloat(adjustForm.quantity)
    if (isNaN(qtyVal) || qtyVal <= 0) {
      setError('الكمية يجب أن تكون أكبر من الصفر')
      return
    }

    setActionLoading(true)
    setError('')

    const product = products.find(p => p.id === adjustForm.productId)
    if (!product) {
      setError('المنتج غير موجود')
      setActionLoading(false)
      return
    }

    let newQty = product.quantity
    if (adjustForm.type === 'inbound') {
      newQty += qtyVal
    } else {
      if (newQty < qtyVal) {
        setError('الكمية المتاحة في المخزن غير كافية لهذه العملية')
        setActionLoading(false)
        return
      }
      newQty -= qtyVal
    }

    try {
      const { error: pError } = await supabase
        .from('products')
        .update({ quantity: newQty })
        .eq('id', product.id)

      if (pError) throw pError

      const movementPayload = {
        product_id: product.id,
        product_name: product.name,
        type: adjustForm.type,
        quantity: qtyVal,
        branch: product.branch || 'غير محدد',
        notes: adjustForm.notes.trim() || (adjustForm.type === 'inbound' ? 'توريد/إضافة يدوية' : 'صرف/تسوية يدوية')
      }

      const { error: mError } = await supabase
        .from('inventory_movements')
        .insert(movementPayload)

      if (mError) throw mError

      setSuccess('تم تسجيل الحركة وتحديث المخزون بنجاح')
      setTimeout(() => {
        setShowAdjustModal(false)
        loadData()
      }, 1000)

    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تنفيذ العملية')
    } finally {
      setActionLoading(false)
    }
  }

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transferForm.productId || !transferForm.targetBranch || !transferForm.quantity) {
      setError('يرجى ملء جميع الحقول المطلوبة')
      return
    }

    const qtyVal = parseFloat(transferForm.quantity)
    if (isNaN(qtyVal) || qtyVal <= 0) {
      setError('الكمية يجب أن تكون أكبر من الصفر')
      return
    }

    setActionLoading(true)
    setError('')

    const sourceProduct = products.find(p => p.id === transferForm.productId)
    if (!sourceProduct) {
      setError('المنتج الأصلي غير موجود')
      setActionLoading(false)
      return
    }

    if (sourceProduct.branch === transferForm.targetBranch) {
      setError('لا يمكن التحويل لنفس الفرع')
      setActionLoading(false)
      return
    }

    if (sourceProduct.quantity < qtyVal) {
      setError(`الكمية المتاحة بالفرع الحالي (${sourceProduct.quantity}) غير كافية`)
      setActionLoading(false)
      return
    }

    try {
      const { error: sError } = await supabase
        .from('products')
        .update({ quantity: sourceProduct.quantity - qtyVal })
        .eq('id', sourceProduct.id)

      if (sError) throw sError

      const targetProduct = products.find(p => 
        (p.barcode && p.barcode === sourceProduct.barcode && p.branch === transferForm.targetBranch) ||
        (p.name === sourceProduct.name && p.branch === transferForm.targetBranch)
      )

      if (targetProduct) {
        const { error: tUpdateError } = await supabase
          .from('products')
          .update({ quantity: targetProduct.quantity + qtyVal })
          .eq('id', targetProduct.id)

        if (tUpdateError) throw tUpdateError
      } else {
        const { error: tInsertError } = await supabase
          .from('products')
          .insert({
            barcode: sourceProduct.barcode || null,
            name: sourceProduct.name,
            category: sourceProduct.category,
            unit_type: sourceProduct.unit_type,
            quantity: qtyVal,
            price: sourceProduct.price || null,
            branch: transferForm.targetBranch
          })

        if (tInsertError) throw tInsertError
      }

      const { error: mError } = await supabase
        .from('inventory_movements')
        .insert({
          product_id: sourceProduct.id,
          product_name: sourceProduct.name,
          type: 'transfer',
          quantity: qtyVal,
          branch: sourceProduct.branch || 'غير محدد',
          target_branch: transferForm.targetBranch,
          notes: transferForm.notes.trim() || `تحويل مخزني من ${sourceProduct.branch} إلى ${transferForm.targetBranch}`
        })

      if (mError) throw mError

      setSuccess('تم تحويل المخزون بنجاح')
      setTimeout(() => {
        setShowTransferModal(false)
        loadData()
      }, 1000)

    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء التحويل')
    } finally {
      setActionLoading(false)
    }
  }

  const getQuantityStatus = (qty: number) => {
    if (qty <= 0) return { label: 'نفذ', color: 'var(--accent-red)', bg: 'rgba(239, 68, 68, 0.15)' }
    if (qty < 10) return { label: 'منخفض', color: 'var(--accent-amber)', bg: 'rgba(245, 158, 11, 0.15)' }
    return { label: 'ممتاز', color: 'var(--accent-emerald)', bg: 'rgba(16, 217, 160, 0.15)' }
  }

  return (
    <div className="fade-in" style={{ direction: 'rtl' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>إدارة المخزون والعمليات المخزنية</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>متابعة وتحويل وإدخل كميات المنتجات بين الفروع</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button 
            id="transfer-stock-btn"
            onClick={() => openTransferModal()} 
            className="btn-primary" 
            style={{ 
              padding: '10px 18px', 
              fontSize: 13, 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8,
              background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="17 11 21 7 17 3"/><line x1="21" y1="7" x2="9" y2="7"/>
              <polyline points="7 13 3 17 7 21"/><line x1="3" y1="17" x2="15" y2="17"/>
            </svg>
            تحويل مخزني
          </button>
          <button 
            id="adjust-stock-btn"
            onClick={() => openAdjustModal()} 
            className="btn-primary" 
            style={{ padding: '10px 18px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            تعديل الكميات
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="stat-card">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>إجمالي الأصناف</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>{totalProductsCount}</div>
          <div style={{ fontSize: 11, color: 'var(--accent-blue)', marginTop: 4 }}>صنف منتج نشط</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>إجمالي المخزون (كميات)</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>{totalStockQuantity.toLocaleString('ar-EG')}</div>
          <div style={{ fontSize: 11, color: 'var(--accent-purple)', marginTop: 4 }}>قطعة وكجم إجمالية</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>أصناف حرجة / منخفضة</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: lowStockCount > 0 ? 'var(--accent-amber)' : 'var(--text-primary)' }}>{lowStockCount}</div>
          <div style={{ fontSize: 11, color: lowStockCount > 0 ? 'var(--accent-amber)' : 'var(--accent-emerald)', marginTop: 4 }}>
            {lowStockCount > 0 ? 'بحاجة لإعادة الطلب فوراً' : 'المخزون بوضع ممتاز'}
          </div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>القيمة المالية الكلية</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-emerald)' }}>{totalInventoryValue.toLocaleString('ar-EG')} ج.م</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>جنيهاً مصرياً تقريبياً</div>
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        <button 
          id="tab-levels"
          onClick={() => { setActiveTab('levels'); setSearch('') }}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'levels' ? '2px solid var(--accent-blue)' : 'none',
            color: activeTab === 'levels' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontSize: 14,
            fontWeight: 600,
            padding: '12px 20px',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
        >
          مستويات المخزون الحالية
        </button>
        <button 
          id="tab-movements"
          onClick={() => { setActiveTab('movements'); setSearch('') }}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'movements' ? '2px solid var(--accent-blue)' : 'none',
            color: activeTab === 'movements' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontSize: 14,
            fontWeight: 600,
            padding: '12px 20px',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
        >
          سجل حركات المخزن والتسويات
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input 
            id="inventory-search"
            className="input-field" 
            style={{ padding: '10px 36px 10px 14px' }} 
            placeholder={activeTab === 'levels' ? "ابحث عن منتج بالاسم أو الباركود..." : "ابحث بسجل حركة منتج..."}
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>

        <div style={{ width: 180 }}>
          <select 
            id="branch-filter"
            value={selectedBranch} 
            onChange={e => setSelectedBranch(e.target.value)}
            style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', width: '100%', cursor: 'pointer' }}
          >
            <option value="">جميع الفروع</option>
            {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
          </select>
        </div>

        {activeTab === 'levels' && (
          <div style={{ width: 180 }}>
            <select 
              id="category-filter"
              value={selectedCategory} 
              onChange={e => setSelectedCategory(e.target.value)}
              style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', width: '100%', cursor: 'pointer' }}
            >
              <option value="">جميع التصنيفات</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />جاري تحميل البيانات...
          </div>
        ) : activeTab === 'levels' ? (
          filteredProducts.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>لا توجد منتجات مطابقة لخيارات التصفية</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ textAlign: 'right' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'right' }}>الباركود</th>
                    <th style={{ textAlign: 'right' }}>اسم المنتج</th>
                    <th style={{ textAlign: 'right' }}>الصنف</th>
                    <th style={{ textAlign: 'right' }}>الفرع (المستودع)</th>
                    <th style={{ textAlign: 'right' }}>الكمية المتاحة</th>
                    <th style={{ textAlign: 'right' }}>حالة المخزون</th>
                    <th style={{ textAlign: 'right' }}>سعر البيع</th>
                    <th style={{ textAlign: 'right' }}>قيمة المخزون</th>
                    <th style={{ textAlign: 'right' }}>إجراءات سريعة</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(prod => {
                    const status = getQuantityStatus(prod.quantity)
                    const valAmount = (prod.quantity || 0) * (prod.price || 0)
                    return (
                      <tr key={prod.id}>
                        <td>
                          <span style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.05)', padding: '3px 6px', borderRadius: 4, fontSize: 13, border: '1px solid var(--border)' }}>
                            {prod.barcode ?? '—'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{prod.name}</td>
                        <td>{prod.category}</td>
                        <td>{prod.branch ?? 'جميع الفروع'}</td>
                        <td style={{ fontWeight: 700, color: status.color }}>
                          {prod.quantity} <span className={`badge ${unitBadge[prod.unit_type] ?? 'badge-blue'}`}>{unitLabel[prod.unit_type]}</span>
                        </td>
                        <td>
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, color: status.color, background: status.bg }}>
                            {status.label}
                          </span>
                        </td>
                        <td>{prod.price ? `${prod.price.toLocaleString('ar-EG')} ج.م` : '—'}</td>
                        <td style={{ fontWeight: 600 }}>{prod.price ? `${valAmount.toLocaleString('ar-EG')} ج.م` : '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => openAdjustModal(prod.id)} style={{ padding: '5px 8px', borderRadius: 6, background: 'rgba(91,110,245,0.1)', border: '1px solid rgba(91,110,245,0.2)', color: '#818cf8', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
                              تعديل الكمية
                            </button>
                            <button onClick={() => openTransferModal(prod.id)} style={{ padding: '5px 8px', borderRadius: 6, background: 'rgba(155,89,248,0.1)', border: '1px solid rgba(155,89,248,0.2)', color: '#c084fc', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
                              تحويل
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          filteredMovements.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🧾</div>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>لا توجد حركات مخزنية مسجلة بعد</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ textAlign: 'right' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'right' }}>التاريخ والوقت</th>
                    <th style={{ textAlign: 'right' }}>المنتج</th>
                    <th style={{ textAlign: 'right' }}>نوع الحركة</th>
                    <th style={{ textAlign: 'right' }}>الكمية</th>
                    <th style={{ textAlign: 'right' }}>الفرع الأصلي</th>
                    <th style={{ textAlign: 'right' }}>الفرع المحول إليه</th>
                    <th style={{ textAlign: 'right' }}>ملاحظات وتفاصيل</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.map(move => {
                    let typeBadgeClass = 'badge-blue'
                    let typeLabel = 'غير معروف'
                    if (move.type === 'inbound') {
                      typeBadgeClass = 'badge-green'
                      typeLabel = 'إضافة مخزون (وارد)'
                    } else if (move.type === 'outbound') {
                      typeBadgeClass = 'badge-red'
                      typeLabel = 'صرف مخزون (صادر)'
                    } else if (move.type === 'transfer') {
                      typeBadgeClass = 'badge-amber'
                      typeLabel = 'تحويل فروع'
                    }

                    return (
                      <tr key={move.id}>
                        <td style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                          {new Date(move.created_at).toLocaleString('ar-EG')}
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{move.product_name}</td>
                        <td>
                          <span className={`badge ${typeBadgeClass}`}>{typeLabel}</span>
                        </td>
                        <td style={{ fontWeight: 700 }}>{move.quantity}</td>
                        <td>{move.branch}</td>
                        <td>{move.target_branch ?? '—'}</td>
                        <td style={{ fontStyle: 'italic', fontSize: 13 }}>{move.notes ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {showAdjustModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAdjustModal(false) }}>
          <div className="modal-box" style={{ maxWidth: 500 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>تعديل وتحديث كمية مخزون صنف</h2>
              <button onClick={() => setShowAdjustModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>

            {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#f87171', marginBottom: 16 }}>{error}</div>}
            {success && <div style={{ background: 'rgba(16,217,160,0.1)', border: '1px solid rgba(16,217,160,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#10d9a0', marginBottom: 16 }}>{success}</div>}

            <form onSubmit={handleAdjustSubmit}>
              <div style={{ display: 'grid', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>اختر المنتج</label>
                  <select 
                    id="adjust-product-select"
                    value={adjustForm.productId} 
                    onChange={e => setAdjustForm(f => ({ ...f, productId: e.target.value }))}
                    disabled={!!adjustForm.productId}
                    style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', width: '100%' }}
                  >
                    <option value="">-- اختر من القائمة --</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.branch ?? 'جميع الفروع'}) - المتاح: {p.quantity}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>نوع التعديل</label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <label style={{ flex: 1, padding: '12px', borderRadius: 10, background: adjustForm.type === 'inbound' ? 'rgba(16,217,160,0.1)' : 'rgba(255,255,255,0.02)', border: adjustForm.type === 'inbound' ? '1px solid var(--accent-emerald)' : '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', justifyContent: 'center' }}>
                      <input type="radio" name="adjustType" checked={adjustForm.type === 'inbound'} onChange={() => setAdjustForm(f => ({ ...f, type: 'inbound' }))} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: adjustForm.type === 'inbound' ? 'var(--accent-emerald)' : 'var(--text-secondary)' }}>إضافة مخزون (وارد)</span>
                    </label>
                    <label style={{ flex: 1, padding: '12px', borderRadius: 10, background: adjustForm.type === 'outbound' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.02)', border: adjustForm.type === 'outbound' ? '1px solid var(--accent-red)' : '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', justifyContent: 'center' }}>
                      <input type="radio" name="adjustType" checked={adjustForm.type === 'outbound'} onChange={() => setAdjustForm(f => ({ ...f, type: 'outbound' }))} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: adjustForm.type === 'outbound' ? 'var(--accent-red)' : 'var(--text-secondary)' }}>صرف/سحب مخزون (صادر)</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>الكمية المراد تعديلها</label>
                  <input 
                    id="adjust-qty-input"
                    type="number" 
                    step="any"
                    placeholder="أدخل الكمية هنا..." 
                    value={adjustForm.quantity} 
                    onChange={e => setAdjustForm(f => ({ ...f, quantity: e.target.value }))}
                    className="input-field" 
                    style={{ padding: '10px 12px' }} 
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>ملاحظات الحركة (أسباب التعديل)</label>
                  <textarea 
                    id="adjust-notes-input"
                    placeholder="مثال: توريد كمية جديدة من المورد، جرد سنوي، بضاعة تالفة..." 
                    value={adjustForm.notes} 
                    onChange={e => setAdjustForm(f => ({ ...f, notes: e.target.value }))}
                    className="input-field" 
                    style={{ padding: '10px 12px', height: 80, resize: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button type="button" onClick={() => setShowAdjustModal(false)} style={{ flex: 1, padding: '11px', borderRadius: 'var(--radius)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}>إلغاء</button>
                <button id="adjust-save-btn" type="submit" disabled={actionLoading} className="btn-primary" style={{ flex: 1, padding: '11px', fontSize: 14 }}>
                  {actionLoading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTransferModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowTransferModal(false) }}>
          <div className="modal-box" style={{ maxWidth: 500 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>تحويل المخزون بين الفروع والمستودعات</h2>
              <button onClick={() => setShowTransferModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>

            {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#f87171', marginBottom: 16 }}>{error}</div>}
            {success && <div style={{ background: 'rgba(16,217,160,0.1)', border: '1px solid rgba(16,217,160,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#10d9a0', marginBottom: 16 }}>{success}</div>}

            <form onSubmit={handleTransferSubmit}>
              <div style={{ display: 'grid', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>اختر المنتج ومصدر المخزون الحالي</label>
                  <select 
                    id="transfer-product-select"
                    value={transferForm.productId} 
                    onChange={e => setTransferForm(f => ({ ...f, productId: e.target.value }))}
                    disabled={!!transferForm.productId}
                    style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', width: '100%' }}
                  >
                    <option value="">-- اختر من القائمة --</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} - فرع: {p.branch ?? 'غير حدد'} (المتاح: {p.quantity})</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>الفرع المستهدف للتحويل إليه</label>
                  <select 
                    id="transfer-branch-select"
                    value={transferForm.targetBranch} 
                    onChange={e => setTransferForm(f => ({ ...f, targetBranch: e.target.value }))}
                    style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', width: '100%' }}
                  >
                    <option value="">-- اختر الفرع المستهدف --</option>
                    {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>الكمية المراد نقلها</label>
                  <input 
                    id="transfer-qty-input"
                    type="number" 
                    step="any"
                    placeholder="أدخل الكمية هنا..." 
                    value={transferForm.quantity} 
                    onChange={e => setTransferForm(f => ({ ...f, quantity: e.target.value }))}
                    className="input-field" 
                    style={{ padding: '10px 12px' }} 
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>ملاحظات التحويل</label>
                  <textarea 
                    id="transfer-notes-input"
                    placeholder="مثال: سد عجز في الفرع الفرعي، تلبية لطلب زبون..." 
                    value={transferForm.notes} 
                    onChange={e => setTransferForm(f => ({ ...f, notes: e.target.value }))}
                    className="input-field" 
                    style={{ padding: '10px 12px', height: 80, resize: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button type="button" onClick={() => setShowTransferModal(false)} style={{ flex: 1, padding: '11px', borderRadius: 'var(--radius)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}>إلغاء</button>
                <button id="transfer-save-btn" type="submit" disabled={actionLoading} className="btn-primary" style={{ flex: 1, padding: '11px', fontSize: 14 }}>
                  {actionLoading ? 'جاري التحويل...' : 'تأكيد التحويل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
