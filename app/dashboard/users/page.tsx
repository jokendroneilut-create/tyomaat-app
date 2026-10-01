'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { laskeLaskutus, muotoileEuro } from '@/lib/users/laskutus'
import { daysLeft, daysSince, trialState, type TrialState } from '@/lib/users/trial'

type AdminUser = {
  id: string
  email: string | null
  created_at: string
  last_sign_in_at: string | null

  /*
   * Viimeisin TAPAHTUMA, ei kirjautuminen (D-204). Tyhja jos nakymaa
   * user_last_activity ei ole viela luotu tai tunnus ei ole kayttanyt
   * tuotetta sen jalkeen kun tapahtumia alettiin kirjata 14.7.2026.
   */
  last_seen_at?: string | null
  confirmed: boolean
  locked?: boolean
  lockedReason?: string | null

  /* Jarjestelmarooli ja hankkinut myyja. Vain adminille merkityksellisia. */
  role?: 'admin' | 'seller' | 'user'
  ownerId?: string | null
  ownerEmail?: string | null

  /*
   * LASKUTUS ON ASIAKKAAN, EI TUNNUKSEN (D-223). `billingKey` on
   * yritysdomain tai vapaan sahkopostin koko osoite, ja saman avaimen
   * tunnukset jakavat yhden hinnan — Sarlinin 12 tunnusta ovat yksi
   * maksava asiakas.
   */
  /* Valittu yritys. Tyhja = asiakas paatellaan sahkopostista (D-224). */
  company?: string | null

  billingKey?: string
  billingStatus?: 'maksava' | 'testi' | 'ei_maksava' | null
  billingMonthly?: number | null
  billingSince?: string | null
  billingNote?: string | null
  billingUpdatedAt?: string | null
}

/*
 * Kannan arvo on yha `testi`, nakyva sana on "Trial" (Johannes
 * 2.10.2026). Arvoa ei nimetty uudelleen, koska se vaatisi
 * check-rajoitteen migraation eika muuttaisi mitaan muuta.
 */
const BILLING_LABEL: Record<string, string> = {
  maksava: 'Maksava',
  testi: 'Trial',
  ei_maksava: 'Ei maksava',
}

type Seller = { id: string; email: string | null }

type SortColumn =
  | 'email'
  | 'created_at'
  | 'age_days'
  | 'last_seen_at'
  | 'confirmed'
  | 'company'
  | 'seller'
  | 'billing'
type SortDirection = 'asc' | 'desc'

/*
 * Sekunnit pois: kaksi paivamaarasaraketta vei niilla noin 90 pikselia
 * leveytta eika kukaan lue tunnuksen luontihetkea sekunnin tarkkuudella.
 * Tila meni Yritys-sarakkeelle (D-224).
 */
