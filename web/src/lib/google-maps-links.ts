import type { Location } from "@/types/meetup";

function placeId(place: Location) {
  return place.placeId.trim().replace(/^places\//, "");
}

function coordinatesOrName(place: Location) {
  const { latitude, longitude } = place;
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    ? `${latitude},${longitude}` : [place.name, place.address].filter(Boolean).join(" ");
}

export function googleMapsPlaceUrl(place: Location) {
  const params = new URLSearchParams({ api: "1", query: coordinatesOrName(place) });
  const id = placeId(place);
  if (id) params.set("query_place_id", id);
  return `https://www.google.com/maps/search/?${params}`;
}

// Only use the dedicated, referrer-restricted browser key. Never the server key
// used by Places/Routes, nor Firebase's API key.
export function googleMapsEmbedUrl(place: Location, language: string) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY?.trim();
  if (!key) return undefined;
  const id = placeId(place);
  const params = new URLSearchParams({
    key, q: id ? `place_id:${id}` : coordinatesOrName(place),
    language: language === "ko" ? "ko" : "ja", zoom: "16",
  });
  return `https://www.google.com/maps/embed/v1/place?${params}`;
}

/** No-key, inline map fallback for deployments that intentionally do not ship a
 * browser Google Maps key. Coordinates are already part of the saved place. */
export function openStreetMapEmbedUrl(place: Location) {
  if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)
    || Math.abs(place.latitude) > 90 || Math.abs(place.longitude) > 180) return undefined;
  const latitudeSpan = 0.0025;
  const longitudeSpan = Math.max(0.0025, latitudeSpan / Math.max(Math.cos(place.latitude * Math.PI / 180), 0.2));
  const bbox = [
    place.longitude - longitudeSpan,
    place.latitude - latitudeSpan,
    place.longitude + longitudeSpan,
    place.latitude + latitudeSpan,
  ].map((value) => value.toFixed(6)).join(",");
  const params = new URLSearchParams({ bbox, layer: "mapnik", marker: `${place.latitude},${place.longitude}` });
  return `https://www.openstreetmap.org/export/embed.html?${params}`;
}
