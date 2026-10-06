/*
 * YHTEYSHENKILON TASO ASIAKKAALLE (D-241).
 *
 * Johannes 6.10.2026: *"yrityskohtainen tieto on parempi kun ei tietoa
 * ollenkaan. voi se olla jos se kerrotaan kayttajalle selvasti."*
 *
 * Merkinta naytetaan VAIN yrityskohtaiselle. Hankekohtainen on se mita
 * asiakas odottaa saavansa, eika odotettua tarvitse selittaa — merkinta
 * jokaisella rivilla vain hukuttaisi poikkeuksen.
 *
 * Sanamuoto kertoo mita puuttuu, ei mita on: "ei tiedossa taman
 * tyomaan omaa yhteyshenkiloa" on asiakkaalle tarkeampi kuin se etta
 * numero kuuluu yritykselle. Han paattaa soittaako.
 */
export default function YhteyshenkilonTaso({
  level,
}: {
  level?: string | null
}) {
  if (String(level ?? "project") !== "company") return null

  return (
    <span
      title="Tämän työmaan omaa yhteyshenkilöä ei ole tiedossa"
      style={{
        marginLeft: 6,
        padding: "1px 7px",
        borderRadius: 999,
        background: "#f3f4f6",
        border: "1px solid #e5e7eb",
        color: "#6b7280",
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      yrityksen yhteyshenkilö
    </span>
  )
}
