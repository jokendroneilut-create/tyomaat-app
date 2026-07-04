type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonValue[]

type JsonObject = {
  [key: string]: JsonValue
}

export function findObjectsByType(
  value: JsonValue,
  type: string
): JsonObject[] {
  const results: JsonObject[] = []

  walk(value)

  return results

  function walk(node: JsonValue) {
    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item)
      }
      return
    }

    if (!node || typeof node !== "object") {
      return
    }

    if ("type" in node && node.type === type) {
      results.push(node)
    }

    for (const child of Object.values(node)) {
      walk(child)
    }
  }
}

export function findObjectsContainingKey(
  value: JsonValue,
  key: string
): JsonObject[] {
  const results: JsonObject[] = []

  walk(value)

  return results

  function walk(node: JsonValue) {
    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item)
      }
      return
    }

    if (!node || typeof node !== "object") {
      return
    }

    if (key in node) {
      results.push(node)
    }

    for (const child of Object.values(node)) {
      walk(child)
    }
  }
}