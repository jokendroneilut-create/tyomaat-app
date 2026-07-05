export type PermitDecisionBlock = {
  index: number
  sectionNumber: string
  propertyIds: string[]
  district: string | null
  address: string | null
  postalCode: string | null
  city: string | null
  operation: string | null
  decisionMaker: string | null
  permitNumber: string | null
  rawText: string
}

export function splitEspooPermitNoticeText(text: string): PermitDecisionBlock[] {
  const normalized = normalizeText(text)

  const cleaned = normalized
    .replace(/ESPOON KAUPUNKI[\s\S]*?Pykälä\s+Luvan tunnus/gi, "")
    .replace(/ESBO STAD[\s\S]*?Paragraf\s+Lovnummer/gi, "")
    .replace(/Paragraf\s+Lovnummer/gi, "")
    .replace(/_{5,}/g, "")
    .replace(/Muutoksenhaku[\s\S]*$/gi, "")
    .trim()

  const startRegex =
    /(?=^\s*\d{1,3}\s+49[-–]\d+[-–]\d+[-–]\d+\s+[A-ZÅÄÖ][A-ZÅÄÖ\s-]*)/gm

  const blocks = cleaned
    .split(startRegex)
    .map((block) => block.trim())
    .filter(Boolean)

  return blocks.map((block, index) =>
    parseEspooDecisionBlock(block, index + 1)
  )
}

function parseEspooDecisionBlock(
  block: string,
  index: number
): PermitDecisionBlock {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  const firstLine = lines[0] ?? ""

  const firstMatch = firstLine.match(
    /^(\d{1,3})\s+(49[-–]\d+[-–]\d+[-–]\d+)\s+(.+)$/
  )

  const sectionNumber = firstMatch?.[1] ?? ""
  const firstPropertyId = normalizeDash(firstMatch?.[2] ?? "")
  const district = firstMatch?.[3]?.trim() ?? null

  const allPropertyIds = Array.from(
    block.matchAll(/49[-–]\d+[-–]\d+[-–]\d+/g)
  ).map((match) => normalizeDash(match[0]))

  const propertyIds = Array.from(
    new Set([firstPropertyId, ...allPropertyIds].filter(Boolean))
  )

  const permitNumber =
    normalizeDash(block.match(/049[-–]\d{4}[-–]\d+/)?.[0] ?? "") || null

  const decisionMaker =
    block.match(/päätöksentekijä:\s*(.+)/i)?.[1]?.trim() ?? null

  const postalLineIndex = lines.findIndex((line) =>
    /^\d{5}\s+ESPOO$/i.test(line)
  )

  const address = postalLineIndex > 0 ? lines[postalLineIndex - 1] : null

  const postalMatch =
    postalLineIndex >= 0
      ? lines[postalLineIndex].match(/^(\d{5})\s+(.+)$/)
      : null

  const postalCode = postalMatch?.[1] ?? null
  const city = postalMatch?.[2] ?? null

  const decisionMakerIndex = lines.findIndex((line) =>
    /^päätöksentekijä:/i.test(line)
  )

  const operation =
    postalLineIndex >= 0 && decisionMakerIndex > postalLineIndex
      ? lines.slice(postalLineIndex + 1, decisionMakerIndex).join(" ")
      : null

  return {
    index,
    sectionNumber,
    propertyIds,
    district,
    address,
    postalCode,
    city,
    operation,
    decisionMaker,
    permitNumber,
    rawText: block,
  }
}

function normalizeDash(value: string): string {
  return value.replace(/–/g, "-").trim()
}

function normalizeText(value: string): string {
  return value
    .replace(/\r/g, "")
    .replace(/Ã¤/g, "ä")
    .replace(/Ã„/g, "Ä")
    .replace(/Ã¶/g, "ö")
    .replace(/Ã–/g, "Ö")
    .replace(/Ã¥/g, "å")
    .replace(/Ã…/g, "Å")
    .replace(/â€“/g, "–")
}