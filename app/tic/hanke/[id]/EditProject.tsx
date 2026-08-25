"use client"

import { useRouter } from "next/navigation"
import ContactsEditor, {
  contactsPayload,
  type EditableContact,
} from "@/app/tic/components/ContactsEditor"
import { useState } from "react"
import { CANONICAL_PHASES } from "@/lib/projects/phases"
import { REGIONS } from "@/lib/geo/municipalities"

const PHASE_OPTIONS = CANONICAL_PHASES.map((p) => p.label)

/*
 * Hyväksytyn hankkeen kenttien korjaus (D-076).
 *
 * Erillinen `EditableCandidate`ista, koska ne kirjoittavat eri tauluun:
 * tämä `projects`iin, se `potential_projects`iin. Yhdistäminen näyttäisi
 * säästöltä mutta piilottaisi juuri sen eron joka aiheutti alkuperäisen
 * ongelman — käsin syötetyt tiedot menivät ehdokkaalle eivätkä koskaan
 * päätyneet hankkeelle.
 */


type Props = {
  projectId: string
  initial: {
    name: string
    region: string
    city: string
    location: string
    developer: string
    builder: string
    propertyType: string
    phase: string
    estimatedCost: string
    estimatedCompletion: string
    apartments: string
    floorArea: string
    constructionStart: string
    expireAt: string
    additionalInfo: string
  }
  initialContacts: EditableContact[]
}

const FIELD_LABELS: Record<keyof Props["initial"], string> = {
  name: "Nimi",
  region: "Maakunta",
  city: "Kaupunki",
  location: "Sijainti / osoite",
  developer: "Rakennuttaja",
  builder: "Pääurakoitsija",
  propertyType: "Kohdetyyppi",
  phase: "Vaihe",
  estimatedCost: "Arvioitu kustannus (€)",
  estimatedCompletion: "Arvioitu valmistuminen",
  apartments: "Asuntoja",
  floorArea: "Kerrosala (m²)",
  constructionStart: "Rakentamisen aloitus",
  expireAt: "Vanhenee",
  additionalInfo: "Kuvaus",
}


