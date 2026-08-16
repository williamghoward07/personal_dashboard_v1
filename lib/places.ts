import type { Place, PlaceCategory } from './types'

export const PLACE_CATEGORIES: { value: PlaceCategory; label: string }[] = [
  { value: 'cafe', label: 'Cafe' },
  { value: 'university', label: 'University' },
  { value: 'pub', label: 'Pub' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'gym', label: 'Gym' },
  { value: 'office', label: 'Office' },
  { value: 'home', label: 'Home' },
  { value: 'event', label: 'Event' },
  { value: 'other', label: 'Other' },
]

export function placeCategoryLabel(category: PlaceCategory) {
  return PLACE_CATEGORIES.find((c) => c.value === category)?.label ?? 'Other'
}

/**
 * A Google Maps deep link for a place. Uses the free URL scheme rather than the
 * Maps Embed/Static APIs, so no API key is needed. Coordinates win when present
 * because they're unambiguous; otherwise the address, then the bare name.
 * Returns null when there's nothing locatable to search for.
 */
export function mapUrl(place: Pick<Place, 'name' | 'address' | 'latitude' | 'longitude'>) {
  const query =
    place.latitude != null && place.longitude != null
      ? `${place.latitude},${place.longitude}`
      : place.address || place.name

  if (!query) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}
