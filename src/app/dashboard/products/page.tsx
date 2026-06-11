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
  const [showImportModal, setShowImportModal] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [previewProducts, setPreviewProducts] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  
  const [form, setForm] = useState({ 
    barcode: '', name: '', category: '', 
    unit_type: 'piece', quantity: '', price: '', branch: '' 
  })
  
  const [error, setError] = useState('')
  const [branches, setBranches] = useState<{id:string, name:string}[]>([])

  const handleDownloadTemplate = () => {
    const csvContent = "\ufeffالباركود,اسم المنتج,الصنف,نوع الوحدة,الكمية,السعر,الفرع\n6221234567890,شاشة سامسونج 55 بوصة,إلكترونيات,قطعة,10,13500,فرع القاهرة - الرئيسي\n,بن قهوة اسبريسو برازيلي,مشروبات وأغذية,وزن,15.5,480,فرع القاهرة - الرئيسي"
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", "products_template.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setImportError('')
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string
        if (!text) return

        // Delimiter detection (comma vs semicolon)
        let delimiter = ','
        const firstLine = text.split('\n')[0] || ''
        const commas = (firstLine.match(/,/g) || []).length
        const semicolons = (firstLine.match(/;/g) || []).length
        if (semicolons > commas) {
          delimiter = ';'
        }

        // CSV Parser
        const csvRows: string[][] = []
        let row: string[] = []
        let inQuotes = false
        let entry = ''
        
        for (let i = 0; i < text.length; i++) {
          const c = text[i]
          const next = text[i+1]
          
          if (c === '"') {
            if (inQuotes && next === '"') {
              entry += '"'
              i++
            } else {
              inQuotes = !inQuotes
            }
          } else if (c === delimiter && !inQuotes) {
            row.push(entry.trim())
            entry = ''
          } else if ((c === '\r' || c === '\n') && !inQuotes) {
            if (c === '\r' && next === '\n') i++
            row.push(entry.trim())
            if (row.length > 1 || row[0] !== '') {
              csvRows.push(row)
            }
            row = []
            entry = ''
          } else {
            entry += c
          }
        }
        if (entry || row.length > 0) {
          row.push(entry.trim())
          csvRows.push(row)
        }

        const headers = csvRows[0]
        if (!headers || csvRows.length < 2) {
          setImportError('الملف فارغ أو لا يحتوي على صفوف بيانات!')
          return
        }

        const headerMap: Record<string, string> = {
          'الاسم': 'name', 'اسم المنتج': 'name', 'المنتج': 'name', 'name': 'name', 'product': 'name', 'product name': 'name', 'title': 'name',
          'الباركود': 'barcode', 'باركود': 'barcode', 'كود': 'barcode', 'كود المنتج': 'barcode', 'barcode': 'barcode', 'code': 'barcode',
          'الصنف': 'category', 'صنف': 'category', 'القسم': 'category', 'الفئة': 'category', 'category': 'category', 'type': 'category',
          'الكمية': 'quantity', 'الكميه': 'quantity', 'العدد': 'quantity', 'quantity': 'quantity', 'qty': 'quantity', 'stock': 'quantity',
          'السعر': 'price', 'سعر': 'price', 'سعر البيع': 'price', 'price': 'price', 'rate': 'price',
          'الفرع': 'branch', 'فرع': 'branch', 'المخزن': 'branch', 'branch': 'branch', 'warehouse': 'branch',
          'الوحدة': 'unit_type', 'وحدة': 'unit_type', 'نوع الوحدة': 'unit_type', 'unit': 'unit_type', 'unit type': 'unit_type'
        }

        const colIndices: Record<string, number> = {}
        headers.forEach((h, idx) => {
          const clean = h.replace(/^\ufeff/, '').trim().toLowerCase() // Remove BOM
          const field = headerMap[clean]
          if (field) colIndices[field] = idx
        })

        if (colIndices['name'] === undefined) {
          setImportError('لم يتم العثور على عمود "اسم المنتج" (Name). يرجى التحقق من تسمية الأعمدة في الملف.')
          return
        }

        const items: any[] = []
        for (let i = 1; i < csvRows.length; i++) {
          const r = csvRows[i]
          if (r.length < 1 || !r[colIndices['name']]) continue
          
          const name = r[colIndices['name']].trim()
          if (!name) continue

          const barcode = colIndices['barcode'] !== undefined ? r[colIndices['barcode']].trim() : ''
          const category = colIndices['category'] !== undefined ? r[colIndices['category']].trim() : 'عام'
          const qtyStr = colIndices['quantity'] !== undefined ? r[colIndices['quantity']].trim() : '0'
          const priceStr = colIndices['price'] !== undefined ? r[colIndices['price']].trim() : ''
          const branch = colIndices['branch'] !== undefined ? r[colIndices['branch']].trim() : ''
          const unitRaw = colIndices['unit_type'] !== undefined ? r[colIndices['unit_type']].trim().toLowerCase() : ''

          const quantity = parseFloat(qtyStr.replace(/[^\d.-]/g, '')) || 0
          const price = priceStr ? (parseFloat(priceStr.replace(/[^\d.-]/g, '')) || null) : null
          
          let unit_type: 'piece' | 'weight' = 'piece'
          if (unitRaw.includes('وزن') || unitRaw.includes('كجم') || unitRaw.includes('كيلو') || unitRaw.includes('weight') || unitRaw.includes('kg')) {
            unit_type = 'weight'
          }

          let finalBarcode = barcode
          if (!finalBarcode && unit_type === 'piece') {
            finalBarcode = 'PRD-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
          }

          items.push({
            barcode: finalBarcode || null,
            name,
            category,
            unit_type,
            quantity,
            price,
            branch: branch || null
          })
        }

        if (items.length === 0) {
          setImportError('لم يتم العثور على أي منتجات صالحة للاستيراد في الملف.')
        } else {
          setPreviewProducts(items)
        }
      } catch (err: any) {
        setImportError('حدث خطأ أثناء قراءة الملف: ' + err.message)
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleConfirmImport = async () => {
    if (previewProducts.length === 0) return
    setImporting(true)
    setImportError('')
    
    try {
      const { error } = await supabase.from('products').insert(previewProducts)
      if (error) throw error
      
      alert(`تم استيراد ${previewProducts.length} منتج بنجاح! 🎉`)
      setShowImportModal(false)
      setPreviewProducts([])
      load()
    } catch (err: any) {
      setImportError(err.message || 'حدث خطأ أثناء حفظ المنتجات.')
    } finally {
      setImporting(false)
    }
  }

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
        <div style={{ display: 'flex', gap: 10 }}>
          <button 
            id="import-csv-btn" 
            onClick={() => {
              setPreviewProducts([])
              setImportError('')
              setShowImportModal(true)
            }} 
            className="btn-secondary" 
            style={{ padding: '10px 18px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 'var(--radius)', cursor: 'pointer' }}
          >
            📥 استيراد من شيت (CSV)
          </button>
          <button id="add-product-btn" onClick={openAddModal} className="btn-primary" style={{ padding: '10px 18px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            إضافة منتج
          </button>
        </div>
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

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowImportModal(false) }}>
          <div className="modal-box" style={{ maxWidth: 650 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>📥 استيراد المنتجات من ملف Excel/CSV</h2>
              <button onClick={() => setShowImportModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>

            {/* Instruction Banner */}
            <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                💡 <strong>تعليمات الملف:</strong>
                <ul style={{ paddingRight: 18, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <li>يجب حفظ شيت الإكسيل بصيغة <strong>CSV (Comma delimited)</strong> قبل رفعه.</li>
                  <li>تأكد من وجود الأعمدة الأساسية: <strong>اسم المنتج، الباركود، الصنف، الكمية، السعر، الفرع</strong> (يدعم اللغة العربية والإنجليزية).</li>
                  <li>عمود "الفرع" والباركود والسعر حقول اختيارية.</li>
                </ul>
              </div>
              <button onClick={handleDownloadTemplate} style={{ marginTop: 10, padding: '6px 12px', fontSize: 11, background: 'rgba(16,217,160,0.1)', border: '1px solid rgba(16,217,160,0.2)', color: '#34d399', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                📥 تحميل نموذج الملف الاسترشادي (Excel/CSV)
              </button>
            </div>

            {importError && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#f87171', marginBottom: 16 }}>
                ❌ {importError}
              </div>
            )}

            {previewProducts.length === 0 ? (
              <div style={{ border: '2px dashed var(--border)', borderRadius: 12, padding: '40px 20px', textAlign: 'center', background: 'rgba(255,255,255,0.01)', position: 'relative' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>اختر ملف الـ CSV الخاص بك للرفع والاستيراد</div>
                <input 
                  type="file" 
                  accept=".csv" 
                  onChange={handleFileChange} 
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} 
                />
                <button className="btn-secondary" style={{ pointerEvents: 'none', padding: '8px 16px', fontSize: 12 }}>اختر الملف</button>
              </div>
            ) : (
              <div>
                <div style={{ background: 'rgba(16,217,160,0.06)', border: '1px solid rgba(16,217,160,0.15)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                  ✅ تم قراءة <strong>{previewProducts.length}</strong> منتج جاهز للاستيراد. معاينة أول 5 منتجات:
                </div>
                
                {/* Preview Table */}
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 20 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'right' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: 8 }}>الاسم</th>
                        <th style={{ padding: 8 }}>الباركود</th>
                        <th style={{ padding: 8 }}>الصنف</th>
                        <th style={{ padding: 8 }}>الكمية</th>
                        <th style={{ padding: 8 }}>السعر</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewProducts.slice(0, 5).map((p, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: 8, color: 'var(--text-primary)', fontWeight: 500 }}>{p.name}</td>
                          <td style={{ padding: 8, fontFamily: 'monospace' }}>{p.barcode || '—'}</td>
                          <td style={{ padding: 8 }}>{p.category}</td>
                          <td style={{ padding: 8 }}>{p.quantity} ({p.unit_type === 'weight' ? 'كجم' : 'قطعة'})</td>
                          <td style={{ padding: 8 }}>{p.price ? `${p.price} ج.م` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" onClick={() => setPreviewProducts([])} style={{ flex: 1, padding: '11px', borderRadius: 'var(--radius)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>تغيير الملف</button>
                  <button onClick={handleConfirmImport} disabled={importing} className="btn-primary" style={{ flex: 1, padding: '11px', fontSize: 13 }}>
                    {importing ? 'جاري الاستيراد والحفظ...' : 'تأكيد واستيراد البيانات'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
