'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
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

interface Branch {
  id: string
  name: string
  city: string
}

interface Employee {
  id: string
  name: string
  branch: string
}

interface CartItem {
  product: Product
  quantity: number
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  
  // Selection state
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState('')
  
  // Search and cart state
  const [searchQuery, setSearchQuery] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [discount, setDiscount] = useState('')
  const [notes, setNotes] = useState('')
  
  // Action states
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successReceipt, setSuccessReceipt] = useState<{
    id: string
    date: string
    branch: string
    employee: string
    items: { name: string; quantity: number; price: number; unit: string }[]
    subtotal: number
    discountPercent: number
    discountAmount: number
    total: number
    notes?: string
  } | null>(null)

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true)
    const [
      { data: prodData },
      { data: branchData },
      { data: empData }
    ] = await Promise.all([
      supabase.from('products').select('*').order('name', { ascending: true }),
      supabase.from('branches').select('id, name, city').order('name', { ascending: true }),
      supabase.from('employees').select('id, name, branch').order('name', { ascending: true })
    ])
    
    setProducts(prodData ?? [])
    setBranches(branchData ?? [])
    setEmployees(empData ?? [])
    
    // Auto-select first branch if available
    if (branchData && branchData.length > 0) {
      setSelectedBranch(branchData[0].name)
    }
    
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Filter products by selected branch & search query
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // Branch filter (if branch is selected, match it. Some products might have no branch, meaning general stock)
      const matchesBranch = !selectedBranch || !p.branch || p.branch === selectedBranch
      
      // Search filter
      const matchesSearch = !searchQuery || 
        p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category?.toLowerCase().includes(searchQuery.toLowerCase())
        
      return matchesBranch && matchesSearch
    })
  }, [products, selectedBranch, searchQuery])

  // Filter employees by selected branch
  const filteredEmployees = useMemo(() => {
    if (!selectedBranch) return employees
    return employees.filter(e => e.branch === selectedBranch)
  }, [employees, selectedBranch])

  // Auto-select employee when branch changes
  useEffect(() => {
    if (filteredEmployees.length > 0) {
      setSelectedEmployee(filteredEmployees[0].name)
    } else {
      setSelectedEmployee('')
    }
  }, [selectedBranch, filteredEmployees])

  // Cart operations
  const addToCart = (product: Product) => {
    if (product.quantity <= 0) {
      alert('عذراً، هذا المنتج غير متوفر في المخزن حالياً!')
      return
    }

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id)
      if (existing) {
        // Check max quantity limit
        const nextQty = existing.quantity + (product.unit_type === 'weight' ? 0.5 : 1)
        if (nextQty > product.quantity) {
          alert(`لا يمكن إضافة المزيد. الكمية المتوفرة في المخزن هي ${product.quantity}`)
          return prev
        }
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: nextQty } 
            : item
        )
      }
      return [...prev, { product, quantity: product.unit_type === 'weight' ? 0.5 : 1 }]
    })
  }

  const updateQuantity = (productId: string, val: number) => {
    const item = cart.find(i => i.product.id === productId)
    if (!item) return

    if (val <= 0) {
      removeFromCart(productId)
      return
    }

    if (val > item.product.quantity) {
      alert(`عذراً، الكمية المطلوبة تتعدى المخزون المتوفر (${item.product.quantity})`)
      return
    }

    setCart(prev => 
      prev.map(i => i.product.id === productId ? { ...i, quantity: val } : i)
    )
  }

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId))
  }

  const clearCart = () => {
    setCart([])
    setDiscount('')
    setNotes('')
    setError('')
  }

  // Calculate totals
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.product.price ?? 0) * item.quantity, 0)
  }, [cart])

  const discountVal = parseFloat(discount || '0')
  const discountAmount = useMemo(() => {
    if (isNaN(discountVal) || discountVal <= 0) return 0
    return (subtotal * discountVal) / 100
  }, [subtotal, discountVal])

  const total = useMemo(() => {
    return Math.max(0, subtotal - discountAmount)
  }, [subtotal, discountAmount])

  // Handle Checkout / Print Sale
  const handleCheckout = async () => {
    if (cart.length === 0) {
      setError('السلة فارغة! يرجى إضافة منتجات أولاً.')
      return
    }
    if (!selectedBranch) {
      setError('يرجى تحديد الفرع أولاً.')
      return
    }
    if (!selectedEmployee) {
      setError('يرجى تحديد الموظف (الكاشير).')
      return
    }

    setSaving(true)
    setError('')

    try {
      // 1. Generate a detailed invoice notes string
      const itemsList = cart.map(item => {
        const itemPrice = item.product.price ?? 0
        const itemTotal = itemPrice * item.quantity
        return `- ${item.product.name} [${item.product.barcode ?? 'بدون باركود'}]: ${item.quantity} ${item.product.unit_type === 'piece' ? 'قطعة' : 'كجم'} × ${itemPrice.toLocaleString('ar-EG')} ج.م = ${itemTotal.toLocaleString('ar-EG')} ج.م`
      }).join('\n')
      
      const detailedNotes = `فاتورة تفصيلية لنقطة البيع (POS):\n\nالمنتجات المباعة:\n${itemsList}\n\nإجمالي الفاتورة: ${subtotal.toLocaleString('ar-EG')} ج.م\nالخصم: ${discountVal}%\nالصافي النهائي: ${total.toLocaleString('ar-EG')} ج.م\n\nالكاشير المسؤول: ${selectedEmployee}\n\n${notes ? `ملاحظات إضافية: ${notes}` : ''}`

      // 2. Insert record into `sales` table
      const salePayload = {
        employee_name: selectedEmployee,
        branch: selectedBranch,
        amount: total,
        product: cart.map(i => i.product.name).join('، '),
        notes: detailedNotes,
      }

      const { data: saleResult, error: saleError } = await supabase
        .from('sales')
        .insert(salePayload)
        .select()
        .single()

      if (saleError) throw saleError

      // 3. Update products inventory levels
      const updatePromises = cart.map(async item => {
        const nextQuantity = Math.max(0, item.product.quantity - item.quantity)
        const { error: updateError } = await supabase
          .from('products')
          .update({ quantity: nextQuantity })
          .eq('id', item.product.id)
          
        if (updateError) throw updateError
      })

      await Promise.all(updatePromises)

      // 4. Set receipt for printing / layout
      setSuccessReceipt({
        id: saleResult.id || 'POS-' + Math.floor(Math.random() * 1000000),
        date: new Date().toLocaleString('ar-EG'),
        branch: selectedBranch,
        employee: selectedEmployee,
        items: cart.map(item => ({
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.price ?? 0,
          unit: item.product.unit_type === 'piece' ? 'قطعة' : 'كجم'
        })),
        subtotal,
        discountPercent: discountVal,
        discountAmount,
        total,
        notes: notes
      })

      // 5. Reload products data & Clear Cart
      clearCart()
      await loadData()

    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إتمام عملية البيع.')
    } finally {
      setSaving(false)
    }
  }

  // Barcode scanner simulation (handling barcode enter key)
  const handleBarcodeSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      e.preventDefault()
      // Find exact product match by barcode
      const product = products.find(p => p.barcode?.toLowerCase() === searchQuery.trim().toLowerCase())
      if (product) {
        addToCart(product)
        setSearchQuery('') // Clear search
      } else {
        alert('لم يتم العثور على منتج بهذا الباركود!')
      }
    }
  }

  const printReceipt = () => {
    window.print()
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, minHeight: 'calc(100vh - 120px)' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>نقطة البيع (POS Cashier)</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
            تسجيل مبيعات مباشرة وخصمها من المخازن تلقائياً
          </p>
        </div>
        
        {/* Branch / Cashier Selection Header Bar */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div>
            <label style={{ display: 'inline-block', fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>الفرع:</label>
            <select
              value={selectedBranch}
              onChange={e => {
                setSelectedBranch(e.target.value)
                clearCart()
              }}
              style={{
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="">جميع الفروع (تحديد إلزامي لإجراء عملية بيع)</option>
              {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'inline-block', fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>الكاشير:</label>
            <select
              value={selectedEmployee}
              onChange={e => setSelectedEmployee(e.target.value)}
              style={{
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
                cursor: 'pointer',
                minWidth: 120
              }}
            >
              <option value="">اختر الموظف</option>
              {filteredEmployees.map(emp => (
                <option key={emp.id} value={emp.name}>{emp.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 10,
          padding: '12px 16px',
          fontSize: 13,
          color: '#f87171',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* POS Workspace Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)', gap: 20, flex: 1 }}>
        
        {/* RIGHT COLUMN: Products Catalog Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Search bar */}
          <div style={{ position: 'relative', width: '100%' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              id="pos-search"
              className="input-field"
              style={{ padding: '12px 14px 12px 40px', fontSize: 14 }}
              placeholder="ابحث بالاسم أو الباركود... (اضغط Enter للإضافة السريعة بالباركود)"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={handleBarcodeSubmit}
              autoComplete="off"
            />
          </div>

          {/* Products Grid */}
          <div className="glass-card" style={{ flex: 1, padding: 18, minHeight: 400, maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" style={{ width: 36, height: 36 }} />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>📦</div>
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>لا توجد منتجات مطابقة في هذا الفرع</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
                {filteredProducts.map(prod => {
                  const isOutOfStock = prod.quantity <= 0
                  const isLowStock = prod.quantity > 0 && prod.quantity < 10
                  
                  return (
                    <div 
                      key={prod.id} 
                      onClick={() => !isOutOfStock && addToCart(prod)}
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        padding: 14,
                        cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        height: 140,
                        opacity: isOutOfStock ? 0.5 : 1
                      }}
                      onMouseOver={e => {
                        if (!isOutOfStock) {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                          e.currentTarget.style.borderColor = 'var(--accent-blue)'
                          e.currentTarget.style.transform = 'translateY(-2px)'
                        }
                      }}
                      onMouseOut={e => {
                        if (!isOutOfStock) {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                          e.currentTarget.style.borderColor = 'var(--border)'
                          e.currentTarget.style.transform = 'translateY(0)'
                        }
                      }}
                    >
                      {/* Barcode badge */}
                      <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {prod.barcode ?? '—'}
                      </span>

                      {/* Product Name */}
                      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', height: 40, lineHeight: 1.4 }}>
                        {prod.name}
                      </h3>

                      {/* Stock Info */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent-emerald)' }}>
                          {prod.price ? `${prod.price.toLocaleString('ar-EG')} ج.م` : '—'}
                        </span>
                        
                        <span 
                          className={`badge ${
                            isOutOfStock ? 'badge-red' : isLowStock ? 'badge-amber' : 'badge-blue'
                          }`}
                          style={{ fontSize: 9, padding: '2px 6px' }}
                        >
                          {isOutOfStock ? 'نفد' : `${prod.quantity} ${prod.unit_type === 'piece' ? 'ق' : 'كجم'}`}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* LEFT COLUMN: Shopping Cart Panel */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', padding: 20, maxHeight: 'calc(100vh - 200px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              🛒 السلة الحالية 
              <span style={{ fontSize: 12, background: 'rgba(91,110,245,0.15)', color: '#818cf8', padding: '2px 8px', borderRadius: 20 }}>
                {cart.reduce((sum, item) => sum + (item.product.unit_type === 'piece' ? item.quantity : 1), 0)} صنف
              </span>
            </h2>
            <button 
              onClick={clearCart}
              disabled={cart.length === 0}
              style={{
                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontWeight: 500
              }}
              onMouseOver={e => e.currentTarget.style.color = '#f87171'}
              onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              تفريغ 🗑️
            </button>
          </div>

          {/* Cart Items List */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4, marginBottom: 16 }}>
            {cart.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', padding: 40 }}>
                <span style={{ fontSize: 32, marginBottom: 8 }}>🛒</span>
                <p style={{ fontSize: 13, textAlign: 'center' }}>السلة فارغة. اضغط على أي منتج من المعروض لإضافته للفاتورة.</p>
              </div>
            ) : (
              cart.map(item => {
                const itemTotal = (item.product.price ?? 0) * item.quantity
                
                return (
                  <div 
                    key={item.product.id}
                    style={{
                      background: 'rgba(255,255,255,0.015)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      padding: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.product.name}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {(item.product.price ?? 0).toLocaleString('ar-EG')} ج.م / {item.product.unit_type === 'piece' ? 'قطعة' : 'كجم'}
                        </span>
                      </div>
                      
                      <button 
                        onClick={() => removeFromCart(item.product.id)}
                        style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 13, padding: 2 }}
                      >
                        ×
                      </button>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {/* Quantity Editor Controls */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button 
                          onClick={() => updateQuantity(item.product.id, item.quantity - (item.product.unit_type === 'weight' ? 0.5 : 1))}
                          style={{
                            width: 24, height: 24, borderRadius: 6, background: 'rgba(255,255,255,0.05)',
                            border: '1px solid var(--border)', color: 'white', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14
                          }}
                        >
                          -
                        </button>
                        
                        <input
                          type="number"
                          value={item.quantity}
                          step={item.product.unit_type === 'weight' ? "0.1" : "1"}
                          min="0.1"
                          onChange={e => updateQuantity(item.product.id, parseFloat(e.target.value) || 0)}
                          style={{
                            width: 50, height: 24, textAlign: 'center', background: 'rgba(0,0,0,0.2)',
                            border: '1px solid var(--border)', borderRadius: 6, color: 'white', fontSize: 12
                          }}
                        />

                        <button 
                          onClick={() => updateQuantity(item.product.id, item.quantity + (item.product.unit_type === 'weight' ? 0.5 : 1))}
                          style={{
                            width: 24, height: 24, borderRadius: 6, background: 'rgba(255,255,255,0.05)',
                            border: '1px solid var(--border)', color: 'white', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14
                          }}
                        >
                          +
                        </button>
                      </div>

                      {/* Item total price */}
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {itemTotal.toLocaleString('ar-EG')} ج.م
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Pricing calculations details */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            
            {/* Discount input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', flexShrink: 0 }}>الخصم (%):</span>
              <input
                id="pos-discount"
                type="number"
                min="0"
                max="100"
                placeholder="0"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                className="input-field"
                style={{ padding: '6px 10px', fontSize: 13, width: 70, textAlign: 'center' }}
              />
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                قيمة الخصم: {discountAmount.toLocaleString('ar-EG')} ج.م
              </span>
            </div>

            {/* Notes input */}
            <div>
              <input
                id="pos-notes"
                placeholder="أضف ملاحظات الفاتورة هنا..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="input-field"
                style={{ padding: '8px 10px', fontSize: 12 }}
              />
            </div>

            {/* Totals Summary */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>المجموع الفرعي:</span>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{subtotal.toLocaleString('ar-EG')} ج.م</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px dashed var(--border)' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>المجموع النهائي:</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-emerald)', letterSpacing: '-0.5px' }}>
                {total.toLocaleString('ar-EG')} ج.م
              </span>
            </div>

            {/* Checkout Button */}
            <button
              id="pos-submit"
              onClick={handleCheckout}
              disabled={saving || cart.length === 0 || !selectedBranch || !selectedEmployee}
              className="btn-primary"
              style={{
                width: '100%', padding: '14px', fontSize: 15,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                marginTop: 6
              }}
            >
              {saving ? (
                <>
                  <div className="spinner" style={{ width: 18, height: 18 }} />
                  <span>جاري تسجيل الفاتورة...</span>
                </>
              ) : (
                <>
                  <span>إتمام عملية البيع وطباعة الفاتورة 🧾</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* SUCCESS RECEIPT DIALOG MODAL */}
      {successReceipt && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSuccessReceipt(null) }}>
          <div className="modal-box" style={{ maxWidth: 360, background: '#ffffff', color: '#111111', padding: 24, borderRadius: 0, fontFamily: 'monospace', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}>
            
            {/* Screen Actions (Non-printable) */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, borderBottom: '1px solid #ddd', paddingBottom: 10 }}>
              <span style={{ fontWeight: 'bold', color: '#5b6ef5' }}>تم تسجيل العملية بنجاح! 🎉</span>
              <button 
                onClick={() => setSuccessReceipt(null)}
                style={{ background: '#f3f4f6', border: '1px solid #ccc', padding: '4px 10px', cursor: 'pointer', borderRadius: 4, fontSize: 12 }}
              >
                إغلاق ×
              </button>
            </div>

            {/* Printable Receipt Area */}
            <div id="receipt-print-area" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', fontSize: 12 }}>
              <h2 style={{ fontSize: 18, fontWeight: 'bold', margin: '0 0 4px 0' }}>ERP SYSTEM RECEIPT</h2>
              <p style={{ margin: '0 0 10px 0', fontSize: 11, color: '#666' }}>نظام إدارة موارد المؤسسة</p>
              
              <div style={{ width: '100%', borderTop: '1px dashed #111', margin: '10px 0' }} />
              
              {/* Metadata */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start', fontSize: 10, textAlign: 'right' }}>
                <div><strong>رقم الفاتورة:</strong> {successReceipt.id}</div>
                <div><strong>التاريخ:</strong> {successReceipt.date}</div>
                <div><strong>الفرع:</strong> {successReceipt.branch}</div>
                <div><strong>الكاشير:</strong> {successReceipt.employee}</div>
              </div>

              <div style={{ width: '100%', borderTop: '1px dashed #111', margin: '10px 0' }} />

              {/* Items Table */}
              <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #111' }}>
                    <th style={{ textAlign: 'right', paddingBottom: 4 }}>الصنف</th>
                    <th style={{ textAlign: 'center', paddingBottom: 4 }}>الكمية</th>
                    <th style={{ textAlign: 'left', paddingBottom: 4 }}>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {successReceipt.items.map((item, idx) => (
                    <tr key={idx} style={{ height: 24 }}>
                      <td style={{ textAlign: 'right' }}>{item.name}</td>
                      <td style={{ textAlign: 'center' }}>{item.quantity} {item.unit}</td>
                      <td style={{ textAlign: 'left' }}>{(item.price * item.quantity).toLocaleString('ar-EG')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ width: '100%', borderTop: '1px dashed #111', margin: '10px 0' }} />

              {/* Summary Totals */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>المجموع الفرعي:</span>
                  <span>{successReceipt.subtotal.toLocaleString('ar-EG')} ج.م</span>
                </div>
                {successReceipt.discountPercent > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555' }}>
                    <span>الخصم ({successReceipt.discountPercent}%):</span>
                    <span>-{successReceipt.discountAmount.toLocaleString('ar-EG')} ج.م</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 'bold', paddingTop: 6, borderTop: '1px solid #111', marginTop: 4 }}>
                  <span>المجموع الإجمالي:</span>
                  <span>{successReceipt.total.toLocaleString('ar-EG')} ج.م</span>
                </div>
              </div>

              {successReceipt.notes && (
                <>
                  <div style={{ width: '100%', borderTop: '1px dashed #111', margin: '10px 0' }} />
                  <div style={{ fontSize: 9, textAlign: 'right', width: '100%' }}>
                    <strong>ملاحظات:</strong> {successReceipt.notes}
                  </div>
                </>
              )}

              <div style={{ width: '100%', borderTop: '1px dashed #111', margin: '10px 0' }} />
              <p style={{ margin: '10px 0 0 0', fontSize: 10, fontWeight: 'bold' }}>شكراً لتسوقكم معنا!</p>
            </div>

            {/* Print trigger button (Non-printable) */}
            <div className="no-print" style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button 
                onClick={printReceipt} 
                className="btn-primary" 
                style={{ flex: 1, padding: '10px', fontSize: 13, background: '#111111', border: '1px solid #111111', color: 'white' }}
              >
                طباعة الفاتورة 🖨️
              </button>
            </div>

          </div>
        </div>
      )}

      {/* PRINT-ONLY CSS STYLING OVERRIDES */}
      <style jsx global>{`
        @media print {
          /* Hide everything except the receipt modal contents */
          body * {
            visibility: hidden;
            background: none !important;
          }
          #receipt-print-area, #receipt-print-area * {
            visibility: visible;
          }
          .modal-overlay {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: none !important;
            display: block !important;
            box-shadow: none !important;
          }
          .modal-box {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}
