import { mkdirSync } from "node:fs"

/*
 * LATAUSILMAISIN JAETTAVAKSI: ANIMOITU GIF JA WEBP.
 *
 * Johannes 3.10.2026: saisiko latausilmaisimen videona tai gifina niin
 * etta sen voi jakaa WhatsAppissa tai somessa.
 *
 * RUUDUT RENDEROIDAAN LASKENNALLISESTI, EI KUVAKAAPPAUKSISTA. Samat
 * arvot kuin `app/components/Lataus.tsx`:ssa, joten jaettava kuva on
 * sama animaatio eika sinnepain. Kuvakaappaussarja olisi myos
 * epatasainen ja selaimen ruudunpaivityksen armoilla.
 *
 * ORTOGRAFINEN KIERTO = VAAKASUORA SKAALAUS. Komponentissa ei ole
 * perspektiivia (D-228), joten `rotateY(a)` on tasmalleen vaakasuora
 * skaalaus kertoimella cos(a) kiertoakselin ympari, ja peilaus kun
 * cos(a) < 0. Se on suoraan toistettavissa `sharp`illa.
 *
 *   npx tsx scripts/tee-lataus-animaatio.ts
 *
 * MP4 WHATSAPPIA VARTEN. WhatsApp kasittelee raahatun GIFin
 * dokumenttina eika toista sita; MP4:n se toistaa aina. Enkoodaus
 * erikseen, koska ffmpeg ei ole riippuvuus:
 *
 *   npm install --no-save ffmpeg-static
 *   FF=$(node -e "console.log(require('ffmpeg-static'))")
 *   "$FF" -y -stream_loop 2 -i public/jaettava/tyomaat-lataus.gif  *     -vf "scale=720:-2:flags=lanczos,fps=25"  *     -c:v libx264 -pix_fmt yuv420p -profile:v baseline -level 3.1  *     -crf 20 -movflags +faststart public/jaettava/tyomaat-lataus.mp4
 */

/* Kankaan mitat ja logon osien sijainnit (samat kuin komponentissa). */
const KANGAS_W = 978
const KANGAS_H = 304
const AKSELI = 213.5          // maston keskiviiva
const PUOMI_X = 131           // puomipalan vasen reuna kankaalla
const PUOMI_W = 262
const PUOMI_Y = 28
const PUOMI_H = 77
const TAAKKA_W = 95
const TAAKKA_H = 108
const TAAKKA_KESKI = 366.5    // = vaijerin keskiviiva, pala on symmetrinen
const TAAKKA_YLA = 142
const VAIJERI_YLA = 95
const VAIJERI_LEVEYS = 6
const NOSTO_PX = 35
const VARI = { r: 27, g: 74, b: 143 }   // #1b4a8f

/* Jaettavan kuvan kehys: logo keskelle, ilmaa ymparille. */
const ULOS_W = 640
const REUNUS = 40

/* 8 s, 15 ruutua sekunnissa. */
const KESTO_S = 8
const FPS = 15
const RUUTUJA = KESTO_S * FPS

type Avainruutu = [osuus: number, arvo: number]

/* CSS:n ease-in-out riittavan tarkasti. */
function pehmenna(t: number): number {
  return t * t * (3 - 2 * t)
}

function arvo(avaimet: Avainruutu[], t: number): number {
  if (t <= avaimet[0][0]) return avaimet[0][1]
  for (let i = 1; i < avaimet.length; i++) {
    const [p0, v0] = avaimet[i - 1]
    const [p1, v1] = avaimet[i]
    if (t <= p1) {
      if (p1 === p0) return v1
      return v0 + (v1 - v0) * pehmenna((t - p0) / (p1 - p0))
    }
  }
  return avaimet[avaimet.length - 1][1]
}

/* Samat vaiheet kuin komponentin @keyframes. */
const KULMA: Avainruutu[] = [
  [0, 0], [0.2, 0], [0.45, -180], [0.76, -180], [0.94, 0], [1, 0],
]
const NOSTO: Avainruutu[] = [
  [0, 0], [0.05, 0], [0.2, NOSTO_PX], [0.45, NOSTO_PX],
  [0.57, 0], [0.64, 0], [0.76, NOSTO_PX], [0.94, NOSTO_PX], [1, 0],
]

