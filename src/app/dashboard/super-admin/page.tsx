'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Tenant {
  id: string
  name: string
  owner_email: string
  status: 'active' | 'suspended'
  created_at: string
  employee_count?: number
  sales_volume?: number
}

export default function SuperAdminPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  
  // Add company modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [newCompanyName, setNewCompanyName] = useState('')
  const [newOwnerEmail, setNewOwnerEmail] = useState('')
  const [addingError, setAddingError] = useState('')
  const [addingSaving, setAddingSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('tenants').select('*')
    setTenants(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    // Check permissions on mount
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push('/')
      } else {
        const { data: profile } = await supabase.from('profiles').select('*').eq('email', data.user.email).single()
        if (profile?.role !== 'super_admin') {
          router.push('/dashboard')
        }
      }
    })
    
    loadData()
  }, [router, loadData])

  const handleToggleStatus = async (tenant: Tenant) => {
    setUpdatingId(tenant.id)
    const nextStatus = tenant.status === 'active' ? 'suspended' : 'active'
    
    const { error } = await supabase
      .from('tenants')
      .update({ status: nextStatus })
      .eq('id', tenant.id)

    if (error) {
      alert('حدث خطأ أثناء تعديل حالة العميل: ' + error.message)
    } else {
      await loadData()
    }
    setUpdatingId(null)
  }

  const handleImpersonate = (tenant: Tenant) => {
    if (tenant.status !== 'active') {
      alert('عذراً، هذا العميل موقوف حالياً. يرجى تفعيل اشتراكه أولاً لتتمكن من محاكاة بياناته.')
      return
    }
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('impersonated_tenant_id', tenant.id)
      router.push('/dashboard') // Redirect back to normal dashboard layout
    }
  }

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCompanyName.trim()) {
      setAddingError('يرجى إدخال اسم الشركة')
      return
    }
    if (!newOwnerEmail.trim() || !newOwnerEmail.includes('@')) {
      setAddingError('يرجى إدخال بريد إلكتروني صحيح للمالك')
      return
    }

    setAddingSaving(true)
    setAddingError('')

    const tenantId = 't_' + Math.random().toString(36).substr(2, 9)

    // 1. Insert tenant
    const { error: tenantErr } = await supabase.from('tenants').insert({
      id: tenantId,
      name: newCompanyName.trim(),
      owner_email: newOwnerEmail.trim().toLowerCase(),
      status: 'active'
    })

    if (tenantErr) {
      setAddingError('خطأ أثناء إنشاء الشركة: ' + tenantErr.message)
      setAddingSaving(false)
      return
    }

    // 2. Insert corresponding profile for the admin of this tenant
    const { error: profileErr } = await supabase.from('profiles').insert({
      id: 'u_' + Math.random().toString(36).substr(2, 9),
      email: newOwnerEmail.trim().toLowerCase(),
      tenant_id: tenantId,
      role: 'admin'
    })

    if (profileErr) {
      // Clean up the created tenant if profile creation fails
      await supabase.from('tenants').delete().eq('id', tenantId)
      setAddingError('خطأ أثناء إنشاء حساب المالك: ' + profileErr.message)
      setAddingSaving(false)
      return
    }

    // Clean up state
    setNewCompanyName('')
    setNewOwnerEmail('')
    setAddingSaving(false)
    setShowAddModal(false)
    
    // Reload table data
    await loadData()
  }

  const filtered = useMemo(() => {
    return tenants.filter(t => 
      t.name?.toLowerCase().includes(search.toLowerCase()) || 
      t.owner_email?.toLowerCase().includes(search.toLowerCase())
    )
  }, [tenants, search])

  const stats = useMemo(() => {
    return {
      total: tenants.length,
      active: tenants.filter(t => t.status === 'active').length,
      suspended: tenants.filter(t => t.status === 'suspended').length,
      employees: tenants.reduce((sum, t) => sum + (t.employee_count || 0), 0),
      sales: tenants.reduce((sum, t) => sum + (t.sales_volume || 0), 0)
    }
  }, [tenants])

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
          لوحة الإشراف العام للمشرف الرئيسي (Super Admin)
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
          مراقبة حالة واشتراكات العملاء (Tenants)، إحصائيات المبيعات، ومحاكاة صلاحياتهم لمساعدتهم وتعديل بياناتهم.
        </p>
      </div>

      {/* Overview stats cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        
        <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>إجمالي العملاء المشتركين</span>
              <div style={{ width: 36, height: 36, borderRadius: 8, fontSize: 18, background: 'rgba(155, 89, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👥</div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
              {loading ? '—' : stats.total} شركة / عميل
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            النشطين: {stats.active} | المعلقين: {stats.suspended}
          </div>
        </div>

        <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>إجمالي مبيعات المشتركين</span>
              <div style={{ width: 36, height: 36, borderRadius: 8, fontSize: 18, background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>💰</div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent-emerald)', letterSpacing: '-0.5px' }}>
              {loading ? '—' : `${stats.sales.toLocaleString('ar-EG')} ج.م`}
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            تجميع أرقام مبيعات كافة فروع العملاء
          </div>
        </div>

        <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>عدد الموظفين على الشبكة</span>
              <div style={{ width: 36, height: 36, borderRadius: 8, fontSize: 18, background: 'rgba(91, 110, 245, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👔</div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
              {loading ? '—' : stats.employees} موظف مسجل
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            عدد المستخدمين والعاملين تحت مظلة العملاء
          </div>
        </div>

      </div>

      {/* Controls: Search & Add Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ position: 'relative', minWidth: 300, flex: 1, maxWidth: 400 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input 
            id="super-admin-search" 
            className="input-field" 
            style={{ padding: '10px 14px 10px 36px' }} 
            placeholder="بحث باسم الشركة أو بريد المالك..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
        <button 
          onClick={() => {
            setNewCompanyName('')
            setNewOwnerEmail('')
            setAddingError('')
            setShowAddModal(true)
          }}
          className="btn-primary"
          style={{
            padding: '10px 20px',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderRadius: 8,
            cursor: 'pointer'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          إضافة عميل جديد
        </button>
      </div>

      {/* Companies monitoring table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            جاري تحميل بيانات العملاء...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            لا يوجد عملاء مطابقين للبحث حالياً
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>اسم الشركة</th>
                  <th>بريد المالك المسجل</th>
                  <th>عدد الموظفين</th>
                  <th>حجم المبيعات الكلي</th>
                  <th>تاريخ التسجيل</th>
                  <th>حالة الاشتراك</th>
                  <th>إجراءات الإشراف</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(tenant => (
                  <tr key={tenant.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                          {tenant.name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{tenant.name}</span>
                      </div>
                    </td>
                    <td>{tenant.owner_email}</td>
                    <td style={{ fontWeight: 600 }}>{tenant.employee_count ?? 0} موظف</td>
                    <td style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>
                      {(tenant.sales_volume || 0).toLocaleString('ar-EG')} ج.م
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(tenant.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td>
                      <span className={`badge ${tenant.status === 'active' ? 'badge-green' : 'badge-red'}`}>
                        {tenant.status === 'active' ? 'نشط (مفعّل)' : 'موقوف / معلّق'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button 
                          onClick={() => handleImpersonate(tenant)} 
                          style={{
                            padding: '6px 12px', borderRadius: 6, 
                            background: 'rgba(16, 217, 160, 0.1)', 
                            border: '1px solid rgba(16, 217, 160, 0.2)', 
                            color: '#10d9a0', cursor: 'pointer', fontSize: 12, fontWeight: 500
                          }}
                        >
                          دخول بصلاحيات العميل 👤
                        </button>
                        
                        <button 
                          onClick={() => handleToggleStatus(tenant)}
                          disabled={updatingId === tenant.id}
                          style={{
                            padding: '6px 12px', borderRadius: 6, 
                            background: tenant.status === 'active' ? 'rgba(239,68,68,0.1)' : 'rgba(91,110,245,0.1)', 
                            border: tenant.status === 'active' ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(91,110,245,0.2)', 
                            color: tenant.status === 'active' ? '#f87171' : '#818cf8', 
                            cursor: 'pointer', fontSize: 12, fontWeight: 500
                          }}
                        >
                          {updatingId === tenant.id ? 'جاري...' : (tenant.status === 'active' ? 'تعليق الحساب ⛔' : 'تفعيل الحساب 🟢')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Client Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false) }}>
          <div className="modal-box" style={{ maxWidth: 450 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>إضافة عميل (شركة) جديد للمنظومة</h2>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            
            {addingError && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#f87171', marginBottom: 16 }}>
                {addingError}
              </div>
            )}
            
            <form onSubmit={handleAddCompany}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>اسم الشركة / المحل التجاري</label>
                  <input 
                    id="new-company-name"
                    type="text" 
                    placeholder="مثال: شركة المستقبل للتجارة" 
                    value={newCompanyName} 
                    onChange={e => setNewCompanyName(e.target.value)} 
                    className="input-field" 
                    style={{ padding: '10px 12px' }} 
                    required
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>البريد الإلكتروني لمالك الشركة (يستخدم لتسجيل الدخول)</label>
                  <input 
                    id="new-owner-email"
                    type="email" 
                    placeholder="owner@company.com" 
                    value={newOwnerEmail} 
                    onChange={e => setNewOwnerEmail(e.target.value)} 
                    className="input-field" 
                    style={{ padding: '10px 12px' }} 
                    required
                  />
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    سيتم إنشاء حساب مشرف تلقائياً بهذا البريد لعزل بياناته عن باقي المشتركين.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: '11px', borderRadius: 'var(--radius)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}>إلغاء</button>
                <button id="company-save-btn" type="submit" disabled={addingSaving} className="btn-primary" style={{ flex: 1, padding: '11px', fontSize: 14 }}>
                  {addingSaving ? 'جاري الحفظ...' : 'إضافة وتفعيل الحساب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
