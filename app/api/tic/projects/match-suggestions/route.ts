import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyAdminRequest } from "@/lib/auth/verifyAdminRequest"
import { findProjectMatchDetailed, calculateMatch } from "@/lib/agent/projectMatcher"
import { streetKey } from "@/lib/projects/streetKey"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const runtime = "nodejs"
export const maxDuration = 60

/*
 * Ehdottaa olemassa olevia hankkeita joihin ehdokas voisi kuulua.
 *
 * Tausta: automaattinen yhdistäminen vaatii luottamuksen 70. Sen alle jäävät
 * osumat ovat juuri niitä joissa ihmisen silmä on tarpeen - esimerkiksi uutinen
 * "Bravida nappasi 200 miljoonan datakeskusurakan" ja hanke "FIN04A Datakeskus"
 * ovat sama kohde, vaikka otsikot eivät muistuta toisiaan (osuma 56: sama
 * kaupunki, maakunta, rakennuttaja ja rakennustyyppi). Aiemmin sellainen
 * ehdokas voitiin vain hyväksyä uutena hankkeena tai hylätä.
 *
 * Kynnys on tässä matala tarkoituksella: lista on ihmiselle katsottavaksi,
 * ei automaattista toimintaa varten.
 */
const SUGGESTION_THRESHOLD = 30
const MAX_SUGGESTIONS = 5

/* Saman katuosoitteen osumat erikseen, jotteivät ne syrjäytä pisteytettyjä. */
const MAX_STREET_SUGGESTIONS = 3

