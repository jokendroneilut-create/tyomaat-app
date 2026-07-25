import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

/*
 * Sama "@/"-aliaskartta kuin tsconfig.jsonissa ("@/*" -> "./*"), jotta testit
 * voivat importata tuotantokoodin samoilla poluilla kuin sovellus.
 */
const rootDir = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      "@": rootDir,
    },
  },
  test: {
    environment: "node",
    /*
     * Käytetään "*.spec.ts"-konventiota Vitest-testeille. Projektissa on jo
     * vanhoja "*.test.ts"-tiedostoja, jotka ovat käsin ajettavia console.log-
     * skriptejä (ei kehystestejä) — niitä ei haluta ajaa täällä.
     */
    include: ["**/*.spec.ts"],
    exclude: ["**/node_modules/**", "**/.claude/**", "**/.next/**"],
  },
})
