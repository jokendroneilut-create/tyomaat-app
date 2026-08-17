/*
 * Kirjautumisvirheen suomennos.
 *
 * MIKSI. Kirjautumissivu näytti Supaben virheen sellaisenaan
 * (`setError(error.message)`), eli suomenkielisessä palvelussa luki
 * "user is banned" tai "Invalid login credentials". Havaittu 18.8.2026
 * lukitusta testattaessa: viesti on teknisesti oikein muttei kerro
 * käyttäjälle mitä tehdä seuraavaksi.
 *
 * TUNTEMATON VIRHE PALAUTETAAN SELLAISENAAN. Geneerinen "kirjautuminen
 * epäonnistui" piilottaisi syyn myös silloin kun se olisi ollut
 * hyödyllinen — ja tekisi tuntemattomasta viasta näkymättömän. Mieluummin
 * englanninkielinen totuus kuin suomenkielinen tyhjyys.
 */

type Rule = { match: RegExp; message: string }

const RULES: Rule[] = [
  {
    /* Lukittu tunnus. Ainoa kohta jossa lukittu käyttäjä kohtaa palvelun. */
    match: /banned|user is banned/i,
    message:
      "Tunnus on lukittu. Ota yhteyttä osoitteeseen info@tyomaat.fi.",
  },
  {
    match: /invalid login credentials|invalid credentials/i,
    message: "Sähköposti tai salasana on väärin.",
  },
  {
    match: /email not confirmed|not confirmed/i,
    message:
      "Tunnusta ei ole vielä aktivoitu. Avaa sähköpostiisi tullut kutsulinkki ja aseta salasana.",
  },
  {
    match: /too many requests|rate limit/i,
    message: "Liian monta yritystä. Odota hetki ja yritä uudelleen.",
  },
  {
    match: /user not found/i,
    message: "Sähköposti tai salasana on väärin.",
  },
]

export function loginErrorMessage(raw: string | null | undefined): string {
  const text = String(raw ?? "").trim()

  if (!text) return "Kirjautuminen epäonnistui. Yritä uudelleen."

  for (const rule of RULES) {
    if (rule.match.test(text)) return rule.message
  }

  return text
}
