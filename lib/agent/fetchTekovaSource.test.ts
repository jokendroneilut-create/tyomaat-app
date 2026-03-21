import { fetchTekovaSource } from "./fetchTekovaSource"

async function main() {
  const results = await fetchTekovaSource()
  console.log("COUNT:", results.length)
  console.log(JSON.stringify(results.slice(0, 20), null, 2))
}

main().catch(console.error)