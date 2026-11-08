import {
  katselmointiMetadata,
  paatteleKaavanKatselmointi,
  type KaavanKatselmointi,
} from "./kaavanKatselmointi"

/*
 * KAAVOITUSVAIHEEN RIVIEN TARKISTUS YHTENÄ AJONA (D-396).
 *
 * Sama funktio ajetaan vuorokausiajossa
 * (`/api/admin/advance-effective-zoning`) ja takautuvassa ajossa
 * (`scripts/nosta-kaavojen-lopputilat.ts`), jottei sääntö ehdi eriytyä
 * kahdeksi kopioksi ([[anchor-vocabulary-per-source]] kohta 4).
 *
 * LUKEE VAIN TARVITTAVAT JSON-AVAIMET, ei koko `raw_payload`ia eikä
 * `metadata`a: koko sarakkeen lukeminen 3 000 rivistä on kymmeniä
 * megatavuja ([[metadata-column-is-the-cost]]).
 */

export type NostoTulos = {
  kaavoitusvaiheessa: number
  nostettu: number
  vaihePaivitetty: number
  ilmanDokumenttia: number
  /* Kuivaharjoituksessa koko lista, muuten enintään 50 esimerkkiä. */
  rivit: {
    id: string
    nimi: string
    toiminto: KaavanKatselmointi["toiminto"]
    tila?: string
    paiva?: string | null
    todiste?: string
    vaihe?: string
  }[]
  virheet: { id: string; error: string }[]
}

type Hanke = {
  id: string
  name: string | null
  phase: string | null
  needs_review?: boolean | null
  metadata?: Record<string, any> | null
}

export async function nostaLopputilat(
  supabase: any,
  hankkeet: Hanke[],
  dryRun: boolean,
  nyt: Date = new Date()
): Promise<NostoTulos> {
  const osoitteet = new Set<string>()
  for (const h of hankkeet) {
    const md: any = h.metadata ?? {}
    if (md.source_url) osoitteet.add(String(md.source_url))
    if (md.documents_url) osoitteet.add(String(md.documents_url))
  }

  /* Dokumentit kerralla, vain vaihekentät. */
  const dokumentit = new Map<string, { vaihe: string | null }>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("source_documents")
      .select("document_url,vaihe:raw_payload->phase,tila:raw_payload->decision_status")
      .range(from, from + 999)
    if (error) throw error
    for (const d of data ?? []) {
      const url = String((d as any).document_url)
      if (!osoitteet.has(url)) continue
      dokumentit.set(url, { vaihe: ((d as any).vaihe ?? (d as any).tila ?? null) as string | null })
    }
    if (!data || data.length < 1000) break
  }

  const tulos: NostoTulos = {
    kaavoitusvaiheessa: hankkeet.length,
    nostettu: 0,
    vaihePaivitetty: 0,
    ilmanDokumenttia: 0,
    rivit: [],
    virheet: [],
  }

  for (const h of hankkeet) {
    const md: any = h.metadata ?? {}
    const dokumentti =
      dokumentit.get(String(md.documents_url ?? "")) ??
      dokumentit.get(String(md.source_url ?? "")) ??
      null
    if (!dokumentti) {
      tulos.ilmanDokumenttia += 1
      continue
    }

    const paatos = paatteleKaavanKatselmointi(
      {
        phase: h.phase,
        needsReview: h.needs_review ?? false,
        decisionStatus: md.decision_status ?? null,
      },
      dokumentti
    )
    if (paatos.toiminto === "ei_mitaan") continue

    const lopputila = paatos.toiminto === "nosta" ? paatos.lopputila : null
    if (paatos.toiminto === "nosta") tulos.nostettu += 1
    else tulos.vaihePaivitetty += 1

    if (tulos.rivit.length < (dryRun ? 500 : 50)) {
      tulos.rivit.push({
        id: h.id,
        nimi: String(h.name ?? ""),
        toiminto: paatos.toiminto,
        ...(lopputila
          ? { tila: lopputila.tila, paiva: lopputila.paiva, todiste: lopputila.todiste }
          : { vaihe: paatos.uusiVaihe }),
      })
    }

    if (dryRun) continue

    const paivitys: Record<string, any> = {
      metadata: katselmointiMetadata(md, paatos.uusiVaihe, lopputila, nyt),
    }
    /*
     * `needs_review` nousee vain nostossa. Vaiheen päivitys ei saa
     * merkitä riviä tarkistettavaksi, tai merkki menettää merkityksensä.
     */
    if (paatos.toiminto === "nosta") paivitys.needs_review = true

    const { error } = await supabase.from("projects").update(paivitys).eq("id", h.id)
    if (error) tulos.virheet.push({ id: h.id, error: error.message })
  }

  return tulos
}