export default function EditProject({ projectId, initial, initialContacts }: Props) {
  const router = useRouter()
  const [values, setValues] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string[] | null>(null)

  /*
   * LOMAKKEEN TILA ON SYNKATTAVA PROPSIIN — muuten se kumoaa muut muutokset.
   *
   * `useState(initial)` alustaa vain kerran eikä päivity kun propsi muuttuu.
   * Kun ehdotus hyväksytään, kortti kirjoittaa arvon ja kutsuu
   * `router.refresh()`: palvelin renderöi uuden arvon, mutta lomakkeen oma
   * tila jää vanhaan tyhjään. Silloin `changedKeys` näkee eron ja tulkitsee
   * sen KÄYTTÄJÄN tyhjennykseksi — "Tallenna" kirjoittaa tyhjän juuri
   * hyväksytyn arvon päälle.
   *
   * Mitattu 16.8.2026: hanke "Asunto Oy Hyvinkään Altus" menetti näin
   * urakoitsijansa kahdesti peräkkäin, ja tallennus näytti onnistuneen.
   *
   * Synkataan kun palvelimen data OIKEASTI muuttuu, ei joka renderillä —
   * muuten kesken oleva kirjoitus katoaisi näppäimen alta.
   */
  /*
   * Yhteystiedot ovat lista objekteja eivätkä mahdu `values`-tauluun, joten
   * ne pidetään erillisessä tilassa. Ne tallentuvat samalla painikkeella,
   * koska kaksi tallennusta samalla sivulla johtaisi ennen pitkää siihen
   * että toinen unohtuu.
   */
  const [contacts, setContacts] = useState<EditableContact[]>(initialContacts)

  /*
   * Yhteystiedot kuuluvat samaan synkronointiin: jos ne jäisivät pois
   * avaimesta, palvelimen palauttama korjattu lista ei koskaan päivittyisi
   * lomakkeelle — se on juuri se hiljainen katoaminen jota tämä lohko
   * estää.
   */
  const initialKey = JSON.stringify({ initial, initialContacts })
  const [syncedKey, setSyncedKey] = useState(initialKey)

  if (syncedKey !== initialKey) {
    setSyncedKey(initialKey)
    setValues(initial)
    setContacts(initialContacts)
    setSaved(null)
  }

  const set = (key: keyof Props["initial"]) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }))
  const contactsChanged =
    JSON.stringify(contactsPayload(contacts)) !== JSON.stringify(initialContacts)


  const changedKeys = (Object.keys(values) as (keyof Props["initial"])[]).filter(
    (key) => values[key] !== initial[key]
  )

  const muutoksia = changedKeys.length + (contactsChanged ? 1 : 0)

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(null)

    try {
      /*
       * Lähetetään vain muuttuneet kentät. Reitti tulkitsee tyhjän
       * merkkijonon tyhjennykseksi, joten koko lomakkeen lähettäminen
       * pyyhkisi kentät joita ei ole ladattu lomakkeelle.
       */
      const fields: Record<string, unknown> = {}

      const NUMEROT: Record<string, string> = {
        estimatedCost: "estimated_cost",
        apartments: "apartments",
        floorArea: "floor_area",
      }

      const NIMET: Record<string, string> = {
        propertyType: "property_type",
        additionalInfo: "additional_info",
        estimatedCompletion: "estimated_completion",
        constructionStart: "construction_start",
        expireAt: "expire_at",
      }

      for (const key of changedKeys) {
        const value = values[key]

        if (key in NUMEROT) {
          fields[NUMEROT[key]] = value.trim() === "" ? null : Number(value)
          continue
        }

        fields[NIMET[key] ?? key] = value
      }

      if (contactsChanged) {
        fields.contact_persons = contactsPayload(contacts)
      }

      const response = await fetch("/api/tic/projects/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, fields }),
      })

      const result = await response.json()

      if (!response.ok || !result?.ok) {
        setError(result?.error ?? "Tallennus epäonnistui")
        return
      }

      setSaved(result.changed ?? [])
      router.refresh()
    } catch (err: any) {
      setError(String(err?.message ?? err))
    } finally {
      setSaving(false)
    }
  }

  const textField = (key: keyof Props["initial"]) => (
    <label key={key} className="block">
      <span className="text-sm font-medium text-gray-700">{FIELD_LABELS[key]}</span>
      <input
        type="text"
        value={values[key]}
        onChange={(e) => set(key)(e.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
    </label>
  )

  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Korjaa tietoja</h2>

      <p className="mt-1 text-sm text-gray-600">
        Käsin syötetty arvo on vahvin: se ei kumoudu seuraavalla poiminnalla.
        Tyhjä kenttä tyhjentää arvon.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {textField("name")}
        {textField("developer")}
        {textField("builder")}
        {textField("propertyType")}

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Maakunta</span>
          <select
            value={values.region}
            onChange={(e) => set("region")(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        {textField("city")}
        {textField("location")}

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Vaihe</span>
          <select
            value={values.phase}
            onChange={(e) => set("phase")(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {PHASE_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        {textField("estimatedCost")}
        {textField("estimatedCompletion")}
        {textField("apartments")}
        {textField("floorArea")}

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Rakentamisen aloitus</span>
          <input
            type="date"
            value={values.constructionStart}
            onChange={(e) => set("constructionStart")(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        {/*
          * VANHENEMINEN. Hyväksynnässä on ruksi "aseta vanhenemaan", mutta
          * jos se unohtuu, päivää ei voinut asettaa jälkikäteen millään.
          * Painike laskee saman säännön mukaan kuin hyväksyntä.
          */}
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Vanhenee</span>
          <input
            type="date"
            value={values.expireAt}
            onChange={(e) => set("expireAt")(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <span className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => {
                const d = new Date()
                d.setFullYear(d.getFullYear() + 1)
                set("expireAt")(d.toISOString().slice(0, 10))
              }}
              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700"
            >
              Vuoden kuluttua
            </button>
            <button
              type="button"
              onClick={() => set("expireAt")("")}
              disabled={!values.expireAt}
              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 disabled:opacity-40"
            >
              Ei vanhene
            </button>
          </span>
        </label>
      </div>

      <label className="mt-4 block">
        <span className="text-sm font-medium text-gray-700">Kuvaus</span>
        <textarea
          value={values.additionalInfo}
          onChange={(e) => set("additionalInfo")(e.target.value)}
          rows={6}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </label>

      <div className="mt-6">
        <ContactsEditor contacts={contacts} onChange={setContacts} disabled={saving} />
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || muutoksia === 0}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {saving ? "Tallennetaan…" : `Tallenna (${muutoksia})`}
        </button>

        <button
          type="button"
          onClick={() => {
            setValues(initial)
            setContacts(initialContacts)
            setError(null)
            setSaved(null)
          }}
          disabled={saving || muutoksia === 0}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-40"
        >
          Peruuta
        </button>

        {saved && (
          <span className="text-sm text-green-700">
            {saved.length ? `Tallennettu: ${saved.join(", ")}` : "Ei muutoksia"}
          </span>
        )}

        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </section>
  )
}
