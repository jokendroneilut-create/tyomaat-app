import { describe, expect, it } from "vitest"
import {
  VANTAA_KAAVALISTAUS,
  VANTAA_KAAVA_RSS,
  etsiKaavasivut,
  kaavanTunnuksetSivulta,
  listauksenLinkit,
  nimenVartalot,
  osuuOtsikkoon,
  rssLinkit,
} from "./vantaaKaavaSivu"

const sivu = (nimi: string) => `<html><body><dl>
  <dt class="point__term">Hakija</dt><dd class="point__description">Vantaan kaupunki</dd>
  <dt class="point__term"
  >Kaavan nimi</dt>
  <dd class="point__description"
  >${nimi}</dd></dl></body></html>`

const TUOMELA = "https://www.vantaa.fi/fi/kaavoitus/kaavat/hameenkylassa-tuomelan-koulutontille-pientaloja"
const RAAPPA = "https://www.vantaa.fi/fi/kaavoitus/kaavat/variston-raappavuorentiella-turvataan-kaukolammon-tuotantoa"
const PALOASEMA = "https://www.vantaa.fi/fi/kaavoitus/kaavat/myyrmaen-paloasema-raappavuorentielle"

describe("kaavanTunnuksetSivulta", () => {
  it("lukee numeron Kaavan nimi -kentästä (Tuomela, D-423)", () => {
    expect(kaavanTunnuksetSivulta(sivu("002657 Tuomelan koulutontti"))).toEqual(["002657"])
  })
  it("lukee kaksi numeroa ja kirjaintunnuksen", () => {
    expect(kaavanTunnuksetSivulta(sivu("002494 ja 002494va Väritehdas 1"))).toEqual(["002494"])
    expect(kaavanTunnuksetSivulta(sivu("YK0048 - Vantaan uusi yleiskaava 2020"))).toContain("YK0048")
  })
  it("ei lue muita kenttiä", () => {
    expect(kaavanTunnuksetSivulta("<dt class='point__term'>Hakija</dt><dd class='point__description'>002657</dd>")).toEqual([])
  })
})

describe("rssLinkit ja listauksenLinkit", () => {
  it("lukee RSS:n linkit", () => {
    const xml = `<rss><channel><title>Vantaa Kaavat</title><link>https://www.vantaa.fi</link>
      <item><title>Hämeenkylässä Tuomelan koulutontille pientaloja</title><link>${TUOMELA}</link></item></channel></rss>`
    expect(rssLinkit(xml)).toEqual([TUOMELA])
  })
  it("lukee listauksen kaavalinkit", () => {
    const html = `<a href="/fi/kaavoitus/kaavat/myyrmaen-paloasema-raappavuorentielle"> Myyrmäen paloasema </a>
      <a href="/fi/kaavoitus">Kaavoitus</a>`
    expect(listauksenLinkit(html)).toEqual([{ href: PALOASEMA, otsikko: "Myyrmäen paloasema" }])
  })
})

describe("osuuOtsikkoon", () => {
  it("taivutus ei estä osumaa", () => {
    expect(nimenVartalot("002640 - Raappavuorentie 38")).toEqual(["raappa"])
    expect(osuuOtsikkoon("002640 - Raappavuorentie 38", { href: RAAPPA, otsikko: "Variston Raappavuorentiellä turvataan kaukolämmön tuotantoa" })).toBe(true)
  })
  it("ääkköset eivät estä osumaa", () => {
    expect(osuuOtsikkoon("002657 Tuomelan koulutontti", { href: TUOMELA, otsikko: "Hämeenkylässä Tuomelan koulutontille pientaloja" })).toBe(true)
  })
})

describe("etsiKaavasivut", () => {
  const verkko: Record<string, string> = {
    [VANTAA_KAAVA_RSS]: `<rss><channel><item><link>${TUOMELA}</link></item></channel></rss>`,
    [TUOMELA]: sivu("002657 Tuomelan koulutontti"),
    [VANTAA_KAAVALISTAUS]: `<a href="/fi/kaavoitus/kaavat/myyrmaen-paloasema-raappavuorentielle">Myyrmäen paloasema Raappavuorentielle</a>
      <a href="/fi/kaavoitus/kaavat/variston-raappavuorentiella-turvataan-kaukolammon-tuotantoa">Variston Raappavuorentiellä turvataan kaukolämmön tuotantoa</a>`,
    [`${VANTAA_KAAVALISTAUS}?page=1`]: "",
    [PALOASEMA]: sivu("002493 Myyrmäen paloasema"),
    [RAAPPA]: sivu("002640 - Raappavuorentie 38"),
  }
  const hae = async (url: string) => verkko[url] ?? null

  it("löytää uuden RSS:stä ja vanhan listauksesta, vahvistaa numerolla", async () => {
    const tulos = await etsiKaavasivut({
      puuttuvat: [
        { tunnus: "002657", nimi: "002657 Tuomelan koulutontti" },
        { tunnus: "002640", nimi: "002640 - Raappavuorentie 38" },
        { tunnus: "002599", nimi: "002599 Kivivuorentie 4-6" },
      ],
      tunnetutSivut: new Set(),
      hae,
      budjetti: 10,
    })
    expect(Object.fromEntries(tulos)).toEqual({ "002657": TUOMELA, "002640": RAAPPA })
  })

  it("väärä Raappavuori-sivu ei kelpaa", async () => {
    const tulos = await etsiKaavasivut({
      puuttuvat: [{ tunnus: "002640", nimi: "002640 - Raappavuorentie 38" }],
      tunnetutSivut: new Set([RAAPPA]),
      hae,
      budjetti: 10,
    })
    expect(tulos.size).toBe(0)
  })

  it("budjetti rajaa sivuhaut", async () => {
    let haut = 0
    await etsiKaavasivut({
      puuttuvat: [{ tunnus: "002640", nimi: "002640 - Raappavuorentie 38" }],
      tunnetutSivut: new Set(),
      hae: async (u) => {
        if (u.includes("/kaavat/")) haut++
        return hae(u)
      },
      budjetti: 1,
    })
    expect(haut).toBe(1)
  })
})
