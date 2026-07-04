export function extractNextData(rawHtml: string): any | null {
  const match = rawHtml.match(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/
  )

  if (!match?.[1]) {
    return null
  }

  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}