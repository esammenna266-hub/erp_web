import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ykctzdnuytnobxusghoc.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-key'

// Create the real Supabase client
const realSupabase = createClient(supabaseUrl, supabaseAnonKey)

// Multi-Tenant SaaS Initial Mock Data
const INITIAL_MOCK_DATA: Record<string, any[]> = {
  tenants: [
    { id: "t1", name: "شركة النور للتجارة", owner_email: "menna@admin.com", status: "active", created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
    { id: "t2", name: "سوبرماركت المدينة", owner_email: "city@admin.com", status: "active", created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString() },
    { id: "t3", name: "مكتبة النجاح", owner_email: "library@admin.com", status: "suspended", created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString() }
  ],
  profiles: [
    { id: "u_super", email: "super@admin.com", tenant_id: null, role: "super_admin", password: "demo" },
    { id: "u_c1", email: "menna@admin.com", tenant_id: "t1", role: "admin", password: "demo" },
    { id: "u_c2", email: "city@admin.com", tenant_id: "t2", role: "admin", password: "demo" },
    { id: "u_c3", email: "library@admin.com", tenant_id: "t3", role: "admin", password: "demo" }
  ],
  branches: [
    {
      id: "b1",
      tenant_id: "t1",
      name: "فرع القاهرة - الرئيسي",
      city: "القاهرة",
      address: "شارع التحرير، وسط البلد",
      manager: "أحمد محمود",
      phone: "0223456789",
      created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "b2",
      tenant_id: "t1",
      name: "فرع الإسكندرية",
      city: "العجمي، هانوفيل",
      address: "شارع الهانوفيل الرئيسي",
      manager: "سارة علي",
      phone: "034567890",
      created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "b3",
      tenant_id: "t2",
      name: "فرع الجيزة",
      city: "الجيزة",
      address: "شارع الهرم الرئيسي",
      manager: "كريم سعد",
      phone: "0235678901",
      created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
    }
  ],
  employees: [
    {
      id: "e1",
      tenant_id: "t1",
      name: "منة أحمد",
      email: "menna@admin.com",
      role: "admin",
      branch: "فرع القاهرة - الرئيسي",
      phone: "01012345678",
      salary: 15000,
      created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "e2",
      tenant_id: "t1",
      name: "عمرو حسن",
      email: "amr@company.com",
      role: "supervisor",
      branch: "فرع القاهرة - الرئيسي",
      phone: "01112345678",
      salary: 9500,
      created_at: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "e3",
      tenant_id: "t1",
      name: "سارة علي",
      email: "sara@company.com",
      role: "employee",
      branch: "فرع الإسكندرية",
      phone: "01212345678",
      salary: 6500,
      created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "e4",
      tenant_id: "t2",
      name: "كريم سعد",
      email: "karim@company.com",
      role: "employee",
      branch: "فرع الجيزة",
      phone: "01512345678",
      salary: 5800,
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    }
  ],
  products: [
    {
      id: "p1",
      tenant_id: "t1",
      barcode: "8806090123456",
      name: "شاشة سامسونج 55 بوصة Smart 4K",
      category: "إلكترونيات",
      unit_type: "piece",
      quantity: 12,
      price: 13500,
      branch: "فرع القاهرة - الرئيسي",
      created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "p2",
      tenant_id: "t1",
      barcode: "5397184123456",
      name: "لابتوب ديل Vostro Core i7 16GB",
      category: "إلكترونيات",
      unit_type: "piece",
      quantity: 4,
      price: 24000,
      branch: "فرع الإسكندرية",
      created_at: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "p3",
      tenant_id: "t1",
      barcode: "6221000123456",
      name: "بن قهوة اسبريسو برازيلي 1 كجم",
      category: "مشروبات وأغذية",
      unit_type: "weight",
      quantity: 24.5,
      price: 480,
      branch: "فرع القاهرة - الرئيسي",
      created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "p4",
      tenant_id: "t2",
      barcode: "6222000123456",
      name: "مياه معدنية نستله 1.5 لتر",
      category: "مشروبات وأغذية",
      unit_type: "piece",
      quantity: 150,
      price: 8,
      branch: "فرع الجيزة",
      created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "p5",
      tenant_id: "t1",
      barcode: "6974000123456",
      name: "ماوس لاسلكي Logitech M170",
      category: "إكسسوارات كمبيوتر",
      unit_type: "piece",
      quantity: 3,
      price: 380,
      branch: "فرع القاهرة - الرئيسي",
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    }
  ],
  sales: [
    {
      id: "s1",
      tenant_id: "t1",
      employee_name: "سارة علي",
      branch: "فرع القاهرة - الرئيسي",
      amount: 13500,
      product: "شاشة سامسونج 55 بوصة Smart 4K",
      notes: "فاتورة مبيعات نقدية",
      created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "s2",
      tenant_id: "t2",
      employee_name: "كريم سعد",
      branch: "فرع الجيزة",
      amount: 8000,
      product: "شاشة سامسونج 55 بوصة Smart 4K",
      notes: "عملية بيع POS كاش",
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "s3",
      tenant_id: "t1",
      employee_name: "سارة علي",
      branch: "فرع الإسكندرية",
      amount: 24380,
      product: "لابتوب ديل Vostro Core i7 16GB، ماوس لاسلكي Logitech M170",
      notes: "مبيعات للفرع بالفيزا",
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "s4",
      tenant_id: "t1",
      employee_name: "عمرو حسن",
      branch: "فرع القاهرة - الرئيسي",
      amount: 9600,
      product: "بن قهوة اسبريسو برازيلي 1 كجم (عدد 20)",
      notes: "",
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "s5",
      tenant_id: "t2",
      employee_name: "كريم سعد",
      branch: "فرع الجيزة",
      amount: 24000,
      product: "لابتوب ديل Vostro Core i7 16GB",
      notes: "دفع فيزا شحن مباشر",
      created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "s6",
      tenant_id: "t1",
      employee_name: "سارة علي",
      branch: "فرع القاهرة - الرئيسي",
      amount: 13880,
      product: "شاشة سامسونج 55 بوصة Smart 4K، ماوس لاسلكي Logitech M170",
      notes: "",
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "s7",
      tenant_id: "t1",
      employee_name: "سارة علي",
      branch: "فرع الإسكندرية",
      amount: 24000,
      product: "لابتوب ديل Vostro Core i7 16GB",
      notes: "",
      created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
    }
  ],
  attendance: [
    {id: "a1", tenant_id: "t1", employee_name: "منة أحمد", branch: "فرع القاهرة - الرئيسي", date: new Date().toISOString().split('T')[0], check_in: "08:50", check_out: "17:00", status: "present", notes: ""},
    {id: "a2", tenant_id: "t1", employee_name: "عمرو حسن", branch: "فرع القاهرة - الرئيسي", date: new Date().toISOString().split('T')[0], check_in: "08:55", check_out: "17:05", status: "present", notes: ""},
    {id: "a3", tenant_id: "t1", employee_name: "سارة علي", branch: "فرع الإسكندرية", date: new Date().toISOString().split('T')[0], check_in: "09:45", check_out: "17:00", status: "late", notes: "عطل بالمواصلات العامة"},
    {id: "a4", tenant_id: "t2", employee_name: "كريم سعد", branch: "فرع الجيزة", date: new Date().toISOString().split('T')[0], check_in: "", check_out: "", status: "absent", notes: "غياب بدون عذر مقبول"},
    {id: "a5", tenant_id: "t1", employee_name: "منة أحمد", branch: "فرع القاهرة - الرئيسي", date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0], check_in: "08:45", check_out: "17:00", status: "present", notes: ""},
    {id: "a6", tenant_id: "t1", employee_name: "عمرو حسن", branch: "فرع القاهرة - الرئيسي", date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0], check_in: "08:50", check_out: "17:00", status: "present", notes: ""},
    {id: "a7", tenant_id: "t1", employee_name: "سارة علي", branch: "فرع الإسكندرية", date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0], check_in: "09:00", check_out: "17:00", status: "present", notes: ""},
    {id: "a8", tenant_id: "t2", employee_name: "كريم سعد", branch: "فرع الجيزة", date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0], check_in: "08:55", check_out: "17:00", status: "present", notes: ""}
  ],
  inventory_movements: [
    { id: "im1", tenant_id: "t1", product_id: "p1", product_name: "شاشة سامسونج 55 بوصة Smart 4K", type: "inbound", quantity: 12, branch: "فرع القاهرة - الرئيسي", notes: "رصيد افتتاحي للمخزن", created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
    { id: "im2", tenant_id: "t1", product_id: "p2", product_name: "لابتوب ديل Vostro Core i7 16GB", type: "inbound", quantity: 4, branch: "فرع الإسكندرية", notes: "رصيد افتتاحي للمخزن", created_at: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString() },
    { id: "im3", tenant_id: "t1", product_id: "p3", product_name: "بن قهوة اسبريسو برازيلي 1 كجم", type: "inbound", quantity: 30, branch: "فرع القاهرة - الرئيسي", notes: "توريد من المورد الأساسي", created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString() },
    { id: "im4", tenant_id: "t1", product_id: "p3", product_name: "بن قهوة اسبريسو برازيلي 1 كجم", type: "outbound", quantity: 5.5, branch: "فرع القاهرة - الرئيسي", notes: "هالك / تالف بسبب سوء التخزين", created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() }
  ]
}

