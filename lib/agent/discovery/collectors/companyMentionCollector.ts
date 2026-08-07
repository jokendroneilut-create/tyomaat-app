import * as cheerio from "cheerio"
import { createClient } from "@supabase/supabase-js"
import { findProjectMatchDetailed } from "@/lib/agent/projectMatcher"
import { loadProjectsForMatching } from "@/lib/agent/importCandidate"
import { mergeCompanyNames } from "@/lib/projects/projectCompanies"
import { detectCityFromText } from "@/lib/agent/detectCityFromText"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/*
 * Rikastuslähde: yritys tiedottaa siitä missä hankkeissa se on mukana, ei
 * omista hankkeistaan.
 *
 * Rajukiven sivuilla lukee esimerkiksi "Rajukivi Oy vastaa alueen
 * Melkinlaiturin katu-urakan (RU3) toteutuksesta". Melkinlaituri on jo
 * kannassa omana hankkeenaan, joten uuden ehdokkaan luominen tuottaa
 * kaksoiskappaleen - mitattuna 48 ehdokasta, joista 48 hylättiin eikä
 * yhtään hyväksyttiin. Samaan aikaan tieto jota lähde oikeasti tarjoaa jäi
 * saamatta: Rajukivi ei ollut urakoitsijana eikä liittyvänä yrityksenä
 * yhdelläkään hankkeella.
 *
 * Tämä kerääjä ei siis luo ehdokkaita. Se etsii artikkelin kuvaaman
 * työmaan olemassa olevista hankkeista ja lisää yrityksen sen liittyviin
 * yrityksiin. Jos osumaa ei löydy, ei tehdä mitään - väärään hankkeeseen
 * liitetty urakoitsija on pahempi kuin puuttuva tieto.
 */

type MentionSource = {
  company: string
  listing: string
  maxPages: number
  /** Listaussivun artikkelilinkit. */
  listSelector: string
  titleSelector: string
  /** Artikkelisivun leipäteksti. */
  bodySelector: string
  /** Työmaan nimi leipätekstistä, kun otsikko ei kerro sitä. */
  worksitePatterns: RegExp[]
  excludeKeywords: string[]
}

const MENTION_SOURCES: Record<string, MentionSource> = {
  rajukiviParser: {
    company: "Rajukivi Oy",
    listing: "https://rajukivi.fi/category/aajankohtaista/",
    maxPages: 4,
    listSelector: "article[id^='post-']",
    titleSelector: "h2.entry-title a",
    bodySelector: ".et_pb_post_content",
    worksitePatterns: [
      /rajukivi\s+toimii\s+pääurakoitsijana\s+(.+?)\s*-?alueella\b/i,
      /rajukivi\s+oy\s+vastaa\s+alueen\s+(.+?)\s+toteutuksesta/i,
      /(\S+(?:\s+\S+){0,4})\s+asemakaava-alue(?:en)?\s+sijaitsee/i,
      /rajukivi\s+vastaa\s+(.+?)\s+\S*(?:töistä|rakenteista)/i,
      /rajukivi\s+(?:on\s+)?valittu\s+toteuttamaan\s+(.+?)(?:\s+kokonaisurakkaa|\.)/i,
      /rajukivi\s+(?:on\s+)?mukana\s+(.+?)(?:-hankkeessa|hankkeessa|-projektissa)\b/i,
      /rajukivi\s+osallistui\s+(.+?)\s+vaiheen\s+rakentamiseen/i,
    ],
    excludeKeywords: [
      "olemme ylpeitä",
      "arvomme",
      "tavoitteemme on luoda",
      "hyvää joulua",
      "joulua",
      "avoimet työpaikat",
      "arvostettu työpaikka",
      "sertifikaatin arvoinen",
      "rakennamme tulevaisuuden",
    ],
  },
}

/*
 * Sama kynnys kuin agentin tuonnissa. Kirjoitus kohdistuu olemassa olevaan
 * julkiseen hankkeeseen, joten varmuuden on oltava yhtä korkea.
 */
const MATCH_THRESHOLD = 70

