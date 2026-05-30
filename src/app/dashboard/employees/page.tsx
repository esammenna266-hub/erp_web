'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface Employee {
  id: string
  name: string
  email: string
  role: string
  branch: string
  phone?: string
  salary?: number
  created_at: string
}

const ROLE_OPTIONS = ['employee', 'supervisor', 'admin']
const roleLabel: Record<string, string> = { admin: 'مسؤول', supervisor: 'مشرف', employee: 'موظف' }
const roleBadge: Record<string, string> = { admin: 'badge-red', supervisor: 'badge-amber', employee: 'badge-blue' }

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [filtered, setFiltered] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'employee', branch: '', phone: '', salary: '' })
  const [error, setError] = useState('')
  const [branches, setBranches] = useState<{id:string, name:string}[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('employees').select('*').order('created_at', { ascending: false })
    const { data: bData } = await supabase.from('branches').select('id, name')
    setEmployees(data ?? [])
    setBranches(bData ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    let list = employees
    if (search) list = list.filter(e => e.name?.toLowerCase().includes(search.toLowerCase()) || e.email?.toLowerCase().includes(search.toLowerCase()))
    if (roleFilter !== 'all') list = list.filter(e => e.role === roleFilter)
    setFiltered(list)
  }, [employees, search, roleFilter])

  function openAddModal() {
    setEditingId(null)
    setForm({ name: '', email: '', role: 'employee', branch: '', phone: '', salary: '' })
    setError('')
    setShowModal(true)
  }

  function openEditModal(emp: Employee) {
    setEditingId(emp.id)
    setForm({ name: emp.name ?? '', email: emp.email ?? '', role: emp.role ?? 'employee', branch: emp.branch ?? '', phone: emp.phone ?? '', salary: emp.salary?.toString() ?? '' })
    setError('')
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) { setError('الاسم والبريد مطلوبان'); return }
    setSaving(true)
    setError('')
    const targetEmail = form.email.trim().toLowerCase()
    const payload = { name: form.name.trim(), email: targetEmail, role: form.role, branch: form.branch, phone: form.phone, salary: form.salary ? parseFloat(form.salary) : null }

    if (editingId) {
      // Get old email first to sync update
      const { data: oldEmp } = await supabase.from('employees').select('email').eq('id', editingId).single()
      
      const { error } = await supabase.from('employees').update(payload).eq('id', editingId)
      if (error) { setError(error.message); setSaving(false); return }

      // Update matching profile if exists
      if (oldEmp) {
        await supabase.from('profiles').update({ email: targetEmail, role: form.role }).eq('email', oldEmp.email)
      }
    } else {
      const { error } = await supabase.from('employees').insert(payload)
      if (error) { setError(error.message); setSaving(false); return }

      // Get current logged-in user's tenant_id to assign it to employee
      const { data: authData } = await supabase.auth.getUser()
      if (authData?.user) {
        const { data: currentProfile } = await supabase.from('profiles').select('tenant_id').eq('email', authData.user.email).single()
        const activeTenantId = currentProfile?.tenant_id

        // Create profile so they can log in
        const { data: existingProfile } = await supabase.from('profiles').select('id').eq('email', targetEmail).single()
        if (!existingProfile) {
          await supabase.from('profiles').insert({
            email: targetEmail,
            tenant_id: activeTenantId,
            role: form.role,
            password: 'demo' // default password is 'demo'
          })
        }
      }
    }
    setSaving(false)
    setShowModal(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('هل أنت متأكد من حذف هذا الموظف؟')) return
    
    // Delete profile first
    const { data: empToDelete } = await supabase.from('employees').select('email').eq('id', id).single()
    if (empToDelete) {
      await supabase.from('profiles').delete().eq('email', empToDelete.email)
    }

    await supabase.from('employees').delete().eq('id', id)
    load()
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>الموظفون</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
            {filtered.length} موظف {search || roleFilter !== 'all' ? '(مٌصفَّى)' : ''}
          </p>
        </div>
        <button id="add-employee-btn" onClick={openAddModal} className="btn-primary" style={{ padding: '10px 18px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>إضافة موظف</span>
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            id="employee-search"
            className="input-field"
            style={{ padding: '10px 14px 10px 36px' }}
            placeholder="بحث بالاسم أو البريد..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          id="role-filter"
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', cursor: 'pointer' }}
        >
          <option value="all">جميع الأدوار</option>
          {ROLE_OPTIONS.map(r => <option key={r} value={r}>{roleLabel[r]}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            جاري التحميل...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{search || roleFilter !== 'all' ? 'لا توجد نتائج مطابقة' : 'لا يوجد موظفون بعد'}</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>الموظف</th>
                  <th>البريد الإلكتروني</th>
                  <th>الهاتف</th>
                  <th>الدور</th>
                  <th>الفرع</th>
                  <th>الراتب</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(emp => (
                  <tr key={emp.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                          {emp.name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{emp.name}</span>
                      </div>
                    </td>
                    <td>{emp.email}</td>
                    <td>{emp.phone ?? '—'}</td>
                    <td><span className={`badge ${roleBadge[emp.role] ?? 'badge-blue'}`}>{roleLabel[emp.role] ?? emp.role}</span></td>
                    <td>{emp.branch ?? '—'}</td>
                    <td style={{ fontWeight: 600, color: 'var(--accent-emerald)' }}>
                      {emp.salary ? `${emp.salary.toLocaleString('ar-EG')} ج.م` : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEditModal(emp)} style={{ padding: '5px 10px', borderRadius: 6, background: 'rgba(91,110,245,0.1)', border: '1px solid rgba(91,110,245,0.2)', color: '#818cf8', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>تعديل</button>
                        <button onClick={() => handleDelete(emp.id)} style={{ padding: '5px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>حذف</button>
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
                {editingId ? 'تعديل موظف' : 'إضافة موظف جديد'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
            </div>
            {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#f87171', marginBottom: 16 }}>{error}</div>}
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[
                  { id:'emp-name', label: 'الاسم الكامل', key: 'name', type: 'text', placeholder: 'محمد أحمد' },
                  { id:'emp-email', label: 'البريد الإلكتروني', key: 'email', type: 'email', placeholder: 'email@company.com' },
                  { id:'emp-phone', label: 'رقم الهاتف', key: 'phone', type: 'tel', placeholder: '01xxxxxxxxx' },
                  { id:'emp-salary', label: 'الراتب (ج.م)', key: 'salary', type: 'number', placeholder: '5000' },
                ].map(field => (
                  <div key={field.key}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>{field.label}</label>
                    <input
                      id={field.id}
                      type={field.type}
                      placeholder={field.placeholder}
                      value={(form as Record<string, string>)[field.key]}
                      onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                      className="input-field"
                      style={{ padding: '10px 12px' }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>الدور</label>
                  <select
                    id="emp-role"
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', width: '100%' }}
                  >
                    {ROLE_OPTIONS.map(r => <option key={r} value={r}>{roleLabel[r]}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>الفرع</label>
                  <select
                    id="emp-branch"
                    value={form.branch}
                    onChange={e => setForm(f => ({ ...f, branch: e.target.value }))}
                    style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', width: '100%' }}
                  >
                    <option value="">اختر الفرع</option>
                    {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '11px', borderRadius: 'var(--radius)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>إلغاء</button>
                <button id="emp-save-btn" type="submit" disabled={saving} className="btn-primary" style={{ flex: 1, padding: '11px', fontSize: 14, position: 'relative' }}>
                  {saving ? <><span>جاري الحفظ...</span></> : (editingId ? 'حفظ التعديلات' : 'إضافة الموظف')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
