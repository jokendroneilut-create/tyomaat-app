import { fetchTestSource } from "./fetchTestSource"

async function main() {
  const results = await fetchTestSource()
  console.log(JSON.stringify(results.slice(0, 5), null, 2))
}

main().catch(console.error)