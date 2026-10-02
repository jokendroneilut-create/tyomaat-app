/*
 * LATAUSILMAISIN: TORNINOSTURI KAANTAA LOGON O-KIRJAINTA.
 *
 * Sovelluksessa luki kahdessatoista kohdassa pelkka "Ladataan...", eika
 * mikaan niista kertonut etta kyse on juuri tasta sovelluksesta.
 *
 * MIKSI OIKEA LOGO EIKA PIIRRETTY NOSTURI. Ensimmainen versio piirsi
 * nosturin SVG:lla jotta osia voisi animoida. Johannes 3.10.2026:
 * *"nosturi ei nayta silta milta oikeasti"* ja *"myos fontti on
 * muuttunut"*. Molemmat pitivat paikkansa — logon ristikkoa ja
 * kirjasinta ei saa kasin piirtamalla vastaamaan. Liike tehdaan siksi
 * OIKEASTA logosta leikatuilla paloilla:
 *
 *   logo-lataus-tausta.png   masto ja sana (ylarakenne ja o pyyhitty)
 *   logo-lataus-puomi.png    vastapaino, puomi ja huippu (y 28-104)
 *   logo-lataus-taakka.png   koukku ja o yhtena palana
 *
 * Palat leikattiin pikselirajoilta, jotka mitattiin logosta: o on
 * x 231-313 ja y 163-249, koukkupala y 142-162, vaijeri x 263-270 ylos
 * y 95:een, ja kaantyva ylarakenne x 31-292 / y 28-104.
 *
 * KANGAS ON 100 PX LEVEAMPI KUIN LOGO. Taakka on 158 px kiertoakselista,
 * joten 180 asteen kaannossa se paatyisi kohtaan x = -45 eli logon
 * ulkopuolelle. Levennyksen jalkeen se asettuu kohtaan x 13-97 ja
 * puomin karki kohtaan 35 — kaikki pysyy kuvassa.
 *
 * MIKSI TASAN 180 EIKA VAHEMMAN. 90 asteessa litte kuva on tasan
 * kyljellaan ja sen leveys ruudulla on nolla: puomi, vaijeri ja taakka
 * katoavat kaikki. Mitattu. Kaannoksen on siis mentava sen ohi.
 *
 * VAIHEET OVAT ERILLISET (Johannes 3.10.2026): nosto, kaanto, lasku —
 * tauko — ja samat vaiheet kaanteisesti takaisin. Jokainen vaihe
 * paattyy ennen kuin seuraava alkaa, joten liike luetaan tyovaiheina
 * eika yhtena sulavana pyorahdyksena.
 *
 * LIIKE ON VAPAAEHTOINEN: `prefers-reduced-motion` pysayttaa animaation,
 * jolloin jaljelle jaa logo paikallaan.
 */

/* Mitat logon pikseleista (kangas 978x304). Prosentteina skaalautuvuuden takia. */
const AKSELI = 21.83
const TAAKKA_VASEN = 32.62
const TAAKKA_YLA = 46.71
const TAAKKA_LEVEYS = 9.71
/*
 * TAAKKAPALA ON LEIKATTU SYMMETRISESTI VAIJERIN YMPARI (x 219-313,
 * keskiviiva 266). Ilman sita koukku ja vaijeri eivat kohdanneet
 * kaannetyssa aariasennossa:
 *
 * Puomin kierto peilaa taakan SIJAINNIN, ja taakan vastakierto peilaa
 * sen KUVAN takaisin — juuri siksi o pysyy luettavana. Mutta jos
 * kiinnityspiste ei ole palan keskella, se ei silloin peilaudu, kun
 * vaijerin sijainti peilautuu. Mitattu heitto oli 1,3 % leveydesta eli
 * 11 px 900 pikselin koossa, nakyen vain kaannetyssa asennossa.
 *
 * Symmetrisella palalla peilaus ei voi siirtaa mitaan.
 */

/*
 * Vaijerin VASEN REUNA, ei keskiviiva. Koukun kiinnityspiste logossa on
 * x 266,5 eli 37,47 % kankaasta, ja vaijeri on 0,62 % levea — joten
 * vasen reuna on 37,47 - 0,31.
 *
 * Ensimmainen versio asetti vasemman reunan suoraan 37,47:aan, jolloin
 * keskiviiva meni 0,3 % oikealle. Virhe nakyi erityisesti kaannetyssa
 * aariasennossa, koska se vaihtaa siina suuntaa: lepoasennossa vaijeri
 * oli koukusta vasemmalla ja 180 asteessa oikealla (mitattu).
 */
const VAIJERI_VASEN = 37.164
const VAIJERI_YLA = 31.25
const VAIJERI_LEPO = 15.46
const VAIJERI_YLHAALLA = 3.95
/* Nosto 35 px taakan 108 px korkeudesta; vaijerin pituus rajaa taman. */
const NOSTO = 32.41

