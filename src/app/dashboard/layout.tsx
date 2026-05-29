'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'الرئيسية',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    )
  },
  {
    href: '/dashboard/pos',
    label: 'نقطة البيع (POS)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" ry="2"/>
        <line x1="12" y1="10" x2="12" y2="18"/>
        <line x1="8" y1="14" x2="16" y2="14"/>
        <circle cx="6" cy="8" r="1"/>
        <circle cx="10" cy="8" r="1"/>
        <circle cx="14" cy="8" r="1"/>
        <circle cx="18" cy="8" r="1"/>
      </svg>
    )
  },
  {
    href: '/dashboard/employees',
    label: 'الموظفون',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    )
  },
  {
    href: '/dashboard/branches',
    label: 'الفروع',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    )
  },
  {
    href: '/dashboard/sales',
    label: 'المبيعات',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    )
  },
  {
    href: '/dashboard/attendance',
    label: 'الحضور',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    )
  },
  {
    href: '/dashboard/products',
    label: 'المنتجات',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    )
  },
]

const superNavItems: NavItem[] = [
  {
    href: '/dashboard/super-admin',
    label: 'إشراف العملاء والاشتراكات',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <path d="M12 8v4"/>
        <path d="M12 16h.01"/>
      </svg>
    )
  }
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [role, setRole] = useState<string>('employee')
  const [impersonatedCompany, setImpersonatedCompany] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push('/')
      } else {
        setUser(data.user)
        
        // Fetch role from profile
        const { data: profile } = await supabase.from('profiles').select('*').eq('email', data.user.email).single()
        setRole(profile?.role || 'employee')
        
        // Redirect if super admin and not impersonating and not in super admin pages
        const isImpersonating = !!localStorage.getItem('impersonated_tenant_id')
        if (profile?.role === 'super_admin' && !isImpersonating && !pathname.startsWith('/dashboard/super-admin')) {
          router.push('/dashboard/super-admin')
        }
      }
      setLoading(false)
    })
  }, [router, pathname])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const impId = localStorage.getItem('impersonated_tenant_id')
      if (impId) {
        supabase.from('tenants').select('name').eq('id', impId).single().then(({ data }: { data: any }) => {
          if (data) setImpersonatedCompany(data.name)
        })
      } else {
        setImpersonatedCompany(null)
      }
    }
  }, [pathname])

  function handleExitImpersonation() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('impersonated_tenant_id')
      setImpersonatedCompany(null)
      router.push('/dashboard/super-admin')
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>جاري التحميل...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: sidebarOpen ? 260 : 72, flexShrink: 0,
        background: 'rgba(255,255,255,0.025)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.25s ease',
        position: 'sticky', top: 0, height: '100vh',
        overflow: 'hidden', zIndex: 20
      }}>
        {/* Logo */}
        <div style={{
          padding: '20px 16px', display: 'flex', alignItems: 'center',
          gap: 12, borderBottom: '1px solid var(--border)', flexShrink: 0
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px var(--accent-blue-glow)'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
          {sidebarOpen && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>ERP System</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>نظام إدارة الموارد</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '4px 8px 8px', display: sidebarOpen ? 'block' : 'none' }}>
            القائمة الرئيسية
          </div>
          {((role === 'super_admin' && !impersonatedCompany) ? superNavItems : navItems).map((item) => {
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href} className={`nav-item ${isActive ? 'active' : ''}`} style={{ marginBottom: 4, justifyContent: sidebarOpen ? 'flex-start' : 'center' }}>
                <span style={{ flexShrink: 0 }}>{item.icon}</span>
                {sidebarOpen && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          {sidebarOpen ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
              <div style={{
                width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: 'white'
              }}>
                {user?.email?.[0]?.toUpperCase() ?? 'A'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.email?.split('@')[0] ?? 'Admin'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {role === 'super_admin' ? 'مدير النظام الرئيسي' : 'مسؤول الفرع / الشركة'}
                </div>
              </div>
              <button id="logout-btn" onClick={handleLogout} title="تسجيل الخروج" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6, transition: 'color 0.15s' }} onMouseOver={e => (e.currentTarget.style.color = '#f87171')} onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          ) : (
            <button onClick={handleLogout} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '10px 0', display: 'flex', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Impersonation Banner */}
        {impersonatedCompany && (
          <div style={{
            background: 'linear-gradient(90deg, #f59e0b, #9b59f8)',
            color: 'white',
            padding: '10px 24px',
            fontSize: 13,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 100
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚠️ وضع المحاكاة: أنت تتصفح وتعدّل الآن بيانات <strong>{impersonatedCompany}</strong></span>
            </div>
            <button 
              onClick={handleExitImpersonation}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.4)',
                borderRadius: 6,
                color: 'white',
                padding: '4px 10px',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 'bold',
                transition: 'all 0.15s'
              }}
            >
              إنهاء وضع المحاكاة والعودة لوحة التحكم الرئيسيه 🚪
            </button>
          </div>
        )}
        {/* Top bar */}
        <header style={{
          height: 60, background: 'rgba(255,255,255,0.02)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16,
          position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(8px)'
        }}>
          <button
            id="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--text-secondary)', padding: '6px 8px', transition: 'all 0.15s' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>

          <div style={{ flex: 1 }} />

          {/* Notifications */}
          <button style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--text-secondary)', padding: '6px 8px', position: 'relative' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-red)', border: '2px solid var(--bg-primary)' }} />
          </button>

          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: '28px 28px', overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
