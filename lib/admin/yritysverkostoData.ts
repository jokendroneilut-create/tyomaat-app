import { createClient } from "@supabase/supabase-js"

import {
  kokoaYritykset,
  type ProjektinTiedot,
  type RekisteriRivi,
  type VerkostoHanke,
  type VerkostoYritys,
} from "@/lib/metrics/yritysverkosto"

/*
 * YRITYSVERKOSTON LUKU ADMIN-NAKYMALLE (D-253).
 *
 * VAIN PALVELIMELLA JA VAIN ADMININ TARKISTUKSEN JALKEEN. Taulu
 * `yritys_yhteyshenkilot` on suljettu anon- ja authenticated-rooleilta,
 * joten se luetaan service-rolella — kutsuja vastaa siita etta
 * kayttaja on admin (ks. `lib/auth/onAdmin.ts`).
 *
 * KOKO KANTA KERRAN, MUISTISSA 10 MIN. Hankkeita on ~6 600, ja
 * yrityksen kokoaminen vaatii ne kaikki (yritys voi olla osapuolena
 * missa tahansa). Mitattu 8.10.2026: roolikentat ~2,5 s ja
 * yhteyshenkilot ~2,4 s, rinnakkain. Sivutus 1 000 rivin paloissa,
 * koska PostgREST palauttaa enintaan sen verran kerralla.
 *
 * Valimuisti on prosessikohtainen eika jaettu: yhden hengen
 * admin-kayttoon riittaa, ja tieto vanhenee korkeintaan 10 minuuttia.
 */

const SIVU = 1000
const PALA = 100
const ELINIKA_MS = 10 * 60 * 1000

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function haeSivuittain<T>(
  hae: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rivit: T[] = []
  for (let from = 0; ; from += SIVU) {
    const { data, error } = await hae(from, from + SIVU - 1)
    if (error) throw new Error(error.message)
    rivit.push(...(data ?? []))
    if (!data || data.length < SIVU) break
  }
  return rivit
}

async function lataa(): Promise<Map<string, VerkostoYritys>> {
  const db = admin()

  const [roolit, yhteyshenkilot, rekisteri] = await Promise.all([
    haeSivuittain<VerkostoHanke>((from, to) =>
      db
        .from("projects")
        .select(
          "id, developer, builder, related_companies:metadata->related_companies, aliurakoitsijat:metadata->aliurakoitsijat"
        )
        .order("id")
        .range(from, to)
    ),
    haeSivuittain<{ id: string; contact_persons: unknown }>((from, to) =>
      db
        .from("projects")
        .select("id, contact_persons:metadata->contact_persons")
        .not("metadata->contact_persons", "is", null)
        .order("id")
        .range(from, to)
    ),
    haeSivuittain<RekisteriRivi>((from, to) =>
      db
        .from("yritys_yhteyshenkilot")
        .select("avain, yritys, nimi, nimike, email, puhelin, lahde")
        .order("id")
        .range(from, to)
    ),
  ])

  const kontaktit = new Map(yhteyshenkilot.map((r) => [String(r.id), r.contact_persons]))
  const hankkeet = roolit.map((h) => ({ ...h, contact_persons: kontaktit.get(String(h.id)) }))

  return kokoaYritykset(hankkeet, rekisteri)
}

let valimuisti: { aika: number; lupaus: Promise<Map<string, VerkostoYritys>> } | null = null

export function haeYritysverkosto(): Promise<Map<string, VerkostoYritys>> {
  if (valimuisti && Date.now() - valimuisti.aika < ELINIKA_MS) return valimuisti.lupaus

  const lupaus = lataa()
  valimuisti = { aika: Date.now(), lupaus }
  /* Epaonnistunut haku ei saa jaada muistiin kymmeneksi minuutiksi. */
  lupaus.catch(() => {
    if (valimuisti?.lupaus === lupaus) valimuisti = null
  })
  return lupaus
}

/* Hankkeiden nayttotiedot id:n mukaan; .in() paloissa (~100). */
export async function haeProjektienTiedot(ids: string[]): Promise<Map<string, ProjektinTiedot>> {
  const db = admin()
  const uniikit = [...new Set(ids)]
  const tulos = new Map<string, ProjektinTiedot>()

  const palat: string[][] = []
  for (let i = 0; i < uniikit.length; i += PALA) palat.push(uniikit.slice(i, i + PALA))

  const vastaukset = await Promise.all(
    palat.map((pala) =>
      db
        .from("projects")
        .select("id, name, city, phase, status, is_public, estimated_completion")
        .in("id", pala)
    )
  )
  for (const { data, error } of vastaukset) {
    if (error) throw new Error(error.message)
    for (const r of data ?? []) tulos.set(String(r.id), r as ProjektinTiedot)
  }
  return tulos
}
