import io

p = "lib/agent/kaavanLiite.ts"
s = io.open(p, encoding="utf-8").read()

# 1. Oma apuri: kuvaus ilman liiteotsikoita.
ankkuri = "export function onVainLiiteotsikot("
assert s.count(ankkuri) == 1
lisa = '''/*
 * KUVAUS ILMAN LIITEOTSIKOITA (D-335).
 *
 * Kynnys mittasi raakaa pituutta, ja se mittaa vaaraa asiaa. Paraisten
 * lohkoissa pituus tulee TOISTUVISTA ilmoitusriveista ja liitenimista:
 *
 *   "Kaavaehdotus on ollut julkisesti nahtavana 11.9-13.10.2025:
 *    Kaavaehdotus merkkienselityksineen Kaavaselostus liitteineen
 *    Luontoselvitys 2025 ... Aloitusvaiheen aineisto, kaava on
 *    ilmoitettu vireille lehti-ilmoituksella 6.6.2024: ..."
 *
 * 461 merkkia, nolla hankesisaltoa -- ja silti yli 300:n kynnyksen,
 * joten selostusta ei haettu. Mitattu 23.10.2026: viisi Paraisten
 * lohkoa yhdeksasta oli tassa tilassa.
 *
 * Siksi kynnysta vasten verrataan OMAA sisaltoa. Tama vain LISAA
 * hakuja siella missa pohja oli tayteaineista; aito kappale jaa yha
 * kynnyksen ylle eika sita haeta turhaan. Hakujen maaran kattaa
 * `budjetti.raja` per ajo.
 */
export function omaSisalto(kuvaus: string | null | undefined, linkit: { teksti?: string | null }[]): string {
  let jaannos = String(kuvaus ?? "")
  for (const l of [...linkit]
    .map((x) => String(x.teksti ?? "").trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)) {
    jaannos = jaannos.split(l).join(" ")
  }
  return jaannos.replace(/\\s+/g, " ").trim()
}

'''
s = s.replace(ankkuri, lisa + ankkuri)

# 2. onVainLiiteotsikot kayttaa samaa apuria, ettei logiikka ole kahdesti.
old2 = """  let jaannos = teksti
  /* Pisin ensin, jottei lyhyt otsikko syo pidemman osaa. */
  for (const l of [...linkit]
    .map((x) => String(x.teksti ?? "").trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)) {
    jaannos = jaannos.split(l).join(" ")
  }
  const kirjaimia = (jaannos.match(/[A-Za-z\\u00c0-\\u024f]/g) ?? []).length"""
new2 = """  const kirjaimia = (omaSisalto(teksti, linkit).match(/[A-Za-z\\u00c0-\\u024f]/g) ?? []).length"""
assert s.count(old2) == 1, s.count(old2)
s = s.replace(old2, new2)

# 3. Kynnysvertailu omaan sisaltoon.
old3 = """  if ((kuvaus ?? "").length >= kynnys) return kuvaus"""
new3 = """  /* Kynnys omaa sisaltoa vasten, ei raakaa pituutta -- ks. omaSisalto. */
  if (omaSisalto(kuvaus, linkit).length >= kynnys) return kuvaus"""
assert s.count(old3) == 1
s = s.replace(old3, new3)

io.open(p, "w", encoding="utf-8").write(s)
print("ohjausmerkkeja:", sum(1 for c in s if ord(c) < 32 and c not in "\t\n\r"))