function extractWorksiteName(
  bodyText: string,
  patterns: RegExp[]
): string | null {
  for (const pattern of patterns) {
    const match = bodyText.match(pattern)
    if (!match?.[1]) continue

    const cleaned = match[1].trim().replace(/^(uuden|uutta|uusi)\s+/i, "")
    if (cleaned.length >= 6) {
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
    }
  }
  return null
}

export async function collectCompanyMentionSource(source: any) {
  const config = MENTION_SOURCES[source.parser]

  if (!config) {
    throw new Error(
      `Tuntematon rikastuslähde: ${source.parser ?? "(parser puuttuu)"}`
    )
  }

  const articles: { title: string; url: string }[] = []
  const seenUrls = new Set<string>()

  for (let page = 1; page <= config.maxPages; page++) {
    const url =
      page === 1 ? config.listing : `${config.listing}page/${page}/`

    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) break

    const $ = cheerio.load(await response.text())
    const found = $(config.listSelector)
    if (found.length === 0) break

    found.each((_, el) => {
      const link = $(el).find(config.titleSelector).first()
      const title = link.text().trim()
      const href = link.attr("href")
      if (!title || !href || seenUrls.has(href)) return
      seenUrls.add(href)
      articles.push({ title, url: href })
    })
  }

  const projects = articles.length > 0 ? await loadProjectsForMatching() : []

  let checked = 0
  let matched = 0
  let enriched = 0

  for (const article of articles) {
    let body = ""

    try {
      const response = await fetch(article.url, { cache: "no-store" })
      if (response.ok) {
        const $ = cheerio.load(await response.text())
        body = $(config.bodySelector).first().text().replace(/\s+/g, " ").trim()
      }
    } catch {
      continue
    }

    const haystack = `${article.title} ${body}`.toLowerCase()
    if (config.excludeKeywords.some((keyword) => haystack.includes(keyword))) {
      continue
    }

    checked++

    /*
     * Työmaan nimi leipätekstistä on tarkempi kuin artikkelin otsikko, joka
     * on usein markkinointia ("Toiminta laajenee"). Otsikko jää varalle.
     */
    const worksite =
      extractWorksiteName(body, config.worksitePatterns) ?? article.title

    const city = detectCityFromText(haystack)

    const match = findProjectMatchDetailed(projects, {
      name: worksite,
      sourceTitle: article.title,
      city,
      region: null,
      location: null,
      permitNumber: null,
      propertyId: null,
      developer: null,
      buildingType: null,
      description: body || null,
    })

    if (!match || match.confidence < MATCH_THRESHOLD) continue

    matched++

    const { data: project, error: readError } = await supabaseAdmin
      .from("projects")
      .select("id, name, metadata")
      .eq("id", match.project.id)
      .maybeSingle()

    if (readError || !project) continue

    const metadata = project.metadata ?? {}
    const before = Array.isArray(metadata.related_companies)
      ? metadata.related_companies
      : []

    const after = mergeCompanyNames(before, [config.company])

    // Yritys jo listalla: ei kirjoiteta turhaan.
    if (after.length === before.length) continue

    const { error: updateError } = await supabaseAdmin
      .from("projects")
      .update({
        last_verified_at: new Date().toISOString(),
        metadata: {
          ...metadata,
          related_companies: after,
          company_mentions: [
            ...(Array.isArray(metadata.company_mentions)
              ? metadata.company_mentions
              : []),
            {
              company: config.company,
              source_url: article.url,
              title: article.title,
              seen_at: new Date().toISOString(),
            },
          ],
        },
      })
      .eq("id", project.id)

    if (updateError) continue

    enriched++
  }

  /*
   * documentsFound/-Saved pitävät ajolokin muodon samana kuin muilla
   * kerääjillä. Tämä lähde ei tallenna dokumentteja vaan rikastaa hankkeita,
   * joten "saved" tarkoittaa tässä rikastettua hanketta.
   */
  return {
    documentsFound: articles.length,
    documentsSaved: enriched,
    checked,
    matched,
  }
}
