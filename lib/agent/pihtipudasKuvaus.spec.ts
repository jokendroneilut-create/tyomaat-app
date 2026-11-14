import { describe, expect, it } from "vitest"
import { pihtipudasKuvaus } from "./pihtipudasKuvaus"

/*
 * Rakenne luettu pihtipudas.fi:n sivuilta 14.11.2026 (D-418), tekstit
 * aitoja. Uudella pohjalla ei ole .entry-contentia; vanhalla on.
 */
const teksti = (t: string) =>
  `<div class="elementor-widget elementor-widget-text-editor"><div class="elementor-widget-container"><p>${t}</p></div></div>`
const otsikko = (t: string) =>
  `<div class="elementor-widget elementor-widget-heading"><div class="elementor-widget-container"><h2>${t}</h2></div></div>`

const UUSI = `<html><body><header><nav>Asuminen ja ympäristö » Kaavoitus ja mittaus</nav></header>
<div data-elementor-type="wp-page">
${otsikko("Asemakaavan muutos, kirkonkylän korttelit 53 (osa), 55 ja 58 (osa)")}
${teksti("Asemakaavan muutoksen tarkoituksena on tutkia Kirkkotien, Keskustien ja Rastaantien välisellä alueella korttelissa 53 sijaitsevien rakennusten suojelun edellytyksiä.")}
${teksti("Kuva 1. Asemakaavan suunnittelualue. Taustakartta © Maanmittauslaitos.")}
${otsikko("Kaava-aineisto, valmisteluvaihe")}
<a href="/wp-content/uploads/2026/11/Kaavaselostus_luonnos.pdf">Kaavaselostus, luonnos</a>
${otsikko("Yhteystiedot")}
${teksti("Kaavoitusarkkitehti")}
${teksti("henri.haapaniemi@pihtipudas.fi")}
</div>
<div data-elementor-type="wp-post">${teksti("Pihtiputaan kunta, Keskustie 9")}</div>
</body></html>`

const VANHA = `<html><body><div class="entry-content">
<p>Niemenharjun alueen asemakaavan muutos Asuminen ja ympäristö » Kaavoitus ja mittaus</p>
<div data-elementor-type="wp-page">
${otsikko("Niemenharjun alueen asemakaavan muutos")}
<div class="elementor-widget elementor-widget-text-editor"><div class="elementor-widget-container"><p>Kaavamuutosalueen pinta-ala on yht. 16,5 ha.</p><p>Tason alueen asemakaava päivitetään vastaamaan nykytilannetta.</p></div></div>
${teksti("Kaavakonsultti: Envineer Oy, Jemina Lahtela, jemina.lahtela@envineer.fi<br>Hankkeesta vastaava: Eurowind Energy Oy")}
${otsikko("Yhteystiedot")}
${teksti("Martti Junikka")}
</div></div></body></html>`

describe("pihtipudasKuvaus", () => {
  it("uusi pohja ilman .entry-contentia: kuvaus tekstiwidgetistä, kuvateksti pois", () => {
    expect(pihtipudasKuvaus(UUSI)).toBe(
      "Asemakaavan muutoksen tarkoituksena on tutkia Kirkkotien, Keskustien ja Rastaantien välisellä alueella korttelissa 53 sijaitsevien rakennusten suojelun edellytyksiä."
    )
  })

  it("vanha pohja: ei murupolkua eikä yhteystietoja, kappaleet ja <br> erotettu", () => {
    expect(pihtipudasKuvaus(VANHA)).toBe(
      "Kaavamuutosalueen pinta-ala on yht. 16,5 ha. Tason alueen asemakaava päivitetään vastaamaan nykytilannetta. Kaavakonsultti: Envineer Oy, Jemina Lahtela, jemina.lahtela@envineer.fi Hankkeesta vastaava: Eurowind Energy Oy"
    )
  })

  it("ei sisältöä -> null, jolloin keräin käyttää sivun tekstiä", () => {
    expect(pihtipudasKuvaus("<html><body><p>Sivua ei löydy</p></body></html>")).toBeNull()
    expect(pihtipudasKuvaus(null)).toBeNull()
  })
})
