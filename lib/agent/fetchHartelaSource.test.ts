import { fetchPeabSource } from "./fetchHartelaSource"

async function main() {
  const results = await fetchHartelaSource()
}

main().catch(console.error)