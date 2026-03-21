import { fetchAsuntosaatioSource } from "./fetchAsuntosaatioSource"

async function main() {
  const results = await fetchAsuntosaatioSource()
  console.log(JSON.stringify(results.slice(0, 10), null, 2))
}

main().catch(console.error)