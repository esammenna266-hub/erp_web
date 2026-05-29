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

const UNIT_OPTIONS = [
  { value: 'piece', label: 'قطعة (Piece)' },
  { value: 'weight', label: 'وزن (Weight/Kg)' }
]
const unitLabel: Record<string, string> = { piece: 'قطعة', weight: 'كجم' }
const unitBadge: Record<string, string> = { piece: 'badge-blue', weight: 'badge-amber' }

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  
  const [form, setForm] = useState({ 
    barcode: '', name: '', category: '', 
    unit_type: 'piece', quantity: '', price: '', branch: '' 
  })
  
  const [error, setError] = useState('')
  const [branches, setBranches] = useState<{id:string, name:string}[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data }, { data: bData }] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('branches').select('id, name'),
    ])
    setProducts(data ?? [])
    setBranches(bData ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode?.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  )

  function openAddModal() {
    setEditingId(null)
    setForm({ barcode: '', name: '', category: '', unit_type: 'piece', quantity: '', price: '', branch: '' })
    setError('')
    setShowModal(true)
  }

  function openEditModal(prod: Product) {
    setEditingId(prod.id)
    setForm({ 
      barcode: prod.barcode ?? '', 
      name: prod.name ?? '', 
      category: prod.category ?? '', 
      unit_type: prod.unit_type ?? 'piece', 
      quantity: prod.quantity?.toString() ?? '', 
      price: prod.price?.toString() ?? '', 
      branch: prod.branch ?? '' 
    })
    setError('')
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.category.trim() || !form.quantity) { 
      setError('الاسم، الصنف، والكمية حقول مطلوبة'); 
      return 
    }
    setSaving(true); setError('')
    
    // Auto-generate barcode if unit is piece and no barcode is provided
    let finalBarcode = form.barcode.trim()
    if (!finalBarcode && form.unit_type === 'piece') {
      finalBarcode = 'PRD-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
    }

    const payload = {
      barcode: finalBarcode || null,
      name: form.name.trim(),
      category: form.category.trim(),
      unit_type: form.unit_type,
      quantity: parseFloat(form.quantity),
      price: form.price ? parseFloat(form.price) : null,
      branch: form.branch || null,
    }

    if (editingId) {
      const { error } = await supabase.from('products').update(payload).eq('id', editingId)
      if (error) { setError(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('products').insert(payload)
      if (error) { setError(error.message); setSaving(false); return }
    }
    
    setSaving(false); setShowModal(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('حذف هذا المنتج؟')) return
    await supabase.from('products').delete().eq('id', id)
    load()
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>المستودع والمنتجات</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>{filtered.length} منتج متوفر بالمخزون</p>
        </div>
        <button id="add-product-btn" onClick={openAddModal} className="btn-primary" style={{ padding: '10px 18px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          إضافة منتج
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 400, marginBottom: 20 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input 
          id="products-search" 
          className="input-field" 
          style={{ padding: '10px 14px 10px 36px' }} 
          placeholder="ابحث بالاسم، الصنف، أو الباركود..." 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
        />
      </div>

      {/* Table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />جاري التحميل...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>لا توجد منتجات بعد</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>الباركود</th>
                  <th>اسم المنتج</th>
                  <th>الصنف</th>
                  <th>الكمية</th>
                  <th>السعر</th>
                  <th>الفرع</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(prod => (
                  <tr key={prod.id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.05)', padding: '3px 6px', borderRadius: 4, fontSize: 13, border: '1px solid var(--border)' }}>
                        {prod.barcode ?? '—'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{prod.name}</td>
                    <td>{prod.category}</td>
                    <td style={{ fontWeight: 700, color: prod.quantity < 10 ? 'var(--accent-amber)' : 'var(--accent-emerald)' }}>
                      {prod.quantity} <span className={`badge ${unitBadge[prod.unit_type] ?? 'badge-blue'}`}>{unitLabel[prod.unit_type]}</span>
                    </td>
                    <td>{prod.price ? `${prod.price.toLocaleString('ar-EG')} ج.م` : '—'}</td>
                    <td>{prod.branch ?? '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEditModal(prod)} style={{ padding: '5px 10px', borderRadius: 6, background: 'rgba(91,110,245,0.1)', border: '1px solid rgba(91,110,245,0.2)', color: '#818cf8', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>تعديل</button>
                        <button onClick={() => handleDelete(prod.id)} style={{ padding: '5px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>حذف</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal-box" style={{ maxWidth: 600 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                {editingId ? 'تعديل بيانات المنتج' : 'إضافة منتج جديد'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            
            {/* Barcode scanner hint */}
            {!editingId && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(16,217,160,0.08)', border: '1px solid rgba(16,217,160,0.2)', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ fontSize: 20 }}>📷</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--accent-emerald)', display: 'block', marginBottom: 2 }}>هل تستخدم سكنر باركود؟</strong>
                  ضع المؤشر في خانة "الباركود" وقم بمسح الكود ضوئياً لإدخاله تلقائياً.
                </div>
              </div>
            )}

            {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#f87171', marginBottom: 16 }}>{error}</div>}
            
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>الباركود (كود المنتج)</label>
                  <input id="prod-barcode" type="text" placeholder="مثال: 6221234567890 (اختياري - سيتم توليده تلقائياً إن ترك فارغاً للقطع)" value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} className="input-field" style={{ padding: '10px 12px', fontFamily: 'monospace' }} autoFocus />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>اسم المنتج</label>
                  <input id="prod-name" type="text" placeholder="اكتب اسم المنتج..." value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" style={{ padding: '10px 12px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>الصنف (Category)</label>
                  <input id="prod-category" type="text" placeholder="مثال: إلكترونيات، معلبات، إلخ..." value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="input-field" style={{ padding: '10px 12px' }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>نوع الوحدة (قطعة / وزن)</label>
                  <select id="prod-unit" value={form.unit_type} onChange={e => setForm(f => ({ ...f, unit_type: e.target.value }))} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', width: '100%' }}>
                    {UNIT_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>الكمية المتاحة ({unitLabel[form.unit_type]})</label>
                  <input id="prod-qty" type="number" step={form.unit_type === 'weight' ? "0.01" : "1"} placeholder={form.unit_type === 'weight' ? "2.5" : "10"} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} className="input-field" style={{ padding: '10px 12px' }} min="0" />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>سعر البيع الافتراضي (ج.م) - اختياري</label>
                  <input id="prod-price" type="number" step="0.01" placeholder="مثال: 150" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className="input-field" style={{ padding: '10px 12px' }} min="0" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>الفرع (المخزن)</label>
                  <select id="prod-branch" value={form.branch} onChange={e => setForm(f => ({ ...f, branch: e.target.value }))} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', width: '100%' }}>
                    <option value="">جميع الفروع (أو غير محدد)</option>
                    {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                </div>

              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 26 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '11px', borderRadius: 'var(--radius)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}>إلغاء</button>
                <button id="prod-save-btn" type="submit" disabled={saving} className="btn-primary" style={{ flex: 1, padding: '11px', fontSize: 14 }}>
                  {saving ? 'جاري الحفظ...' : (editingId ? 'حفظ التعديلات' : 'حفظ المنتج')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
