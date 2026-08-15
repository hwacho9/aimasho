export interface Location {
  placeId: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
}

export interface RouteResult {
  durationMinutes: number;
  transfers?: number;
  routeSummary?: string;
}

export interface RouteMatrixResult {
  durations: number[][];
}

export interface LocationRouteDuration {
  participantUid: string;
  durationMinutes: number;
}

export type MeetingPointMode = "FAIR" | "FAST";

export interface MeetingPointCandidate extends Location {
  averageDurationMinutes: number;
  maxDurationMinutes: number;
  standardDeviationMinutes: number;
  fairScore: number;
  fastScore: number;
  score: number;
  participantDurations: LocationRouteDuration[];
}
