import type { Location, MeetingPointCandidate, MeetingPointMode } from "./models.js";

export function geographicCenter(locations: Location[]): Pick<Location, "latitude" | "longitude"> {
  if (locations.length === 0) throw new Error("At least one origin is required.");
  return {
    latitude: locations.reduce((total, location) => total + location.latitude, 0) / locations.length,
    longitude: locations.reduce((total, location) => total + location.longitude, 0) / locations.length,
  };
}

export function rankMeetingPoints(candidates: Location[], durationsByCandidate: number[][], participantUids: string[], mode: MeetingPointMode): MeetingPointCandidate[] {
  return candidates.map((candidate, candidateIndex) => {
    const durations = durationsByCandidate.map((row) => row[candidateIndex] ?? Number.POSITIVE_INFINITY);
    const averageDurationMinutes = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
    const standardDeviationMinutes = Math.sqrt(durations.reduce((sum, duration) => sum + (duration - averageDurationMinutes) ** 2, 0) / durations.length);
    const maxDurationMinutes = Math.max(...durations);
    const fairScore = averageDurationMinutes + standardDeviationMinutes * 1.5 + maxDurationMinutes * 0.25;
    const fastScore = averageDurationMinutes;
    return { ...candidate, averageDurationMinutes: Math.round(averageDurationMinutes * 10) / 10, maxDurationMinutes, standardDeviationMinutes: Math.round(standardDeviationMinutes * 10) / 10, fairScore: Math.round(fairScore * 10) / 10, fastScore: Math.round(fastScore * 10) / 10, score: Math.round((mode === "FAIR" ? fairScore : fastScore) * 10) / 10, participantDurations: participantUids.map((participantUid, index) => ({ participantUid, durationMinutes: durations[index] })) };
  }).sort((a, b) => a.score - b.score || a.maxDurationMinutes - b.maxDurationMinutes || a.name.localeCompare(b.name));
}