/*
 * Kierros 8 s. Vaiheiden rajat prosentteina:
 *   0-5    lepo
 *   5-20   nosto          0,4 - 1,6 s
 *   20-45  kaanto 180     1,6 - 3,6 s
 *   45-57  lasku          3,6 - 4,6 s
 *   57-64  tauko
 *   64-76  nosto
 *   76-94  kaanto takaisin
 *   94-100 lasku
 */
const KESTO = "8s"

export default function Lataus({
  teksti = "Ladataan…",
  leveys = 170,
  keskita = false,
}: {
  /* Tyhja merkkijono jattaa pelkan logon ilman tekstia. */
  teksti?: string
  /* Ilmaisimen leveys pikseleina (sisaltaa 100 px kaantovaran). */
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
        <img className="tm-lataus-pohja" src="/logo-lataus-tausta.png" alt="Työmaat.fi" />

        <div className="tm-lataus-ylarakenne">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="tm-lataus-puomi" src="/logo-lataus-puomi.png" alt="" />
          <div className="tm-lataus-vaijeri" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="tm-lataus-taakka" src="/logo-lataus-taakka.png" alt="" />
        </div>
      </div>

      {teksti ? <span style={{ color: "#6b7280", fontSize: 14 }}>{teksti}</span> : null}

      <style>{`
        .tm-lataus {
          position: relative;
          display: inline-block;
          perspective: 1400px;
          perspective-origin: ${AKSELI}% 40%;
        }
        .tm-lataus-pohja { display: block; width: 100%; height: auto; }

        /* Puomi, vaijeri ja taakka kaantyvat yhtena kappaleena. */
        .tm-lataus-ylarakenne {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          transform-origin: ${AKSELI}% 50%;
          /* Ilman tata lapset littyvat puomin tasoon eika vastakierto toimi. */
          transform-style: preserve-3d;
          animation: tm-kaanto ${KESTO} ease-in-out infinite;
        }
        .tm-lataus-puomi {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: auto;
        }
        .tm-lataus-vaijeri {
          position: absolute;
          left: ${VAIJERI_VASEN}%;
          top: ${VAIJERI_YLA}%;
          width: 0.62%;
          height: ${VAIJERI_LEPO}%;
          background: #1b4a8f;
          animation: tm-vaijeri ${KESTO} ease-in-out infinite;
        }
        .tm-lataus-taakka {
          position: absolute;
          left: ${TAAKKA_VASEN}%;
          top: ${TAAKKA_YLA}%;
          width: ${TAAKKA_LEVEYS}%;
          height: auto;
          animation: tm-nosto ${KESTO} ease-in-out infinite;
        }

        @keyframes tm-kaanto {
          0%, 20%   { transform: rotateY(0deg); }
          45%, 76%  { transform: rotateY(-180deg); }
          94%, 100% { transform: rotateY(0deg); }
        }
        /*
          * TAAKKA JA VAIJERI KIERTAVAT SAMAN VERRAN VASTAAN.
          *
          * Johannes 3.10.2026: *"pida animaatiossa o-kirjain koko ajan
          * katsojaan pain luettavana eli ikaan kuin se olisi pallo"*.
          * Ilman vastakiertoa taakka kiertyy puomin mukana ja litistyy
          * mitattomaksi siina kohdassa jossa puomi on kyljellaan.
          * Vastakierron kanssa se pysyy 34x44 pikselin kokoisena ja
          * pystyssa, mutta kulkee silti kaaren mukana.
          */
        @keyframes tm-nosto {
          0%, 5%    { transform: translateY(0)          rotateY(0deg); }
          20%       { transform: translateY(-${NOSTO}%) rotateY(0deg); }
          45%       { transform: translateY(-${NOSTO}%) rotateY(180deg); }
          57%, 64%  { transform: translateY(0)          rotateY(180deg); }
          76%       { transform: translateY(-${NOSTO}%) rotateY(180deg); }
          94%       { transform: translateY(-${NOSTO}%) rotateY(0deg); }
          100%      { transform: translateY(0)          rotateY(0deg); }
        }
        @keyframes tm-vaijeri {
          0%, 5%    { height: ${VAIJERI_LEPO}%;      transform: rotateY(0deg); }
          20%       { height: ${VAIJERI_YLHAALLA}%;  transform: rotateY(0deg); }
          45%       { height: ${VAIJERI_YLHAALLA}%;  transform: rotateY(180deg); }
          57%, 64%  { height: ${VAIJERI_LEPO}%;      transform: rotateY(180deg); }
          76%       { height: ${VAIJERI_YLHAALLA}%;  transform: rotateY(180deg); }
          94%       { height: ${VAIJERI_YLHAALLA}%;  transform: rotateY(0deg); }
          100%      { height: ${VAIJERI_LEPO}%;      transform: rotateY(0deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .tm-lataus-ylarakenne,
          .tm-lataus-taakka,
          .tm-lataus-vaijeri { animation: none; }
        }
      `}</style>
    </div>
  )
}
