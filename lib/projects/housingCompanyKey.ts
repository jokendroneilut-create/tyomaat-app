/*
 * TALOYHTIÖN NIMI TÄSMÄYTYSAVAIMENA.
 *
 * "Asunto Oy Oulun Valoisa" on rekisteröity ja yksikäsitteinen tavalla
 * jota tiedoteotsikko ei ole. Sama hanke tunnistuu siitä vaikka otsikot
 * olisivat täysin eri lauseita — juuri niin kuin Laptin Hiukkavaarassa,
 * joka jäi 38 pisteeseen vaikka molemmissa teksteissä lukee sama yhtiö.
 *
 * KOKO KUVAUS ON KELVOTON LÄHDE. Mitattu 29.8.2026: kaikkien mainintojen
 * poiminta yhdisti Oulun, Turun, Porin ja Joensuun hankkeet samaan
 * avaimeen, koska tiedotteet luettelevat lopussa yrityksen MUITA
 * kohteita. Väärät parit 472. Pelkkä ensimmäinen maininta ei riittänyt
 * (193 väärää): tiedote johtaa toisinaan toisella kohteella.
 *
 * Rajaus otsikkoon ja ensimmäiseen virkkeeseen pudotti väärät parit
 * kahteen, ja nekin olivat kaupunkivirheitä eivät vääriä linkkejä.
 *
 * Avain EI mene calculateMatchiin eikä automaattiseen yhdistämiseen,
 * vaan ehdotuslistaan — sama linja kuin katuavaimella (D-090).
 */

/*
 * "Koy Tampereen Hymni" EI SISÄLLÄ ERILLISTÄ "Oy":TA. Kuvio vaati
 * aiemmin yhtiömuodon perään vielä sanan "Oy", joten kaikki Koy- ja
 * KOy-alkuiset nimet jäivät kokonaan poimimatta (mitattu 6.9.2026).
 */
const YHTIO_RE =
  /\b((?:(?:Asunto|As\.?|Kiinteistö)\s*\.?\s*Oy\.?|Koy\.?|KOy\.?)\s+[A-ZÄÖÅ][\wÄÖÅäöå-]+(?:\s+[A-ZÄÖÅ][\wÄÖÅäöå-]+){0,3})/

/*
 * NIMEN LOPPU: EDELTÄVÄN SANAN GENETIIVI.
 *
 * Kuvio nielaisee nimen perään seuraavan virkkeen tai kentän
 * ensimmäisen sanan, koska sekin alkaa isolla: "Asunto Oy Espoon
 * Luhtavehka SRV aloittaa…", "…Fredrika Arvioitu valmistuminen
 * 12/2026", "…Kruunuvouti Vastaava työnjohtaja". Lähteissä nimen
 * jälkeen ei ole pistettä, joten virkerajaa ei voi käyttää.
 *
 * Suomalaisen taloyhtiön nimen määreet ovat genetiivissä: "Turun
 * Kirstinpuiston Solina", "Espoon Hannusrannan Aurea". Nimi siis
 * jatkuu vain niin kauan kuin edellinen sana päättyy n:ään.
 *
 * Mitattu 6.9.2026: sääntö katkaisi oikein kaikki 30 luettua riviä,
 * joilla yhtiömuodon jälkeen oli kolme tai useampi sana.
 */
/*
 * Pääsana ottaa peräänsä nimen eikä ole genetiivissä: "Villa Stenius",
 * "Kauppakeskus Sello". Ilman tätä nimi katkeaisi pääsanaan (mitattu
 * 6.9.2026: "As Oy Helsingin Villa" oli "…Villa Stenius").
 */
const PAASANAT = new Set(["villa", "kauppakeskus"])

