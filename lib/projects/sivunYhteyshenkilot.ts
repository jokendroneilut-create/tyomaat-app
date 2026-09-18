import type { CheerioAPI } from "cheerio"

import { isPersonName } from "@/lib/agent/vaylaContacts"
import { extractContacts, type Contact } from "./contacts"
import { siivoaTitteli } from "./vapaaYhteystieto"

/*
 * YHTEYSHENKILÖT TIEDOTE- TAI HANKESIVULTA (D-200).
 *
 * Käytetään kun hankkeelle on löydetty lähdesivu jälkikäteen (tallessa
 * ollut osoite tai haku). Säännöt on mitattu 19.9.2026 73 sivulla:
 *
 *   - Elementtien väliin rivinvaihto. Ilman sitä "Pietarinen" +
 *     "Toimitusjohtaja" + "Terho Pietarinen" liimautuivat yhdeksi nimeksi.
 *   - Nimen muoto (`isPersonName`) ei yksin riitä: "Perustiedot
 *     Helsingin" ja "Taaleri Kiinteistöjen" läpäisivät sen. Vahva todiste
 *     on SÄHKÖPOSTI, jonka alkuosassa on henkilön etu- tai sukunimi.
 *     Pelkän puhelinnumeron rivi jää pois - mieluummin tyhjä kuin väärä.
 *   - Yli 60 merkin "titteli" on tiedotteen yrityskuvaus.
 *   - Sama osoite vain kerran.
 */
export function sahkopostiVastaaNimea(nimi: unknown, email: unknown): boolean {
  const ascii = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "")
  const alku = ascii(String(email ?? "").split("@")[0] ?? "")
  if (!alku) return false
  return String(nimi ?? "")
    .split(/\s+/)
    .map(ascii)
    .some((osa) => osa.length >= 3 && alku.includes(osa))
}

export function sivunYhteyshenkilot($: CheerioAPI): Contact[] {
  $("script, style, nav, header, footer").remove()
  $("body *").each((_, el) => {
    $(el).append("\n")
  })
  const nahty = new Set<string>()
  return extractContacts($("body").text())
    .filter((c) => c.kind === "person" && c.role !== "authority")
    .filter((c) => isPersonName(c.name) && sahkopostiVastaaNimea(c.name, c.email))
    .filter((c) => {
      const k = String(c.email).toLowerCase()
      if (nahty.has(k)) return false
      nahty.add(k)
      return true
    })
    .map((c) => ({ ...c, title: String(c.title ?? "").length > 60 ? null : siivoaTitteli(c.title) }))
}
