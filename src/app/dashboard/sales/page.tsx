'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface Sale {
  id: string
  employee_name: string
  branch: string
  amount: number
  product?: string
  notes?: string
  created_at: string
  payment_method?: 'cash' | 'visa' | 'instapay'
  customer_name?: string
  customer_phone?: string
  status?: 'completed' | 'returned'
  items?: { product_id: string; product_name: string; quantity: number }[]
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ employee_name: '', branch: '', amount: '', product: '', notes: '', payment_method: 'cash', customer_name: '', customer_phone: '' })
  const [error, setError] = useState('')
  const [branches, setBranches] = useState<{id:string, name:string}[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data }, { data: bData }] = await Promise.all([
      supabase.from('sales').select('*').order('created_at', { ascending: false }),
      supabase.from('branches').select('id, name'),
    ])
    setSales(data ?? [])
    setBranches(bData ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = sales.filter(s =>
    s.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.product?.toLowerCase().includes(search.toLowerCase()) ||
    s.branch?.toLowerCase().includes(search.toLowerCase())
  )

  const totalAmount = filtered.reduce((sum, s) => sum + (s.amount ?? 0), 0)

  function openAddModal() {
    setEditingId(null)
    setForm({ employee_name: '', branch: '', amount: '', product: '', notes: '', payment_method: 'cash', customer_name: '', customer_phone: '' })
    setError('')
    setShowModal(true)
  }

  function openEditModal(sale: Sale) {
    setEditingId(sale.id)
    setForm({ 
      employee_name: sale.employee_name ?? '', 
      branch: sale.branch ?? '', 
      amount: sale.amount?.toString() ?? '', 
      product: sale.product ?? '', 
      notes: sale.notes ?? '',
      payment_method: sale.payment_method ?? 'cash',
      customer_name: sale.customer_name ?? '',
      customer_phone: sale.customer_phone ?? ''
    })
    setError('')
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.employee_name.trim() || !form.amount) { setError('الموظف والمبلغ مطلوبان'); return }
    setSaving(true); setError('')
    const payload = {
      employee_name: form.employee_name.trim(),
      branch: form.branch,
      amount: parseFloat(form.amount),
      product: form.product,
      notes: form.notes,
      payment_method: form.payment_method,
      customer_name: form.customer_name.trim() || null,
      customer_phone: form.customer_phone.trim() || null,
      status: 'completed',
      items: []
    }

    if (editingId) {
      const { error } = await supabase.from('sales').update(payload).eq('id', editingId)
      if (error) { setError(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('sales').insert(payload)
      if (error) { setError(error.message); setSaving(false); return }
    }
    
    setSaving(false); setShowModal(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('حذف هذه المبيعة؟')) return
    await supabase.from('sales').delete().eq('id', id)
    load()
  }

  async function handleReturn(sale: Sale) {
    if (!sale.items || sale.items.length === 0) {
      alert('لا توجد بيانات منتجات مسجلة في هذه الفاتورة لإعادتها للمخزن!')
      return
    }

    if (!confirm(`هل تريد عمل مرتجع للفاتورة رقم (${sale.id}) بالكامل؟\nسيتم تصفير قيمتها المالية وإعادة البضائع للمخزن.`)) {
      return
    }

    setLoading(true)
    try {
      // 1. Return items to products stock
      const updatePromises = sale.items.map(async item => {
        // Get current quantity
        const { data: prod } = await supabase
          .from('products')
          .select('quantity')
          .eq('id', item.product_id)
          .single()

        const currentQty = prod?.quantity ?? 0
        const newQty = currentQty + item.quantity

        // Update product quantity
        const { error: updateError } = await supabase
          .from('products')
          .update({ quantity: newQty })
          .eq('id', item.product_id)

        if (updateError) throw updateError

        // 2. Log inventory movement as inbound
        const { error: logError } = await supabase
          .from('inventory_movements')
          .insert({
            product_id: item.product_id,
            product_name: item.product_name,
            type: 'inbound',
            quantity: item.quantity,
            branch: sale.branch,
            notes: `مرتجع تلقائي للمبيعات - فاتورة رقم ${sale.id}`
          })

        if (logError) throw logError
      })

      await Promise.all(updatePromises)

      // 3. Update sale status to 'returned' and set amount to 0
      const { error: saleError } = await supabase
        .from('sales')
        .update({
          status: 'returned',
          amount: 0,
          notes: (sale.notes || '') + '\n\n[تم عمل مرتجع بالكامل وإعادة المنتجات للمخازن]'
        })
        .eq('id', sale.id)

      if (saleError) throw saleError

      alert('تم إرجاع المنتجات وتحديث الحسابات بنجاح! 🎉')
      await load()

    } catch (e: any) {
      alert(`حدث خطأ أثناء معالجة المرتجع: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>المبيعات</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>{filtered.length} سجل مبيعة</p>
        </div>
        <button id="add-sale-btn" onClick={openAddModal} className="btn-primary" style={{ padding: '10px 18px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          تسجيل مبيعة
        </button>
      </div>

      {/* Total Banner */}
      <div style={{ padding: '18px 22px', borderRadius: 14, background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.04))', border: '1px solid rgba(245,158,11,0.2)', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--accent-amber)', fontWeight: 600, marginBottom: 4 }}>💰 إجمالي المبيعات</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-1px' }}>
            {totalAmount.toLocaleString('ar-EG', { minimumFractionDigits: 0 })} ج.م
          </div>
        </div>
        <div style={{ fontSize: 40, opacity: 0.3 }}>💵</div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 400, marginBottom: 20 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input id="sales-search" className="input-field" style={{ padding: '10px 14px 10px 36px' }} placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />جاري التحميل...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💸</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>لا توجد مبيعات بعد</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>العميل</th>
                  <th>الموظف</th>
                  <th>المنتج</th>
                  <th>طريقة الدفع</th>
                  <th>الفرع</th>
                  <th>المبلغ</th>
                  <th>التاريخ</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(sale => {
                  const isReturned = sale.status === 'returned'
                  return (
                    <tr key={sale.id} style={{ opacity: isReturned ? 0.65 : 1, background: isReturned ? 'rgba(239,68,68,0.02)' : 'none' }}>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        <div>{sale.customer_name || 'عام'}</div>
                        {sale.customer_phone && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{sale.customer_phone}</div>}
                      </td>
                      <td>{sale.employee_name}</td>
                      <td>{sale.product ?? '—'}</td>
                      <td>
                        <span style={{
                          padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                          background: sale.payment_method === 'cash' ? 'rgba(16, 185, 129, 0.1)' : sale.payment_method === 'visa' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(139, 92, 246, 0.1)',
                          color: sale.payment_method === 'cash' ? '#34d399' : sale.payment_method === 'visa' ? '#60a5fa' : '#a78bfa'
                        }}>
                          {sale.payment_method === 'cash' ? 'كاش 💵' : sale.payment_method === 'visa' ? 'فيزا 💳' : 'انستا باي ⚡'}
                        </span>
                      </td>
                      <td>{sale.branch ?? '—'}</td>
                      <td>
                        <span style={{ fontWeight: 700, color: isReturned ? 'var(--text-muted)' : 'var(--accent-emerald)', fontSize: 15, textDecoration: isReturned ? 'line-through' : 'none' }}>
                          {(sale.amount ?? 0).toLocaleString('ar-EG')} ج.م
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {new Date(sale.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {isReturned ? (
                            <span style={{
                              padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                              background: 'rgba(239, 68, 68, 0.15)', color: '#f87171'
                            }}>
                              تم الإرجاع ❌
                            </span>
                          ) : (
                            <>
                              <button onClick={() => handleReturn(sale)} style={{ padding: '5px 10px', borderRadius: 6, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>عمل مرتجع ↩️</button>
                              <button onClick={() => handleDelete(sale.id)} style={{ padding: '5px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>حذف 🗑️</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                {editingId ? 'تعديل بيانات المبيعة' : 'تسجيل مبيعة جديدة'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#f87171', marginBottom: 16 }}>{error}</div>}
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>اسم الموظف</label>
                  <input id="sale-employee" type="text" placeholder="محمد أحمد" value={form.employee_name} onChange={e => setForm(f => ({ ...f, employee_name: e.target.value }))} className="input-field" style={{ padding: '10px 12px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>المبلغ (ج.م)</label>
                  <input id="sale-amount" type="number" placeholder="1500" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="input-field" style={{ padding: '10px 12px' }} min="0" step="0.01" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>المنتج / الخدمة</label>
                  <input id="sale-product" type="text" placeholder="اسم المنتج" value={form.product} onChange={e => setForm(f => ({ ...f, product: e.target.value }))} className="input-field" style={{ padding: '10px 12px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>الفرع</label>
                  <select id="sale-branch" value={form.branch} onChange={e => setForm(f => ({ ...f, branch: e.target.value }))} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', width: '100%' }}>
                    <option value="">اختر الفرع</option>
                    {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>اسم العميل</label>
                  <input id="sale-customer-name" type="text" placeholder="اسم العميل" value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} className="input-field" style={{ padding: '10px 12px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>رقم العميل</label>
                  <input id="sale-customer-phone" type="text" placeholder="01xxxxxxxxx" value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} className="input-field" style={{ padding: '10px 12px' }} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>طريقة الدفع</label>
                  <select id="sale-payment-method" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', width: '100%' }}>
                    <option value="cash">كاش 💵</option>
                    <option value="visa">فيزا 💳</option>
                    <option value="instapay">انستا باي ⚡</option>
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>ملاحظات</label>
                <textarea id="sale-notes" placeholder="أي ملاحظات إضافية..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input-field" style={{ padding: '10px 12px', resize: 'vertical', minHeight: 80 }} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '11px', borderRadius: 'var(--radius)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}>إلغاء</button>
                <button id="sale-save-btn" type="submit" disabled={saving} className="btn-primary" style={{ flex: 1, padding: '11px', fontSize: 14 }}>
                  {saving ? 'جاري الحفظ...' : (editingId ? 'حفظ التعديلات' : 'تسجيل المبيعة')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
