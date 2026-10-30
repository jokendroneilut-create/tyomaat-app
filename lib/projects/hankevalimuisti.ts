/*
 * HANKELISTAN SELAINVÄLIMUISTI.
 *
 * MIKSI. Mitattu 15.10.2026: **91 % /today- ja /projects-latauksista
 * tapahtuu alle 30 minuutin kuluessa edellisestä** (koneellinen käyttö
 * pois laskettuna), eli sama 5 MB haetaan yhä uudelleen samalle
 * datalle. Siirtymä sivujen välillä on koko sivun uudelleenlataus,
 * joten selaimen muisti nollautuu joka kerta.
 *
 * MIKSI IndexedDB EIKÄ sessionStorage. Kevyt rivistö on noin 5 MB ja
 * kuvaukset 12 MB lisää; sessionStorage on tyypillisesti 5-10 MB koko
 * originille. IndexedDB kestää tämän, ja se säilyy myös välilehtien yli.
 *
 * VANHENEMINEN ON KELLOAIKA, EI ISTUNTO. Johannes 15.10.2026: *"ison
 * pelkoni on ennemmin että välimuisti jää päivittämättä kokonaan kun
 * käyttäjä ei koskaan kirjaudu pois ja siksi emme huomaa sitä."*
 *
 * Siksi:
 *  - merkintään tallennetaan kirjoitushetki, ja sitä vanhempi kuin
 *    ELINAIKA_MS hylätään — riippumatta siitä mitä käyttäjä tekee.
 *    Mikään ei sido vanhenemista istuntoon tai uloskirjautumiseen.
 *  - avaimessa on VERSIO: jos rivin muoto muuttuu julkaisussa, vanha
 *    merkintä ei kelpaa, eikä vanhentunut muoto voi rikkoa sivua hiljaa.
 *  - tallennushetki palautetaan kutsujalle, mutta **sitä ei näytetä
 *    käyttäjälle** (päätös 15.10.2026). Kokeiltiin: hankelistalla luki
 *    "tiedot 00.52 · päivitä". Mitattu syy poistolle: uusia hankkeita
 *    ilmestyy mediaanina kahtena tuntina päivässä, käytännössä iltaisin
 *    klo 18-22 katselmoinnin yhteydessä. Kahden tunnin ikä ei siis
 *    piilota asiakkaalta mitään, joten kellonaika kertoisi erosta jota
 *    ei ole — ja herättäisi epäilyn ilman vastinetta. Johannes: *"ei
 *    näytetä sitä käyttäjälle"*, eikä myöskään varoitusta vanhasta
 *    datasta. Aikaleima jää rajapintaan diagnostiikkaa varten.
 *
 * Kaikki luku ja kirjoitus on try/catch:in sisällä: yksityisessä
 * ikkunassa tai estetyillä evästeillä IndexedDB voi heittää, eikä se saa
 * kaataa sivua. Välimuistin puuttuminen on normaali tila, ei virhe.
 */

const TIETOKANTA = "tyomaat"
const VARASTO = "hankkeet"
const VERSIO = "v1"
const ELINAIKA_MS = 2 * 60 * 60 * 1000

export type Valimuistimerkinta<T> = {
  rivit: T[]
  tallennettu: number
}

function avaa(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null)
      const pyynto = indexedDB.open(TIETOKANTA, 1)
      pyynto.onupgradeneeded = () => {
        const db = pyynto.result
        if (!db.objectStoreNames.contains(VARASTO)) db.createObjectStore(VARASTO)
      }
      pyynto.onsuccess = () => resolve(pyynto.result)
      pyynto.onerror = () => resolve(null)
      /* Esim. yksityinen ikkuna voi jäädä odottamaan lupaa ikuisesti. */
      setTimeout(() => resolve(null), 2000)
    } catch {
      resolve(null)
    }
  })
}

