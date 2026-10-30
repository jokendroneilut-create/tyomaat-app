/*
 * LÄHTEEN NÄYTTÖNIMI.
 *
 * Asiakkaalle näytetään `metadata.source_name` sellaisenaan ("Lähde: …").
 * Useimmilla lähteillä se on kunnollinen nimi — kuntien kaavakerääjät
 * kirjaavat "Helsingin vireillä olevat asemakaavat (SUKKA)" — mutta
 * `lib/agent/*.ts`:ssä määritellyt lähteet kirjaavat sisäisen
 * tunnisteen. Mitattu 31.10.2026: 324 eri arvoa, joista 83 on
 * tunnisteen näköisiä ja ne kattavat 1 798 hanketta. Asiakas näki siis
 * rivejä kuten "Lähde: helsinki_paatokset" ja "Lähde: ysaatio".
 *
 * Tämä kartta kääntää tunnisteen nimeksi. Kaksi periaatetta:
 *
 * 1. VALMIS NIMI PALAUTETAAN SELLAISENAAN. Jos arvossa on välilyönti tai
 *    iso alkukirjain, se on jo nimi eikä sitä kosketa. Näin kuntien
 *    kaavalähteet eivät mene rikki.
 *
 * 2. TUNTEMATON TUNNISTE SIISTITÄÄN, EI JÄTETÄ RAAKANA. Alaviivat
 *    välilyönneiksi ja iso alkukirjain. Uusi yrityslähde näkyy siis
 *    "Rajukivi"-muodossa heti, eikä unohtunut kartta päästä tunnistetta
 *    läpi asiakkaalle.
 *
 * TAIVUTUS KIRJOITETAAN KÄSIN. "helsinki_paatokset" -> "Helsingin
 * kaupungin päätökset" vaatii genetiivin, eikä suomen taivutus synny
 * merkkijonoa liittämällä (sama ansa kuin D-365:n kuvauksissa:
 * "Saarijärvilla", "Oyn"). Siksi jokainen päätöslähde on kartassa
 * erikseen eikä johdettuna.
 */

