import { NextResponse } from "next/server"
import { sources } from "@/lib/agent/sources"
import { verifyAdminRequest } from "@/lib/auth/verifyAdminRequest"

export const runtime = "nodejs"
export const maxDuration = 300

/*
 * ~29 yrityslähdettä käydään läpi peräkkäin yhdessä palvelinkutsussa, ja
 * havaittu käytännössä ehtii käsitellä vain n. 17-18 kappaletta ennen kuin
 * kutsu jostain syystä katkeaa — jos taulukon järjestys olisi aina sama,
 * viimeiset lähteet eivät koskaan pääsisi vuoroon. Kierrättämällä
 * aloituskohtaa päivän mukaan jokainen lähde ehtii käsittelyyn muutaman
 * päivän sisällä riippumatta siitä missä todellinen aikaraja menee.
 */
function rotateSourcesForToday<T>(list: T[]): T[] {
  if (list.length === 0) return list
  const dayIndex = Math.floor(Date.now() / 86400000)
  const step = Math.ceil(list.length / 2)
  const offset = (dayIndex * step) % list.length
  return [...list.slice(offset), ...list.slice(0, offset)]
}

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const allCandidates: any[] = []
  const sourceStatus: any[] = []

  for (const source of rotateSourcesForToday(sources)) {
    try {
      console.log(`RUNNING SOURCE: ${source.name}`)

      const candidates = await source.fetch()

      console.log(`SOURCE OK: ${source.name} (${candidates?.length ?? 0})`)

      allCandidates.push(...(candidates || []))
      sourceStatus.push({
        source: source.name,
        ok: true,
        count: candidates?.length ?? 0,
      })
    } catch (err: any) {
      console.error(`SOURCE FAILED: ${source.name}`, err)

      sourceStatus.push({
        source: source.name,
        ok: false,
        error: err?.message || String(err),
      })
    }
  }

  return NextResponse.json({
    ok: true,
    count: allCandidates.length,
    candidates: allCandidates,
    source_status: sourceStatus,
  })
}