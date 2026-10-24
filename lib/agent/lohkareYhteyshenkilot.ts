/*
 * LOHKAREEN "LISATIEDOT"-LOHKO (D-341).
 *
 * Tiedotteen lopussa on yhteystiedot kappale kerrallaan, organisaatio
 * kerrallaan:
 *
 *     Lisatiedot :
 *     Turun Satama Oy
 *     Minna Pirkkanen, Toimitusjohtaja
 *     Puh. 050 5533 100
 *     minna.pirkkanen@portofturku.fi
 *     Markku Alahame, Tekninen johtaja
 *     ...
 *     Oteran Oy
 *     Jukka Seeslinna, Toimitusjohtaja
 *     ...
 *
 * RAKENNE LUETAAN, EI ARVATA. Yleinen tekstipoimija rikkoi Turun
 * vastaavan lohkon: nimista katosivat aakkoset ja nimikkeiksi tuli
 * katkelmia ([[fields-into-prose-break-contacts]]). Tassa rooli,
 * puhelin ja osoite ovat omilla riveillaan, joten ne luetaan
 * JARJESTYKSESSA: yritysnimi vaihtaa organisaation, "Nimi, Nimike"
 * aloittaa henkilon, ja puhelin ja sahkoposti taydentavat hanta.
 *
 * Tama on arvokkain osa koko lahteesta: mitattu 22.10.2026, S2-laiturin
 * rivilla oli ennen vain tilaajan vaihde, ja tiedote antoi nelja
 * nimettya yhteyshenkiloa suorine numeroineen.
 */

export type LohkareYhteyshenkilo = {
  kind: "person"
  name: string
  title: string | null
  phone: string | null
  email: string | null
  organization: string | null
}

const LISATIEDOT = /^lis[äa]tiedot\s*:?\s*$/i
const YHTIOMUOTO = /\b(?:Oy|Oyj|Ab|Abp|Ky|Ltd)\b\.?$/
const PUHELIN = /^puh\.?\s*:?\s*(\+?[\d\s()\-]{6,})$/i
const SAHKOPOSTI = /^([\w.+\-]+@[\w\-]+(?:\.[\w\-]+)*)$/
const NIMI_JA_NIMIKE = /^([A-ZÅÄÖ][\wÅÄÖåäö'’\-]+(?:\s+[A-ZÅÄÖ][\wÅÄÖåäö'’\-]+){0,3}),\s*(.+)$/u

/*
 * KATKENNUT VERKKOTUNNUS KORJATAAN VAIN SAMAN LOHKON TODISTEELLA.
 *
 * Lahteessa oli `timo.luukkonen@oteran.f` seka linkin tekstissa etta
 * `mailto:`-osoitteessa -- tarkistettu raa'asta HTML:sta, ei oman
 * purun virhe. Samassa listassa on `jukka.seeslinna@oteran.fi`, joten
 * tunnus on katkennut kirjoitusvirheeseen.
 *
 * Taydennys tehdaan VAIN kun katkennut tunnus on toisen, samassa
 * lohkossa esiintyvan tunnuksen alku. Se on eri asia kuin osoitteen
 * johtaminen saannosta ("etunimi.sukunimi@"): paikallinen osa on
 * annettu sellaisenaan ja verkkotunnus luetaan naytosta. Ilman tata
 * kantaan jaisi osoite johon ei voi lahettaa.
 */
export function korjaaKatkennutDomain(osoitteet: string[]): Map<string, string> {
  const korjaukset = new Map<string, string>()
  const domainit = osoitteet.map((o) => o.split("@")[1] ?? "").filter(Boolean)

  for (const osoite of osoitteet) {
    const [paikallinen, domain] = osoite.split("@")
    if (!domain || !paikallinen) continue
    /* Kelvollisessa tunnuksessa on piste ja vahintaan kaksi kirjainta lopussa. */
    if (/\.[a-z]{2,}$/i.test(domain)) continue

    const taydempi = domainit.find((d) => d !== domain && d.startsWith(`${domain}`) && /\.[a-z]{2,}$/i.test(d))
    if (taydempi) korjaukset.set(osoite, `${paikallinen}@${taydempi}`)
  }

  return korjaukset
}

export function lohkareenYhteyshenkilot(kappaleet: string[]): LohkareYhteyshenkilo[] {
  const alku = kappaleet.findIndex((k) => LISATIEDOT.test(k.trim()))
  if (alku === -1) return []

  const henkilot: LohkareYhteyshenkilo[] = []
  let organisaatio: string | null = null
  let nykyinen: LohkareYhteyshenkilo | null = null

  const sulje = () => {
    if (nykyinen && (nykyinen.phone || nykyinen.email)) henkilot.push(nykyinen)
    nykyinen = null
  }

  for (const raaka of kappaleet.slice(alku + 1)) {
    const k = raaka.trim()
    if (!k) continue

    const posti = k.match(SAHKOPOSTI)
    if (posti) {
      if (nykyinen) nykyinen.email = posti[1]
      continue
    }

    const puhelin = k.match(PUHELIN)
    if (puhelin) {
      if (nykyinen) nykyinen.phone = puhelin[1].replace(/\s+/g, " ").trim()
      continue
    }

    const nimi = k.match(NIMI_JA_NIMIKE)
    if (nimi) {
      sulje()
      nykyinen = {
        kind: "person",
        name: nimi[1].trim(),
        title: nimi[2].trim() || null,
        phone: null,
        email: null,
        organization: organisaatio,
      }
      continue
    }

    /* Yritysnimi vaihtaa organisaation ja paattaa edellisen henkilon. */
    if (YHTIOMUOTO.test(k) && k.length <= 60) {
      sulje()
      organisaatio = k
      continue
    }

    /*
     * Muu teksti paattaa lohkon: tiedotteen lopussa on yrityksen
     * esittely ("Oteran Oy on kotimainen infran rakentaja..."), joka
     * alkaa yritysnimella mutta jatkuu virkkeena.
     */
    sulje()
    if (k.length > 80) break
  }
  sulje()

  const korjaukset = korjaaKatkennutDomain(
    henkilot.map((h) => h.email).filter((e): e is string => Boolean(e))
  )

  return henkilot.map((h) =>
    h.email && korjaukset.has(h.email) ? { ...h, email: korjaukset.get(h.email)! } : h
  )
}
