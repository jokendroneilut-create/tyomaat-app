import { VAIHEEN_NIMI, type Kattavuus } from "@/lib/metrics/yhteystiedonKattavuus"
import {
  MITTARI,
  VYOHYKKEET,
  mittarinKaari,
  mittarinPiste,
} from "@/lib/metrics/mittarinGeometria"

/*
 * ANALOGINEN MITTARI YHTEYSTIEDON KATTAVUUDELLE (D-239).
 *
 * Johannes 6.10.2026 toi mallikuvan huoneilmamittarista: puoliympyra,
 * neula ja varivyohykkeet. Analoginen taulu kertoo yhdella silmayksella
 * missa ollaan suhteessa tavoitteeseen; pelkka prosenttiluku ei kerro
 * onko 63 hyva vai huono.
 *
 * VYOHYKKEET ON VALITTU MITATUSTA LAHTOTASOSTA, ei pyoreista luvuista:
 * 6.10.2026 rakenteilla 63 % ja suunnittelussa 48 %. Molemmat osuvat
 * keltaiselle, mika on rehellinen lahtoasento — vihrea pitaa ansaita.
 *
 * LUKEMA MYOS NUMEROINA mittarin alle (Johannes): neula kertoo suunnan,
 * numero kertoo tarkan arvon, ja osoittaja/nimittaja kertoo mista
 * joukosta on kyse. Pelkka prosentti ei erota 60:ta prosenttia kolmesta
 * hankkeesta 60:sta prosentista 725:sta.
 */

const { leveys: LEVEYS, korkeus: KORKEUS, keskiX: KESKI_X, keskiY: KESKI_Y, sade: SADE } = MITTARI

const piste = mittarinPiste
const kaari = mittarinKaari

export default function KattavuusMittari({ kattavuus }: { kattavuus: Kattavuus }) {
  const { osuus, hankkeita, yhteystiedolla, vaihe } = kattavuus
  const prosentti = Math.round(osuus * 100)
  const neula = piste(osuus, SADE - 8)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-700">{VAIHEEN_NIMI[vaihe]}</h3>

      <svg
        viewBox={`0 0 ${LEVEYS} ${KORKEUS}`}
        className="mt-2 w-full"
        role="img"
        aria-label={`${VAIHEEN_NIMI[vaihe]}: ${prosentti} prosentilla hankkeista on yhteyshenkilo`}
      >
        {VYOHYKKEET.map((v) => (
          <path
            key={v.nimi}
            d={kaari(v.alku, v.loppu, SADE)}
            stroke={v.vari}
            strokeWidth={MITTARI.paksuus}
            fill="none"
            strokeLinecap="butt"
          />
        ))}

        {[0, 0.25, 0.5, 0.75, 1].map((kohta) => {
          const ulko = piste(kohta, SADE + MITTARI.paksuus / 2 + 2)
          const sisa = piste(kohta, SADE + MITTARI.paksuus / 2 - 3)
          const teksti = piste(kohta, MITTARI.nimikkeenSade)
          return (
            <g key={kohta}>
              <line
                x1={ulko.x}
                y1={ulko.y}
                x2={sisa.x}
                y2={sisa.y}
                stroke="#9ca3af"
                strokeWidth={1.5}
              />
              <text
                x={teksti.x}
                y={teksti.y + 4}
                textAnchor="middle"
                fontSize={11}
                fill="#6b7280"
              >
                {kohta * 100}
              </text>
            </g>
          )
        })}

        <line
          x1={KESKI_X}
          y1={KESKI_Y}
          x2={neula.x}
          y2={neula.y}
          stroke="#111827"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <circle cx={KESKI_X} cy={KESKI_Y} r={6} fill="#111827" />
      </svg>

      <p className="mt-1 text-center text-3xl font-bold tabular-nums text-gray-900">
        {prosentti} %
      </p>
      <p className="text-center text-sm text-gray-500">
        {yhteystiedolla.toLocaleString("fi-FI")} / {hankkeita.toLocaleString("fi-FI")} hanketta
      </p>
    </div>
  )
}