const NIMET: Record<string, string> = {
  /* Kuntien päätöstiedotteet — genetiivi kirjoitettu käsin. */
  helsinki_paatokset: "Helsingin kaupungin päätökset",
  espoo_paatokset: "Espoon kaupungin päätökset",
  tampere_paatokset: "Tampereen kaupungin päätökset",
  rovaniemi_paatokset: "Rovaniemen kaupungin päätökset",
  kouvola_paatokset: "Kouvolan kaupungin päätökset",
  jyvaskyla_paatokset: "Jyväskylän kaupungin päätökset",
  joensuu_paatokset: "Joensuun kaupungin päätökset",
  pori_paatokset: "Porin kaupungin päätökset",
  kuopio_paatokset: "Kuopion kaupungin päätökset",
  savonlinna_paatokset: "Savonlinnan kaupungin päätökset",
  porvoo_paatokset: "Porvoon kaupungin päätökset",
  tornio_paatokset: "Tornion kaupungin päätökset",
  tuusula_paatokset: "Tuusulan kunnan päätökset",
  kirkkonummi_paatokset: "Kirkkonummen kunnan päätökset",

  kerava_uutiset: "Keravan kaupungin uutiset",
  helsinki_uutiset: "Helsingin kaupungin uutiset",

  /* Viranomaiset ja rekisterit. */
  yva: "Ympäristövaikutusten arviointi (YVA)",
  ymparistolupa: "Ympäristölupa",
  fingrid_hankkeet: "Fingridin hankkeet",
  tampereen_tilapalvelut: "Tampereen Tilapalvelut",
  datakeskusrekisteri: "Datakeskushankkeiden kansallinen rekisteri",
  suunnittelukilpailu: "Suunnittelukilpailut",

  /* Tiedotepalvelut ja media. */
  stt_haku: "STT-tiedotteet",
  stt_julkaisijat: "STT-tiedotteet",
  rakennuslehti: "Rakennuslehti",

  /*
   * Oma tiedonkeruu. Asiakkaalle kerrotaan mistä tieto on peräisin, ei
   * työtapaa: "kasin_kuvakaappaus" on meidän sisäinen asia.
   *
   * BRÄNDI KIRJOITETAAN ILMAN Ö:TÄ, kuten muu koodipohja: 49 osumaa
   * muodossa "Tyomaat.fi", ei yhtään ö:llistä. Vahti on
   * `lib/brandi.spec.ts`.
   */
  kasin_kuvakaappaus: "Tyomaat.fi oma tiedonkeruu",
  linkedin_manual: "Tyomaat.fi oma tiedonkeruu",
  tyomaakyltti: "Työmaakyltti",

  /* Yritykset joissa kirjoitusasu ei synny siistimisellä. */
  srv: "SRV",
  yit: "YIT",
  ncc: "NCC",
  ncc_projektit: "NCC",
  grk: "GRK",
  grk_projektit: "GRK",
  nrc_projektit: "NRC Group",
  vrj: "VRJ",
  are: "Are",
  t2h_kohteet: "T2H",
  jm_kohteet: "JM Suomi",
  ysaatio: "Y-Säätiö",
  asuntosaatio: "Asuntosäätiö",
  espoon_asunnot: "Espoon Asunnot",
  kas_asunnot: "KAS Asunnot",
  heka: "Heka",

  /*
   * NAMA LUETTIIN `discovery_sources.name`-SARAKKEESTA, EI ARVATTU.
   *
   * Tunniste on tappanut aantiomerkit ja lyhentanyt nimen, joten
   * siistiminen antoi vaaria muotoja: "Pelti assat" (oikea
   * Pelti-Assat), "Marttilan" (Marttilan Rakennus), "Aura" (Aura
   * Rakennus), "Hoivakodit" (HC Hoivakodit). Rekisterissa on
   * kirjoitettu nimi jokaiselle lahteelle, ja se on totuuden lahde.
   */
  pelti_assat: "Pelti-Ässät",
  marttilan: "Marttilan Rakennus",
  aura: "Aura Rakennus",
  hc_hoivakodit: "HC Hoivakodit",
  jalon_tyomaat: "Jalon",
  lapti: "Rakennusliike Lapti",
  lapti_kohteet: "Rakennusliike Lapti",
  pohjola_rakennus: "Pohjola Rakennus",
  brand_toimitilat: "Brand Toimitilat",

  /* Yritykset joilla sama nimi usealla kerääjällä. */
  skanska: "Skanska",
  skanska_projektit: "Skanska",
  bonava: "Bonava",
  bonava_kohteet: "Bonava",
  hartela: "Hartela",
  hartela_asuinalueet: "Hartela",
  lujatalo: "Lujatalo",
  lujatalo_projektit: "Lujatalo",
  lujakoti: "Lujakoti",
  destia_tiedotteet: "Destia",
  toivo_tiedotteet: "Toivo",
  rakennusteho: "Rakennusteho",
  sitowise: "Sitowise",
  fira: "Fira",
  peab: "Peab",
  jatke: "Jatke",
  varte: "Varte",
  oteran: "Oteran",
  kastelli: "Kastelli",

  /* Tarkistettu rekisteria vasten; siistiminen antaisi saman, mutta
   * kartassa ne eivat ole fallbackin varassa. */
  mangrove: "Mangrove",
  tekova: "Tekova",
  marvea: "Marvea",
  asura: "Asura",
  meijou: "Meijou",
  torppari: "Torppari",
  hausia: "Hausia",
  amplit: "Amplit",
  sarlin: "Sarlin",
  vexatec: "Vexatec",
  rajukivi: "Rajukivi",
}

/* Tunniste: pelkkiä pieniä kirjaimia, numeroita ja alaviivoja. */
const TUNNISTE = /^[a-z0-9_]+$/

/* Alaviivat pois ja iso alkukirjain: "rajukivi" -> "Rajukivi". */
function siisti(tunniste: string): string {
  const sanat = tunniste.replace(/_/g, " ").trim()
  if (!sanat) return tunniste
  return sanat.charAt(0).toUpperCase() + sanat.slice(1)
}

export function lahteenNimi(arvo: string | null | undefined): string | null {
  if (arvo === null || arvo === undefined) return null
  const teksti = String(arvo).trim()
  if (!teksti) return null

  const nimi = NIMET[teksti.toLowerCase()]
  if (nimi) return nimi

  /* Valmis nimi tunnistuu siitä ettei se ole tunnisteen muotoinen. */
  if (!TUNNISTE.test(teksti)) return teksti

  return siisti(teksti)
}
