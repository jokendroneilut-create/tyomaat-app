import { fetchAsuraSource } from "./fetchAsuraSource"

async function main() {
  const results = await fetchAsuraSource()
  console.log(JSON.stringify(results.slice(0, 10), null, 2))
}

main().catch(console.error)