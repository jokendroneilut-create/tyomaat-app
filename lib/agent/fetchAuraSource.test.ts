import { fetchAuraSource } from "./fetchAuraSource"

async function main() {
  const results = await fetchAuraSource()
  console.log(JSON.stringify(results.slice(0, 10), null, 2))
}

main().catch(console.error)