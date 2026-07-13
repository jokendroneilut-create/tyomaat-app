import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

function parseAdminEmails(value: string | undefined) {
  return (value || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export type AdminAuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

/*
 * Yhteinen tunnistautumistarkistus TIC:n admin-API-reiteille. Hyväksyy
 * joko (a) CRON_SECRET-bearer-tokenin (palvelin-palvelin-kutsut, esim.
 * yöllinen cron tai käsin ajettu debug-kutsu), tai (b) kirjautuneen
 * admin-käyttäjän session-evästeen (selaimesta tulevat kutsut /tic-
 * sivuilta, jotka ovat jo middlewaren suojaamia — eväste kulkee
 * automaattisesti mukana fetch-kutsussa, ei vaadi muutoksia
 * kutsuvaan koodiin).
 */
export async function verifyAdminRequest(
  request: Request
): Promise<AdminAuthResult> {
  const authHeader = request.headers.get("authorization")

  if (
    authHeader &&
    process.env.CRON_SECRET &&
    authHeader === `Bearer ${process.env.CRON_SECRET}`
  ) {
    return { ok: true }
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {
          // Route handlerissa ei tarvitse päivittää evästeitä —
          // middleware hoitaa session-refreshin ennen tänne tuloa.
        },
      },
    }
  )

  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    return { ok: false, status: 401, error: "unauthorized" }
  }

  const admins = parseAdminEmails(process.env.ADMIN_EMAILS)

  if (!admins.includes((data.user.email || "").toLowerCase())) {
    return { ok: false, status: 403, error: "forbidden" }
  }

  return { ok: true }
}
