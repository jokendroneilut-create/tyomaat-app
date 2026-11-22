import { describe, expect, it } from "vitest"
import {
  haeUlvilanKaavanTiedot,
  ulvilanKuulutuksenKuvaus,
  ulvilanKuulutukset,
  ulvilanYhteyshenkilot,
  valitseUlvilanAsiakirjat,
} from "./ulvilaKaava"

/* Pirunkynnen vireilletulokuulutus 19.11.2026 sellaisena kuin pdf-parse sen antaa. */
const PIRUNKYNSI = `www.ulvila.
KUULUTUS
Vireille tuleva asemakaava
Nähtävillä osallistumis- ja arviointisuunnitelma (AkL 62 ja 63 §)
PIRUNKYNNEN TEOLLISUUSALUEEN ASEMAKAAVA koskee ase-
makaavoittamattomia metsäalueita keskustaajaman yleiskaava 2045:n T/
kem-1 alueella Pirunkynnessä aluetta halkovan voimalinjan eteläpuolella.
Tavoitteena on laatia teollisten toimintojen sijoittumisen mahdollistava
asemakaava alueelle.
Asemakaava tulee vireille tällä ilmoituksella. Osallistumis- ja arviointisuunni-
telma on nähtävillä 19.11.-18.12.2026 välisenä aikana kaupungin internet-
sivuilla (www.ulvila.fi /asemakaavat) ja kaupunkikehityksen ilmoitustaululla
osoitteessa Loukkurantie 1, 28450 Vanha-Ulvila. Mielipiteet pyydetään
jättämään nähtävilläoloaikana joko sähköisesti osoitteeseen
kaupunkikehitys@ulvila.fi  tai postitse osoitteeseen Ulvilan kaupunki /
kaupunkikehitys, PL 77, 28401 Ulvila.
Lisätietoja antaa kaupunkisuunnittelun johtaja Juha Virola,
puh. 0400 134 718, juha.virola@ulvila.fi .
Ulvilassa 19.11.2026
Kaupunginhallitus`

/* Ehdotusvaiheen ilmoitus: ei omaa kuvausta, vain menettely ja yhteyshenkilö. */
const NAHKURI = `www.ulvila.fi
ASEMAKAAVAN VALMISTELU
Nähtävillä asemakaavaehdotus (AkL 65 §, MRA 27 §)
NAHKURIN ja NUMMELAN asemakaavan muutoksen
ehdotusaineisto asetetaan nähtäville 30.4.–1.6.2026
väliseksi ajaksi muistutusten tekemistä varten. Aineis-
to on nähtävillä kaupungin internet-sivuilla (www.
ulvila.fi/asemakaavat) ja kaupunkikehityksen ilmoi-
tustaululla osoitteessa Loukkurantie 1, 28450 Vanha-
Ulvila.
Lisätietoja asiasta antaa kaavoitusarkkitehti Mikko
Toivanen, puh. 0400 134 777, mikko.toivanen@ulvila.fi.
Ulvilassa 27.4.2026
Kaupunginhallitus`

/* Palovainion ilmoituksen fonttikoodaus on rikki. */
const RIKKI = `ASEMAKAAVAN VALMISTELU
Nähtävillä asemakaavaehdotus (AkL 65 §, MRA 27 §)
˨˟˩ ̃˟˔ʡЃʢ˔˦ ̆ˠ˔˞˔˔˩˔˧ʜ ̋˔˞˔˨ˣ˨ˡ˞ ̃˞ ̆ ̨ ̃˧ˬ˞˦ ̆ˡ ̃˟ˠˢ ̃˧ˬ˦
Lisätietoja asiasta antaa kaavoitusarkkitehti Mikko
ˇˢ ̃˩˔ˡ ̆ˡʟˣ˨ ̨ʡʣʧʣʣʤʦʧʪʪʪʟˠ ̃˞˞ˢʡ˧ˢ ̃˩˔ˡ ̆ˡʳ˨˟˩ ̃˟˔ʡЃʡ`

const LIITTEET = [
  { teksti: "– vireilletuloilmoitus", href: "https://www.ulvila.fi/wp-content/uploads/2026/11/KUULUTUS-Pirunkynnen-asemakaava-vireille-ja-OAS-19112026-SK.pdf" },
  { teksti: "– osallistumis- ja arviointisuunnitelma", href: "https://www.ulvila.fi/wp-content/uploads/2026/11/Osallistumis-ja-arviointisuunnitelma-KH-16112026.pdf" },
]

