/*
 * Kohdetyypin päättely otsikosta ja tekstistä.
 *
 * Oma moduulinsa, koska sekä yritysten tiedotteet että kuntien
 * päätösasiakirjat tarvitsevat saman päättelyn - kohdetyyppi oli 0 %
 * molemmilla.
 */

/*
 * Ingressin pituus. Tiedotteen kärki kertoo mistä hankkeessa on kyse ja
 * kuka sen tilasi; loppuosa kuvaa ympäristöä, siteeraa johtajia ja
 * luettelee muita tiedotteita. Osapuolet ja kohdetyyppi luetaan siksi vain
 * tästä osasta - koko sivulta luettuna tuloksena oli naapuriartikkelin
 * yritys ("Garmin" Skanskan tiedotteessa) tai lähipalvelu ("päiväkoti"
 * asuntokohteessa).
 */
export const LEAD_LENGTH = 700

/*
 * Kuviot katkaistaan vartaloon, koska otsikossa sana on lähes aina
 * taivutettu. Astevaihtelu syö päätteen: "kulttuurikeskuksen" EI sisällä
 * merkkijonoa "keskus" (keskus -> keskuksen), joten täysi sana ei osu.
 */
const BUILDING_TYPES: [RegExp, string][] = [
  [/datakesku/i, "Datakeskus"],
  [/sairaal/i, "Sairaala"],
  /*
   * "museo" vaatii sananrajan: "Kaupunginmuseo" on lupapäätöksen
   * lausunnonantaja, ei hankkeen kohde. Mitattu: Pohjantie 3:n
   * asuinkerrostalohanke sai tyypin "Kulttuurirakennus", koska
   * lausunnoissa mainittiin Espoon kaupunginmuseo.
   */
  [/kulttuurikesku|teatteri|\bmuseo|konserttital/i, "Kulttuurirakennus"],
  [/päiväkoti|päiväkodi/i, "Päiväkoti"],
  /*
   * Nuorisotila ennen koulua: sen teksti kuvaa lähes aina nykyisiä
   * ahtaita tiloja koulun yhteydessä. Mitattu: "Zillarin nuorisotilan
   * tarveselvitys" sai tyypin "Koulu" ingressin lauseesta "toimintatilat
   * ovat ahtaat ja koulun tarpeisiin sisustetut".
   */
  [/nuorisotila|nuorisotalo/i, "Nuorisotila"],
  /*
   * Sananrajaa EI saa vaatia: koulu on suomessa lähes aina yhdyssanan
   * jälkiosa. Mitattu: "Muurolan peruskoulun tarveselvitys" ei osunut
   * kuvioon \bkoulu, joten tyyppi luettiin rungosta ja tuloksena oli
   * "Päiväkoti" (teksti mainitsi viereen rakennetun päiväkodin).
   *
   * Kielto laajennettiin samalla muotoon (?!t): pelkkä (?!tus) päästi läpi
   * sanat "kouluttaa" ja "koulutettava". "koulutus" ei ole koulu -
   * mitattu: "Hyvinkää Areena - uusi urheilu-, koulutus- ja
   * tapahtumakeskus" sai tyypin "Koulu".
   */
  [/koulu(?!t)|lukio|kampus|oppilaitos/i, "Koulu"],
  [/kirjasto/i, "Kirjasto"],
  [/hoivakoti|palvelutalo|asumisyksik|senioritalo/i, "Hoivakoti"],
  [/logistiikk|varastorakennu|terminaal/i, "Logistiikka"],
  [/hotelli/i, "Hotelli"],
  [/toimitila|toimistorakennu|toimistotalo/i, "Toimitila"],
  [/kerrostalo|asuntohank|asuinrakennu|asunto\s+oy/i, "Kerrostalo"],
  [/rivitalo/i, "Rivitalo"],
  /*
   * ULKOALUEET VIIMEISENÄ, heti infran edellä. Ne ovat aineistossa kahdessa
   * eri roolissa: kunnan päätöksessä hankkeen kohde ("Leikkipuisto Trumpetin
   * puistosuunnitelma"), yrityksen tiedotteessa naapuruston palvelu ("76
   * asunnon kohde ... lähellä on leikkipuisto"). Rakennustyypit ratkaistaan
   * siksi ensin: hankkeen oma rakennus voittaa ympäristön palvelun.
   *
   * Mitattu: taulun alkupäässä nämä veivät kaksi asuntokohdetta
   * leikkipuistoksi ja yhden uutisartikkelin nuorisotilaksi.
   */
  /*
   * Ulkoliikuntapaikat puuttuivat kokonaan, vaikka kentät ja liikuntapuistot
   * ovat kunnan päätösaineistossa yleisiä. Ne olivat lähes kaikki tyhjiä, ja
   * osa sai tyypin rungosta: "Keskusurheilukentän tekonurmen peruskorjaus"
   * oli "Koulu", koska ingressissä luki "Rautiosaaren koulun kentälle".
   *
   * KENTTÄ EI KELPAA YKSIN: "Lentokenttäalueen rakennushanke" ei ole
   * liikuntapaikka. Siksi vain yhdyssanat joissa etuosa on liikuntaa.
   */
  [
    /uimahalli|liikuntahalli|jäähalli|urheiluhalli|urheilukent|yleisurheilukent|pallokent|pelikent|tekonurmi|tekonurme|tekojääkent|liikuntapuisto|urheilupuisto|urheilukesku|liikuntapaik|kuntorata|skeittipaik|skeittipuisto|uimaranta/i,
    "Liikuntapaikka",
  ],
  /*
   * Leikkipuisto on Helsingissä valvottu kohde jolla on oma rakennus, ja
   * niitä on päätösaineistossa 19. Ilman omaa tyyppiä ne poimivat rungosta
   * mitä sattuu: "Leikkipuisto Trumpetin puistosuunnitelma" oli
   * "Kerrostalo" ja "Maasälvänpuisto, leikkipuisto Maasälpä" oli "Rivitalo".
   */
  [/leikkipuisto|leikkipiha|leikkipaik/i, "Leikkipuisto"],
  [/\bsilta\b|siltaa|ratahank|raitiotie|katusaneeraus/i, "Infrahanke"],
]

