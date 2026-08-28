import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

import { parseAdminEmails, resolveRole } from "@/lib/auth/roles"

/* Ainoa dashboard-polku jolle myyja paasee. */
const SELLER_PATH = "/dashboard/users"

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
  const isOhjeet = pathname.startsWith("/ohjeet")

  /*
   * Ohjeet vaatii kirjautumisen: sivu kertoo mitä lähteitä ja logiikkaa
   * palvelu käyttää. Pelkkä matcher-lista ei suojaa mitään — polku on
   * lisättävä myös tähän ehtoon, muuten middleware ajaa mutta päästää läpi.
   */
  const isProtected = isDashboard || isProjects || isToday || isTic || isOhjeet

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  if (isDashboard || isTic) {
    const admins = parseAdminEmails(process.env.ADMIN_EMAILS)
    const userEmail = (user?.email || "").toLowerCase()

    /*
     * Rooli kysytään vain jos ympäristömuuttuja ei jo riitä. Näin
     * adminin polulle ei tule ylimääräistä kyselyä, ja tänne asti
     * päätyvät vain ne jotka olisi muutenkin ohjattu pois.
     */
    let dbRole: string | null = null

    if (user && !admins.includes(userEmail)) {
      const { data: rooli } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle()

      dbRole = rooli?.role ?? null
    }

    const role = resolveRole({ email: userEmail, dbRole, adminEmails: admins })

    /*
     * Myyjä pääsee VAIN omaan asiakaslistaansa. Muu dashboard ja koko
     * TIC ovat adminin. Polku vertaillaan tarkasti, jottei
     * /dashboard/users-alkuinen alipolku avaudu vahingossa.
     */
    const sallittu = role === "admin" || (role === "seller" && pathname === SELLER_PATH)

    if (!sallittu) {
      // Ei-admin ohjataan asiakaskotiin. Aiemmin /projects (vanha koti);
      // nyt /today on asiakasnäkymän etusivu.
      const url = request.nextUrl.clone()
      url.pathname = "/today"
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
    "/ohjeet",
    "/tic",
    "/tic/:path*",
  ],
}