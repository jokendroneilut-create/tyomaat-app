import { VAIHEEN_NIMI, type MitattavaVaihe } from "@/lib/metrics/yhteystiedonKattavuus"

/*
 * KATTAVUUDEN KEHITYS (D-239).
 *
 * Johannes 6.10.2026: *"voisi olla myos pieni grafiikka mihin suuntaan
 * tuo lukema kehittyy."*
 *
 * SARJA ALKAA TYHJANA, EIKA SITA TAYTETA ARVAUKSILLA. Yhteystiedot
 * elavat hankkeen metadatassa ilman versiota, joten eilista lukemaa ei
 * ole missaan. Kokeilin laskea trendin tuontikuukauden mukaan ja se
 * heiluu volyymin mukaan eika laadun: suunnitteluvaihe nayttaisi
 * kesakuussa 100 %, mutta se oli yksi hanke.
 *
 * Siksi tassa nakyy vain mitattu tieto. Yhdella pisteella piirretaan
 * piste eika viivaa — viiva vaittaisi kehityssuunnan jota ei ole
 * mitattu.
 */

export type Piste = { paiva: string; osuus: number }

const LEVEYS = 220
const KORKEUS = 110
const MARGIN = { ylos: 10, alas: 20, vasen: 26, oikea: 8 }

export default function KattavuusTrendi({
  vaihe,
  pisteet,
}: {
  vaihe: MitattavaVaihe
  pisteet: Piste[]
}) {
  const piirtoLeveys = LEVEYS - MARGIN.vasen - MARGIN.oikea
  const piirtoKorkeus = KORKEUS - MARGIN.ylos - MARGIN.alas

  const x = (i: number) =>
    MARGIN.vasen + (pisteet.length <= 1 ? piirtoLeveys / 2 : (i / (pisteet.length - 1)) * piirtoLeveys)
  const y = (osuus: number) => MARGIN.ylos + piirtoKorkeus * (1 - Math.min(1, Math.max(0, osuus)))

  const polku = pisteet.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.osuus).toFixed(1)}`).join(" ")

  const ensimmainen = pisteet[0]
  const viimeinen = pisteet[pisteet.length - 1]
  const muutos =
    pisteet.length > 1 ? Math.round((viimeinen.osuus - ensimmainen.osuus) * 100) : null

  const lyhytPaiva = (paiva: string) => paiva.slice(8, 10) + "." + paiva.slice(5, 7) + "."

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-700">
        {VAIHEEN_NIMI[vaihe]} — kehitys
      </h3>

      <svg viewBox={`0 0 ${LEVEYS} ${KORKEUS}`} className="mt-2 w-full" role="img">
        {[0, 0.5, 1].map((taso) => (
          <g key={taso}>
            <line
              x1={MARGIN.vasen}
              y1={y(taso)}
              x2={LEVEYS - MARGIN.oikea}
              y2={y(taso)}
              stroke="#e5e7eb"
              strokeWidth={1}
            />
            <text x={MARGIN.vasen - 5} y={y(taso) + 3} textAnchor="end" fontSize={9} fill="#9ca3af">
              {taso * 100}
            </text>
          </g>
        ))}

        {pisteet.length > 1 && (
          <path d={polku} fill="none" stroke="#2563eb" strokeWidth={2} strokeLinejoin="round" />
        )}

        {pisteet.map((p, i) => (
          <circle key={p.paiva} cx={x(i)} cy={y(p.osuus)} r={pisteet.length === 1 ? 4 : 2.5} fill="#2563eb" />
        ))}

        {pisteet.length > 0 && (
          <text x={x(0)} y={KORKEUS - 6} textAnchor="middle" fontSize={9} fill="#9ca3af">
            {lyhytPaiva(ensimmainen.paiva)}
          </text>
        )}
        {pisteet.length > 1 && (
          <text
            x={x(pisteet.length - 1)}
            y={KORKEUS - 6}
            textAnchor="middle"
            fontSize={9}
            fill="#9ca3af"
          >
            {lyhytPaiva(viimeinen.paiva)}
          </text>
        )}
      </svg>

      {pisteet.length <= 1 ? (
        <p className="mt-1 text-center text-sm text-gray-500">
          Mittaus alkoi {pisteet.length === 1 ? lyhytPaiva(ensimmainen.paiva) : "tänään"}
        </p>
      ) : (
        <p className="mt-1 text-center text-sm text-gray-500">
          {muutos === 0
            ? "Ennallaan"
            : `${muutos! > 0 ? "+" : ""}${muutos} prosenttiyksikköä`}{" "}
          · {pisteet.length} mittauspäivää
        </p>
      )}
    </div>
  )
}