async function main() {
  const sharp = (await import("sharp")).default
  mkdirSync("public/jaettava", { recursive: true })

  const tausta = await sharp("public/logo-lataus-tausta.png").ensureAlpha().toBuffer()
  const puomiKoko = await sharp("public/logo-lataus-puomi.png")
    .extract({ left: PUOMI_X, top: PUOMI_Y, width: PUOMI_W, height: PUOMI_H })
    .toBuffer()
  const taakka = await sharp("public/logo-lataus-taakka.png").toBuffer()

  const ruudut: Buffer[] = []
  /*
   * RUUDUN MITAT LUETAAN RENDEROIDUSTA RUUDUSTA, EI LASKETA.
   * Ensimmainen versio laski korkeuden kaavalla ja erehtyi pikselin:
   * silloin raw-puskurin rivit menevat limittain ja GIF on pelkkaa
   * juovaa. Mitat eivat ole paateltavissa, ne ovat kysyttavissa.
   */
  let ruutuW = 0
  let ruutuH = 0

  for (let n = 0; n < RUUTUJA; n++) {
    const t = n / RUUTUJA
    const kulma = arvo(KULMA, t)
    const nosto = arvo(NOSTO, t)
    const s = Math.cos((kulma * Math.PI) / 180)
    const peilattu = s < 0
    const skaala = Math.abs(s)

    const kerrokset: any[] = [{ input: tausta, left: 0, top: 0 }]

    /* Puomi: vaakasuora skaalaus akselin ympari, peilaus kun cos < 0. */
    const puomiLeveys = Math.max(1, Math.round(PUOMI_W * skaala))
    if (puomiLeveys > 2) {
      let pala = sharp(puomiKoko).resize(puomiLeveys, PUOMI_H, { fit: "fill" })
      if (peilattu) pala = pala.flop()
      const vasenOsa = AKSELI - PUOMI_X                 // 82.5
      const oikeaOsa = PUOMI_X + PUOMI_W - AKSELI       // 178.5
      const vasen = Math.round(AKSELI - (peilattu ? oikeaOsa : vasenOsa) * skaala)
      kerrokset.push({ input: await pala.toBuffer(), left: vasen, top: PUOMI_Y })
    }

    /* Taakka kulkee kaarella mutta ei kierry: pysyy katsojaan pain. */
    const taakkaKeski = AKSELI + s * (TAAKKA_KESKI - AKSELI)
    const taakkaYla = TAAKKA_YLA - nosto
    const taakkaVasen = Math.round(taakkaKeski - TAAKKA_W / 2)

    /* Vaijeri: puomista taakan ylareunaan, samassa x:ssa. */
    const vaijeriKorkeus = Math.max(1, Math.round(taakkaYla - VAIJERI_YLA))
    const vaijeri = await sharp({
      create: {
        width: VAIJERI_LEVEYS, height: vaijeriKorkeus, channels: 4,
        background: { ...VARI, alpha: 1 },
      },
    }).png().toBuffer()
    kerrokset.push({
      input: vaijeri,
      left: Math.round(taakkaKeski - VAIJERI_LEVEYS / 2),
      top: VAIJERI_YLA,
    })

    kerrokset.push({ input: taakka, left: taakkaVasen, top: Math.round(taakkaYla) })

    /*
     * KAHDESSA VAIHEESSA. `sharp` ajaa `composite`n vasta `resize`n
     * jalkeen, joten yhdessa putkessa taustakuva olisi jo pienennettya
     * kangasta suurempi ("Image to composite must have same dimensions
     * or smaller").
     */
    const koottu = await sharp({
      create: {
        width: KANGAS_W, height: KANGAS_H, channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite(kerrokset)
      .png()
      .toBuffer()

    const { data: ruutu, info } = await sharp(koottu)
      .extend({
        top: REUNUS, bottom: REUNUS, left: REUNUS, right: REUNUS,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .resize({ width: ULOS_W })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    if (!ruutuW) { ruutuW = info.width; ruutuH = info.height }
    if (info.width !== ruutuW || info.height !== ruutuH) {
      throw new Error(`ruutu ${n} on ${info.width}x${info.height}, odotettiin ${ruutuW}x${ruutuH}`)
    }

    ruudut.push(ruutu)
    if (n % 20 === 0) console.log(`  ruutu ${n}/${RUUTUJA}`)
  }

  const nippu = Buffer.concat(ruudut)
  const viive = Math.round(1000 / FPS)

  console.log(`\n${RUUTUJA} ruutua, ${ULOS_W}x${ruutuH}, viive ${viive} ms`)

  /*
   * `pageHeight` KUULUU RAW-OBJEKTIN SISAAN. Juureen annettuna sharp
   * kirjoittaa yhden pitkan kuvan (pages 1) eika animaatiota — testattu.
   */
  const syote = { raw: { width: ruutuW, height: ruutuH * RUUTUJA, channels: 3, pageHeight: ruutuH } }

  /*
   * VIIVE ON ANNETTAVA TAULUKKONA, yksi arvo per ruutu. Yhtena lukuna
   * sharp asettaa sen vain ensimmaiselle ruudulle ja loput saavat 0 ms,
   * jolloin koko animaatio kestaa 0,07 s — mitattu.
   */
  const viiveet = new Array(RUUTUJA).fill(viive)

  await sharp(nippu, syote as any)
    .gif({ loop: 0, delay: viiveet })
    .toFile("public/jaettava/tyomaat-lataus.gif")

  const { statSync } = await import("node:fs")
  for (const f of ["public/jaettava/tyomaat-lataus.gif"]) {
    const m = await sharp(f, { animated: true }).metadata()
    console.log(`${f}  ${(statSync(f).size / 1024).toFixed(0)} kt  ${m.width}x${m.pageHeight}  ${m.pages} ruutua`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
