import { createClient } from "@supabase/supabase-js"

import {
  haeRajatutLahteet,
  kuuluuJonoon,
} from "@/lib/tic/osapuolettomienRajaus"

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
  /*
   * LUKU LASKETAAN SAMOILLA EHDOILLA KUIN LISTA (D-234).
   *
   * Kaksi eroa korjattiin kerralla: luku ei aiemmin rajannut
   * piilotettuja pois vaikka lista rajasi, ja rajatut lähteet puuttuivat
   * kokonaan. Navigaation luvun on tarkoitettava samaa kuin sivun
   * otsikon, muuten jono näyttää siltä ettei se tyhjene.
   *
   * Rivit luetaan tässä sen sijaan että käytettäisiin `count: exact`ia,
   * koska lähderajaus tehdään nimellä eikä sitä saa PostgREST-ehdoksi
   * ilman että `source_name`-null katoaa samalla.
   */
  const rajatutLahteet = await haeRajatutLahteet(supabaseAdmin)

  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("id, source_name:metadata->>source_name")
    .eq("status", "active")
    .eq("is_public", true)
    .in("phase", ACTIVE_PHASES)
    .or("developer.is.null,developer.eq.")
    .or("builder.is.null,builder.eq.")
    .limit(2000)

  /*
   * Navigaation luku ei saa kaataa koko TIC:iä: virheessä palautetaan 0,
   * jolloin linkki näkyy ilman lukua.
   */
  if (error) {
    console.error("getIncompleteProjectCount:", error.message)
    return 0
  }

  return (data ?? []).filter((r) =>
    kuuluuJonoon((r as { source_name?: string | null }).source_name, rajatutLahteet)
  ).length
}
