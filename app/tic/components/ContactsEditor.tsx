"use client"

/*
 * YHTEYSHENKILÖIDEN MUOKKAUS.
 *
 * Sama taulukko kahdessa paikassa: jonon ehdokkaalla
 * (`/tic/projects/[id]`) ja hyväksytyllä hankkeella (`/tic/hanke/[id]`).
 * Yhteinen komponentti, koska kaksi erillistä toteutusta erkaantuisi ja
 * korjaus jäisi toiseen — sama perustelu kuin tililokin täsmäytyksessä.
 *
 * Muokkaus on tarpeen, koska väärin poimittu osoite näyttää oikealta ja
 * ohjaa asiakkaan väärälle henkilölle (D-122). Rivin tyhjentäminen
 * poistaa yhteyshenkilön — se on tietoinen poikkeus vain-lisäävään
 * sääntöön ja ainoa tapa saada virheellinen tieto pois käsin.
 */

export type EditableContact = {
  name: string
  title: string
  email: string
  phone: string
}

export const TYHJA_KONTAKTI: EditableContact = { name: "", title: "", email: "", phone: "" }

export function contactsPayload(contacts: EditableContact[]): EditableContact[] {
  return contacts.filter((c) => c.name || c.email || c.phone)
}

export default function ContactsEditor({
  contacts,
  onChange,
  disabled,
}: {
  contacts: EditableContact[]
  onChange: (next: EditableContact[]) => void
  disabled?: boolean
}) {
  const set = (i: number, key: keyof EditableContact) => (value: string) =>
    onChange(contacts.map((c, j) => (j === i ? { ...c, [key]: value } : c)))

  const kentta = (
    i: number,
    key: keyof EditableContact,
    placeholder: string,
    type = "text"
  ) => (
    <input
      type={type}
      value={contacts[i][key]}
      onChange={(e) => set(i, key)(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
    />
  )

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900">Yhteyshenkilöt</h3>
      <p className="mt-1 text-xs text-gray-600">
        Tyhjennä rivin kaikki kentät poistaaksesi yhteyshenkilön.
      </p>

      <div className="mt-3 space-y-2">
        {contacts.length === 0 && (
          <p className="text-sm text-gray-500">Ei yhteyshenkilöitä.</p>
        )}

        {contacts.map((_, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-4">
            {kentta(i, "name", "Nimi")}
            {kentta(i, "title", "Nimike")}
            {kentta(i, "email", "Sähköposti", "email")}
            {kentta(i, "phone", "Puhelin")}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onChange([...contacts, { ...TYHJA_KONTAKTI }])}
        disabled={disabled}
        className="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-40"
      >
        + Lisää yhteyshenkilö
      </button>
    </div>
  )
}
