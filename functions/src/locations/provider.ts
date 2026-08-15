import type { Location, RouteMatrixResult, RouteResult } from "./models.js";

export interface MapsProvider {
  searchPlaces(query: string, near?: Pick<Location, "latitude" | "longitude">): Promise<Location[]>;
  candidatePlaces(near: Pick<Location, "latitude" | "longitude">): Promise<Location[]>;
  /** Calculates a transit route that arrives by the requested time. */
  calculateRoute(origin: Location, destination: Location, arrivalTime?: Date): Promise<RouteResult>;
  calculateMatrix(origins: Location[], destinations: Location[]): Promise<RouteMatrixResult>;
}

const mockLocations: Location[] = [
  { placeId: "mock-shibuya", name: "渋谷駅", address: "東京都渋谷区道玄坂1丁目", latitude: 35.658034, longitude: 139.701636 },
  { placeId: "mock-shinjuku", name: "新宿駅", address: "東京都新宿区西新宿1丁目", latitude: 35.690921, longitude: 139.700258 },
  { placeId: "mock-tokyo", name: "東京駅", address: "東京都千代田区丸の内1丁目", latitude: 35.681236, longitude: 139.767125 },
  { placeId: "mock-yokohama", name: "横浜駅", address: "神奈川県横浜市西区高島2丁目", latitude: 35.466188, longitude: 139.622715 },
  { placeId: "mock-kichijoji", name: "吉祥寺駅", address: "東京都武蔵野市吉祥寺南町2丁目", latitude: 35.703152, longitude: 139.579584 },
  { placeId: "mock-chiba", name: "千葉駅", address: "千葉県千葉市中央区新千葉1丁目", latitude: 35.613995, longitude: 140.113858 },
  { placeId: "mock-ebisu", name: "恵比寿駅", address: "東京都渋谷区恵比寿南1丁目", latitude: 35.646685, longitude: 139.71007 },
  { placeId: "mock-ikebukuro", name: "池袋駅", address: "東京都豊島区西池袋1丁目", latitude: 35.728926, longitude: 139.71038 },
  { placeId: "mock-shinagawa", name: "品川駅", address: "東京都港区高輪3丁目", latitude: 35.628471, longitude: 139.73876 },
];

function haversineKilometers(a: Pick<Location, "latitude" | "longitude">, b: Pick<Location, "latitude" | "longitude">): number {
  const earthRadius = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLatitude = toRadians(b.latitude - a.latitude);
  const deltaLongitude = toRadians(b.longitude - a.longitude);
  const h = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(deltaLongitude / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export class MockMapsProvider implements MapsProvider {
  async searchPlaces(query: string): Promise<Location[]> {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return mockLocations.slice(0, 6);
    const matches = mockLocations.filter((location) => `${location.name} ${location.address}`.toLowerCase().includes(normalized));
    return matches.length > 0 ? matches : mockLocations.slice(0, 6);
  }

  async candidatePlaces(near: Pick<Location, "latitude" | "longitude">): Promise<Location[]> {
    return [...mockLocations].sort((a, b) => haversineKilometers(a, near) - haversineKilometers(b, near)).slice(0, 6);
  }

  async calculateRoute(origin: Location, destination: Location): Promise<RouteResult> {
    const distance = haversineKilometers(origin, destination);
    const durationMinutes = Math.max(7, Math.round(10 + distance * 1.05));
    return {
      durationMinutes,
      transfers: distance > 25 ? 2 : distance > 8 ? 1 : 0,
      routeSummary: `${origin.name} → ${destination.name}`,
    };
  }

  async calculateMatrix(origins: Location[], destinations: Location[]): Promise<RouteMatrixResult> {
    return { durations: await Promise.all(origins.map(async (origin) => Promise.all(destinations.map(async (destination) => (await this.calculateRoute(origin, destination)).durationMinutes)))) };
  }
}

interface GoogleRoutesResponse { routes?: Array<{ duration?: string; legs?: Array<{ steps?: unknown[] }> }> }

class GoogleMapsProvider implements MapsProvider {
  constructor(private readonly apiKey: string) {}

  async searchPlaces(query: string, near?: Pick<Location, "latitude" | "longitude">): Promise<Location[]> {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": this.apiKey, "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location" },
      body: JSON.stringify({ textQuery: query, ...(near ? { locationBias: { circle: { center: { latitude: near.latitude, longitude: near.longitude }, radius: 25000 } } } : {}) }),
    });
    if (!response.ok) throw new Error(`Google Places request failed (${response.status}).`);
    const payload = await response.json() as { places?: Array<{ id: string; displayName?: { text?: string }; formattedAddress?: string; location?: { latitude?: number; longitude?: number } }> };
    return (payload.places ?? []).flatMap((place) => place.location?.latitude !== undefined && place.location.longitude !== undefined ? [{ placeId: place.id, name: place.displayName?.text ?? place.formattedAddress ?? "Unknown place", address: place.formattedAddress, latitude: place.location.latitude, longitude: place.location.longitude }] : []);
  }

  async candidatePlaces(near: Pick<Location, "latitude" | "longitude">): Promise<Location[]> {
    return this.searchPlaces("駅", near);
  }

  async calculateRoute(origin: Location, destination: Location, arrivalTime?: Date): Promise<RouteResult> {
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": this.apiKey, "X-Goog-FieldMask": "routes.duration,routes.legs.steps" },
      body: JSON.stringify({ origin: { location: { latLng: { latitude: origin.latitude, longitude: origin.longitude } } }, destination: { location: { latLng: { latitude: destination.latitude, longitude: destination.longitude } } }, travelMode: "TRANSIT", ...(arrivalTime ? { arrivalTime: arrivalTime.toISOString() } : {}) }),
    });
    if (!response.ok) throw new Error(`Google Routes request failed (${response.status}).`);
    const payload = await response.json() as GoogleRoutesResponse;
    const route = payload.routes?.[0];
    const seconds = Number(route?.duration?.replace("s", ""));
    if (!Number.isFinite(seconds)) throw new Error("Google Routes returned no route.");
    return { durationMinutes: Math.max(1, Math.ceil(seconds / 60)), transfers: Math.max(0, (route?.legs?.[0]?.steps?.length ?? 1) - 1), routeSummary: `${origin.name} → ${destination.name}` };
  }

  async calculateMatrix(origins: Location[], destinations: Location[]): Promise<RouteMatrixResult> {
    return { durations: await Promise.all(origins.map(async (origin) => Promise.all(destinations.map(async (destination) => (await this.calculateRoute(origin, destination)).durationMinutes)))) };
  }
}

export function getMapsProvider(): MapsProvider {
  const useMock = process.env.USE_MOCK_MAPS !== "false";
  if (useMock) return new MockMapsProvider();
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_MAPS_SERVER_API_KEY is required when USE_MOCK_MAPS=false.");
  return new GoogleMapsProvider(apiKey);
}
