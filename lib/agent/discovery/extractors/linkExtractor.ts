export function extractLinks(rawHtml: string): string[] {
  const matches = [...rawHtml.matchAll(/href=["']([^"']+)["']/gi)]

  return [...new Set(matches.map((match) => match[1]).filter(Boolean))]
}