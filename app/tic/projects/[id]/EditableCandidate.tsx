"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import ContactsEditor, {
  contactsPayload,
  type EditableContact,
} from "@/app/tic/components/ContactsEditor"
import { CANONICAL_PHASES } from "@/lib/projects/phases"
import { REGIONS } from "@/lib/geo/municipalities"

const PHASE_OPTIONS = CANONICAL_PHASES.map((p) => p.label)

type Props = {
  candidateId: string
  initial: {
    title: string
    region: string
    city: string
    address: string
    developer: string
    builder: string
    relatedCompanies: string
    buildingType: string
    phaseHint: string
  }
  /*
   * Yhteyshenkilot: naita ei voinut korjata jonossa lainkaan, joten vaarin
   * poimittu osoite siirtyi hyvaksynnassa hankkeelle ja virhe piti korjata
   * kahdesti (D-124).
   */
  initialContacts: EditableContact[]
  /*
   * Kentän alkuperä: mistä arvo on peräisin. Ilman tätä katselmoija
   * hyväksyy sokkona — esikatselu näyttää arvot muttei sitä, tuliko kenttä
   * lähteestä valmiina, poimittiinko se tiedotteen tekstistä vai
   * pääteltiinkö se julkaisijasta.
   *
   * Vanhoilla riveillä tietoa ei ole, jolloin merkintä jätetään pois —
   * tyhjä on rehellisempi kuin arvattu alkuperä.
   */
  sources?: Record<string, string | null | undefined>
  /* Kadunnimi ilman talonumeroa: näytetään vihjeenä, ei osoitteena. */
  streetHint?: string | null
}

