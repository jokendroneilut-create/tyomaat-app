import { fetchFiraSource } from "./fetchFiraSource"

async function main() {
  const results = await fetchFiraSource()
  console.log("COUNT:", results.length)
  console.log(JSON.stringify(results.slice(0, 20), null, 2))
}

main().catch(console.error)