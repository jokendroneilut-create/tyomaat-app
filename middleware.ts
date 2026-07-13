import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

function parseAdminEmails(value: string | undefined) {
  return (value || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

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

  const { data, error } = await supabase.auth.getUser()
  const user = error ? null : data.user

  const pathname = request.nextUrl.pathname

  const isDashboard = pathname.startsWith("/dashboard")
  const isProjects = pathname.startsWith("/projects")
  const isToday = pathname.startsWith("/today")
  const isTic = pathname.startsWith("/tic")

  const isProtected = isDashboard || isProjects || isToday || isTic

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  if (isDashboard || isTic) {
    const admins = parseAdminEmails(process.env.ADMIN_EMAILS)
    const userEmail = (user?.email || "").toLowerCase()

    if (!admins.includes(userEmail)) {
      const url = request.nextUrl.clone()
      url.pathname = "/projects"
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/projects",
    "/projects/:path*",
    "/today",
    "/today/:path*",
    "/tic",
    "/tic/:path*",
  ],
}