async function lueRaaka<T>(avain: string): Promise<T | null> {
  const db = await avaa()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const pyynto = db.transaction(VARASTO, "readonly").objectStore(VARASTO).get(avain)
      pyynto.onsuccess = () => resolve((pyynto.result as T) ?? null)
      pyynto.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function kirjoitaRaaka(avain: string, arvo: unknown): Promise<void> {
  const db = await avaa()
  if (!db) return
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(VARASTO, "readwrite")
      tx.objectStore(VARASTO).put(arvo, avain)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}

function avaimella(nimi: string): string {
  return `${VERSIO}:${nimi}`
}

/*
 * Palauttaa merkinnän vain jos se on tuore. Vanha merkintä ei pelkästään
 * jää käyttämättä vaan myös poistetaan, jottei se jää makaamaan selaimeen.
 */
/*
 * KELVOLLISEN MERKINNAN MAARITELMA, YHDESSA PAIKASSA (D-363).
 *
 * Puhdas funktio, jotta saanto on testattavissa ilman IndexedDB:ta --
 * selainvarasto ei ole olemassa Nodessa, joten muuten tata ei voisi
 * testata lainkaan.
 */
export function kelpaakoMerkinta<T>(
  merkinta: unknown,
  nyt: number = Date.now()
): merkinta is Valimuistimerkinta<T> {
  const m = merkinta as Valimuistimerkinta<T> | null
  if (!m || !Array.isArray(m.rivit) || typeof m.tallennettu !== "number") return false

  /*
   * TYHJA MERKINTA EI OLE OSUMA.
   *
   * `/projects` lukee valimuistin ensin ja palaa heti jos merkinta
   * loytyy -- ehto oli `if (valimuistista)`, eika se erota tyhjaa
   * taydesta. Jos haku oli kerran palauttanut nolla rivia ILMAN
   * virhetta (hetkellinen tunnistautumis- tai verkkohairio), tyhja
   * lista tallentui ja asiakas naki **tyhjan kartan kahden tunnin ajan
   * ilman yhtaan virheilmoitusta**.
   *
   * Juuri tallainen vika ei huuda vaan vaikenee
   * ([[silent-watch-failure]]), joten se pysahtyy tahan: tyhja
   * merkinta on ohiosuma ja sivu hakee datan kannasta.
   *
   * Tyhja TULOS on silti mahdollinen aito tilanne (suodatin ei osu),
   * mutta sita ei tarvitse valimuistittaa: haku on silloin halpa.
   */
  if (m.rivit.length === 0) return false

  const ika = nyt - m.tallennettu
  return ika >= 0 && ika <= ELINAIKA_MS
}

export async function lueValimuisti<T>(nimi: string): Promise<Valimuistimerkinta<T> | null> {
  const merkinta = await lueRaaka<Valimuistimerkinta<T>>(avaimella(nimi))

  if (!kelpaakoMerkinta<T>(merkinta)) {
    /* Kelvoton merkinta poistetaan, jottei se jaa makaamaan selaimeen. */
    if (merkinta) void kirjoitaRaaka(avaimella(nimi), undefined)
    return null
  }

  return merkinta
}

export async function kirjoitaValimuisti<T>(nimi: string, rivit: T[]): Promise<void> {
  /*
   * Tyhjaa ei kirjoiteta lainkaan: silloin virheellinen nollatulos ei
   * paase jaamaan selaimeen edes siksi aikaa etta joku lukee sen. Sama
   * suoja kahdessa suunnassa, koska lukija ja kirjoittaja voivat olla
   * eri versioita (selaimessa on vanhaa koodia valimuistissa).
   */
  if (!Array.isArray(rivit) || rivit.length === 0) return
  await kirjoitaRaaka(avaimella(nimi), { rivit, tallennettu: Date.now() })
}

export async function tyhjennaValimuisti(nimi: string): Promise<void> {
  await kirjoitaRaaka(avaimella(nimi), undefined)
}

export function valimuistinIka(tallennettu: number | null): string | null {
  if (!tallennettu) return null
  return new Date(tallennettu).toLocaleTimeString("fi-FI", {
    hour: "2-digit",
    minute: "2-digit",
  })
}
