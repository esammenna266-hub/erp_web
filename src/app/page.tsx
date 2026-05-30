'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDemo, setShowDemo] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('demo') === 'true' || params.get('dev') === 'true') {
        setShowDemo(true)
      }
    }
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message === 'Invalid login credentials'
        ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
        : error.message)
    } else {
      // Check if there is a redirect parameter in the URL
      const searchParams = new URLSearchParams(window.location.search);
      const redirectUrl = searchParams.get('redirect') || '/dashboard';
      router.push(redirectUrl)
    }
    setLoading(false)
  }

  async function handleQuickLogin(email: string) {
    setLoading(true)
    setError('')
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('use_mock_data', 'true')
    }

    const { error } = await supabase.auth.signInWithPassword({ 
      email, 
      password: 'demo' 
    })
    
    if (error) {
      setError(error.message)
    } else {
      router.push('/dashboard')
    }
    setLoading(false)
  }

  async function handleSignUp(e: React.MouseEvent) {
    e.preventDefault()
    if (!email || !password) {
      setError('يرجى كتابة البريد الإلكتروني وكلمة المرور أولاً')
      return
    }
    
    setLoading(true)
    setError('')

    const { error, data } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
    } else {
      // Check if email confirmation is required based on session
      if (data.session) {
         const searchParams = new URLSearchParams(window.location.search);
         const redirectUrl = searchParams.get('redirect') || '/dashboard';
         router.push(redirectUrl)
      } else {
         setError('تم التسجيل! لكن يبدو أن "تأكيد البريد الإلكتروني" مفعل في Supabase. يرجى إيقافه من إعدادات Supabase Auth ثم المحاولة مجدداً.')
      }
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      {/* Background glow orbs */}
      <div style={{
        position: 'absolute', top: '15%', left: '25%', width: 400, height: 400,
        background: 'radial-gradient(circle, rgba(91,110,245,0.15) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', bottom: '20%', right: '20%', width: 350, height: 350,
        background: 'radial-gradient(circle, rgba(155,89,248,0.12) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none'
      }} />

      {/* Grid pattern */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
        backgroundSize: '48px 48px', pointerEvents: 'none'
      }} />

      <div className="fade-in" style={{ width: '100%', maxWidth: 420, padding: '0 24px', position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', boxShadow: '0 8px 24px var(--accent-blue-glow)'
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
            ERP System
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 6 }}>
            تسجيل الدخول إلى لوحة التحكم
          </p>
        </div>

        {/* Login Card */}
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
          borderRadius: 20, padding: 32, backdropFilter: 'blur(12px)'
        }}>
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 10, padding: '10px 14px', marginBottom: 20,
              fontSize: 13, color: '#f87171', display: 'flex', alignItems: 'center', gap: 8
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
                البريد الإلكتروني
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@company.com"
                className="input-field"
                style={{ padding: '12px 14px' }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
                كلمة المرور
              </label>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-field"
                style={{ padding: '12px 14px' }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <button
                id="login-submit"
                onClick={handleLogin}
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{ width: '100%', padding: '13px', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, position: 'relative' }}
              >
                {loading ? (
                  <>
                    <div className="spinner" style={{ width: 18, height: 18 }} />
                    <span>جاري...</span>
                  </>
                ) : (
                  <>
                    <span>تسجيل الدخول</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </>
                )}
              </button>
            </div>

            {showDemo && (
              <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 16, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
                  حسابات تجريبية سريعة (Demo Accounts)
                </div>
                
                <button
                  type="button"
                  onClick={() => handleQuickLogin('super@admin.com')}
                  disabled={loading}
                  className="btn-primary"
                  style={{
                    width: '100%', padding: '11px', fontSize: 13, 
                    background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    fontWeight: 600
                  }}
                >
                  <span>👑 دخول كـ مسؤول النظام (Super Admin)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('menna@admin.com')}
                  disabled={loading}
                  style={{
                    width: '100%', padding: '11px', fontSize: 13, 
                    background: 'rgba(16, 217, 160, 0.12)', 
                    border: '1px solid rgba(16, 217, 160, 0.25)', borderRadius: 'var(--radius)', 
                    color: '#10d9a0', cursor: 'pointer', display: 'flex', 
                    alignItems: 'center', justifyContent: 'center', gap: 8,
                    fontWeight: 600, transition: 'all 0.15s'
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(16, 217, 160, 0.2)'}
                  onMouseOut={e => e.currentTarget.style.background = 'rgba(16, 217, 160, 0.12)'}
                >
                  <span>🏢 دخول كـ شركة النور (Company 1)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('city@admin.com')}
                  disabled={loading}
                  style={{
                    width: '100%', padding: '11px', fontSize: 13, 
                    background: 'rgba(91, 110, 245, 0.12)', 
                    border: '1px solid rgba(91, 110, 245, 0.25)', borderRadius: 'var(--radius)', 
                    color: '#818cf8', cursor: 'pointer', display: 'flex', 
                    alignItems: 'center', justifyContent: 'center', gap: 8,
                    fontWeight: 600, transition: 'all 0.15s'
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(91, 110, 245, 0.2)'}
                  onMouseOut={e => e.currentTarget.style.background = 'rgba(91, 110, 245, 0.12)'}
                >
                  <span>🛒 دخول كـ سوبرماركت المدينة (Company 2)</span>
                </button>
              </div>
            )}
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--text-muted)' }}>
          نظام إدارة الموارد البشرية © 2026
        </p>
      </div>
    </div>
  )
}