describe("Ulvilan kaavan liitteet (22.11.2026)", () => {
  it("lukee kuulutuksen oman kuvauksen ilman menettelyä", () => {
    expect(ulvilanKuulutuksenKuvaus(PIRUNKYNSI)).toBe(
      "PIRUNKYNNEN TEOLLISUUSALUEEN ASEMAKAAVA koskee asemakaavoittamattomia metsäalueita keskustaajaman yleiskaava 2045:n T/ kem-1 alueella Pirunkynnessä aluetta halkovan voimalinjan eteläpuolella. Tavoitteena on laatia teollisten toimintojen sijoittumisen mahdollistava asemakaava alueelle."
    )
  })

  it("ei anna kuvausta pelkästä nähtävilläoloilmoituksesta eikä rikkinäisestä tekstistä", () => {
    expect(ulvilanKuulutuksenKuvaus(NAHKURI)).toBeNull()
    expect(ulvilanKuulutuksenKuvaus(RIKKI)).toBeNull()
  })

  it("poimii yhteyshenkilön nimikkeineen", () => {
    expect(ulvilanYhteyshenkilot(PIRUNKYNSI)).toEqual([
      { kind: "person", name: "Juha Virola", title: "Kaupunkisuunnittelun johtaja", phone: "0400 134 718", email: "juha.virola@ulvila.fi", organization: "Ulvilan kaupunki" },
    ])
    expect(ulvilanYhteyshenkilot(NAHKURI)[0]?.name).toBe("Mikko Toivanen")
    expect(ulvilanYhteyshenkilot(RIKKI)).toEqual([])
  })

  it("ei valitse kuulutusta OAS:ksi, vaikka sen nimessä lukee OAS", () => {
    expect(ulvilanKuulutukset(LIITTEET)).toEqual([LIITTEET[0].href])
    expect(valitseUlvilanAsiakirjat(LIITTEET).oas).toBe(LIITTEET[1].href)
  })

  it("käyttää uusinta luettavaa kuulutusta ja OAS:n kuvausta", async () => {
    const liitteet = [
      { teksti: "– vireilletuloilmoitus", href: "https://www.ulvila.fi/wp-content/uploads/2026/01/KUULUTUS_vanha.pdf" },
      { teksti: "– osallistumis- ja arviointisuunnitelma", href: "https://www.ulvila.fi/wp-content/uploads/2026/01/OAS.pdf" },
      { teksti: "– nähtävilläoloilmoitus", href: "https://www.ulvila.fi/wp-content/uploads/2026/03/ILMOITUS_EHDOTUS.pdf" },
    ]
    const tekstit: Record<string, string> = {
      "https://www.ulvila.fi/wp-content/uploads/2026/01/KUULUTUS_vanha.pdf": PIRUNKYNSI,
      "https://www.ulvila.fi/wp-content/uploads/2026/03/ILMOITUS_EHDOTUS.pdf": RIKKI,
    }
    const tulos = await haeUlvilanKaavanTiedot(
      liitteet,
      async (url) => tekstit[url] ?? null,
      async (url) => (url.endsWith("OAS.pdf") ? "Asemakaavan tavoitteena on mahdollistaa teollisuuden sijoittuminen alueelle." : null)
    )
    expect(tulos.contacts[0]?.name).toBe("Juha Virola")
    expect(tulos.description).toContain("PIRUNKYNNEN TEOLLISUUSALUEEN ASEMAKAAVA koskee")
    expect(tulos.description).toContain("Asemakaavan tavoitteena on mahdollistaa teollisuuden")
  })
})

describe("Ulvilan yhteiskuulutus (22.11.2026)", () => {
  const YHTEINEN = `www.ulvila.fi
VIREILLE TULEVAT ASEMAKAAVAT
Nähtävillä osallistumis- ja arviointisuunnitelma
(AkL 62 ja 63 §)
KESKUSTAN, SUURPÄÄN, NUMMELAN ja SAHAMÄ-
EN asemakaava ja asemakaavan muutos (Friitalan
eritasoliittymä) koskee tie-, rautatie- ja virkistyspal-
veluiden alueita sekä asemakaavoittamattomia tie-,
rautatie-, pientalo- ja metsäalueita.
Nähtävillä osallistumis- ja arviointisuunnitelma
(AkL 62 ja 63 §) ja asemakaavaluonnos (AkL 62 §,
MRA 30 §)
NAHKURIN asemakaavan muutos koskee kortteleita
518 ja 519 sekä katu-, virkistys- ja suojaviheralueita.
Asemakaavat tulevat vireille tällä ilmoituksella. Kaa-
vojen aineistot ovat nähtävillä 29.1.—2.3.2026 välisenä
aikana kaupungin internet-sivuilla (www.ulvila.fi/
asemakaavat) ja kaupunkikehityksen ilmoitustau-
lulla osoitteessa Loukkurantie 1, 28450 Vanha-Ulvila.
Lisätietoja antaa kaavoitusarkkitehti Mikko Toivanen,
puh. 0400 134 777, mikko.toivanen@ulvila.fi.`

  it("antaa kummallekin kaavalle vain sen oman kappaleen", () => {
    expect(ulvilanKuulutuksenKuvaus(YHTEINEN, "Nahkurin ja Nummelan asemakaavan muutos")).toBe(
      "NAHKURIN asemakaavan muutos koskee kortteleita 518 ja 519 sekä katu-, virkistys- ja suojaviheralueita."
    )
    expect(
      ulvilanKuulutuksenKuvaus(
        YHTEINEN,
        "Keskustan, Suurpään, Nahkurin, Nummelan ja Sahamäen asemakaava ja Suurpään, Nummelan ja Sahamäen asemakaavan muutos (Friitalan esitasoliittymä)"
      )
    ).toBe(
      "KESKUSTAN, SUURPÄÄN, NUMMELAN ja SAHAMÄEN asemakaava ja asemakaavan muutos (Friitalan eritasoliittymä) koskee tie-, rautatie- ja virkistyspalveluiden alueita sekä asemakaavoittamattomia tie-, rautatie-, pientalo- ja metsäalueita."
    )
  })
})
