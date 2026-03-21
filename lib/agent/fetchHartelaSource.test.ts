import { fetchHartelaSource } from "./fetchHartelaSource"

async function main() {
  const results = await fetchHartelaSource()
  console.log("COUNT:", results.length)
  console.log(JSON.stringify(results.slice(0, 20), null, 2))
}

main().catch(console.error)