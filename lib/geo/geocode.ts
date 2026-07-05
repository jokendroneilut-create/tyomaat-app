export type GeocodeResult = {
  lat: number | null
  lon: number | null
}

export async function geocodeAddress(query: string): Promise<GeocodeResult> {
  if (!query) return { lat: null, lon: null }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`

    const res = await fetch(url, {
      headers: {
        "Accept-Language": "fi,en;q=0.8",
        "User-Agent": "Tyomaat.fi Discovery Agent",
      },
      cache: "no-store",
    })

    const data = await res.json()

    if (Array.isArray(data) && data.length > 0 && data[0]?.lat && data[0]?.lon) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
      }
    }

    return { lat: null, lon: null }
  } catch (error) {
    console.error("Geocoding error:", error)
    return { lat: null, lon: null }
  }
}

export async function geocodeProjectLocation(input: {
  location?: string | null
  city?: string | null
  region?: string | null
}) {
  const q1 = [input.location, input.city, input.region, "Finland"]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(", ")

  let coords = await geocodeAddress(q1)

  if ((coords.lat == null || coords.lon == null) && input.city?.trim()) {
    coords = await geocodeAddress(`${input.city.trim()}, Finland`)
  }

  if ((coords.lat == null || coords.lon == null) && input.region?.trim()) {
    coords = await geocodeAddress(`${input.region.trim()}, Finland`)
  }

  return coords
}