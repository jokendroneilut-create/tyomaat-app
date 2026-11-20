"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { LIIAN_PIENI } from "../services/pienetHankkeet"

/*
 * PALUUTIE PIENILLE HANKKEILLE (D-442).
 *
 * "Liian pieni hanke" -alapeukku piilottaa kaikki TIC:ssä pieniksi merkityt.
 * Piilotetulle hankkeelle ei voi antaa uutta palautetta, joten ilman tätä
 * yksi klikkaus olisi pysyvä. "Näytä ne" poistaa syyn käyttäjän palautteista;
 * alapeukku jää, joten juuri se hanke pysyy piilossa.
 */
export default function PienetPiilotettuIlmoitus({ maara }: { maara: number }) {
  const router = useRouter()
  const [kaynnissa, setKaynnissa] = useState(false)
  const [virhe, setVirhe] = useState<string | null>(null)

  async function naytaPienet() {
    setKaynnissa(true)
    setVirhe(null)
    const { data } = await supabase.auth.getUser()
    const userId = data?.user?.id
    if (!userId) {
      setKaynnissa(false)
      return
    }
    const { error } = await supabase
      .from("project_feedback")
      .update({ reason_category: null })
      .eq("user_id", userId)
      .eq("reason_category", LIIAN_PIENI)
    if (error) {
      setVirhe("Palautus epäonnistui, yritä uudelleen.")
      setKaynnissa(false)
      return
    }
    router.refresh()
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-800">
      <span>
        <span className="font-semibold">
          {maara === 1 ? "1 pieni hanke on piilotettu," : `${maara} pientä hanketta on piilotettu,`}
        </span>{" "}
        koska merkitsit hankkeen liian pieneksi (esim. maalaus, maalämpö, katon uusinta).
      </span>
      <button
        type="button"
        onClick={naytaPienet}
        disabled={kaynnissa}
        className="rounded-md border border-slate-400 bg-white px-3 py-1 font-medium hover:bg-slate-100 disabled:opacity-50"
      >
        {kaynnissa ? "Palautetaan…" : "Näytä ne"}
      </button>
      {virhe && <span className="text-red-700">{virhe}</span>}
    </div>
  )
}
