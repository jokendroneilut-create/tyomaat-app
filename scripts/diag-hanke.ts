import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}
async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data, error } = await sb.from("projects").select("*").eq("id", process.argv[2]).maybeSingle()
  if (error) { console.error(error); return }
  if (!data) { console.log("ei loytynyt"); return }
  const d: any = data
  for (const k of Object.keys(d)) {
    if (k === "metadata") continue
    const v = d[k]
    if (v === null || v === "" || (Array.isArray(v) && v.length === 0)) continue
    console.log(k.padEnd(24), JSON.stringify(v).slice(0, 300))
  }
  console.log("\n=== metadata-avaimet ===")
  const md = d.metadata ?? {}
  for (const k of Object.keys(md)) {
    console.log("  " + k.padEnd(30), JSON.stringify(md[k]).slice(0, 400))
  }
}
main()
