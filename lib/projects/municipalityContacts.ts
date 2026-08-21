/*
 * KUNTIEN YLEISET YHTEYSTIEDOT.
 *
 * Jokainen osoite on HAETTU kunnan omalta sivulta, ei kirjoitettu
 * muistista eikä johdettu kaavasta. Todiste on kaksinkertainen: osoite
 * esiintyy kunnan omalla sivulla JA sen verkkotunnus vastaa kuntaa.
 *
 * Miksi kaavaa ei voi käyttää: "kirjaamo@<kunnan domain>" näyttää
 * turvalliselta, mutta Helsingin kirjaamo on helsinki.kirjaamo@hel.fi.
 * Yksi arvattu osoite olisi mennyt 579 hankkeelle.
 *
 * Nämä ovat organisaatiotason laatikoita, eivät nimettyjä henkilöitä
 * (vrt. D-102). Ne merkitään aina kind: "organization".
 *
 * Haettu 22.8.2026, 93 kuntaa, kattaa 1116 hanketta.
 * Päivitys: npx tsx scripts/mine-municipality-contacts.ts
 */

export const MUNICIPALITY_CONTACTS: Record<string, { email: string; source: string }> = {
  "Helsinki": { email: "helsinki.kirjaamo@hel.fi", source: "https://www.hel.fi/kirjaamo" },
  "Espoo": { email: "kirjaamo@espoo.fi", source: "https://www.espoo.fi/kirjaamo" },
  "Kirkkonummi": { email: "kirjaamo@kirkkonummi.fi", source: "https://www.kirkkonummi.fi" },
  "Kouvola": { email: "kirjaamo@kouvola.fi", source: "https://www.kouvola.fi/fi/hallinto-ja-talous/kirjaamo" },
  "Jämsä": { email: "kirjaamo@jamsa.fi", source: "https://www.jamsa.fi" },
  "Tuusula": { email: "kirjaamo@tuusula.fi", source: "https://www.tuusula.fi" },
  "Vantaa": { email: "kirjaamo@vantaa.fi", source: "https://www.vantaa.fi/fi/yhteystiedot" },
  "Äänekoski": { email: "kirjaamo@aanekoski.fi", source: "https://www.aanekoski.fi" },
  "Kotka": { email: "kirjaamo@kotka.fi", source: "https://www.kotka.fi" },
  "Rovaniemi": { email: "kirjaamo@rovaniemi.fi", source: "https://www.rovaniemi.fi" },
  "Sipoo": { email: "kirjaamo@sipoo.fi", source: "https://www.sipoo.fi/fi/yhteystiedot" },
  "Kuopio": { email: "kirjaamo@kuopio.fi", source: "https://www.kuopio.fi" },
  "Hanko": { email: "kirjaamo@hanko.fi", source: "https://www.hanko.fi" },
  "Sysmä": { email: "kirjaamo@sysma.fi", source: "https://www.sysma.fi" },
  "Säkylä": { email: "kirjaamo@sakyla.fi", source: "https://www.sakyla.fi" },
  "Pudasjärvi": { email: "asiakaspalvelu@pudasjarvi.fi", source: "https://www.pudasjarvi.fi" },
  "Eura": { email: "kirjaamo@eura.fi", source: "https://www.eura.fi" },
  "Karkkila": { email: "kirjaamo@karkkila.fi", source: "https://www.karkkila.fi" },
  "Vehmaa": { email: "kirjaamo@vehmaa.fi", source: "https://www.vehmaa.fi" },
  "Pirkkala": { email: "kirjaamo@pirkkala.fi", source: "https://www.pirkkala.fi" },
  "Haapavesi": { email: "neuvonta@haapavesi.fi", source: "https://www.haapavesi.fi" },
  "Savonlinna": { email: "kirjaamo@savonlinna.fi", source: "https://www.savonlinna.fi" },
  "Naantali": { email: "kirjaamo@naantali.fi", source: "https://www.naantali.fi" },
  "Tammela": { email: "kirjaamo@tammela.fi", source: "https://www.tammela.fi/yhteystiedot" },
  "Kolari": { email: "kirjaamo@kolari.fi", source: "https://www.kolari.fi" },
  "Rauma": { email: "kirjaamo@rauma.fi", source: "https://www.rauma.fi" },
  "Järvenpää": { email: "kirjaamo@jarvenpaa.fi", source: "https://www.jarvenpaa.fi/yhteystiedot" },
  "Muhos": { email: "kirjaamo@muhos.fi", source: "https://www.muhos.fi" },
  "Tohmajärvi": { email: "kirjaamo@tohmajarvi.fi", source: "https://www.tohmajarvi.fi" },
  "Suonenjoki": { email: "kirjaamo@suonenjoki.fi", source: "https://www.suonenjoki.fi/fi/yhteystiedot" },
  "Vaala": { email: "kirjaamo@vaala.fi", source: "https://www.vaala.fi" },
  "Ylivieska": { email: "kirjaamo@ylivieska.fi", source: "https://www.ylivieska.fi/kirjaamo" },
  "Joutsa": { email: "kirjaamo@joutsa.fi", source: "https://www.joutsa.fi/fi/yhteystiedot" },
  "Kuhmo": { email: "kirjaamo@kuhmo.fi", source: "https://www.kuhmo.fi" },
  "Saarijärvi": { email: "kirjaamo@saarijarvi.fi", source: "https://www.saarijarvi.fi" },
  "Mikkeli": { email: "kirjaamo@mikkeli.fi", source: "https://www.mikkeli.fi" },
  "Hyvinkää": { email: "kirjaamo@hyvinkaa.fi", source: "https://www.hyvinkaa.fi" },
  "Loimaa": { email: "kirjaamo@loimaa.fi", source: "https://www.loimaa.fi" },
  "Ylöjärvi": { email: "kirjaamo@ylojarvi.fi", source: "https://www.ylojarvi.fi" },
  "Kurikka": { email: "kirjaamo@kurikka.fi", source: "https://www.kurikka.fi/fi/yhteystiedot" },
  "Joensuu": { email: "kirjaamo@joensuu.fi", source: "https://www.joensuu.fi/yhteystiedot" },
  "Sotkamo": { email: "kirjaamo@sotkamo.fi", source: "https://www.sotkamo.fi" },
  "Pori": { email: "kirjaamo@pori.fi", source: "https://www.pori.fi" },
  "Kärkölä": { email: "kirjaamo@karkola.fi", source: "https://www.karkola.fi" },
  "Asikkala": { email: "kirjaamo@asikkala.fi", source: "https://www.asikkala.fi" },
  "Ulvila": { email: "kirjaamo@ulvila.fi", source: "https://www.ulvila.fi" },
  "Forssa": { email: "kirjaamo@forssa.fi", source: "https://www.forssa.fi" },
  "Nakkila": { email: "kirjaamo@nakkila.fi", source: "https://www.nakkila.fi" },
  "Sodankylä": { email: "kirjaamo@sodankyla.fi", source: "https://www.sodankyla.fi" },
  "Lemi": { email: "rakennusvalvonta@lemi.fi", source: "https://www.lemi.fi/fi/yhteystiedot" },
  "Lappeenranta": { email: "kirjaamo@lappeenranta.fi", source: "https://www.lappeenranta.fi/yhteystiedot" },
  "Hattula": { email: "kirjaamo@hattula.fi", source: "https://www.hattula.fi" },
  "Salo": { email: "kirjaamo@salo.fi", source: "https://www.salo.fi" },
  "Orimattila": { email: "kirjaamo@orimattila.fi", source: "https://www.orimattila.fi" },
  "Kokkola": { email: "asiakaspalvelu@kokkola.fi", source: "https://www.kokkola.fi/fi/yhteystiedot" },
  "Tornio": { email: "kirjaamo@tornio.fi", source: "https://www.tornio.fi" },
  "Taipalsaari": { email: "kirjaamo@taipalsaari.fi", source: "https://www.taipalsaari.fi" },
  "Kajaani": { email: "neuvonta@kajaani.fi", source: "https://www.kajaani.fi" },
  "Hollola": { email: "kirjaamo@hollola.fi", source: "https://www.hollola.fi" },
  "Salla": { email: "kirjaamo@salla.fi", source: "https://www.salla.fi" },
  "Muurame": { email: "kirjaamo@muurame.fi", source: "https://www.muurame.fi" },
  "Vaasa": { email: "kirjaamo@vaasa.fi", source: "https://www.vaasa.fi/fi/hallinto-ja-talous/kirjaamo" },
  "Kitee": { email: "tekninen.kirjaamo@kitee.fi", source: "https://www.kitee.fi" },
  "Raisio": { email: "kirjaamo@raisio.fi", source: "https://www.raisio.fi" },
  "Kaarina": { email: "kirjaamo@kaarina.fi", source: "https://www.kaarina.fi" },
  "Lahti": { email: "kirjaamo@lahti.fi", source: "https://www.lahti.fi/fi/hallinto-ja-talous/kirjaamo" },
  "Kempele": { email: "kirjaamo@kempele.fi", source: "https://www.kempele.fi" },
  "Pello": { email: "kirjaamo@pello.fi", source: "https://www.pello.fi" },
  "Enontekiö": { email: "kirjaamo@enontekio.fi", source: "https://www.enontekio.fi" },
  "Merikarvia": { email: "kirjaamo@merikarvia.fi", source: "https://www.merikarvia.fi" },
  "Janakkala": { email: "kirjaamo@janakkala.fi", source: "https://www.janakkala.fi" },
  "Kalajoki": { email: "kirjaamo@kalajoki.fi", source: "https://www.kalajoki.fi" },
  "Orivesi": { email: "kirjaamo@orivesi.fi", source: "https://www.orivesi.fi" },
  "Kyyjärvi": { email: "kirjaamo@kyyjarvi.fi", source: "https://www.kyyjarvi.fi" },
  "Lieto": { email: "kirjaamo@lieto.fi", source: "https://www.lieto.fi/fi/yhteystiedot" },
  "Pieksämäki": { email: "kirjaamo@pieksamaki.fi", source: "https://www.pieksamaki.fi" },
  "Perho": { email: "info@perho.fi", source: "https://www.perho.fi" },
  "Muonio": { email: "kirjaamo@muonio.fi", source: "https://www.muonio.fi" },
  "Kontiolahti": { email: "kirjaamo@kontiolahti.fi", source: "https://www.kontiolahti.fi" },
  "Kemijärvi": { email: "kirjaamo@kemijarvi.fi", source: "https://www.kemijarvi.fi/fi/hallinto-ja-talous/kirjaamo" },
  "Ilmajoki": { email: "kirjaamo@ilmajoki.fi", source: "https://www.ilmajoki.fi/fi/yhteystiedot" },
  "Ruokolahti": { email: "kirjaamo@ruokolahti.fi", source: "https://www.ruokolahti.fi" },
  "Ylitornio": { email: "kirjaamo@ylitornio.fi", source: "https://www.ylitornio.fi" },
  "Varkaus": { email: "kirjaamo@varkaus.fi", source: "https://www.varkaus.fi" },
  "Kangasala": { email: "kirjaamo@kangasala.fi", source: "https://www.kangasala.fi" },
  "Iisalmi": { email: "kirjaamo@iisalmi.fi", source: "https://www.iisalmi.fi" },
  "Kiuruvesi": { email: "kirjaamo@kiuruvesi.fi", source: "https://www.kiuruvesi.fi" },
  "Heinola": { email: "kirjaamo@heinola.fi", source: "https://www.heinola.fi" },
  "Karstula": { email: "kirjaamo@karstula.fi", source: "https://www.karstula.fi" },
  "Padasjoki": { email: "kirjaamo@padasjoki.fi", source: "https://www.padasjoki.fi/yhteystiedot" },
  "Tervola": { email: "info@tervola.fi", source: "https://www.tervola.fi" },
  "Kauhajoki": { email: "kirjaamo@kauhajoki.fi", source: "https://www.kauhajoki.fi" },
  "Petäjävesi": { email: "kirjaamo@petajavesi.fi", source: "https://www.petajavesi.fi/fi/yhteystiedot" },
}

export function municipalityContact(name: string | null | undefined): string | null {
  const k = String(name ?? "").trim()
  return k ? MUNICIPALITY_CONTACTS[k]?.email ?? null : null
}