// Read/write from local storage helper
function getTableData(table: string): any[] {
  if (typeof window === 'undefined') return []
  const stored = localStorage.getItem(`mock_db_${table}`)
  if (stored) return JSON.parse(stored)
  
  const data = INITIAL_MOCK_DATA[table] || []
  localStorage.setItem(`mock_db_${table}`, JSON.stringify(data))
  return data
}

function setTableData(table: string, data: any[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(`mock_db_${table}`, JSON.stringify(data))
}

const isMockActive = () => {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('use_mock_data') === 'true'
}

// Get tenant ID dynamically based on active user or impersonation session
function getActiveTenantId(): string | null {
  if (typeof window === 'undefined') return null
  
  // 1. If impersonation is active, override with the impersonated company
  const impersonated = localStorage.getItem('impersonated_tenant_id')
  if (impersonated) return impersonated
  
  // 2. Otherwise get the logged-in user's company profile
  const userStr = localStorage.getItem('supabase_mock_user')
  if (!userStr) return null
  const user = JSON.parse(userStr)
  
  const profiles = getTableData('profiles')
  const profile = profiles.find(p => p.email === user.email)
  return profile ? profile.tenant_id : null
}

class MockQueryBuilder {
  private table: string
  private filters: ((item: any) => boolean)[] = []
  private orderCols: { column: string; ascending: boolean }[] = []
  private limitCount: number | null = null
  private action: 'select' | 'insert' | 'update' | 'delete' = 'select'
  private payload: any = null
  private isSingle = false
  private isCountOnly = false

  constructor(table: string) {
    this.table = table
  }

  select(columns?: string, options?: { count?: string; head?: boolean }) {
    if (this.action !== 'insert' && this.action !== 'update') {
      this.action = 'select'
    }
    if (options?.count === 'exact' && options?.head === true) {
      this.isCountOnly = true
    }
    return this
  }

  insert(payload: any) {
    this.action = 'insert'
    this.payload = payload
    return this
  }

  update(payload: any) {
    this.action = 'update'
    this.payload = payload
    return this
  }

  delete() {
    this.action = 'delete'
    return this
  }

  eq(column: string, value: any) {
    this.filters.push(item => item[column] === value)
    return this
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderCols.push({
      column,
      ascending: options?.ascending !== false
    })
    return this
  }

  limit(count: number) {
    this.limitCount = count
    return this
  }

  single() {
    this.isSingle = true
    return this
  }

  async then(onfulfilled?: (value: any) => any) {
    const data = getTableData(this.table)
    let result: any = { data: null, error: null }

    if (this.action === 'select') {
      let filtered = [...data]
      
      // Auto-filter tenant-specific data
      const tenantSpecificTables = ['branches', 'employees', 'products', 'sales', 'attendance', 'inventory_movements']
      if (tenantSpecificTables.includes(this.table)) {
        const activeTenantId = getActiveTenantId()
        if (activeTenantId) {
          filtered = filtered.filter(item => item.tenant_id === activeTenantId)
        }
      }

      // Aggregate company stats dynamically for the super admin list
      if (this.table === 'tenants') {
        const allEmployees = getTableData('employees')
        const allSales = getTableData('sales')
        filtered = filtered.map(tenant => {
          const empCount = allEmployees.filter(e => e.tenant_id === tenant.id).length
          const salesVol = allSales.filter(s => s.tenant_id === tenant.id).reduce((sum, s) => sum + (s.amount || 0), 0)
          return {
            ...tenant,
            employee_count: empCount,
            sales_volume: salesVol
          }
        })
      }

      // Apply query filters (.eq, etc.)
      for (const filter of this.filters) {
        filtered = filtered.filter(filter)
      }

      // Apply multi-column ordering
      if (this.orderCols.length > 0) {
        filtered.sort((a, b) => {
          for (const ord of this.orderCols) {
            const valA = a[ord.column]
            const valB = b[ord.column]
            if (valA < valB) return ord.ascending ? -1 : 1
            if (valA > valB) return ord.ascending ? 1 : -1
          }
          return 0
        })
      }

      if (this.limitCount !== null) {
        filtered = filtered.slice(0, this.limitCount)
      }

      if (this.isCountOnly) {
        result = { count: filtered.length, data: null, error: null }
      } else if (this.isSingle) {
        result = { data: filtered[0] || null, error: null }
      } else {
        result = { data: filtered, error: null }
      }
    } 
    
    else if (this.action === 'insert') {
      const payloads = Array.isArray(this.payload) ? this.payload : [this.payload]
      const inserted: any[] = []
      const updatedList = [...data]
      const activeTenantId = getActiveTenantId()

      for (const p of payloads) {
        const item = {
          id: p.id || 'id-' + Math.random().toString(36).substr(2, 9),
          tenant_id: p.tenant_id || activeTenantId, // Auto-assign current tenant
          created_at: new Date().toISOString(),
          ...p
        }
        updatedList.push(item)
        inserted.push(item)
      }

      setTableData(this.table, updatedList)
      result = { data: this.isSingle ? inserted[0] : inserted, error: null }
    } 
    
    else if (this.action === 'update') {
      const updatedList = data.map(item => {
        let matches = true
        for (const filter of this.filters) {
          if (!filter(item)) matches = false
        }
        if (matches) {
          return { ...item, ...this.payload }
        }
        return item
      })

      setTableData(this.table, updatedList)
      
      const affected = updatedList.filter(item => {
        let matches = true
        for (const filter of this.filters) {
          if (!filter(item)) matches = false
        }
        return matches
      })
      result = { data: this.isSingle ? affected[0] : affected, error: null }
    } 
    
    else if (this.action === 'delete') {
      const remaining = data.filter(item => {
        let matches = true
        for (const filter of this.filters) {
          if (!filter(item)) matches = false
        }
        return !matches
      })

      setTableData(this.table, remaining)
      result = { data: null, error: null }
    }

    if (onfulfilled) {
      return onfulfilled(result)
    }
    return result
  }
}

const mockAuth = {
  async signInWithPassword({ email, password }: any) {
    if (typeof window !== 'undefined') {
      let matchingProfile = getTableData('profiles').find(p => p.email === email)
      
      // Auto-register new demo accounts as company admins for seamless testing
      if (!matchingProfile) {
        const tenantId = 't_new_' + Math.random().toString(36).substr(2, 5)
        const newTenant = {
          id: tenantId,
          name: `شركة ${email.split('@')[0]} التجريبية`,
          owner_email: email,
          status: 'active',
          created_at: new Date().toISOString()
        }
        const newProfile = {
          id: 'u_' + Math.random().toString(36).substr(2, 9),
          email: email,
          tenant_id: tenantId,
          role: 'admin',
          password: password
        }
        
        const tenants = getTableData('tenants')
        tenants.push(newTenant)
        setTableData('tenants', tenants)
        
        const profiles = getTableData('profiles')
        profiles.push(newProfile)
        setTableData('profiles', profiles)
        
        matchingProfile = newProfile
      } else {
        // Validate password
        const savedPassword = matchingProfile.password || 'demo'
        if (savedPassword !== password) {
          return { data: { user: null, session: null }, error: { message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' } }
        }
      }

      const mockUser = { id: matchingProfile.id, email: email }
      const mockSession = { access_token: 'mock-session-token', user: mockUser }
      
      localStorage.setItem('supabase_mock_user', JSON.stringify(mockUser))
      localStorage.setItem('use_mock_data', 'true')
      localStorage.removeItem('impersonated_tenant_id') // Clear any previous impersonation session
      
      return { data: { user: mockUser, session: mockSession }, error: null }
    }
    return { data: { user: null, session: null }, error: { message: 'Window object unavailable' } }
  },

  async signUp({ email }: any) {
    return await this.signInWithPassword({ email, password: 'demo' })
  },

  async getUser() {
    if (typeof window === 'undefined') {
      return { data: { user: null }, error: null }
    }
    const userStr = localStorage.getItem('supabase_mock_user')
    if (userStr) {
      return { data: { user: JSON.parse(userStr) }, error: null }
    }
    return { data: { user: null }, error: null }
  },

  async signOut() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('supabase_mock_user')
      localStorage.removeItem('use_mock_data')
      localStorage.removeItem('impersonated_tenant_id')
    }
    return { error: null }
  }
}

// Generic Proxy query wrapper for handling error-catches and chaining support natively
function createFallbackProxy(realQuery: any, table: string): any {
  return new Proxy(realQuery, {
    get(target, prop) {
      if (prop === 'then') {
        return async function(onfulfilled?: any, onrejected?: any) {
          try {
            const res = await realQuery
            if (res.error) throw res.error
            if (onfulfilled) return onfulfilled(res)
            return res
          } catch (err) {
            console.warn(`Supabase network error on table "${table}", falling back to mock database:`, err)
            if (typeof window !== 'undefined') {
              localStorage.setItem('use_mock_data', 'true')
            }
            // Execute fallback query on Mock builder
            const mockRes = await new MockQueryBuilder(table).select()
            if (onfulfilled) return onfulfilled(mockRes)
            return mockRes
          }
        }
      }
      
      const val = target[prop]
      if (typeof val === 'function') {
        return function(...args: any[]) {
          const nextResult = val.apply(target, args)
          if (nextResult && (typeof nextResult === 'object' || typeof nextResult === 'function')) {
            return createFallbackProxy(nextResult, table)
          }
          return nextResult
        }
      }
      return val
    }
  })
}

export const supabase = {
  auth: {
    async signInWithPassword(args: any) {
      try {
        if (args.email?.includes('admin') || args.email?.includes('demo') || args.email?.includes('super')) {
          return await mockAuth.signInWithPassword(args)
        }
        const res = await realSupabase.auth.signInWithPassword(args)
        if (res.error) throw res.error
        return res
      } catch (e) {
        return await mockAuth.signInWithPassword(args)
      }
    },
    async signUp(args: any) {
      try {
        if (args.email?.includes('admin') || args.email?.includes('demo')) {
          return await mockAuth.signUp(args)
        }
        const res = await realSupabase.auth.signUp(args)
        if (res.error) throw res.error
        return res
      } catch (e) {
        return await mockAuth.signUp(args)
      }
    },
    async getUser() {
      if (isMockActive()) return await mockAuth.getUser()
      try {
        const res = await realSupabase.auth.getUser()
        if (res.error) throw res.error
        return res
      } catch (e) {
        return await mockAuth.getUser()
      }
    },
    async signOut() {
      const res = await realSupabase.auth.signOut().catch(() => ({ error: null }))
      await mockAuth.signOut()
      return res
    }
  },
  from(table: string): any {
    if (isMockActive()) {
      return new MockQueryBuilder(table)
    }
    return createFallbackProxy(realSupabase.from(table), table)
  }
}
