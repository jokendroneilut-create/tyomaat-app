import { readFileSync } from "node:fs"

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}


/*
 * MITTARIEN ESIKATSELU TIEDOSTOON (D-239).
 *
 * /tic vaatii adminkirjautumisen, joten mittareita ei voi katsoa
 * selaimessa taman istunnon aikana. Esikatselu piirtaa SAMOILLA
 * geometriafunktioilla joita komponentti kayttaa, oikeilla luvuilla
 * kannasta — eli se nayttaa sen mita sivu nayttaa.
 *
 *   npx tsx scripts/esikatsele-mittarit.ts
 */
async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { laskeKattavuus, VAIHEEN_NIMI } = await import("../lib/metrics/yhteystiedonKattavuus")
  const { MITTARI, VYOHYKKEET, mittarinKaari, mittarinPiste } = await import("../lib/metrics/mittarinGeometria")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const hankkeet: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("projects").select("phase, status, is_public, metadata").range(from, from + 999)
    if (error) throw error
    hankkeet.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  const kattavuus = laskeKattavuus(hankkeet)

  /* --demo nayttaa milta mittari nayttaa kun tasot eroavat. */
  if (process.argv.includes("--demo")) {
    for (const k of kattavuus) {
      k.hankekohtaisia = Math.round(k.yhteystiedolla * 0.7)
      k.hankekohtainenOsuus = k.hankkeita ? k.hankekohtaisia / k.hankkeita : 0
    }
  }

  const { data: historia } = await db.from("yhteystieto_kattavuus").select("paiva, vaihe, hankkeita, yhteystiedolla").order("paiva")

  const mittari = (k: { vaihe: "construction" | "planning"; osuus: number; hankekohtainenOsuus: number; yhteystiedolla: number; hankekohtaisia: number; hankkeita: number }) => {
    const kaikkiNeula = mittarinPiste(k.osuus, MITTARI.sade - 8)
    const hankeNeula = mittarinPiste(k.hankekohtainenOsuus, MITTARI.sade - 8)
    const vyohykkeet = VYOHYKKEET.map((v) =>
      '<path d="' + mittarinKaari(v.alku, v.loppu, MITTARI.sade) + '" stroke="' + v.vari + '" stroke-width="' + MITTARI.paksuus + '" fill="none" />'
    ).join("")
    const merkit = [0, 0.25, 0.5, 0.75, 1].map((kohta) => {
      const ulko = mittarinPiste(kohta, MITTARI.sade + MITTARI.paksuus / 2 + 2)
      const sisa = mittarinPiste(kohta, MITTARI.sade + MITTARI.paksuus / 2 - 3)
      const teksti = mittarinPiste(kohta, MITTARI.nimikkeenSade)
      return '<line x1="' + ulko.x + '" y1="' + ulko.y + '" x2="' + sisa.x + '" y2="' + sisa.y + '" stroke="#9ca3af" stroke-width="1.5" />' +
        '<text x="' + teksti.x + '" y="' + (teksti.y + 4) + '" text-anchor="middle" font-size="11" fill="#6b7280">' + kohta * 100 + '</text>'
    }).join("")
    return '<div class="ruutu">' +
      '<h3>' + VAIHEEN_NIMI[k.vaihe] + '</h3>' +
      '<svg viewBox="0 0 ' + MITTARI.leveys + ' ' + MITTARI.korkeus + '">' + vyohykkeet + merkit +
      '<line x1="' + MITTARI.keskiX + '" y1="' + MITTARI.keskiY + '" x2="' + kaikkiNeula.x + '" y2="' + kaikkiNeula.y + '" stroke="#9ca3af" stroke-width="3" stroke-linecap="round" />' +
      '<line x1="' + MITTARI.keskiX + '" y1="' + MITTARI.keskiY + '" x2="' + hankeNeula.x + '" y2="' + hankeNeula.y + '" stroke="#111827" stroke-width="3" stroke-linecap="round" />' +
      '<circle cx="' + MITTARI.keskiX + '" cy="' + MITTARI.keskiY + '" r="6" fill="#111827" />' +
      "</svg>" +
      '<p class="iso">' + Math.round(k.hankekohtainenOsuus * 100) + " %</p>" +
      '<p class="pieni">' + k.hankekohtaisia + " hankekohtaista / " + k.hankkeita + "</p>" +
      (Math.round(k.osuus * 100) !== Math.round(k.hankekohtainenOsuus * 100)
        ? '<p class="pieni" style="color:#9ca3af">' + Math.round(k.osuus * 100) + " % kun yrityskohtaiset lasketaan mukaan</p>"
        : "") +
      "</div>"
  }

  const trendi = (vaihe: "construction" | "planning") => {
    const pisteet = (historia ?? []).filter((r: any) => r.vaihe === vaihe)
    const osuudet = pisteet.map((r: any) => (r.hankkeita ? r.yhteystiedolla / r.hankkeita : 0))
    const W = 220, H = 110, mv = 26, mo = 8, my = 10, ma = 20
    const pw = W - mv - mo, ph = H - my - ma
    const x = (i: number) => mv + (osuudet.length <= 1 ? pw / 2 : (i / (osuudet.length - 1)) * pw)
    const y = (o: number) => my + ph * (1 - o)
    const viivat = [0, 0.5, 1].map((t) =>
      '<line x1="' + mv + '" y1="' + y(t) + '" x2="' + (W - mo) + '" y2="' + y(t) + '" stroke="#e5e7eb" />' +
      '<text x="' + (mv - 5) + '" y="' + (y(t) + 3) + '" text-anchor="end" font-size="9" fill="#9ca3af">' + t * 100 + "</text>"
    ).join("")
    const ympyrat = osuudet.map((o, i) => '<circle cx="' + x(i) + '" cy="' + y(o) + '" r="' + (osuudet.length === 1 ? 4 : 2.5) + '" fill="#2563eb" />').join("")
    return '<div class="ruutu"><h3>' + VAIHEEN_NIMI[vaihe] + " — kehitys</h3>" +
      '<svg viewBox="0 0 ' + W + " " + H + '">' + viivat + ympyrat + "</svg>" +
      '<p class="pieni">Mittaus alkoi ' + (pisteet[0]?.paiva ?? "tänään") + "</p></div>"
  }

  const html = "<!doctype html><html lang=\"fi\"><head><meta charset=\"utf-8\"><title>Mittarien esikatselu</title>" +
    "<style>body{font-family:system-ui,sans-serif;background:#f9fafb;padding:24px;margin:0}" +
    "h1{font-size:20px}h2{font-size:16px;color:#374151}" +
    ".rivi{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;max-width:1104px}" +
    "@media(min-width:1024px){.rivi{grid-template-columns:repeat(4,1fr);gap:16px}}" +
    ".ruutu{border:1px solid #e5e7eb;border-radius:16px;background:#fff;padding:16px}" +
    ".ruutu h3{font-size:13px;color:#374151;margin:0 0 8px}" +
    "svg{width:100%}" +
    ".iso{font-size:30px;font-weight:700;text-align:center;margin:4px 0 0}" +
    ".pieni{font-size:13px;color:#6b7280;text-align:center;margin:2px 0 0}" +
    "</style></head><body>" +
    "<h1>Yhteyshenkilön kattavuus — esikatselu</h1>" +
    '<div class="rivi">' + kattavuus.map(mittari).join("") + trendi("construction") + trendi("planning") + "</div>" +
    "</body></html>"

  const { writeFileSync } = await import("node:fs")
  const polku = process.argv[2] ?? "mittarit.html"
  writeFileSync(polku, html, "utf8")
  console.log("kirjoitettu " + polku)
  for (const k of kattavuus) console.log("  " + VAIHEEN_NIMI[k.vaihe] + " " + Math.round(k.osuus * 100) + " %")
}
main().catch((e) => { console.error(e); process.exit(1) })
