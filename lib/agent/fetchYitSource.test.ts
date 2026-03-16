import { fetchYitSource } from "./fetchYitSource"

async function main() {
  const results = await fetchYitSource()
  console.log(JSON.stringify(results.slice(0, 10), null, 2))
}

main().catch(console.error)