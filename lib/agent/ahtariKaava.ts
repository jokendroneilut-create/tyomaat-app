/*
 * ÄHTÄRIN KAAVALISTAN KAPPALEET (27.11.2026, D-454).
 *
 * Johannes 27.11.2026 jonorivistä "- Sivua päivitetty marraskuu 2026":
 * *"selvitä mikä ongelma tässä ehdotuksessa on"*. Keräin tekee jokaisesta
 * linkittömästä kappaleesta kaavan otsikon, joten sivun alareunan
 * päivitysmerkintä tuli hankkeeksi joka kerta kun kunta päivitti sivun:
 * toukokuu, elokuu ja marraskuu 2026 (kaksi ensimmäistä hylätty käsin).
 *
 * Samassa ajossa nimeen lisätty tilamerkintä "Kimpilamminkankaan
 * tuulivoimaosayleiskaava (hyv. KV 5.10.2026 § 82)" vaihtoi nimestä tehdyn
 * tunnisteen, ja jo hyväksytystä kaavasta syntyi uusi jonorivi. Merkintä on
 * tieto (valtuusto hyväksyi), ei osa nimeä.
 */

export function onPaivitysmerkinta(teksti: string): boolean {
  return /^[\s\-–—]*(sivua?\s+)?(viimeksi\s+)?päivitetty\b/i.test(teksti.trim())
}

/*
 * Nimen lopussa sulkeissa oleva käsittelymerkintä: "(hyv. KV 5.10.2026 §
 * 82)", "(hyväksytty …)", "(lainvoimainen …)", "(nähtävillä …)". Muut
 * sulkeet ("(osakortteli 713)") kuuluvat nimeen.
 */
const TILAMERKINTA = /\s*\(((?:hyv\.|hyväksytty|lainvoimainen|lainvoima|nähtävillä|vireillä|kh\b|kv\b|kaupunginvaltuusto|kaupunginhallitus)[^()]*)\)\s*$/i

export function jaaOtsikkoJaTila(otsikko: string): { otsikko: string; tila: string | null; hyvaksytty: boolean } {
  const t = otsikko.replace(/\s+/g, " ").trim()
  const m = t.match(TILAMERKINTA)
  if (!m) return { otsikko: t, tila: null, hyvaksytty: false }
  const tila = m[1].trim()
  return {
    otsikko: t.slice(0, m.index).trim(),
    tila,
    hyvaksytty: /^(hyv\.|hyväksytty)/i.test(tila),
  }
}
