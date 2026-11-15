"use client"

import { useLayoutEffect } from "react"

/*
 * HANKESIVU AUKEAA AINA YLÄREUNASTA (D-426).
 *
 * Johannes 16.11.2026: *"sivun vieritys ei ole automaattisesti sivun
 * ylälaidassa vaan ainakin tuntuu riippuvan siitä missä kohtaa TIC:in
 * sivuvieritys on kun avaan ehdokkaan."*
 *
 * Next.js ei vieritä sivun alkuun vaan vain niin, että uuden segmentin
 * yläreuna on näkyvissä. TIC:ssä välissä on lisäksi `tic/loading.tsx`:
 * lyhyt latausnäkymä piirtyy ensin, ja selain rajaa vierityksen sen
 * korkeuteen, minkä jälkeen varsinainen sivu piirtyy siihen kohtaan
 * mihin vieritys jäi. Lopputulos riippuu siitä, kuinka alhaalla listassa
 * oltiin.
 *
 * Tämä vierittää ylös kun hankkeen sisältö on piirtynyt. Avain on
 * hankkeen id, jotta siirtyminen hankkeesta toiseen tekee saman. Paluu
 * listaan (selaimen taaksepäin) ei kulje tämän kautta, joten listan
 * kohta säilyy.
 */
export default function VieritaYlos() {
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" })
  }, [])
  return null
}