export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  try {
    const body = await request.json()
    const potentialProjectId = body.potentialProjectId

    if (!potentialProjectId) {
      return NextResponse.json(
        { ok: false, error: "Missing potentialProjectId" },
        { status: 400 }
      )
    }

    const { data: candidate, error: candidateError } = await supabaseAdmin
      .from("potential_projects")
      .select("*")
      .eq("id", potentialProjectId)
      .maybeSingle()

    if (candidateError) throw candidateError
    if (!candidate) {
      return NextResponse.json(
        { ok: false, error: "Potential project not found" },
        { status: 404 }
      )
    }

    const metadata = candidate.metadata ?? {}

    /*
     * Sivutus: PostgREST palauttaa enintään 1000 riviä ilman sitä, jolloin
     * ehdotukset katsoisivat vain neljäsosaa hankekannasta.
     */
    const projects: any[] = []
    const PAGE = 1000

    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabaseAdmin
        .from("projects")
        .select(
          "id,name,city,region,location,phase,status,completed_at,developer,builder,property_type,metadata"
        )
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1)

      if (error) throw error
      if (!data?.length) break

      projects.push(...data)
      if (data.length < PAGE) break
    }

    const normalized = {
      name: metadata.operation ?? candidate.title ?? null,
      sourceTitle: (metadata.source_title as string | null) ?? null,
      city: candidate.municipality ?? metadata.city ?? null,
      region: metadata.region ?? null,
      location: candidate.address ?? metadata.project_address ?? null,
      permitNumber: candidate.permit_number ?? null,
      propertyId: candidate.property_id ?? null,
      developer: metadata.developer ?? null,
      buildingType: metadata.building_type ?? null,
      description: metadata.description ?? null,
    }

    const scored = projects
      .map((project) => ({ project, match: calculateMatch(project, normalized as any) }))
      .filter((row) => row.match && row.match.confidence >= SUGGESTION_THRESHOLD)
      .sort((a, b) => (b.match!.confidence ?? 0) - (a.match!.confidence ?? 0))
      .slice(0, MAX_SUGGESTIONS)

    /*
     * SAMA KATUOSOITE ON EHDOTUS, VAIKKA TÄSMÄYTYS EI ANNA PISTEITÄ.
     *
     * calculateMatch vertaa osoitteita merkkijonona, joten sama rakennus eri
     * kirjoitusasussa ei tuota mitään. Mitattu tapaus 21.8.2026:
     *
     *   ehdokas "Osoite Hiihtomäentie 23, 00800 Helsinki"  (Hilma)
     *   hanke   "Hiihtomäentie 23, Helsinki"               (Helsingin päätökset)
     *
     * Sama Herttoniemen kirkon purku kahdesta lähteestä. calculateMatch
     * palautti null, joten ehdotusta ei syntynyt — eikä pari olisi löytynyt
     * duplikaattiskannauksestakaan, joka vaatii vähintään 70.
     *
     * Katuavain EI mene calculateMatchiin eikä siten automaattiseen
     * yhdistämiseen: samalla osoitteella on aidosti eri hankkeita (D-090).
     * Tässä listassa väärä ehdotus maksaa yhden silmäyksen, joten kattavuus
     * on oikea valinta. Sama kaupunki vaaditaan, koska kadunnimet toistuvat
     * kunnasta toiseen ("Koulukatu 15").
     */
    const candidateStreetKey = streetKey(normalized.location)
    const candidateCityKey = String(normalized.city ?? "").trim().toLowerCase()
    const scoredIds = new Set(scored.map((row) => row.project.id))

    const streetMatches =
      candidateStreetKey && candidateCityKey
        ? projects
            .filter(
              (project) =>
                !scoredIds.has(project.id) &&
                String(project.city ?? "").trim().toLowerCase() === candidateCityKey &&
                streetKey(project.location) === candidateStreetKey
            )
            .slice(0, MAX_STREET_SUGGESTIONS)
            .map((project) => ({
              project,
              match: calculateMatch(project, normalized as any),
            }))
        : []

    const best = findProjectMatchDetailed(projects, normalized as any)

    /*
     * Vapaa haku ja kaupunkiperäinen varalista.
     *
     * calculateMatch hylkää tarkoituksella osuman jossa ainoa todiste on sama
     * kaupunki - muuten kaikki saman kaupungin hankkeet yhdistyisivät
     * toisiinsa. Se on oikein automaattiselle yhdistämiselle, mutta ehdotus-
     * lista nojasi samaan funktioon, joten se ei näyttänyt mitään juuri
     * silloin kun ihmistä eniten tarvitaan: uutisotsikko ei muistuta hankkeen
     * nimeä eikä muita kenttiä ole täytetty.
     *
     * Mitattu tapaus: "Datakeskuksen Kouvolaan - tilaajalle jo neljäs kohde
     * Suomessa" ja hanke "FIN04A Datakeskus" (Kouvola) ovat sama kohde, mutta
     * yhteistä on vain kaupunki ja maakunta.
     *
     * Nämä eivät ole osumia vaan selattavaa: ihminen päättää.
     */
    const suggestedIds = new Set([
      ...scored.map((row) => row.project.id),
      ...streetMatches.map((row) => row.project.id),
    ])
    const query = String(body.query ?? "").trim().toLowerCase()

    /*
     * SELAUSLISTA ON JÄRJESTETTÄVÄ, EI VAIN RAJATTAVA.
     *
     * Lista otti aiemmin 25 ensimmäistä siinä järjestyksessä kuin rivit
     * tulivat kannasta (id-järjestys). Mitattu 21.8.2026: Helsingissä on
     * 1 044 hanketta ja etsitty hanke oli sijalla 93 — se ei siis voinut
     * näkyä lainkaan. Isossa kaupungissa järjestämätön lista on sama kuin
     * tyhjä lista.
     *
     * Järjestys on karkea tarkoituksella: tämä on selattavaa, ei osumia.
     */
    const candidateWords = new Set(
      String(normalized.name ?? "")
        .toLowerCase()
        .split(/[^a-zåäö0-9]+/)
        .filter((word) => word.length >= 5)
    )

    const browseRank = (project: any): number => {
      let rank = 0

      if (candidateStreetKey && streetKey(project.location) === candidateStreetKey) {
        rank += 100
      }

      const projectWords = String(project.name ?? "")
        .toLowerCase()
        .split(/[^a-zåäö0-9]+/)
        .filter((word) => word.length >= 5)

      for (const word of new Set(projectWords)) {
        if (candidateWords.has(word)) rank += 10
      }

      return rank
    }

    const browse = projects
      .filter((project) => {
        if (suggestedIds.has(project.id)) return false

        if (query) {
          return [project.name, project.city, project.developer, project.builder]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query))
        }

        // Ilman hakusanaa tarjotaan saman kaupungin hankkeet.
        const city = normalized.city
        return (
          !!city &&
          String(project.city ?? "").toLowerCase() === String(city).toLowerCase()
        )
      })
      .map((project) => ({ project, rank: browseRank(project) }))
      .sort((a, b) => b.rank - a.rank)
      .map((row) => row.project)
      .slice(0, 25)
      .map((project) => ({
        projectId: project.id,
        name: project.name,
        city: project.city,
        region: project.region,
        phase: project.phase,
        status: project.status,
        developer: project.developer,
        builder: project.builder,
        confidence: calculateMatch(project, normalized as any)?.confidence ?? null,
        reasons: calculateMatch(project, normalized as any)?.reasons ?? [],
      }))

    return NextResponse.json({
      ok: true,
      /*
       * autoMergeThreshold kertoo käyttöliittymälle mistä raja menee, jotta
       * se voi näyttää selvästi kumpi tapaus on kyseessä: automaattisesti
       * yhdistyvä vai ihmisen päätöstä vaativa.
       */
      autoMergeThreshold: 70,
      bestConfidence: best?.confidence ?? null,
      /*
       * browse on selattava lista, ei osumia: joko hakusanan tulokset tai
       * saman kaupungin hankkeet. Käyttöliittymä erottaa nämä ehdotuksista.
       */
      browse,
      browseLabel: query
        ? `Hakutulokset: "${query}"`
        : normalized.city
          ? `Muut hankkeet kaupungissa ${normalized.city}`
          : null,
      /*
       * Katuosoiteosumat tulevat pisteytettyjen perään omalla perusteellaan.
       * Niillä ei välttämättä ole pistemäärää lainkaan (calculateMatch voi
       * palauttaa null), mikä on tarkoitus: ne eivät ole täsmäytyksen osumia
       * vaan ihmiselle näytettävä havainto samasta osoitteesta.
       */
      suggestions: [
        ...scored.map(({ project, match }) => ({
          projectId: project.id,
          name: project.name,
          city: project.city,
          region: project.region,
          phase: project.phase,
          status: project.status,
          developer: project.developer,
          builder: project.builder,
          confidence: match!.confidence,
          reasons: match!.reasons,
        })),
        ...streetMatches.map(({ project, match }) => ({
          projectId: project.id,
          name: project.name,
          city: project.city,
          region: project.region,
          phase: project.phase,
          status: project.status,
          developer: project.developer,
          builder: project.builder,
          confidence: match?.confidence ?? null,
          reasons: ["same_street_address", ...(match?.reasons ?? [])],
        })),
      ],
    })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
