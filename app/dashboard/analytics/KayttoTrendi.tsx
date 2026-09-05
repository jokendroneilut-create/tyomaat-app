"use client"

import { useEffect, useState } from "react"

import { akselinYlaraja } from "@/lib/analytics/kayttoyhteenveto"

/*
 * KOKO JOUKON KÄYTTÖ JA SEN KEHITYS, Google Analyticsin tapaan.
 *
 * Sivun muut osiot ovat top-5-listoja: ne kertovat KUKA ja MITÄ, mutta
 * eivät suuntaa. Tämä osio vastaa kysymykseen kasvaako vai väheneekö
 * käyttö — neljä tunnuslukua, kunkin vieressä muutos edelliseen yhtä
 * pitkään jaksoon, ja päiväkohtainen pylväikkö alla.
 *
 * Pylväikkö on tehty div-elementeistä eikä kirjastosta: yksi mittari,
 * yksi sarja — kirjasto olisi enemmän koodia kuin itse kuva.
 */

type Sarja = {
  paiva: string
  kayttajia: number
  istuntoja: number
  sivulatauksia: number
  sekunteja: number
}

type Vastaus = {
  ok: boolean
  paivia: number
  jakso: { alku: string; loppu: string }
  sarja: Sarja[]
  nyt: {
    kayttajia: number
    istuntoja: number
    sivulatauksia: number
    sekunteja: number
    keskiIstuntoSek: number
  }
  muutos: Record<string, number | null>
  sivut: { path: string; sekunteja: number }[]
  error?: string
}

type Mittari = "kayttajia" | "istuntoja" | "sivulatauksia" | "sekunteja"

const MITTARIN_NIMI: Record<Mittari, string> = {
  kayttajia: "käyttäjää",
  istuntoja: "istuntoa",
  sivulatauksia: "sivulatausta",
  sekunteja: "minuuttia",
}

