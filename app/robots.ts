import type { MetadataRoute } from "next"

/*
 * ROBOTS.TXT (D-400).
 *
 * Sovellus app.tyomaat.fi on kokonaan kirjautumisen takana: middleware
 * ohjaa /projects, /today, /tic, /dashboard ja /ohjeet kirjautumattoman
 * osalta /login-sivulle. Indeksoitavaa sisältöä ei siis ole, ja
 * markkinointisivusto on eri repo (www.tyomaat.fi).
 *
 * Tiedosto ei estä mitään — se on pyyntö, jota rehelliset indeksoijat
 * noudattavat. Arvo on kahdessa asiassa:
 *
 *   1. Kirjautumissivuja ja API-polkuja ei haeta eikä niitä päädy
 *      hakutuloksiin (login-sivu hakutuloksissa näyttää rikkinäiseltä).
 *   2. Jos joskus julkaisemme osan sisällöstä, sääntö on jo olemassa ja
 *      se laajennetaan tietoisesti — ei niin että kaikki aukeaa
 *      vahingossa.
 *
 * TÄMÄ EI OLE BOTTISUOJA. Suojana toimii kirjautuminen ja RLS; esto
 * tunnisteen tai IP:n perusteella osuisi ensin omiin työkaluihimme
 * (ks. D-400 ja lib/agent/kielletytLahteet.ts: pyydämme samaa
 * kohteliaisuutta muilta).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        disallow: ["/"],
      },
    ],
  }
}
