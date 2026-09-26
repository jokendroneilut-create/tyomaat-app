/*
 * VANHA OTSIKKO TALTEEN NIMEÄ MUUTETTAESSA (D-216).
 *
 * Täsmäyttäjä lukee hankkeelta KOLME otsikkoa: `name`,
 * `metadata.source_title` ja `metadata.also_known_as`
 * (`projectMatcher.ts`, `getProjectTitles`). Rakenne on ollut olemassa
 * juuri tätä varten — `NormalizedProjectCandidate`in kommentti sanoo
 * "lähteen alkuperäinen otsikko ennen mahdollista käsin muokkausta,
 * jotta editoitu otsikko ei katkaise duplikaattilöydettävyyttä".
 *
 * Yhdistäminen täyttää `also_known_as`in, mutta KÄSIN NIMEÄMINEN ei
 * täyttänyt kumpaakaan: vanha nimi katosi kokonaan.
 *
 * Mitattu 26.9.2026: `also_known_as` on 268 hankkeella (kaikki
 * yhdistämisistä), `source_title` 49:llä, eikä yhdenkään hankkeen nimeä
 * ollut vielä muokattu käsin. Vika olisi siis alkanut vasta siitä kun
 * uutisotsikoita aletaan siivota hankkeen nimiksi.
 *
 * MIKSI KAKSI KENTTÄÄ. Ensimmäinen nimi on LÄHTEEN otsikko ja menee
 * `source_title`iin; myöhemmät työnimet menevät `also_known_as`iin.
 * Näin alkuperäinen säilyy erillään eikä huku listaan, ja täsmäytys saa
 * kaikki muodot käyttöönsä.
 */
export function sailytaVanhaOtsikko(input: {
  vanhaNimi: string | null | undefined
  uusiNimi: string | null | undefined
  metadata: Record<string, any> | null | undefined
}): { source_title?: string; also_known_as?: string[] } {
  const vanha = String(input.vanhaNimi ?? "").trim()
  const uusi = String(input.uusiNimi ?? "").trim()

  if (!vanha || !uusi || vanha === uusi) return {}

  const md = input.metadata ?? {}
  const sourceTitle = String(md.source_title ?? "").trim()

  if (!sourceTitle) return { source_title: vanha }

  /* Sama nimi on jo tallessa lähteen otsikkona. */
  if (sourceTitle === vanha) return {}

  const aka = new Set<string>(
    (Array.isArray(md.also_known_as) ? md.also_known_as : [])
      .map((n: unknown) => String(n ?? "").trim())
      .filter(Boolean)
  )

  if (aka.has(vanha)) return {}

  aka.add(vanha)
  return { also_known_as: Array.from(aka) }
}