function kesto(sekunteja: number) {
  if (sekunteja < 60) return `${Math.round(sekunteja)} s`
  const min = Math.round(sekunteja / 60)
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${min % 60} min`
}

/* Päivä lyhyeen suomalaiseen muotoon: "2026-09-05" -> "5.9." */
function lyhytPaiva(iso: string) {
  const [, kk, pp] = iso.split("-")
  return `${Number(pp)}.${Number(kk)}.`
}

function Muutos({ arvo }: { arvo: number | null }) {
  if (arvo === null) {
    return <span style={{ fontSize: 12, color: "#9ca3af" }}>ei vertailukohtaa</span>
  }
  const nousee = arvo >= 0
  return (
    <span style={{ fontSize: 12, color: nousee ? "#15803d" : "#b91c1c", fontWeight: 600 }}>
      {nousee ? "▲" : "▼"} {Math.abs(arvo)} % vs. edellinen jakso
    </span>
  )
}

function Kortti({
  otsikko,
  arvo,
  muutos,
  valittu,
  onClick,
}: {
  otsikko: string
  arvo: string
  muutos: number | null
  valittu: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: "1 1 150px",
        textAlign: "left",
        padding: 14,
        borderRadius: 10,
        border: valittu ? "2px solid #2563eb" : "1px solid #e5e7eb",
        background: valittu ? "#eff6ff" : "#fff",
        cursor: "pointer",
      }}
    >
      <div style={{ fontSize: 13, color: "#6b7280" }}>{otsikko}</div>
      <div style={{ fontSize: 24, fontWeight: 700, margin: "4px 0" }}>{arvo}</div>
      <Muutos arvo={muutos} />
    </button>
  )
}

export default function KayttoTrendi() {
  const [data, setData] = useState<Vastaus | null>(null)
  const [virhe, setVirhe] = useState<string | null>(null)
  const [paivia, setPaivia] = useState(30)
  const [mittari, setMittari] = useState<Mittari>("kayttajia")
  const [osoitettu, setOsoitettu] = useState<number | null>(null)

  useEffect(() => {
    let peruttu = false
    setData(null)
    setVirhe(null)
    setOsoitettu(null)

    fetch(`/api/admin/usage-trend?days=${paivia}`)
      .then((r) => r.json())
      .then((json) => {
        if (peruttu) return
        if (json.error) setVirhe(json.error)
        else setData(json)
      })
      .catch(() => {
        if (!peruttu) setVirhe("Käyttötrendin haku epäonnistui")
      })

    return () => {
      peruttu = true
    }
  }, [paivia])

  const sarja = data?.sarja ?? []

  /*
   * AIKA NÄYTETÄÄN MINUUTTEINA, MUUT KAPPALEINA. Sekunnit ovat oikea
   * yksikkö laskentaan mutta väärä lukemiseen: kahdeksan tunnin päivä
   * olisi 28 800 eikä kertoisi mitään.
   */
  const naytto = (arvo: number) => (mittari === "sekunteja" ? Math.round(arvo / 60) : arvo)
  const huippu = Math.max(1, ...sarja.map((r) => naytto(Number(r[mittari] ?? 0))))

  /*
   * Ylin viiva on tasaluku eikä satunnainen huippuarvo (47 -> 50).
   * Laskenta on omana testattuna funktionaan, koska pyöristys menee
   * helposti pieleen juuri pienillä luvuilla.
   */
  const ylaraja = akselinYlaraja(huippu)

  return (
    <section
      style={{
        marginTop: 24,
        padding: 16,
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ fontSize: 16, margin: 0 }}>📈 Käytön kehitys</h2>
        <div style={{ display: "flex", gap: 6 }}>
          {[7, 30, 90].map((n) => (
            <button
              key={n}
              onClick={() => setPaivia(n)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
                background: paivia === n ? "#111827" : "#fff",
                color: paivia === n ? "#fff" : "#374151",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {n} pv
            </button>
          ))}
        </div>
      </div>

      {virhe && <p style={{ color: "#b91c1c", marginTop: 12 }}>{virhe}</p>}
      {!data && !virhe && <p style={{ marginTop: 12, color: "#6b7280" }}>Ladataan…</p>}

      {data && (
        <>
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <Kortti
              otsikko="Käyttäjät"
              arvo={String(data.nyt.kayttajia)}
              muutos={data.muutos.kayttajia}
              valittu={mittari === "kayttajia"}
              onClick={() => setMittari("kayttajia")}
            />
            <Kortti
              otsikko="Istunnot"
              arvo={String(data.nyt.istuntoja)}
              muutos={data.muutos.istuntoja}
              valittu={mittari === "istuntoja"}
              onClick={() => setMittari("istuntoja")}
            />
            <Kortti
              otsikko="Sivulataukset"
              arvo={String(data.nyt.sivulatauksia)}
              muutos={data.muutos.sivulatauksia}
              valittu={mittari === "sivulatauksia"}
              onClick={() => setMittari("sivulatauksia")}
            />
            <Kortti
              otsikko="Istunnon keskikesto"
              arvo={kesto(data.nyt.keskiIstuntoSek)}
              muutos={data.muutos.keskiIstuntoSek}
              valittu={mittari === "sekunteja"}
              onClick={() => setMittari("sekunteja")}
            />
          </div>

          {/* Osoitettu päivä: sama tieto kuin pylväässä, mutta luettavana. */}
          <div style={{ marginTop: 16, height: 20, fontSize: 13 }}>
            {osoitettu !== null && sarja[osoitettu] ? (
              <span>
                <strong>{sarja[osoitettu].paiva}</strong>{" "}
                <span style={{ color: "#2563eb", fontWeight: 700 }}>
                  {naytto(Number(sarja[osoitettu][mittari] ?? 0))}
                </span>{" "}
                <span style={{ color: "#6b7280" }}>{MITTARIN_NIMI[mittari]}</span>
              </span>
            ) : (
              <span style={{ color: "#9ca3af" }}>
                Vie osoitin pylvään päälle nähdäksesi päivän.
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            {/* Y-AKSELI: kolme arvoa ja yksikkö. */}
            <div
              style={{
                width: 52,
                height: 150,
                position: "relative",
                fontSize: 11,
                color: "#9ca3af",
                textAlign: "right",
              }}
            >
              {[1, 0.5, 0].map((osuus) => (
                <div
                  key={osuus}
                  style={{
                    position: "absolute",
                    top: `${(1 - osuus) * 100}%`,
                    right: 6,
                    transform: "translateY(-50%)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {Math.round(ylaraja * osuus)}
                </div>
              ))}
            </div>

            <div style={{ position: "relative", flex: 1, height: 150 }}>
              {/* Vaakaviivat samoille kohdille kuin akselin arvot. */}
              {[1, 0.5, 0].map((osuus) => (
                <div
                  key={osuus}
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: `${(1 - osuus) * 100}%`,
                    borderTop: osuus === 0 ? "1px solid #d1d5db" : "1px dashed #f0f0f0",
                  }}
                />
              ))}

              <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: "100%" }}>
                {sarja.map((r, i) => {
                  const arvo = naytto(Number(r[mittari] ?? 0))
                  const korostettu = osoitettu === i
                  return (
                    <div
                      key={r.paiva}
                      onMouseEnter={() => setOsoitettu(i)}
                      onMouseLeave={() => setOsoitettu(null)}
                      title={`${r.paiva}: ${arvo} ${MITTARIN_NIMI[mittari]}`}
                      style={{
                        flex: 1,
                        minWidth: 2,
                        height: "100%",
                        display: "flex",
                        alignItems: "flex-end",
                        cursor: "default",
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: `${Math.max(1, (arvo / ylaraja) * 100)}%`,
                          background: arvo === 0 ? "#f3f4f6" : korostettu ? "#1d4ed8" : "#2563eb",
                          borderRadius: "2px 2px 0 0",
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ width: 34, fontSize: 11, color: "#6b7280", alignSelf: "flex-start" }}>
              {mittari === "sekunteja" ? "min" : "kpl"}
            </div>
          </div>

          {/* X-AKSELI: päivämäärät tasavälein, ei jokaista. */}
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ width: 52 }} />
            <div style={{ display: "flex", flex: 1, fontSize: 11, color: "#6b7280", marginTop: 4 }}>
              {sarja.map((r, i) => {
                const vali = Math.max(1, Math.round(sarja.length / 6))
                const nakyy = i % vali === 0 || i === sarja.length - 1
                return (
                  <div key={r.paiva} style={{ flex: 1, minWidth: 2, textAlign: "left", whiteSpace: "nowrap" }}>
                    {nakyy ? lyhytPaiva(r.paiva) : ""}
                  </div>
                )
              })}
            </div>
            <div style={{ width: 34 }} />
          </div>

          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 12 }}>
            Istunto katkeaa yli 30 minuutin tauosta, kuten Google Analyticsissä.
            Aika lasketaan sivulatausten kestojen summana, joten viimeinen sivu jää
            aina hieman aliarvioiduksi. Adminien oma käyttö on suodatettu pois.
          </p>
        </>
      )}
    </section>
  )
}
