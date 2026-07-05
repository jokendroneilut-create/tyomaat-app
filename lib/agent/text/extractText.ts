export type TextExtractionInput = {
  documentType: string
  rawPayload?: unknown
  extractedText?: string | null
}

export type TextExtractionResult = {
  text: string
  metadata: Record<string, unknown>
}

export async function extractText(
  input: TextExtractionInput
): Promise<TextExtractionResult> {
  switch (input.documentType) {
    case "html":
      return extractHtml(input)

    case "pdf":
      return extractPdf(input)

    case "api":
      return extractApi(input)

    default:
      return {
        text: "",
        metadata: {
          warning: `Unsupported document type: ${input.documentType}`,
        },
      }
  }
}

async function extractHtml(
  input: TextExtractionInput
): Promise<TextExtractionResult> {
  return {
    text: input.extractedText ?? "",
    metadata: {
      extractor: "html",
    },
  }
}

async function extractPdf(
  input: TextExtractionInput
): Promise<TextExtractionResult> {
  return {
    text: input.extractedText ?? "",
    metadata: {
      extractor: "pdf",
    },
  }
}

async function extractApi(
  input: TextExtractionInput
): Promise<TextExtractionResult> {
  return {
    text: input.extractedText ?? "",
    metadata: {
      extractor: "api",
    },
  }
}