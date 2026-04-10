import https from "node:https"
import { gunzipSync, inflateSync, brotliDecompressSync } from "node:zlib"

export async function fetchJsonWithFallback(url: string, referer?: string) {
  return new Promise<any>((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json, text/plain, */*",
          "Accept-Encoding": "gzip, deflate, br",
          ...(referer ? { Referer: referer } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = []

        res.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        })

        res.on("end", () => {
          try {
            const raw = Buffer.concat(chunks)
            const encoding = String(res.headers["content-encoding"] || "").toLowerCase()

            let decoded: Buffer

            try {
              if (encoding.includes("br")) {
                decoded = brotliDecompressSync(raw)
              } else if (encoding.includes("gzip")) {
                decoded = gunzipSync(raw)
              } else if (encoding.includes("deflate")) {
                decoded = inflateSync(raw)
              } else {
                decoded = raw
              }
            } catch {
              // fallback: jos header valehtelee tai data on jo plain text
              decoded = raw
            }

            const text = decoded.toString("utf8")
            resolve(JSON.parse(text))
          } catch (err) {
            reject(err)
          }
        })
      }
    )

    req.on("error", reject)
  })
}