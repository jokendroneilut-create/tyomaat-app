"use client"

import { useEffect, useState } from "react"

/*
 * Kerran näytettävä tervetulo-/ominaisuusesittely. Näytetään jokaiselle
 * kirjautuneelle kerran (kunnes suljetaan), myös olemassa oleville käyttäjille
 * tästä eteenpäin. Muistetaan localStoragessa versiokohtaisesti — nostamalla
 * WELCOME_VERSION koko esittely voidaan näyttää uudelleen kaikille (esim. kun
 * ominaisuuksia lisätään).
 *
 * `suppressed`: ei näytetä samaan aikaan pakollisen roolimodaalin kanssa —
 * uusi käyttäjä valitsee ensin roolin, ja tervetulo tulee sen jälkeen.
 */
const WELCOME_VERSION = 1
const STORAGE_KEY = `tyomaat_welcome_seen_v${WELCOME_VERSION}`

export default function WelcomeInfoModal({
  suppressed = false,
}: {
  suppressed?: boolean
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (suppressed) return
    try {
      if (localStorage.getItem(STORAGE_KEY)) return
    } catch {}
    setOpen(true)
  }, [suppressed])

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString())
    } catch {}
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="shrink-0 border-b px-6 py-5">
          <h2 className="text-2xl font-bold text-gray-900">
            Tervetuloa Työmaat.fi:hin! 👋
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 text-sm leading-relaxed text-gray-700">
          <p>
            <strong>Tänään</strong>-näkymä on <strong>beta-vaiheessa</strong> ja
            aktiivisessa kehityksessä — se ei ole vielä täysin valmis, ja
            kehitämme sitä jatkuvasti käyttäjäpalautteen perusteella. Tavoite on
            koota sinulle tärkeimmät ja ajankohtaisimmat hankkeet valitsemiesi
            asetusten mukaan. <strong>Mukauta asetukset itsellesi sopiviksi</strong>,
            niin näkymä palvelee parhaiten.
          </p>

          <p className="mt-4 font-semibold text-gray-900">
            Muut ominaisuudet lyhyesti:
          </p>

          <ul className="mt-2 space-y-2">
            <li>
              🔔 <strong>Hakuvahdit</strong> — saat sähköpostiisi päivityksen,
              kun seuraamallasi alueella tapahtuu muutoksia työmailla tai
              hankkeeseen tulee uutta tietoa.
            </li>
            <li>
              🗺️ <strong>Kartta ja suosikit</strong> — kartalta voit lisätä
              kohteita suosikkeihin; ne löytyvät valikon kohdasta{" "}
              <strong>Omat</strong>.
            </li>
            <li>
              👥 <strong>Tiiminäkymä</strong> — luo oma tiimi ja jaa hankkeiden
              omistajuudet, niin jokainen hanke pysyy seurannassa eikä
              päällekkäistä seurantaa synny.
            </li>
            <li>
              🏷️ <strong>Hankkeiden merkinnät</strong> — merkitse hankkeelle
              tila (esim. <em>kontaktoitu</em> tai <em>tarjous lähetetty</em>);
              merkityt hankkeet löytyvät kohdasta <strong>Omat</strong>.
            </li>
            <li>
              ✅ <strong>Tehtävät</strong> — valikon <strong>Tehtävät</strong>
              -kohtaan voit lisätä omia tehtäviä ja merkitä ne tehdyiksi tai
              poistaa.
            </li>
          </ul>

          <p className="mt-4">
            Kysymyksiä tai palautetta? Käytä <strong>"Anna palautetta"</strong>{" "}
            -nappia — luemme kaiken. 🙂
          </p>
        </div>

        <div className="shrink-0 border-t px-6 py-4">
          <button
            type="button"
            onClick={dismiss}
            className="w-full rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Selvä, aloitetaan
          </button>
        </div>
      </div>
    </div>
  )
}
