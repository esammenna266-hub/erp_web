'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface Branch {
  id: string
  name: string
  city: string
  address?: string
  manager?: string
  phone?: string
  employee_count?: number
  created_at: string
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', city: '', address: '', manager: '', phone: '' })
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('branches').select('*').order('created_at', { ascending: false })
    setBranches(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = branches.filter(b =>
    b.name?.toLowerCase().includes(search.toLowerCase()) ||
    b.city?.toLowerCase().includes(search.toLowerCase())
  )

  function openAdd() { setEditingId(null); setForm({ name: '', city: '', address: '', manager: '', phone: '' }); setError(''); setShowModal(true) }
  function openEdit(b: Branch) { setEditingId(b.id); setForm({ name: b.name ?? '', city: b.city ?? '', address: b.address ?? '', manager: b.manager ?? '', phone: b.phone ?? '' }); setError(''); setShowModal(true) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.city.trim()) { setError('الاسم والمدينة مطلوبان'); return }
    setSaving(true)
    setError('')
    const payload = { name: form.name.trim(), city: form.city.trim(), address: form.address, manager: form.manager, phone: form.phone }
    if (editingId) {
      const { error } = await supabase.from('branches').update(payload).eq('id', editingId)
      if (error) { setError(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('branches').insert(payload)
      if (error) { setError(error.message); setSaving(false); return }
    }
    setSaving(false); setShowModal(false); load()
  }

  async function handleDelete(id: string) {
    if (!confirm('هل أنت متأكد من حذف هذا الفرع؟')) return
    await supabase.from('branches').delete().eq('id', id)
    load()
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>الفروع</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>{filtered.length} فرع</p>
        </div>
        <button id="add-branch-btn" onClick={openAdd} className="btn-primary" style={{ padding: '10px 18px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          إضافة فرع
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 400, marginBottom: 20 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input id="branch-search" className="input-field" style={{ padding: '10px 14px 10px 36px' }} placeholder="بحث بالاسم أو المدينة..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />جاري التحميل...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏢</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>لا توجد فروع بعد</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filtered.map((branch, i) => (
            <div key={branch.id} className={`glass-card fade-in stagger-${Math.min(i + 1, 4)}`} style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: 'linear-gradient(135deg, rgba(16,217,160,0.2), rgba(16,217,160,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                    🏢
                  </div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{branch.name}</h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{branch.city}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => openEdit(branch)} style={{ padding: '5px 8px', borderRadius: 6, background: 'rgba(91,110,245,0.1)', border: '1px solid rgba(91,110,245,0.2)', color: '#818cf8', cursor: 'pointer', fontSize: 11 }}>تعديل</button>
                  <button onClick={() => handleDelete(branch.id)} style={{ padding: '5px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', cursor: 'pointer', fontSize: 11 }}>حذف</button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {branch.address && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    {branch.address}
                  </div>
                )}
                {branch.manager && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    المدير: {branch.manager}
                  </div>
                )}
                {branch.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    {branch.phone}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{editingId ? 'تعديل الفرع' : 'إضافة فرع جديد'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#f87171', marginBottom: 16 }}>{error}</div>}
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[
                  { id: 'branch-name', label: 'اسم الفرع', key: 'name', placeholder: 'فرع القاهرة', type: 'text' },
                  { id: 'branch-city', label: 'المدينة', key: 'city', placeholder: 'القاهرة', type: 'text' },
                  { id: 'branch-manager', label: 'المدير', key: 'manager', placeholder: 'أحمد محمد', type: 'text' },
                  { id: 'branch-phone', label: 'الهاتف', key: 'phone', placeholder: '02xxxxxxxx', type: 'tel' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>{f.label}</label>
                    <input id={f.id} type={f.type} placeholder={f.placeholder} value={(form as Record<string, string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="input-field" style={{ padding: '10px 12px' }} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>العنوان</label>
                <input id="branch-address" type="text" placeholder="شارع التحرير، وسط البلد" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className="input-field" style={{ padding: '10px 12px' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '11px', borderRadius: 'var(--radius)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}>إلغاء</button>
                <button id="branch-save-btn" type="submit" disabled={saving} className="btn-primary" style={{ flex: 1, padding: '11px', fontSize: 14 }}>
                  {saving ? 'جاري الحفظ...' : (editingId ? 'حفظ التعديلات' : 'إضافة الفرع')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