/*
 * Otsikko ratkaistaan ennen runkoa. Muuten runko voittaa: "Iisalmen
 * kulttuurikeskus" sai tyypin "Kirjasto", koska keskuksessa sattuu olemaan
 * kirjasto. Otsikko kertoo mistä hankkeessa on kyse, runko mitä siihen
 * sisältyy.
 *
 * Kentän sanasto on kannassa vapaata tekstiä (yli 200 eri arvoa), joten
 * tässä käytetään yleisimpiä jo käytössä olevia nimikkeitä eikä keksitä
 * uusia. Epävarmassa tapauksessa null: väärä kohdetyyppi ohjaa
 * asiakassuodatusta väärin, tyhjä ei ohjaa mihinkään.
 */
/*
 * Käyttötarkoituksen muutoksessa ratkaisee KOHDE, ei lähtötilanne.
 * "Toimistorakennuksen muuttaminen asuinkerrostaloksi" on kerrostalohanke,
 * ei toimitilahanke - mutta sanalistalla toimisto osuu ensin. Poimitaan
 * translatiivi ("...ksi") ja ratkaistaan tyyppi siitä.
 */
const CONVERSION = /muut(?:taminen|os|etaan)\s+(.{4,60}?)ksi\b/i

export function inferBuildingType(title: string, body: string | null): string | null {
  const conversion = `${title ?? ""} ${body?.slice(0, LEAD_LENGTH) ?? ""}`.match(CONVERSION)?.[1]
  if (conversion) {
    for (const [pattern, label] of BUILDING_TYPES) {
      if (pattern.test(conversion)) return label
    }
  }

  return inferFromWholeText(title, body)
}

function inferFromWholeText(title: string, body: string | null): string | null {
  /*
   * Rungosta katsotaan vain INGRESSI, ei koko sivua. Tiedotteen loppu
   * kuvaa ympäristöä ja luettelee muita tiedotteita, ja niistä poimittu
   * sana on lähes aina väärä. Mitattu: asuntokohteet "Niittykummun
   * Neuvokas" ja "34 Hitas-kotia Etelä-Haagaan" saivat tyypin "Päiväkoti",
   * koska teksti mainitsi lähipalvelut ("lähellä on päiväkoti ja koulu").
   */
  for (const source of [title, body?.slice(0, LEAD_LENGTH) ?? null]) {
    if (!source) continue
    for (const [pattern, label] of BUILDING_TYPES) {
      if (pattern.test(source)) return label
    }
  }
  return null
}

