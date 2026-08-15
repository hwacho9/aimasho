export type VoteStatus = "YES" | "MAYBE" | "NO";

export interface CandidateSlot {
  id: string;
  startDateTime: string;
}

export interface Vote {
  participantUid: string;
  slotId: string;
  status: VoteStatus;
}

export interface SlotScore extends CandidateSlot {
  yes: number;
  maybe: number;
  no: number;
  totalScore: number;
  participantCount: number;
}

export interface ScheduleRecommendation {
  recommended: SlotScore | null;
  ranking: SlotScore[];
}

export interface Location {
  placeId: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
}
