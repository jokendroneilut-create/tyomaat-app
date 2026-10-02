/*
 * LATAUSILMAISIN: NOSTURI NOSTAA LOGON O-KIRJAINTA.
 *
 * Sovelluksessa luki kahdessatoista kohdassa pelkka "Ladataan...",
 * eika mikaan niista kertonut etta kyse on juuri tasta sovelluksesta.
 *
 * MIKSI OIKEA LOGO EIKA PIIRRETTY NOSTURI. Ensimmainen versio piirsi
 * nosturin SVG:lla, jotta yksittaisia osia voisi animoida. Johannes
 * 3.10.2026: *"nosturi ei nayta silta milta oikeasti"* ja *"myos fontti
 * on muuttunut"*. Molemmat pitivat paikkansa: logon ristikkorakennetta
 * ja kirjasinta ei saa kasin piirtamalla vastaamaan.
 *
 * Siksi liike tehdaan OIKEASTA logosta leikatuilla paloilla:
 *
 *   logo-nosto-tausta.png   logo, josta vaijeri, koukku ja o on pyyhitty
 *   logo-nosto-taakka.png   koukku ja o yhtena palana (83x108)
 *
 * Palat on leikattu `logo_ilman_taustaa.png`:sta pikselirajoilta, jotka
 * mitattiin kuvasta: o on x 231-313 ja y 163-249, sen ylla koukkupala
 * y 142-162 ja vaijeri x 263-270 ylos y 95:een. Lepoasennossa taakka
 * osuu tasmalleen alkuperaiselle paikalleen, joten liikkumaton
 * latausilmaisin on pikselilleen sama kuin logo.
 *
 * VAIJERI ON CSS-PALKKI, EI KUVA. Nosto on fysikaalisesti oikea vain jos
 * vaijeri lyhenee samalla kun taakka nousee. Kuvana se ei veny, joten se
 * on `div` jonka korkeus animoituu taakan kanssa samassa tahdissa.
 *
 * SIJAINNIT OVAT PROSENTTEJA, joten sama komponentti skaalautuu
 * 100 pikselista 400:aan ilman erillisia kokoja.
 *
 * LIIKE ON VAPAAEHTOINEN: `prefers-reduced-motion` pysayttaa animaation,
 * jolloin jaljelle jaa logo paikallaan.
 */

/* Mitat logon pikseleista (878x304). Prosentteina skaalautuvuuden takia. */
const TAAKKA_VASEN = 26.31
const TAAKKA_YLA = 46.71
const TAAKKA_LEVEYS = 9.45
const VAIJERI_VASEN = 30.35
const VAIJERI_YLA = 31.25
/*
 * Vaijerin pituus levossa (y 95 -> 142 = 47 px) ja nostettuna.
 *
 * NOSTOKORKEUS ON RAJATTU VAIJERIN PITUUTEEN. Taakka voi nousta
 * korkeintaan 47 px ennen kuin koukku osuisi puomiin. Nosto on 35 px
 * eli 32 % taakan omasta korkeudesta (108 px), jolloin vaijeria jaa
 * nakyviin 12 px eika koukku koske puomiin.
 *
 * Ensimmainen versio nosti 11 %, mika oli liian vahan erottuakseen
 * (Johannes 3.10.2026).
 */
const VAIJERI_LEPO = 15.46
const VAIJERI_YLHAALLA = 3.95
const NOSTO = 32

export default function Lataus({
  teksti = "Ladataan…",
  leveys = 150,
  keskita = false,
}: {
  /* Tyhja merkkijono jattaa pelkan logon ilman tekstia. */
  teksti?: string
  /* Logon leveys pikseleina. */
  leveys?: number
  /* Koko sivun lataus: keskitetaan ja annetaan ilmaa ymparille. */
  keskita?: boolean
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: keskita ? "56px 20px" : "12px 0",
        ...(keskita ? { minHeight: 240 } : null),
      }}
    >
      <div className="tm-lataus" style={{ width: leveys }}>
        {/*
          * Tavallinen <img>: palat asemoidaan prosenteilla toistensa
          * paalle, mika on next/image:n kanssa tarpeettoman monimutkaista
          * eika naiden kokoisissa kuvissa hyodyta mitaan.
          */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-nosto-tausta.png" alt="Työmaat.fi" />
        <div className="tm-lataus-vaijeri" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="tm-lataus-taakka" src="/logo-nosto-taakka.png" alt="" />
      </div>

      {teksti ? (
        <span style={{ color: "#6b7280", fontSize: 14 }}>{teksti}</span>
      ) : null}

      <style>{`
        .tm-lataus { position: relative; display: inline-block; }
        .tm-lataus > img:first-of-type { display: block; width: 100%; height: auto; }

        .tm-lataus-taakka {
          position: absolute;
          left: ${TAAKKA_VASEN}%;
          top: ${TAAKKA_YLA}%;
          width: ${TAAKKA_LEVEYS}%;
          height: auto;
          animation: tm-nosto 2.1s cubic-bezier(.45,.05,.55,.95) infinite;
        }

        .tm-lataus-vaijeri {
          position: absolute;
          left: ${VAIJERI_VASEN}%;
          top: ${VAIJERI_YLA}%;
          width: 0.8%;
          height: ${VAIJERI_LEPO}%;
          background: #1b4a8f;
          animation: tm-vaijeri 2.1s cubic-bezier(.45,.05,.55,.95) infinite;
        }

        @keyframes tm-nosto {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-${NOSTO}%); }
        }
        @keyframes tm-vaijeri {
          0%, 100% { height: ${VAIJERI_LEPO}%; }
          50%      { height: ${VAIJERI_YLHAALLA}%; }
        }

        @media (prefers-reduced-motion: reduce) {
          .tm-lataus-taakka, .tm-lataus-vaijeri { animation: none; }
        }
      `}</style>
    </div>
  )
}
