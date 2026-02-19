import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Jos cookie puuttuu/vanhentunut, getUser voi palauttaa error -> käsitellään turvallisesti
  const { data, error } = await supabase.auth.getUser()
  const user = error ? null : data.user

  const pathname = request.nextUrl.pathname

  // Suojataan nämä reitit
  const isProtected =
    pathname.startsWith('/dashboard') || pathname.startsWith('/projects')

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  return response
}

// ✅ TÄRKEÄ: ota mukaan myös pelkkä "/dashboard" ja "/projects"
export const config = {
  matcher: ['/dashboard', '/dashboard/:path*', '/projects', '/projects/:path*'],
}