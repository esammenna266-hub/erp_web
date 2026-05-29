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
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ employee_name: '', branch: '', amount: '', product: '', notes: '' })
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
    setForm({ employee_name: '', branch: '', amount: '', product: '', notes: '' })
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
      notes: sale.notes ?? '' 
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
                  <th>الموظف</th>
                  <th>المنتج</th>
                  <th>الفرع</th>
                  <th>المبلغ</th>
                  <th>التاريخ</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(sale => (
                  <tr key={sale.id}>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{sale.employee_name}</td>
                    <td>{sale.product ?? '—'}</td>
                    <td>{sale.branch ?? '—'}</td>
                    <td>
                      <span style={{ fontWeight: 700, color: 'var(--accent-emerald)', fontSize: 15 }}>
                        {(sale.amount ?? 0).toLocaleString('ar-EG')} ج.م
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(sale.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEditModal(sale)} style={{ padding: '5px 10px', borderRadius: 6, background: 'rgba(91,110,245,0.1)', border: '1px solid rgba(91,110,245,0.2)', color: '#818cf8', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>تعديل</button>
                        <button onClick={() => handleDelete(sale.id)} style={{ padding: '5px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>حذف</button>
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