/* Pieni merkintä kentän otsikon perässä. */
function Source({ value }: { value?: string | null }) {
  if (!value) return null

  const style =
    value === "teksti"
      ? "bg-blue-50 text-blue-700"
      : value === "julkaisija"
        ? "bg-amber-50 text-amber-700"
        : "bg-gray-100 text-gray-600"

  return (
    <span
      className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${style}`}
      title={
        value === "teksti"
          ? "Poimittu tiedotteen leipätekstistä säännöllä"
          : value === "julkaisija"
            ? "Päätelty siitä kuka tiedotteen julkaisi"
            : "Tuli lähteestä valmiina"
      }
    >
      {value}
    </span>
  )
}

export default function EditableCandidate({
  candidateId,
  initial,
  initialContacts,
  sources = {},
  streetHint,
}: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState(initial.title)
  const [region, setRegion] = useState(initial.region)
  const [city, setCity] = useState(initial.city)
  const [address, setAddress] = useState(initial.address)
  const [developer, setDeveloper] = useState(initial.developer)
  const [builder, setBuilder] = useState(initial.builder)
  const [relatedCompanies, setRelatedCompanies] = useState(initial.relatedCompanies)
  const [buildingType, setBuildingType] = useState(initial.buildingType)
  const [phaseHint, setPhaseHint] = useState(initial.phaseHint)
  const [contacts, setContacts] = useState<EditableContact[]>(initialContacts)

  function cancelEdit() {
    setTitle(initial.title)
    setRegion(initial.region)
    setCity(initial.city)
    setAddress(initial.address)
    setDeveloper(initial.developer)
    setBuilder(initial.builder)
    setRelatedCompanies(initial.relatedCompanies)
    setBuildingType(initial.buildingType)
    setPhaseHint(initial.phaseHint)
    setContacts(initialContacts)
    setError(null)
    setEditing(false)
  }

  async function save() {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch("/api/tic/projects/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          potentialProjectId: candidateId,
          title,
          region,
          municipality: city,
          address,
          developer,
          builder,
          relatedCompanies,
          buildingType,
          phaseHint,
          contactPersons: contactsPayload(contacts),
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Tallennus epäonnistui")
      }

      setEditing(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message ?? "Tuntematon virhe")
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div>
        <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 text-sm text-gray-800 md:grid-cols-2">
          <p><strong>Maakunta:</strong> {region || "-"}</p>
          <p><strong>Kaupunki:</strong> {city || "-"}<Source value={sources.city} /></p>
          <p>
            <strong>Sijainti / osoite:</strong> {address || "-"}
            <Source value={sources.location} />
            {/*
              * Kadunnimi ilman talonumeroa näytetään erikseen vihjeenä. Se ei
              * kelpaa osoitteeksi täsmäytykseen, mutta katselmoijalle se on
              * tarkempi kuin pelkkä kaupunki — ja usein ainoa mitä tekstissä
              * on ("Nokian Pinsiöntielle").
              */}
            {!address && streetHint ? (
              <span className="ml-2 text-gray-500">
                katu tekstissä: <strong>{streetHint}</strong> (ei talonumeroa)
              </span>
            ) : null}
          </p>
          <p>
            <strong>🏗️ Rakennuttaja:</strong> {developer || "-"}
            <Source value={sources.developer} />
          </p>
          <p>
            <strong>👷 Pääurakoitsija:</strong> {builder || "-"}
            <Source value={sources.builder} />
          </p>
          <p className="md:col-span-2">
            <strong>🏢 Liittyvät yritykset:</strong> {relatedCompanies || "-"}
          </p>
          <p>
            <strong>🏢 Kohdetyyppi:</strong> {buildingType || "-"}
            <Source value={sources.property_type} />
          </p>
          <p><strong>Vaihe:</strong> {phaseHint || "-"}<Source value={sources.phase} /></p>
        </div>

        {Object.values(sources).some(Boolean) ? (
          <p className="mt-3 text-xs text-gray-500">
            Merkintä kertoo mistä arvo tuli:{" "}
            <span className="rounded-full bg-gray-100 px-2 py-0.5">lähde</span> = tuli
            lähteestä valmiina,{" "}
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">teksti</span>{" "}
            = poimittu tiedotteen leipätekstistä säännöllä,{" "}
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
              julkaisija
            </span>{" "}
            = päätelty siitä kuka tiedotteen julkaisi.
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-4 rounded-lg border px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Muokkaa tietoja
        </button>
      </div>
    )
  }

  return (
    <div className="mt-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-gray-700">Otsikko</span>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-semibold text-gray-700">Vaihe</span>
          <select
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={phaseHint}
            onChange={(e) => setPhaseHint(e.target.value)}
          >
            <option value="">-</option>
            {PHASE_OPTIONS.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-semibold text-gray-700">Maakunta</span>
          <select
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          >
            <option value="">-</option>
            {REGIONS.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-semibold text-gray-700">Kaupunki<Source value={sources.city} /></span>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-semibold text-gray-700">Sijainti / osoite<Source value={sources.location} /></span>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-semibold text-gray-700">🏗️ Rakennuttaja</span>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={developer}
            onChange={(e) => setDeveloper(e.target.value)}
          />
        </label>

        {/*
          * builder tarkoittaa PÄÄurakoitsijaa, ja kenttä on nimettävä sen
          * mukaan. Pelkkä "Urakoitsija" houkuttelee kirjaamaan tähän myös
          * osaurakoitsijat - esimerkiksi talotekniikkaurakoitsijan (LVIS),
          * joka ei ole sama asia. Sellaiselle ei ole vielä omaa kenttää.
          */}
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-gray-700">👷 Pääurakoitsija</span>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={builder}
            onChange={(e) => setBuilder(e.target.value)}
            placeholder="esim. Lujatalo"
          />
        </label>

        {/*
          * Muut hankkeeseen liittyvät yritykset vapaana listana. Urakkalajeja
          * on enemmän kuin sarakkeita, joten osaurakoitsijat (talotekniikka,
          * purku, ...) kirjataan tänne eikä omiin kenttiinsä.
          */}
        <label className="text-sm md:col-span-2">
          <span className="mb-1 block font-semibold text-gray-700">
            🏢 Liittyvät yritykset
          </span>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={relatedCompanies}
            onChange={(e) => setRelatedCompanies(e.target.value)}
            placeholder="Pilkulla eroteltuna, esim. Bravida (talotekniikka), Ramboll"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-semibold text-gray-700">🏢 Kohdetyyppi</span>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={buildingType}
            onChange={(e) => setBuildingType(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-5 border-t border-gray-200 pt-4">
        <ContactsEditor contacts={contacts} onChange={setContacts} disabled={saving} />
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Tallennetaan..." : "Tallenna muutokset"}
        </button>

        <button
          type="button"
          onClick={cancelEdit}
          disabled={saving}
          className="rounded-lg border px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50"
        >
          Peruuta
        </button>
      </div>

      {error && <div className="mt-2 text-sm text-red-700">{error}</div>}
    </div>
  )
}