function formatDate(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('fi-FI', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const TRIAL_STYLE: Record<TrialState, { color: string; weight: number }> = {
  ohi: { color: '#b91c1c', weight: 700 },
  pian: { color: '#b45309', weight: 600 },
  kesken: { color: '#374151', weight: 400 },
}

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /*
   * Kutsujan oma rooli. Myyja nakee vain hankkimansa asiakkaat eika saa
   * kutsua, lukita tai poistaa ketaan. Rajaus tehdaan palvelimella
   * (/api/admin/list-users); tama ohjaa vain sita mita napit nayttavat.
   */
  const [viewerRole, setViewerRole] = useState<'admin' | 'seller' | 'user'>('user')
  const [sellers, setSellers] = useState<Seller[]>([])
  const [savingId, setSavingId] = useState<string | null>(null)

  /* Laskutusrivia tallennetaan asiakkaittain, ei tunnuksittain. */
  const [billingSaving, setBillingSaving] = useState<string | null>(null)

  /* Yrityskentan ehdotukset ja tallennuksen tila (D-224). */
  const [companies, setCompanies] = useState<string[]>([])
  const [companySaving, setCompanySaving] = useState<string | null>(null)

  const isAdminView = viewerRole === 'admin'

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<string | null>(null)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [lockingId, setLockingId] = useState<string | null>(null)

  const [sortColumn, setSortColumn] = useState<SortColumn>('created_at')

  /*
   * Kayttohistoria avataan rivi kerrallaan. Data on `analytics_events`
   * -taulussa 14.7.2026 alkaen; sita ei ladata etukateen kaikille, koska
   * lista voi olla satoja rivejä ja jokainen haku on oma kyselynsa.
   */
  const [kayttoAuki, setKayttoAuki] = useState<string | null>(null)
  const [kaytto, setKaytto] = useState<Record<string, any>>({})
  const [kayttoLataa, setKayttoLataa] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(column)
      /*
       * Ika ja kirjautuminen ovat kiinnostavia suurimmasta paasta:
       * paattyneet kokeilut ja tuoreimmat kirjautumiset ensin.
       */
      setSortDirection(column === 'age_days' || column === 'last_seen_at' ? 'desc' : 'asc')
    }
  }

  const trialSummary = useMemo(() => {
    let ohi = 0
    let pian = 0
    for (const u of users) {
      const tila = trialState(daysSince(u.created_at))
      if (tila === 'ohi') ohi += 1
      else if (tila === 'pian') pian += 1
    }
    return { ohi, pian }
  }, [users])

  /*
   * Asiakkaat myyjittain.
   *
   * Myyja- ja admin-tunnukset EIVAT ole asiakkaita, joten ne jatetaan
   * laskuista pois - muuten summa ei tasmaisi asiakasmaaraan. Ilman
   * myyjaa olevat ovat itse hankittuja.
   */
  const sellerSummary = useMemo(() => {
    const asiakkaat = users.filter((u) => (u.role ?? 'user') === 'user')

    const maarat = new Map<string, number>()
    let omat = 0

    for (const u of asiakkaat) {
      if (!u.ownerId) omat += 1
      else maarat.set(u.ownerId, (maarat.get(u.ownerId) ?? 0) + 1)
    }

    const myyjittain = sellers
      .map((s) => ({ id: s.id, email: s.email, maara: maarat.get(s.id) ?? 0 }))
      .sort((a, b) => b.maara - a.maara)

    /*
     * Liitos voi osoittaa tunnukseen jota ei ole myyjalistalla (rooli
     * poistettu kesken kaiken). Ei jateta niita nakymattomiin.
     */
    const tuntematon = [...maarat.entries()]
      .filter(([id]) => !sellers.some((s) => s.id === id))
      .reduce((a, [, n]) => a + n, 0)

    return { myyjittain, omat, tuntematon, yhteensa: asiakkaat.length }
  }, [users, sellers])

  /*
   * Kuukausilaskutus ja ARR (D-223).
   *
   * Summa lasketaan asiakkaista eika tunnuksista, muuten Sarlinin 12
   * tunnusta laskisivat saman hinnan kaksitoista kertaa. Laskenta on
   * `lib/users/laskutus.ts`:ssa, jotta se on testattavissa ilman sivua.
   */
  const laskutus = useMemo(
    () =>
      laskeLaskutus(
        users.map((u) => ({ email: u.email, role: u.role, yritys: u.company })),
        users
          .filter((u) => u.billingKey && u.billingStatus)
          .map((u) => ({
            tunniste: u.billingKey as string,
            tila: u.billingStatus ?? null,
            kuukausihinta_eur: u.billingMonthly ?? null,
            updated_at: u.billingUpdatedAt ?? null,
          }))
      ),
    [users]
  )

  const sortedUsers = useMemo(() => {
    const sorted = [...users].sort((a, b) => {
      let cmp = 0

      if (sortColumn === 'email') {
        cmp = (a.email ?? '').localeCompare(b.email ?? '', 'fi')
      } else if (sortColumn === 'company') {
        /*
         * Yrityksetön tunnus viimeiseksi kumpaankin suuntaan: tyhja ei
         * ole nimi, eika sen kuulu kilpailla aakkosjarjestyksessa.
         */
        const ay = (a.company ?? '').trim()
        const by = (b.company ?? '').trim()
        if (!ay && !by) cmp = (a.email ?? '').localeCompare(b.email ?? '', 'fi')
        else if (!ay) cmp = 1
        else if (!by) cmp = -1
        else cmp = ay.localeCompare(by, 'fi') || (a.email ?? '').localeCompare(b.email ?? '', 'fi')
      } else if (sortColumn === 'age_days') {
        /*
         * Luonnollinen suunta, jotta nuoli vastaa nakemaa: alas = suurin
         * ika ensin eli paattyneet karkeen. Ensimmainen versio kaansi
         * vertailun tassa, jolloin nuoli alas naytti nuorimmat.
         */
        cmp = (daysSince(a.created_at) ?? -1) - (daysSince(b.created_at) ?? -1)
      } else if (sortColumn === 'confirmed') {
        cmp = Number(a.confirmed) - Number(b.confirmed)
      } else if (sortColumn === 'billing') {
        /*
         * Tila ensin, hinta sen sisalla. Hinta yksin ei kelpaisi
         * jarjestykseksi: merkitsematon ja 0 euron rivi menisivat
         * sekaisin, vaikka ne tarkoittavat eri asiaa.
         *
         * Nouseva: maksavat ensin (suurin hinta karjessa), sitten
         * trialit, ei-maksavat ja lopuksi merkitsemattomat. Laskeva
         * kaantaa sen, jolloin merkitsemattomat nousevat karkeen - ja se
         * on juuri se lista jota merkitsemiseen tarvitaan.
         */
        const jarjestys: Record<string, number> = {
          maksava: 0,
          testi: 1,
          ei_maksava: 2,
        }
        const sija = (u: AdminUser) =>
          jarjestys[u.billingStatus ?? ''] ?? 3

        cmp =
          sija(a) - sija(b) ||
          (b.billingMonthly ?? -1) - (a.billingMonthly ?? -1) ||
          (a.email ?? '').localeCompare(b.email ?? '', 'fi')
      } else if (sortColumn === 'seller') {
        /*
         * Aakkosjarjestys myyjan sahkopostin mukaan. Liittamaton on
         * tyhja merkkijono, joten se ryhmittyy alkuun nousevassa ja
         * loppuun laskevassa - kumpikin paa on kayttokelpoinen: alusta
         * loytaa liittamattomat, lopusta ne on siirretty pois tielta.
         *
         * Myyjan oma rivi ei ole kenenkaan asiakas, joten sekin menee
         * tyhjien joukkoon.
         */
        cmp = (a.ownerEmail ?? '').localeCompare(b.ownerEmail ?? '', 'fi')
      } else {
        const aVal = a[sortColumn] ?? ''
        const bVal = b[sortColumn] ?? ''
        cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      }

      return sortDirection === 'asc' ? cmp : -cmp
    })

    return sorted
  }, [users, sortColumn, sortDirection])

  const getToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    return session?.access_token ?? null
  }

  /*
   * silent: käytetään kutsun lähetyksen jälkeisessä automaattisessa
   * päivityksessä. Kutsu itse on siinä vaiheessa jo onnistunut - jos
   * pelkkä listan haku kaatuu (esim. hetkellinen istunto-ongelma heti
   * uudelleenkirjautumisen jälkeen), sitä ei pidä näyttää hälyttävänä
   * virheenä joka sekoittuu onnistuneen kutsun ilmoitukseen. Lista
   * päivittyy joka tapauksessa seuraavalla "Päivitä"-klikkauksella.
   */
  const fetchUsers = async (silent = false) => {
    setLoading(true)
    if (!silent) setError(null)

    const token = await getToken()

    if (!token) {
      if (!silent) setError('Et ole kirjautunut sisään')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/admin/list-users', {
        headers: { Authorization: `Bearer ${token}` },
      })

      const json = await res.json()

      if (!res.ok) {
        if (!silent) setError(json.error || 'Käyttäjien haku epäonnistui')
      } else {
        setUsers(json.users)
        if (json.role) setViewerRole(json.role)
        setSellers(json.sellers ?? [])
        setCompanies(json.companies ?? [])
      }
    } catch {
      if (!silent) setError('Käyttäjien haku epäonnistui')
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  /*
   * Yhteinen kutsu admin-reiteille. Palvelin tarkistaa roolin joka
   * kerta, joten tama on vain kayttoliittyman puoli.
   */
  const laheta = async (polku: string, body: any) => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return { error: 'Et ole kirjautunut sisään' }

    const res = await fetch(polku, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })

    return res.json().catch(() => ({ error: 'Vastauksen luku epäonnistui' }))
  }

  const avaaKaytto = async (user: AdminUser) => {
    if (kayttoAuki === user.id) {
      setKayttoAuki(null)
      return
    }
    setKayttoAuki(user.id)
    if (kaytto[user.id]) return

    setKayttoLataa(user.id)
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    const res = await fetch(`/api/admin/user-activity?userId=${user.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const json = await res.json().catch(() => ({ error: 'Vastauksen luku epäonnistui' }))
    setKaytto((prev) => ({ ...prev, [user.id]: json }))
    setKayttoLataa(null)
  }

  const handleRole = async (user: AdminUser, role: 'seller' | 'admin' | null) => {
    setSavingId(user.id)
    setError(null)

    const json = await laheta('/api/admin/set-user-role', { userId: user.id, role })

    if (json?.error) setError(json.error)
    else await fetchUsers(true)

    setSavingId(null)
  }

  const handleAssign = async (user: AdminUser, sellerId: string | null) => {
    setSavingId(user.id)
    setError(null)

    const json = await laheta('/api/admin/assign-customer', { userId: user.id, sellerId })

    if (json?.error) setError(json.error)
    else await fetchUsers(true)

    setSavingId(null)
  }

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase()
    if (!email) return

    setInviting(true)
    setInviteResult(null)

    const token = await getToken()

    if (!token) {
      setInviteResult('Virhe: et ole kirjautunut sisään')
      setInviting(false)
      return
    }

    try {
      const res = await fetch('/api/admin/invite-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email }),
      })

      const json = await res.json()

      if (!res.ok) {
        setInviteResult(`Virhe: ${json.error}`)
      } else {
        setInviteResult(`Kutsu lähetetty osoitteeseen ${email}`)
        setInviteEmail('')
        await fetchUsers(true)
      }
    } catch {
      setInviteResult('Virhe kutsun lähetyksessä')
    }

    setInviting(false)
  }

  /*
   * LUKITUS JA VAPAUTUS.
   *
   * Lukitus estää kirjautumisen mutta säilyttää tilin, historian ja
   * analytiikan — toisin kuin poisto, joka on peruuttamaton. Siksi tämä on
   * se toimenpide johon tartutaan ensin, jos käyttö näyttää väärinkäytöltä.
   *
   * KAKSI ESTETTÄ VAHINGOLLE. Perustelu on pakollinen, eli lukitus vaatii
   * ajatuksen; ja erillinen vahvistus, jossa sähköposti on luettavissa,
   * eli se vaatii katseen oikeaan riviin. Vapautus ei vaadi kumpaakaan.
   */
  const handleLock = async (user: AdminUser) => {
    const locked = Boolean(user.locked)

    let reason = ''

    if (!locked) {
      const input = window.prompt(
        `Lukitse tunnus ${user.email}?\n\n` +
          'Kirjautuminen estyy heti. Tili, historia ja analytiikka säilyvät, ' +
          'ja lukituksen voi purkaa milloin tahansa.\n\n' +
          'Kirjoita perustelu (pakollinen):'
      )

      if (input === null) return

      reason = input.trim()

      if (!reason) {
        setError('Lukitseminen vaatii perustelun')
        return
      }

      const confirmed = window.confirm(
        `Varmista vielä:\n\nLUKITAAN ${user.email}\nSyy: ${reason}\n\nJatketaanko?`
      )

      if (!confirmed) return
    }

    setLockingId(user.id)
    setError(null)

    const token = await getToken()

    if (!token) {
      setError('Et ole kirjautunut sisään')
      setLockingId(null)
      return
    }

    try {
      const res = await fetch('/api/admin/lock-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: user.id, lock: !locked, reason }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error || 'Toiminto epäonnistui')
      } else {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, locked: !locked } : u))
        )
      }
    } catch {
      setError('Toiminto epäonnistui')
    }

    setLockingId(null)
  }

  /*
   * LASKUTUSRIVIN TALLENNUS (D-223).
   *
   * Kirjoitus kohdistuu asiakkaaseen, joten paikallinen tila on
   * paivitettava KAIKILLE saman avaimen tunnuksille. Muuten Sarlinin
   * 12 rivista yksi nayttaisi uutta hintaa ja yksitoista vanhaa, kunnes
   * sivu ladataan uudelleen.
   */
  const handleBilling = async (
    user: AdminUser,
    tila: string,
    kuukausihinta: string | null
  ) => {
    const tunniste = user.billingKey
    if (!tunniste) return

    setBillingSaving(tunniste)
    setError(null)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    if (!token) {
      setError('Et ole kirjautunut sisään')
      setBillingSaving(null)
      return
    }

    try {
      const res = await fetch('/api/admin/set-customer-billing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tunniste, tila, kuukausihinta }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error || 'Laskutustiedon tallennus epäonnistui')
      } else {
        const nyt = new Date().toISOString()
        setUsers((prev) =>
          prev.map((u) =>
            u.billingKey === tunniste
              ? {
                  ...u,
                  billingStatus: (json.poistettu ? null : json.tila) ?? null,
                  billingMonthly: json.poistettu ? null : (json.kuukausihinta ?? null),
                  billingUpdatedAt: json.poistettu ? null : nyt,
                }
              : u
          )
        )
      }
    } catch {
      setError('Laskutustiedon tallennus epäonnistui')
    }

    setBillingSaving(null)
  }

  /*
   * YRITYKSEN VALINTA (D-224).
   *
   * Vaihtaa asiakastunnisteen, joten koko lista haetaan uudelleen:
   * sama yritys voi koskea montaa tunnusta, ja laskutusrivi voi siirtya
   * mukana. Paikallinen arvaus menisi vaaraan heti kun yritykseen
   * kuuluu useampi kuin yksi tunnus.
   */
  const handleCompany = async (user: AdminUser, yritys: string) => {
    const siisti = yritys.trim().replace(/\s+/g, ' ')
    if (siisti === (user.company ?? '').trim()) return

    setCompanySaving(user.id)
    setError(null)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    if (!token) {
      setError('Et ole kirjautunut sisään')
      setCompanySaving(null)
      return
    }

    try {
      const res = await fetch('/api/admin/set-user-company', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: user.id, yritys: siisti }),
      })

      const json = await res.json()

      if (!res.ok) setError(json.error || 'Yrityksen tallennus epäonnistui')
      else await fetchUsers(true)
    } catch {
      setError('Yrityksen tallennus epäonnistui')
    }

    setCompanySaving(null)
  }

  const handleDelete = async (user: AdminUser) => {
    const ok = window.confirm(
      `Haluatko varmasti poistaa käyttäjän ${user.email}? Tätä ei voi perua.`
    )
    if (!ok) return

    setDeletingId(user.id)

    const token = await getToken()

    if (!token) {
      setError('Et ole kirjautunut sisään')
      setDeletingId(null)
      return
    }

    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: user.id }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error || 'Poisto epäonnistui')
      } else {
        setUsers((prev) => prev.filter((u) => u.id !== user.id))
      }
    } catch {
      setError('Poisto epäonnistui')
    }

    setDeletingId(null)
  }

  return (
    /*
     * Taulukossa on kuusi saraketta, joista kolme on paivamaaria.
     * 900 pikselissa sahkopostisarake leikkautui ja paivamaarat
     * katkesivat kolmelle riville.
     */
    <div style={{ padding: 24, maxWidth: isAdminView ? 1600 : 1280 }}>
      <h1>{isAdminView ? 'Käyttäjät' : 'Omat asiakkaat'}</h1>

      {!isAdminView && (
        <p style={{ marginTop: 8, color: '#6b7280', fontSize: 14 }}>
          Näet hankkimasi asiakkaat ja sen, ovatko he ottaneet tuotteen
          käyttöön. Kokeilun tila lasketaan tunnuksen iästä.
        </p>
      )}

      {isAdminView && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            background: '#f9fafb',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 10 }}>
            Asiakkaat myyjittäin{' '}
            <span style={{ fontWeight: 400, color: '#6b7280', fontSize: 14 }}>
              ({sellerSummary.yhteensa} asiakasta · myyjä- ja admin-tunnukset
              eivät ole mukana)
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <SummaryCard
              label="Omat (ei myyjää)"
              value={sellerSummary.omat}
              highlight
            />

            {sellerSummary.myyjittain.map((s) => (
              <SummaryCard key={s.id} label={s.email ?? '(tuntematon)'} value={s.maara} />
            ))}

            {sellerSummary.tuntematon > 0 && (
              <SummaryCard
                label="Poistetulla myyjällä"
                value={sellerSummary.tuntematon}
              />
            )}
          </div>

          {/*
            * LASKUTUS SAMAAN LAATIKKOON (D-223).
            *
            * Luku on tasmalleen niin oikein kuin kasin syotetyt hinnat.
            * Siksi vieressa on maksavien maara ja varoitus puuttuvista
            * hinnoista: vajaa MRR ei saa nayttaa tasmalliselta.
            */}
          {isAdminView && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                marginTop: 10,
                paddingTop: 10,
                borderTop: '1px solid #e5e7eb',
              }}
            >
              {/*
                * TOTEUTUNUT SININEN, ARVIO MUSTA (Johannes 2.10.2026).
                *
                * MRR, ARR ja maksavien maara ovat kirjattuja lukuja;
                * potentiaali on arvaus 149 eurolla niille joille hintaa
                * ei ole sovittu. Sama vari tekisi niista
                * samanarvoisia, ja arvio luettaisiin tulona.
                */}
              <SummaryCard
                label="Kuukausilaskutus (MRR)"
                value={muotoileEuro(laskutus.mrr)}
                highlight
              />
              <SummaryCard label="Vuodessa (ARR)" value={muotoileEuro(laskutus.arr)} highlight />
              <SummaryCard
                label="Maksavia asiakkaita"
                value={laskutus.maksaviaAsiakkaita}
                sub={`${laskutus.maksaviaTunnuksia} tunnusta · ${laskutus.asiakkaitaYhteensa} asiakasta yhteensä`}
                highlight
              />
              {laskutus.testiasiakkaita > 0 && (
                <>
                  {/*
                    * POTENTIAALI ON ASIAKASKOHTAINEN (D-224). Trialille
                    * kirjattu hinta voittaa 149 euron oletuksen, koska
                    * hinnat ovat yrityskohtaisia (Sarlin 99).
                    */}
                  <SummaryCard
                    label="Potentiaalinen MRR"
                    value={muotoileEuro(laskutus.potentiaalinenMrr)}
                    sub={`sis. ${laskutus.testiasiakkaita} trial-asiakasta`}
                  />
                  <SummaryCard
                    label="Potentiaalinen ARR"
                    value={muotoileEuro(laskutus.potentiaalinenArr)}
                  />
                  <SummaryCard
                    label="Trial-asiakkaita"
                    value={laskutus.testiasiakkaita}
                    sub={`${laskutus.testitunnuksia} tunnusta`}
                  />
                </>
              )}
              {laskutus.ilmanHintaa > 0 && (
                <SummaryCard
                  label="Maksava ilman hintaa"
                  value={laskutus.ilmanHintaa}
                  sub="MRR on näiltä osin vajaa"
                  warn
                />
              )}
            </div>
          )}

          {isAdminView && laskutus.maksaviaAsiakkaita === 0 && (
            <p style={{ marginTop: 10, fontSize: 13, color: '#6b7280' }}>
              Yhtään maksavaa asiakasta ei ole vielä merkitty. Merkitse
              taulukon Laskutus-sarakkeesta — hinta on yrityskohtainen, eli
              yksi merkintä kattaa kaikki saman yrityksen tunnukset.
            </p>
          )}

          {sellerSummary.myyjittain.length === 0 && (
            <p style={{ marginTop: 10, fontSize: 13, color: '#6b7280' }}>
              Yhtään myyjää ei ole vielä merkitty. Tee käyttäjästä myyjä
              taulukon Myyjä-sarakkeesta.
            </p>
          )}
        </div>
      )}

      {isAdminView && (
      <div style={{ marginTop: 16, padding: 16, border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <label style={{ fontWeight: 700 }}>Lisää uusi käyttäjä</label>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          <input
            type="email"
            placeholder="sahkoposti@esimerkki.fi"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            style={{ flex: 1, padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}
          />

          <button
            onClick={handleInvite}
            disabled={inviting || !inviteEmail.trim()}
            style={{
              padding: '8px 16px',
              background: '#111827',
              color: 'white',
              borderRadius: 6,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {inviting ? 'Lähetetään...' : 'Lähetä kutsu'}
          </button>
        </div>

        <p style={{ marginTop: 8, fontSize: 13, color: '#6b7280' }}>
          Käyttäjä saa sähköpostiin linkin, jolla hän asettaa itse oman salasanansa. Ei tarvitse keksiä tai lähettää salasanaa käsin.
        </p>

        {inviteResult && <div style={{ marginTop: 8 }}>{inviteResult}</div>}
      </div>
      )}

      {error && (
        <div style={{ marginTop: 16, color: '#b91c1c' }}>{error}</div>
      )}

      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 18 }}>
            {isAdminView ? 'Kaikki käyttäjät' : 'Asiakkaani'} ({users.length})
            {/*
              * Luvut otsikkoon, jotta paattyneet nakyvat ilman selaamista.
              * Tama on sivun varsinainen tarkoitus: muistaa mitka
              * testitunnukset ovat umpeutuneet.
              */}
            {trialSummary.ohi > 0 || trialSummary.pian > 0 ? (
              <span style={{ marginLeft: 12, fontSize: 14, fontWeight: 400 }}>
                {trialSummary.ohi > 0 ? (
                  <span style={{ color: '#b91c1c', fontWeight: 700 }}>
                    {trialSummary.ohi} kokeilu ohi
                  </span>
                ) : null}
                {trialSummary.ohi > 0 && trialSummary.pian > 0 ? (
                  <span style={{ color: '#9ca3af' }}> · </span>
                ) : null}
                {trialSummary.pian > 0 ? (
                  <span style={{ color: '#b45309', fontWeight: 600 }}>
                    {trialSummary.pian} päättyy viikon sisällä
                  </span>
                ) : null}
              </span>
            ) : null}
          </h2>
          <button
            onClick={() => fetchUsers()}
            disabled={loading}
            style={{
              padding: '6px 12px',
              background: '#f3f4f6',
              borderRadius: 6,
              border: '1px solid #e5e7eb',
              cursor: 'pointer',
            }}
          >
            {loading ? 'Päivitetään...' : 'Päivitä'}
          </button>
        </div>

        {/*
          * Ehdotuslista kerran koko taululle, ei rivia kohden: sama id
          * sadassa elementissa on virheellista HTML:aa ja turhaa tyota.
          */}
        <datalist id="yritysehdotukset">
          {companies.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        <div style={{ marginTop: 12, overflowX: 'auto' }}>
          {/*
            * Myyja-sarake tuo lisaa leveytta, joten adminin taulukko
            * tarvitsee enemman tilaa kuin myyjan. Ilman tata Lukitse- ja
            * Poista-napit jaavat vaakavieritykseen piiloon - sama vika
            * joka korjattiin kerran jo nostamalla 900:aan.
            */}
          <table
            style={{
              width: '100%',
              minWidth: isAdminView ? 1620 : 900,
              borderCollapse: 'collapse',
            }}
          >
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
              <SortHeader column="email" label="Sähköposti" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
              <SortHeader column="created_at" label="Luotu" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
              <SortHeader column="age_days" label="Ikä (pv)" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
              {/*
                * VAIN KAYNTI, EI KIRJAUTUMISTA (D-204).
                *
                * Sarakkeita oli hetken kaksi. Kirjautumispaiva ei kuitenkaan
                * vastaa yhteenkaan kysymykseen jota talla sivulla kysytaan:
                * se jaa jalkeen istunnon verran (mitattu ero jopa 115 vrk)
                * eika kerro kayttajasta mitaan mita kayntipaiva ei kerro
                * paremmin. Tarkka kirjautumishistoria on yha "Kaytto"-
                * painikkeen takana, jonne se kuuluukin.
                */}
              <SortHeader column="last_seen_at" label="Viimeksi käynyt" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
              <SortHeader column="confirmed" label="Tila" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
              {isAdminView && (
                <SortHeader
                  column="company"
                  label="Yritys"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
              )}
              {isAdminView && (
                <SortHeader
                  column="seller"
                  label="Myyjä"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
              )}
              {isAdminView && (
                <SortHeader
                  column="billing"
                  label="Laskutus"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
              )}
              {isAdminView && <th style={{ padding: '8px 4px' }} />}
            </tr>
          </thead>

          <tbody>
            {sortedUsers.flatMap((u) => [
              <tr key={u.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '8px 4px' }}>{u.email}</td>
                <td style={{ padding: '8px 4px', whiteSpace: 'nowrap' }}>{formatDate(u.created_at)}</td>
                <td style={{ padding: '8px 4px', whiteSpace: 'nowrap' }}>
                  {(() => {
                    const days = daysSince(u.created_at)
                    const tila = trialState(days)
                    const tyyli = TRIAL_STYLE[tila]
                    return (
                      <span style={{ color: tyyli.color, fontWeight: tyyli.weight }}>
                        {days == null ? '-' : days}
                        {tila === 'ohi' ? ' · kokeilu ohi' : null}
                        {tila === 'pian' ? ` · ${daysLeft(days)} pv jäljellä` : null}
                      </span>
                    )
                  })()}
                </td>
                <td style={{ padding: '8px 4px', whiteSpace: 'nowrap' }}>
                  {formatDate(u.last_seen_at ?? null)}
                  <button
                    onClick={() => avaaKaytto(u)}
                    title="Käyntipäivät, kirjautumiset ja käytetty aika"
                    style={{
                      marginLeft: 8,
                      padding: '2px 8px',
                      background: kayttoAuki === u.id ? '#dbeafe' : '#f3f4f6',
                      color: '#374151',
                      borderRadius: 6,
                      border: 'none',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {kayttoAuki === u.id ? 'Sulje' : 'Käyttö'}
                  </button>
                </td>
                <td style={{ padding: '8px 4px' }}>
                  {u.locked ? (
                    <span style={{ color: '#b91c1c', fontWeight: 700 }} title={u.lockedReason ?? undefined}>
                      🔒 Lukittu
                      {u.lockedReason ? (
                        <span style={{ display: 'block', fontWeight: 400, fontSize: 12, color: '#6b7280' }}>
                          {u.lockedReason}
                        </span>
                      ) : null}
                    </span>
                  ) : u.confirmed ? (
                    <span style={{ color: '#15803d', fontWeight: 600 }}>Aktivoitu</span>
                  ) : (
                    <span style={{ color: '#b45309', fontWeight: 600 }}>Odottaa kutsun hyväksyntää</span>
                  )}
                </td>

                {isAdminView && (
                  <td style={{ padding: '8px 4px', whiteSpace: 'nowrap' }}>
                    <CompanyCell
                      user={u}
                      saving={companySaving === u.id}
                      onSave={handleCompany}
                    />
                  </td>
                )}

                {isAdminView && (
                  <td style={{ padding: '8px 4px', whiteSpace: 'nowrap' }}>
                    {/*
                      * Myyja itse ei ole kenenkaan asiakas, joten
                      * hanelle nayetaan roolin poisto liitoksen sijaan.
                      */}
                    {u.role === 'seller' ? (
                      <button
                        onClick={() => handleRole(u, null)}
                        disabled={savingId === u.id}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1px solid #d1d5db',
                          background: '#dbeafe',
                          color: '#1d4ed8',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                        title="Poista myyjärooli"
                      >
                        Myyjä ✕
                      </button>
                    ) : u.role === 'admin' ? (
                      <span style={{ color: '#6b7280' }}>admin</span>
                    ) : (
                      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        <select
                          value={u.ownerId ?? ''}
                          disabled={savingId === u.id}
                          onChange={(e) => handleAssign(u, e.target.value || null)}
                          style={{
                            padding: '4px 6px',
                            borderRadius: 6,
                            border: '1px solid #d1d5db',
                            background: '#fff',
                            /* Pitka sahkoposti ei saa levittaa saraketta. */
                            maxWidth: 190,
                          }}
                        >
                          <option value="">— ei myyjää —</option>
                          {sellers.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.email}
                            </option>
                          ))}
                        </select>

                        <button
                          onClick={() => handleRole(u, 'seller')}
                          disabled={savingId === u.id}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: '1px solid #d1d5db',
                            background: '#fff',
                            cursor: 'pointer',
                          }}
                          title="Tee tästä käyttäjästä myyjä"
                        >
                          + myyjäksi
                        </button>
                      </span>
                    )}
                  </td>
                )}

                {isAdminView && (
                  <td style={{ padding: '8px 4px', whiteSpace: 'nowrap' }}>
                    <BillingCell
                      user={u}
                      saving={billingSaving === u.billingKey}
                      onSave={handleBilling}
                    />
                  </td>
                )}

                {isAdminView && (
                <td style={{ padding: '8px 4px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button
                    onClick={() => handleLock(u)}
                    disabled={lockingId === u.id}
                    style={{
                      padding: '6px 12px',
                      marginRight: 8,
                      background: u.locked ? '#dcfce7' : '#fef3c7',
                      color: u.locked ? '#15803d' : '#92400e',
                      borderRadius: 6,
                      border: 'none',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {lockingId === u.id
                      ? 'Odota...'
                      : u.locked
                        ? 'Vapauta'
                        : 'Lukitse'}
                  </button>

                  <button
                    onClick={() => handleDelete(u)}
                    disabled={deletingId === u.id}
                    style={{
                      padding: '6px 12px',
                      background: '#fee2e2',
                      color: '#b91c1c',
                      borderRadius: 6,
                      border: 'none',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {deletingId === u.id ? 'Poistetaan...' : 'Poista'}
                  </button>
                </td>
                )}
              </tr>,

              kayttoAuki === u.id ? (
                <tr key={`${u.id}-kaytto`} style={{ background: '#f9fafb' }}>
                  <td colSpan={14} style={{ padding: '12px 16px' }}>
                    {kayttoLataa === u.id ? (
                      <div style={{ color: '#6b7280' }}>Haetaan käyttöhistoriaa…</div>
                    ) : kaytto[u.id]?.error ? (
                      <div style={{ color: '#b91c1c' }}>{kaytto[u.id].error}</div>
                    ) : (kaytto[u.id]?.paivat ?? []).length === 0 ? (
                      <div style={{ color: '#6b7280' }}>
                        Ei yhtään kirjautumista tai sivulatausta. Tunnus on luotu,
                        mutta tuotetta ei ole avattu.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontWeight: 600, marginBottom: 6 }}>
                            Käyttöpäivät ({(kaytto[u.id]?.paivat ?? []).length} kpl)
                          </div>
                          <table style={{ fontSize: 13, borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ textAlign: 'left', color: '#6b7280' }}>
                                <th style={{ padding: '2px 10px 2px 0' }}>Päivä</th>
                                <th style={{ padding: '2px 10px 2px 0' }}>Kirjautumisia</th>
                                <th style={{ padding: '2px 10px 2px 0' }}>Istuntoja</th>
                                <th style={{ padding: '2px 10px 2px 0' }}>Sivuja</th>
                                <th style={{ padding: '2px 0' }}>Aikaa</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(kaytto[u.id]?.paivat ?? []).slice(0, 30).map((p: any) => (
                                <tr key={p.paiva}>
                                  <td style={{ padding: '2px 10px 2px 0', whiteSpace: 'nowrap' }}>{p.paiva}</td>
                                  <td style={{ padding: '2px 10px 2px 0' }}>{p.kirjautumisia}</td>
                                  <td style={{ padding: '2px 10px 2px 0' }}>{p.istuntoja}</td>
                                  <td style={{ padding: '2px 10px 2px 0' }}>{p.sivulatauksia}</td>
                                  <td style={{ padding: '2px 0', whiteSpace: 'nowrap' }}>
                                    {p.sekunteja < 60
                                      ? `${p.sekunteja} s`
                                      : `${Math.round(p.sekunteja / 60)} min`}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div>
                          <div style={{ fontWeight: 600, marginBottom: 6 }}>Mitä käytti</div>
                          <table style={{ fontSize: 13, borderCollapse: 'collapse' }}>
                            <tbody>
                              {(kaytto[u.id]?.sivut ?? []).map((sv: any) => (
                                <tr key={sv.path}>
                                  <td style={{ padding: '2px 16px 2px 0' }}>{sv.path}</td>
                                  <td style={{ padding: '2px 0', whiteSpace: 'nowrap', color: '#6b7280' }}>
                                    {Math.max(1, Math.round(sv.sekunteja / 60))} min · {sv.kertaa} kertaa
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ) : null,
            ])}

            {!loading && users.length === 0 && (
              <tr>
                <td
                  colSpan={isAdminView ? 7 : 5}
                  style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}
                >
                  {isAdminView
                    ? 'Ei käyttäjiä'
                    : 'Sinulle ei ole vielä liitetty asiakkaita.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}

/* Yksi luku yhdelle myyjalle. Omat korostetaan, koska se on vertailukohta. */
function SummaryCard({
  label,
  value,
  highlight = false,
  sub,
  warn = false,
}: {
  label: string
  /* Euromaara tulee valmiiksi muotoiltuna merkkijonona. */
  value: number | string
  highlight?: boolean
  sub?: string
  warn?: boolean
}) {
  return (
    <div
      style={{
        minWidth: 150,
        padding: '8px 12px',
        borderRadius: 8,
        background: warn ? '#fffbeb' : '#fff',
        border: `1px solid ${warn ? '#fcd34d' : highlight ? '#bfdbfe' : '#e5e7eb'}`,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: '#6b7280',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: 220,
        }}
        title={label}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: warn ? '#b45309' : highlight ? '#1d4ed8' : '#111827',
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{sub}</div>
      )}
    </div>
  )
}

/*
 * LASKUTUSSOLU (D-223).
 *
 * Merkinta kohdistuu ASIAKKAASEEN: sama rivi nakyy kaikilla saman
 * yrityksen tunnuksilla, ja muutos kirjoittaa ne kaikki. Siksi solu
 * kertoo tunnisteen vihjetekstissa — muuten nayttaisi silta etta
 * hinta koskisi vain tata yhta tunnusta.
 *
 * Maksavaksi merkitseminen EI tallennu ennen kuin hinta on annettu.
 * Kanta ja reitti torjuvat hinnattoman maksavan, ja hiljainen torjunta
 * olisi pahempi kuin odottava kentta: MRR vaittaisi olevansa tasmallinen
 * vaikka yksi asiakas puuttuisi siita.
 */
function BillingCell({
  user,
  saving,
  onSave,
}: {
  user: AdminUser
  saving: boolean
  onSave: (user: AdminUser, tila: string, kuukausihinta: string | null) => void
}) {
  const [tila, setTila] = useState<string>(user.billingStatus ?? '')
  const [hinta, setHinta] = useState<string>(
    user.billingMonthly === null || user.billingMonthly === undefined
      ? ''
      : String(user.billingMonthly)
  )

  /* Palvelimen vastaus on totuus, myos kun toinen rivi muutti saman asiakkaan. */
  useEffect(() => {
    setTila(user.billingStatus ?? '')
    setHinta(
      user.billingMonthly === null || user.billingMonthly === undefined
        ? ''
        : String(user.billingMonthly)
    )
  }, [user.billingStatus, user.billingMonthly])

  /* Myyja ja admin eivat ole asiakkaita. */
  if (user.role === 'admin' || user.role === 'seller') {
    return <span style={{ color: '#9ca3af' }}>—</span>
  }

  const tallennaHinta = () => {
    if (tila !== 'maksava' && tila !== 'testi') return
    if (!hinta.trim()) return
    if (String(user.billingMonthly ?? '') === hinta.trim()) return
    onSave(user, tila, hinta)
  }

  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <select
        value={tila}
        disabled={saving}
        title={`Laskutus on yrityskohtainen · ${user.billingKey ?? ''}`}
        onChange={(e) => {
          const arvo = e.target.value
          setTila(arvo)
          if (arvo !== 'maksava') onSave(user, arvo, null)
          else if (hinta.trim()) onSave(user, arvo, hinta)
        }}
        style={{
          padding: '4px 6px',
          borderRadius: 6,
          border: '1px solid #d1d5db',
          background:
            tila === 'maksava' ? '#ecfdf5' : tila === 'testi' ? '#f3f4f6' : '#fff',
          color: tila === 'testi' ? '#6b7280' : '#111827',
          fontWeight: tila === 'maksava' ? 700 : 400,
        }}
      >
        <option value="">— ei merkintää —</option>
        <option value="maksava">{BILLING_LABEL.maksava}</option>
        <option value="ei_maksava">{BILLING_LABEL.ei_maksava}</option>
        <option value="testi">{BILLING_LABEL.testi}</option>
      </select>

      {/*
        * Hinta myos trialille (Johannes 2.10.2026): hinnat ovat
        * yrityskohtaisia (Sarlin 99, Etuputsarit 149), ja kirjattu hinta
        * voittaa potentiaalilaskennan 149 euron oletuksen.
        */}
      {(tila === 'maksava' || tila === 'testi') && (
        <>
          <input
            value={hinta}
            disabled={saving}
            onChange={(e) => setHinta(e.target.value)}
            onBlur={tallennaHinta}
            onKeyDown={(e) => {
              if (e.key === 'Enter') tallennaHinta()
            }}
            placeholder={tila === 'testi' ? '149' : '0'}
            inputMode="decimal"
            style={{
              width: 64,
              padding: '4px 6px',
              borderRadius: 6,
              border: `1px solid ${
                hinta.trim() || tila === 'testi' ? '#d1d5db' : '#fcd34d'
              }`,
              background: hinta.trim() || tila === 'testi' ? '#fff' : '#fffbeb',
              textAlign: 'right',
            }}
          />
          <span style={{ fontSize: 12, color: '#6b7280' }}>€/kk</span>
        </>
      )}
    </span>
  )
}

function SortHeader({
  column,
  label,
  sortColumn,
  sortDirection,
  onSort,
}: {
  column: SortColumn
  label: string
  sortColumn: SortColumn
  sortDirection: SortDirection
  onSort: (column: SortColumn) => void
}) {
  const active = sortColumn === column
  const arrow = active ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''

  return (
    <th style={{ padding: '8px 4px', whiteSpace: 'nowrap' }}>
      <button
        onClick={() => onSort(column)}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          font: 'inherit',
          fontWeight: active ? 800 : 700,
          cursor: 'pointer',
          color: 'inherit',
        }}
      >
        {label}
        {arrow}
      </button>
    </th>
  )
}

/*
 * YRITYSSOLU (D-224).
 *
 * Tekstikentta ehdotuslistalla (`<datalist>`), ei valikko: olemassa
 * olevan yrityksen saa valittua kirjoittamatta, mutta uuden voi
 * kirjoittaa ilman eri "lisaa yritys" -vaihetta. Ehdotukset tulevat
 * jo kaytetyista nimista, jottei sama yritys paady kantaan kolmella
 * kirjoitusasulla.
 *
 * Tallennus tapahtuu kentasta poistuttaessa tai Enterilla. Jokaisella
 * nappainpainalluksella tallentaminen kirjoittaisi kantaan
 * puolivalmiita nimia ("Kon", "Koneu", ...).
 */
function CompanyCell({
  user,
  saving,
  onSave,
}: {
  user: AdminUser
  saving: boolean
  onSave: (user: AdminUser, yritys: string) => void
}) {
  const [arvo, setArvo] = useState<string>(user.company ?? '')

  useEffect(() => {
    setArvo(user.company ?? '')
  }, [user.company])

  /* Myyja ja admin eivat ole asiakkaita. */
  if (user.role === 'admin' || user.role === 'seller') {
    return <span style={{ color: '#9ca3af' }}>—</span>
  }

  return (
    <>
      <input
        value={arvo}
        disabled={saving}
        list="yritysehdotukset"
        onChange={(e) => setArvo(e.target.value)}
        onBlur={() => onSave(user, arvo)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
        /*
         * Tyhja kentta kertoo mista asiakas nyt paatellaan, jottei
         * nayttaisi silta etta tieto puuttuu kokonaan.
         */
        placeholder={user.billingKey ?? ''}
        title={
          arvo.trim()
            ? 'Yritys on valittu — se voittaa sähköpostista päättelyn'
            : `Ei valittua yritystä. Asiakas päätellään: ${user.billingKey ?? '-'}`
        }
        style={{
          width: 150,
          padding: '4px 6px',
          borderRadius: 6,
          border: '1px solid #d1d5db',
          background: '#fff',
          color: arvo.trim() ? '#111827' : '#6b7280',
          fontStyle: arvo.trim() ? 'normal' : 'italic',
        }}
      />

    </>
  )
}