function katkaiseNimi(nimi: string): string {
  const sanat = nimi.split(" ")

  /* Yhtiömuoto ("Asunto Oy", "Koy") + ensimmäinen sana ovat aina mukana. */
  const muotoa = /^(?:Asunto|As\.?|Kiinteistö)$/i.test(sanat[0] ?? "") ? 2 : 1
  let loppu = Math.min(muotoa + 1, sanat.length)

  while (loppu < sanat.length) {
    const edellinen = (sanat[loppu - 1] ?? "").toLowerCase().replace(/[.,]$/, "")
    if (!/n$/.test(edellinen) && !PAASANAT.has(edellinen)) break
    loppu++
  }

  return sanat.slice(0, loppu).join(" ")
}

/*
 * Sijapäätteet pisimmästä lyhimpään: "Valoisaan", "Valoisan" ja
 * "Valoisa" ovat sama yhtiö.
 */
const PAATTEET = [
  "seen", "lle", "lla", "llä",
  "ssa", "ssä", "sta", "stä", "ksi", "ien",
  "in", "en", "an", "än", "on", "ön", "n",
]

/*
 * Yhtiömuoto pois: se toistuu joka nimessä eikä erota mitään.
 *
 * SANALISTA EIKÄ KUVIO. Aiempi `\b(...|kiinteistö|...)\b` EI karsinut
 * sanaa "kiinteistö", koska JS:n `\b` ei tunnista ä/ö/å sananmerkiksi.
 * Silloin "Kiinteistö Oy Turun Lyseo" sai avaimen "kiinteistö turun
 * lyse" — ja koska se on kaupungin kiinteistöyhtiö joka omistaa satoja
 * rakennuksia, avain yhdisti kaksi eri koulua samaksi hankkeeksi
 * (mitattu 6.9.2026: Turun Lyseo ja Luolavuoren koulu).
 */
const YHTIOMUODOT = new Set(["asunto", "as", "kiinteistö", "koy", "oy", "osakeyhtiö"])

