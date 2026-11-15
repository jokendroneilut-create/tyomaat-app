/*
 * VIHDIN KAAVAN VALMISTELIJA YHTEYSHENKILÖKSI (D-428).
 *
 * Johannes 16.11.2026 kaavasta N202b: *"tästä ei ole poimittu
 * yhteystietoa: Kaavan valmistelija: Tarja Johansson"*.
 *
 * Kaavasivun yhteystietolaatikossa on kaksi asiaa:
 *
 *   Kaavatiedustelut: kaavoitus(ät)vihti.fi
 *   Kaavan valmistelija: Tarja Johansson
 *
 * Keräin luki vain ensimmäisen. Valmistelijalle sivulla ei ole puhelinta
 * eikä sähköpostia, mutta kunnan kaavoituksen yhteystietosivulla on
 * jokaisen suunnittelijan nimike ja puhelin, ja sivu sanoo itse
 * "Sähköpostit ovat muotoa etunimi.sukunimi@vihti.fi". Sähköposti
 * muodostetaan VAIN tällä sivun omalla ilmoituksella; ilman sitä jätetään
 * tyhjäksi.
 */

export const VIHTI_KAAVOITUS_YHTEYSTIEDOT = "https://www.vihti.fi/asuminen-ja-ymparisto/kaavoitus/yhteystiedot/"

export type VihtiHenkilo = { nimike: string | null; puhelin: string | null; sahkoposti: string | null }

function teksti(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/* "Kaavan valmistelija: Tarja Johansson" tai "Kaavan laatija: …" yhteystietolaatikosta. */
export function kaavanValmistelija(laatikonTeksti: string): string | null {
  const m = laatikonTeksti.match(
    /*
     * Etu- ja sukunimi, ei enempää: laatikossa nimeä seuraa heti
     * isolla alkava lause ("…Johansson Kaavasuunnittelijat tavoittaa…").
     */
    /Kaavan\s+(?:valmistelija|laatija|valmistelijat)\s*:\s*([A-ZÅÄÖ][\p{L}-]+\s+[A-ZÅÄÖ][\p{L}-]+)/u
  )
  return m ? m[1].trim() : null
}

function sahkopostiMuodosta(nimi: string): string | null {
  const osat = nimi
    .toLowerCase()
    .replace(/[äå]/g, "a")
    .replace(/ö/g, "o")
    .split(/\s+/)
  if (osat.length !== 2 || osat.some((o) => !/^[a-z-]+$/.test(o))) return null
  return `${osat[0]}.${osat[1]}@vihti.fi`
}

/*
 * Rakenne: <em>Nimike</em><br><strong>Nimi</strong><br>p. 050 302 4695.
 * Sivulla on sisäkkäisiä väri-spaneja, jotka poistetaan ensin.
 */
export function jasennaVihtiYhteystiedot(html: string): Map<string, VihtiHenkilo> {
  const siisti = html.replace(/<\/?span[^>]*>/gi, "")
  const muotoIlmoitettu = /etunimi\.sukunimi@vihti\.fi/i.test(teksti(siisti))
  const henkilot = new Map<string, VihtiHenkilo>()
  /*
   * Kentät eivät saa ylittää toisen henkilön rajaa: ilman rajausta
   * ensimmäisen henkilön "nimike" alkoi sivun yläosan osoitetiedoista ja
   * kaksi henkilöä sulautui yhdeksi (mitattu oikealla sivulla).
   */
  const kentta = "((?:(?!<\\/?em|<\\/?strong|<\\/p>)[\\s\\S])*?)"
  /*
   * Sivulla on kolme muunnelmaa (mitattu 16.11.2026): rivinvaihto
   * <em>:n sisällä ("…asemakaavoitus<br></em>"), "p.&nbsp;044…" ja
   * kaksiosainen nimike "<em>Kaavoitussihteeri</em>,<em> asiakaspalvelu</em>".
   */
  const kuvio = new RegExp(
    `(?:<em>${kentta}<\\/em>\\s*,\\s*)?<em>${kentta}<\\/em>\\s*(?:<br\\s*\\/?>)?\\s*<strong>${kentta}<\\/strong>\\s*<br\\s*\\/?>\\s*p\\.(?:\\s|&nbsp;)*([\\d ]{6,})`,
    "gi"
  )
  for (const m of siisti.matchAll(kuvio)) {
    const nimi = teksti(m[3])
    if (!nimi) continue
    const nimike = [m[1], m[2]].filter(Boolean).map(teksti).join(", ")
    henkilot.set(nimi.toLowerCase(), {
      nimike: nimike || null,
      puhelin: m[4].trim() || null,
      sahkoposti: muotoIlmoitettu ? sahkopostiMuodosta(nimi) : null,
    })
  }
  return henkilot
}

/*
 * KAKSI MUOTOA YHTEYSTIETOLAATIKOSSA (mitattu 19 kaavasivulta 16.11.2026):
 *
 *   1. "Kaavan valmistelija: Tarja Johansson" (3 sivua) — vain nimi
 *   2. roolikappaleet (N163b):
 *        <p><strong>Asemakaavan laatiminen</strong><br>Tarja Johansson<br>
 *        <em>kaavasuunnittelija</em><br>puh. 050 302 4695</p>
 *      — rooli, nimi, nimike ja puhelin; myös liikenne- ja katusuunnittelija
 *
 * Loput 15 sivua antavat vain yleisen kaavoitus-osoitteen.
 */
export function vihtiLaatikonYhteyshenkilot(
  laatikkoHtml: string,
  henkilot: Map<string, VihtiHenkilo>
): ReturnType<typeof valmistelijaYhteyshenkiloksi>[] {
  const tulos: ReturnType<typeof valmistelijaYhteyshenkiloksi>[] = []
  const kappaleet = laatikkoHtml.match(/<p[^>]*>[\s\S]*?<\/p>/gi) ?? []
  for (const p of kappaleet) {
    const m = p.match(
      /<strong>([\s\S]*?)<\/strong>\s*<br\s*\/?>\s*([^<]+?)\s*<br\s*\/?>\s*<em>([\s\S]*?)<\/em>\s*<br\s*\/?>\s*(?:puh|p)\.(?:\s|&nbsp;)*([\d ]{6,})/i
    )
    if (!m) continue
    const nimi = teksti(m[2])
    if (!/^[A-ZÅÄÖ][\p{L}-]+\s+[A-ZÅÄÖ][\p{L}-]+$/u.test(nimi)) continue
    const h = henkilot.get(nimi.toLowerCase())
    tulos.push({
      kind: "person",
      name: nimi,
      title: `${teksti(m[1])} (${teksti(m[3])})`,
      phone: m[4].trim(),
      email: h?.sahkoposti ?? null,
      organization: "Vihdin kunta",
    })
  }
  if (!tulos.length) {
    const nimi = kaavanValmistelija(teksti(laatikkoHtml))
    if (nimi) tulos.push(valmistelijaYhteyshenkiloksi(nimi, henkilot))
  }
  return tulos
}

export function valmistelijaYhteyshenkiloksi(
  nimi: string,
  henkilot: Map<string, VihtiHenkilo>
): { kind: "person"; name: string; title: string; phone: string | null; email: string | null; organization: string } {
  const h = henkilot.get(nimi.toLowerCase())
  return {
    kind: "person",
    name: nimi,
    title: h?.nimike ? `Kaavan valmistelija (${h.nimike})` : "Kaavan valmistelija",
    phone: h?.puhelin ?? null,
    email: h?.sahkoposti ?? null,
    organization: "Vihdin kunta",
  }
}
