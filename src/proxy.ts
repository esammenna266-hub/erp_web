import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only protect /dashboard routes
  if (!pathname.startsWith('/dashboard')) {
    return NextResponse.next()
  }

  // Build a response we can attach cookies to
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  // Create a Supabase server client that reads/writes cookies on this request/response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() validates the JWT on the server - safe from cookie tampering
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Temporarily bypassed for testing to avoid Supabase Free-Tier Rate limits
  /*
  if (!user) {
    // Not authenticated → redirect to login page
    const loginUrl = new URL('/', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }
  */

  return response
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