export function normalizeHousingCompany(nimi: string): string {
  const sanat = String(nimi ?? "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((sana) => sana && !YHTIOMUODOT.has(sana))

  if (!sanat.length) return ""

  /*
   * Vain viimeinen sana riisutaan: se on yhtiön erottava osa ja
   * taipuu. Edeltävät ovat yleensä paikannimiä ("Oulun", "Helsingin"),
   * joiden genetiivi kuuluu nimeen.
   */
  return sanat
    .map((s, i) => {
      if (i < sanat.length - 1) return s

      let sana = s
      for (const p of PAATTEET) {
        if (sana.length > p.length + 2 && sana.endsWith(p)) {
          sana = sana.slice(0, -p.length)
          break
        }
      }

      /*
       * Loppuvokaalit pois. Suomen taivutus ei riisu siististi
       * pelkillä päätteillä: "Valoisa", "Valoisan" ja "Valoisaan"
       * tuottivat kolme eri vartaloa. Karkea karsinta yhdistää ne, ja
       * neljän merkin raja suojaa lyhyet nimet ("Pyy").
       */
      while (sana.length > 4 && /[aeiouyäö]$/.test(sana)) {
        sana = sana.slice(0, -1)
      }

      return sana
    })
    .join(" ")
}

/*
 * Otsikko ja kuvauksen KAKSI ENSIMMÄISTÄ VIRKETTÄ. Rajaus on mitattu,
 * ei arvattu — ks. moduulin alku.
 *
 * Yksi virke ei riitä: STT:n tiedote johtaa yleisellä lauseella ja
 * nimeää taloyhtiön vasta toisessa virkkeessä ("Lapti on aloittanut…
 * Asunto Oy Oulun Valoisaan valmistuu 29 asuntoa").
 */
/*
 * KAKSI ERI YHTIÖTÄ SAMASSA TIEDOTTEESSA.
 *
 * "Hausia Oy käynnistää Nihdissä kaksi uutta kohdetta: Asunto Oy Nihdin
 * Skylinen rakentaminen alkaa huhtikuussa ja As Oy Nihdin Horizonin
 * elokuussa." Ensimmäinen maininta antoi hankkeelle "Kerrostalo Nihdin
 * Horizon" väärän yhtiön (mitattu 6.9.2026).
 *
 * Otsikko ratkaisee: se kuvaa juuri tätä hanketta. Jos yksikään
 * mainituista ei löydy otsikosta, jätetään tyhjäksi — väärä yhtiö on
 * pahempi kuin puuttuva.
 */
function poimiNimi(title: string | null | undefined, description?: string | null): string | null {
  const alkuvirkkeet = String(description ?? "")
    .split(/(?<=\.)\s/)
    .slice(0, 2)
    .join(" ")

  const alku = `${String(title ?? "")} ${alkuvirkkeet}`.trim()
  if (!alku) return null

  const nimet: string[] = []
  for (const m of alku.matchAll(new RegExp(YHTIO_RE.source, "g"))) {
    if (m[1]) nimet.push(katkaiseNimi(m[1].replace(/\s+/g, " ").trim()))
  }
  if (!nimet.length) return null

  /* Sama yhtiö eri sijamuodoissa on yksi yhtiö, ei kaksi. */
  const eri = new Map<string, string>()
  for (const nimi of nimet) {
    const avain = normalizeHousingCompany(nimi)
    if (avain && !eri.has(avain)) eri.set(avain, nimi)
  }
  if (eri.size <= 1) return nimet[0]

  const otsikko = String(title ?? "").toLowerCase()
  const otsikossa: string[] = []
  for (const [avain, nimi] of eri) {
    /* Erottava osa on avaimen viimeinen sana; vartalo riittää. */
    const vartalo = avain.split(" ").pop() ?? ""
    if (vartalo.length >= 4 && otsikko.includes(vartalo.slice(0, 5))) otsikossa.push(nimi)
  }

  return otsikossa.length === 1 ? otsikossa[0] : null
}

export function housingCompanyKey(
  title: string | null | undefined,
  description?: string | null
): string | null {
  const nimi = poimiNimi(title, description)
  if (!nimi) return null

  const avain = normalizeHousingCompany(nimi)

  /*
   * Pelkkä paikannimi ei yksilöi mitään: "Asunto Oy Oulun" osuisi
   * kaikkiin oululaisiin taloyhtiöihin. Siksi vaaditaan joko kaksi
   * sanaa (paikka + erottava osa) tai riittävän pitkä yksittäinen nimi.
   */
  const monisanainen = avain.includes(" ")
  return monisanainen || avain.length >= 6 ? avain : null
}

/*
 * TALOYHTIÖN NIMI SELLAISENAAN, ei avaimena.
 *
 * Avain on täsmäytystä varten riisuttu ja taivutuksesta puhdistettu
 * ("oulun valois"), eikä sitä voi näyttää asiakkaalle. Tämä palauttaa
 * nimen siinä muodossa kuin se tekstissä lukee — se on rekisteröity
 * yhtiö ja siksi hakukelpoinen tieto hankkeen yrityslistassa.
 *
 * Sama rajaus kuin avaimella: vain otsikko ja kuvauksen kaksi
 * ensimmäistä virkettä. Koko kuvauksesta poimittuna mukaan tulisi
 * yrityksen MUITA kohteita (mitattu 29.8.2026, 472 väärää paria).
 *
 * Palauttaa null myös silloin kun nimi ei yksilöi ("Asunto Oy Oulun"):
 * kelpoisuus ratkaistaan samalla säännöllä kuin avaimella, jotta
 * näytetty nimi ja täsmäytys eivät voi olla eri mieltä.
 */
export function housingCompanyName(
  title: string | null | undefined,
  description?: string | null
): string | null {
  const nimi = poimiNimi(title, description)
  if (!nimi) return null

  /* Jos avain ei kelpaa, ei nimikään: sama kynnys molemmille. */
  if (!housingCompanyKey(title, description)) return null

  return nimi
}
