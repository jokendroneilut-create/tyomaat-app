import type { CheerioAPI } from "cheerio"

/*
 * SEINAJOEN KAAVASIVUN YHTEYSTIETOKORTIT (D-390).
 *
 * Johannes 8.11.2026 Rahkolan kaavarivista: *"yhteyshenkiloita ei ole
 * poimittu vaikka ne ovat lahteessa annettu."*
 *
 * Sivun sivupalkissa on kolme rakenteista korttia:
 *
 *   <section class="s-sidebar-contact-card">
 *     <h2 class="s-sidebar-contact-card__full-name"> Kuusinen Jyrki </h2>
 *     <span class="s-sidebar-contact-card__title"> yleiskaavapaallikko </span>
 *     <span class="s-sidebar-contact-card__unit"> Kaupunkisuunnittelu ja kaavoitus </span>
 *     <a class="s-sidebar-contact-card__mobile-number" href="tel: 044 754 1645">…</a>
 *     <a class="s-sidebar-contact-card__email" href="mailTo: &#106;&#121;r&#107;i…">…</a>
 *   </section>
 *
 * MIKSI KERAIN EI NAHNYT NIITA. `fetchSeinajokiDetails` lukee kuvauksen
 * `<article>`-elementista, ja kommentti kertoo miksi: haku rajattiin
 * artikkeliin, *"koska muuten se voi jatkua sivun <aside>-sivupalkkiin"*.
 * Yhteystietokortit ovat juuri siina sivupalkissa. Rajaus oli oikea
 * kuvaukselle ja vaara yhteyshenkiloille — kumpaakaan ei voi lukea
 * toisen saannolla.
 *
 * KORTTI ON TAMAN LAHTEEN OMA. Mitattu 8.11.2026 hakemalla yksi
 * hankekohtainen sivu kaikilta 78 kaavalahteelta: `s-sidebar-contact-card`
 * esiintyy VAIN Seinajoella (10 korttia sivulla). Noin 30 muulla
 * lahteella on `mailto:`-linkkeja hankesivulla, mutta rakenne on joka
 * kunnassa eri — kortista saa nimikkeen ja puhelimen, paljaasta
 * mailto-linkista ei (ks. muisti: kaava-parser-vs-page).
 */

export type SeinajoenYhteyshenkilo = {
  kind: "person"
  name: string
  title: string | null
  email: string | null
  phone: string | null
  organization: string
}

const ORGANISAATIO = "Seinäjoen kaupunki"

/*
 * SAHKOPOSTI ON HAMAYTETTY NUMEROENTITEETEILLA
 * (`&#106;&#121;r&#107;i&#046;…`). Cheerio purkaa entiteetit `.text()`issa,
 * joten linkin TEKSTI riittaa eika `href`ia tarvitse purkaa itse. Href
 * alkaa lisaksi muodossa `mailTo: ` valilyonnilla, joka ei ole kelpo
 * osoite sellaisenaan.
 */
const SAHKOPOSTI = /[\w.+-]+@[\w.-]+\.\w{2,}/

/*
 * NIMI ON SUKUNIMI ETUNIMI -JARJESTYKSESSA ("Kuusinen Jyrki").
 *
 * Jarjestys paatellaan SAHKOPOSTISTA eika arvata: osoite
 * `jyrki.kuusinen@seinajoki.fi` kertoo kumpi sana on etunimi. Nain
 * kaksiosainen sukunimi ("Ström Jenni" vs. "von Hertzen Maija") ei mene
 * vaarin silloin kun osoite on luettavissa.
 *
 * Ilman osoitetta kaannetaan vain TASAN KAKSI sanaa, koska kunnan
 * yhteystietokortissa jarjestys on vakiintuneesti sukunimi ensin.
 * Kolmen sanan nimi jatetaan sellaisenaan: arvaus menisi vaarin yhta
 * usein kuin oikein.
 */
export function jarjestaNimi(raaka: string, sahkoposti: string | null): string {
  const sanat = raaka.replace(/\s+/g, " ").trim().split(" ").filter(Boolean)
  if (sanat.length < 2) return sanat.join(" ")

  const paikallinen = (sahkoposti ?? "").split("@")[0]?.toLowerCase() ?? ""
  const osat = paikallinen.split(".").filter(Boolean)

  if (osat.length >= 2) {
    const etunimi = osat[0]
    const normalisoi = (s: string) =>
      s
        .toLowerCase()
        .replace(/[äå]/g, "a")
        .replace(/ö/g, "o")
    /* Jos ensimmainen sana on osoitteen SUKUNIMI, jarjestys on kaannettava. */
    const ekaOnEtunimi = normalisoi(sanat[0]) === normalisoi(etunimi)
    if (ekaOnEtunimi) return sanat.join(" ")
    const viimeinen = sanat[sanat.length - 1]
    if (normalisoi(viimeinen) === normalisoi(etunimi)) {
      return [viimeinen, ...sanat.slice(0, -1)].join(" ")
    }
    return sanat.join(" ")
  }

  if (sanat.length === 2) return [sanat[1], sanat[0]].join(" ")
  return sanat.join(" ")
}

function siisti(teksti: string | null | undefined): string | null {
  const t = String(teksti ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[,;:]+|[,;:]+$/g, "")
    .trim()
  return t || null
}

export function seinajoenYhteyshenkilot($: CheerioAPI): SeinajoenYhteyshenkilo[] {
  const ulos: SeinajoenYhteyshenkilo[] = []
  const nahdyt = new Set<string>()

  $("section.s-sidebar-contact-card").each((_, el) => {
    const $k = $(el)
    const raakaNimi = siisti($k.find(".s-sidebar-contact-card__full-name").first().text())
    if (!raakaNimi) return

    const sahkopostiTeksti = $k.find(".s-sidebar-contact-card__email").first().text()
    const sahkoposti = sahkopostiTeksti.match(SAHKOPOSTI)?.[0]?.toLowerCase() ?? null

    /*
     * Puhelin voi olla joko mobiili- tai lankanumerokentassa; otetaan
     * ensimmainen joka loytyy. `tel:`-arvossa on valilyonti kaksoispisteen
     * jalkeen, joten numero luetaan linkin tekstista.
     */
    const puhelin =
      siisti($k.find(".s-sidebar-contact-card__mobile-number").first().text()) ??
      siisti($k.find(".s-sidebar-contact-card__phone-number").first().text()) ??
      siisti($k.find('a[href^="tel"]').first().text())

    const nimike = siisti($k.find(".s-sidebar-contact-card__title").first().text())

    const nimi = jarjestaNimi(raakaNimi, sahkoposti)
    const avain = nimi.toLowerCase()
    if (nahdyt.has(avain)) return
    nahdyt.add(avain)

    ulos.push({
      kind: "person",
      name: nimi,
      title: nimike,
      email: sahkoposti,
      phone: puhelin,
      organization: ORGANISAATIO,
    })
  })

  return ulos
}
