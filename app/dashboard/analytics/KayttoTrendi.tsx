"use client"

import { useEffect, useState } from "react"

/*
 * KOKO JOUKON KÄYTTÖ JA SEN KEHITYS, Google Analyticsin tapaan.
 *
 * Sivun muut osiot ovat top-5-listoja: ne kertovat KUKA ja MITÄ, mutta
 * eivät suuntaa. Tämä osio vastaa kysymykseen kasvaako vai väheneekö
 * käyttö — neljä tunnuslukua, kunkin vieressä muutos edelliseen yhtä
 * pitkään jaksoon, ja päiväkohtainen pylväikkö alla.
 *
 * Pylväikkö on tehty div-elementeistä eikä kirjastosta: yksi mittari,
 * yksi sarja, ei vuorovaikutusta — kirjasto olisi enemmän koodia kuin
 * itse kuva.
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

function kesto(sekunteja: number) {
  if (sekunteja < 60) return `${Math.round(sekunteja)} s`
  const min = Math.round(sekunteja / 60)
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${min % 60} min`
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

  useEffect(() => {
    let peruttu = false
    setData(null)
    setVirhe(null)

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

  const huippu = Math.max(1, ...(data?.sarja ?? []).map((r) => Number(r[mittari] ?? 0)))

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

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 2,
              height: 140,
              marginTop: 18,
              paddingTop: 8,
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            {data.sarja.map((r) => {
              const arvo = Number(r[mittari] ?? 0)
              return (
                <div
                  key={r.paiva}
                  title={`${r.paiva}: ${mittari === "sekunteja" ? kesto(arvo) : arvo}`}
                  style={{
                    flex: 1,
                    height: `${Math.max(2, (arvo / huippu) * 100)}%`,
                    background: arvo === 0 ? "#f3f4f6" : "#2563eb",
                    borderRadius: "2px 2px 0 0",
                    minWidth: 2,
                  }}
                />
              )
            })}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              color: "#6b7280",
              marginTop: 4,
            }}
          >
            <span>{data.jakso.alku}</span>
            <span>{data.jakso.loppu}</span>
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
