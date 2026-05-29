'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface AttendanceRecord {
  id: string
  employee_name: string
  employee_id?: string
  branch?: string
  date: string
  check_in?: string
  check_out?: string
  status: string
  notes?: string
}

const STATUS_OPTIONS = ['present', 'absent', 'late', 'leave']
const statusLabel: Record<string, string> = { present: 'حاضر', absent: 'غائب', late: 'متأخر', leave: 'إجازة' }
const statusBadge: Record<string, string> = { present: 'badge-green', absent: 'badge-red', late: 'badge-amber', leave: 'badge-blue' }

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0])
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ employee_name: '', branch: '', date: new Date().toISOString().split('T')[0], check_in: '', check_out: '', status: 'present', notes: '' })
  const [error, setError] = useState('')
  const [branches, setBranches] = useState<{id:string, name:string}[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const query = supabase.from('attendance').select('*').order('date', { ascending: false }).order('check_in', { ascending: false })
    const { data, data: bData } = await query
    const { data: branchData } = await supabase.from('branches').select('id, name')
    setRecords(data ?? [])
    setBranches(branchData ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = records.filter(r => {
    const dateMatch = !dateFilter || r.date === dateFilter
    const statusMatch = statusFilter === 'all' || r.status === statusFilter
    return dateMatch && statusMatch
  })

  const stats = {
    present: filtered.filter(r => r.status === 'present').length,
    absent: filtered.filter(r => r.status === 'absent').length,
    late: filtered.filter(r => r.status === 'late').length,
    leave: filtered.filter(r => r.status === 'leave').length,
  }

  function openAddModal() {
    setEditingId(null)
    setForm({ employee_name: '', branch: '', date: new Date().toISOString().split('T')[0], check_in: '', check_out: '', status: 'present', notes: '' })
    setError('')
    setShowModal(true)
  }

  function openEditModal(rec: AttendanceRecord) {
    setEditingId(rec.id)
    setForm({ 
      employee_name: rec.employee_name ?? '', 
      branch: rec.branch ?? '', 
      date: rec.date ?? new Date().toISOString().split('T')[0], 
      check_in: rec.check_in ?? '', 
      check_out: rec.check_out ?? '', 
      status: rec.status ?? 'present', 
      notes: rec.notes ?? '' 
    })
    setError('')
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.employee_name.trim()) { setError('اسم الموظف مطلوب'); return }
    setSaving(true); setError('')
    
    const payload = {
      employee_name: form.employee_name.trim(),
      branch: form.branch,
      date: form.date,
      check_in: form.check_in || null,
      check_out: form.check_out || null,
      status: form.status,
      notes: form.notes,
    }

    if (editingId) {
       const { error } = await supabase.from('attendance').update(payload).eq('id', editingId)
       if (error) { setError(error.message); setSaving(false); return }
    } else {
       const { error } = await supabase.from('attendance').insert(payload)
       if (error) { setError(error.message); setSaving(false); return }
    }
    
    setSaving(false); setShowModal(false); load()
  }

  async function handleDelete(id: string) {
    if (!confirm('حذف هذا السجل؟')) return
    await supabase.from('attendance').delete().eq('id', id)
    load()
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>سجل الحضور</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>{filtered.length} سجل</p>
        </div>
        <button id="add-attendance-btn" onClick={openAddModal} className="btn-primary" style={{ padding: '10px 18px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          تسجيل حضور
        </button>
      </div>

      {/* Mini stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { key: 'present', label: 'حاضر', color: 'var(--accent-emerald)', bg: 'rgba(16,217,160,0.08)', count: stats.present },
          { key: 'absent', label: 'غائب', color: '#f87171', bg: 'rgba(239,68,68,0.08)', count: stats.absent },
          { key: 'late', label: 'متأخر', color: '#fbbf24', bg: 'rgba(245,158,11,0.08)', count: stats.late },
          { key: 'leave', label: 'إجازة', color: '#818cf8', bg: 'rgba(91,110,245,0.08)', count: stats.leave },
        ].map(s => (
          <div key={s.key} style={{ padding: '14px 16px', borderRadius: 12, background: s.bg, border: `1px solid ${s.color}22`, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          id="date-filter"
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', colorScheme: 'dark' }}
        />
        <select
          id="status-filter"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }}
        >
          <option value="all">جميع الحالات</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{statusLabel[s]}</option>)}
        </select>
        <button onClick={() => { setDateFilter(''); setStatusFilter('all') }} style={{ padding: '10px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>
          مسح الفلاتر
        </button>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />جاري التحميل...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>لا توجد سجلات لهذا اليوم</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>الموظف</th>
                  <th>الفرع</th>
                  <th>التاريخ</th>
                  <th>الحضور</th>
                  <th>الانصراف</th>
                  <th>الحالة</th>
                  <th>ملاحظات</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(rec => (
                  <tr key={rec.id}>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{rec.employee_name}</td>
                    <td>{rec.branch ?? '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(rec.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td>{rec.check_in ?? '—'}</td>
                    <td>{rec.check_out ?? '—'}</td>
                    <td><span className={`badge ${statusBadge[rec.status] ?? 'badge-blue'}`}>{statusLabel[rec.status] ?? rec.status}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.notes ?? '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEditModal(rec)} style={{ padding: '5px 10px', borderRadius: 6, background: 'rgba(91,110,245,0.1)', border: '1px solid rgba(91,110,245,0.2)', color: '#818cf8', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>تعديل</button>
                        <button onClick={() => handleDelete(rec.id)} style={{ padding: '5px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>حذف</button>
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
                {editingId ? 'تعديل سجل الحضور' : 'تسجيل حضور'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#f87171', marginBottom: 16 }}>{error}</div>}
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>اسم الموظف</label>
                  <input id="att-employee" type="text" placeholder="محمد أحمد" value={form.employee_name} onChange={e => setForm(f => ({ ...f, employee_name: e.target.value }))} className="input-field" style={{ padding: '10px 12px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>التاريخ</label>
                  <input id="att-date" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', width: '100%', colorScheme: 'dark' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>وقت الحضور</label>
                  <input id="att-checkin" type="time" value={form.check_in} onChange={e => setForm(f => ({ ...f, check_in: e.target.value }))} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', width: '100%', colorScheme: 'dark' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>وقت الانصراف</label>
                  <input id="att-checkout" type="time" value={form.check_out} onChange={e => setForm(f => ({ ...f, check_out: e.target.value }))} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', width: '100%', colorScheme: 'dark' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>الحالة</label>
                  <select id="att-status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', width: '100%' }}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{statusLabel[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>الفرع</label>
                  <select id="att-branch" value={form.branch} onChange={e => setForm(f => ({ ...f, branch: e.target.value }))} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', width: '100%' }}>
                    <option value="">اختر الفرع</option>
                    {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>ملاحظات</label>
                <textarea id="att-notes" placeholder="أي ملاحظات..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input-field" style={{ padding: '10px 12px', resize: 'vertical', minHeight: 72 }} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '11px', borderRadius: 'var(--radius)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}>إلغاء</button>
                <button id="att-save-btn" type="submit" disabled={saving} className="btn-primary" style={{ flex: 1, padding: '11px', fontSize: 14 }}>
                  {saving ? 'جاري الحفظ...' : (editingId ? 'حفظ التعديلات' : 'تسجيل الحضور')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
