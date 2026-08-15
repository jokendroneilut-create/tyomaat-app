import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/*
 * Montako asiakkaalle näkyvää hanketta on suunnittelu- tai
 * rakentamisvaiheessa ILMAN rakennuttajaa ja pääurakoitsijaa.
 *
 * Luku kuuluu TIC:n navigaatioon samasta syystä kuin katselmointijono ja
 * kaksoiskappaleet: se on korjattavissa oleva puute, ei tilasto. Mitattu
 * 15.8.2026 lähtötaso oli 221 ja YVA-poiminnan (D-077) jälkeen 135 —
 * käynnissä oleva työmaa ilman ketään soitettavaa on asiakkaalle
 * hyödytön liidi.
 *
 * Vaiheet luetellaan kirjoitusasuina, koska suodatus tehdään kannassa.
 * `normalizeLegacyPhase` tuntee samat parit (Suunnittelussa/Suunnittelu,
 * Rakenteilla/Rakentaminen aloitettu).
 */
const ACTIVE_PHASES = [
  "Suunnittelussa",
  "Suunnittelu",
  "Rakenteilla",
  "Rakentaminen aloitettu",
]

export async function getIncompleteProjectCount(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .in("phase", ACTIVE_PHASES)
    .or("developer.is.null,developer.eq.")
    .or("builder.is.null,builder.eq.")

  /*
   * Navigaation luku ei saa kaataa koko TIC:iä: virheessä palautetaan 0,
   * jolloin linkki näkyy ilman lukua.
   */
  if (error) {
    console.error("getIncompleteProjectCount:", error.message)
    return 0
  }

  return count ?? 0
}
