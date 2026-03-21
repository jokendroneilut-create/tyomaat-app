import { fetchPeabSource } from "./fetchPeabSource"

async function main() {
  const results = await fetchPeabSource()
}

main().catch(console.error)