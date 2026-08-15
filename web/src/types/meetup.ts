export type VoteStatus = "YES" | "MAYBE" | "NO";
export type MeetupStatus =
  | "SCHEDULING"
  | "SCHEDULE_CONFIRMED"
  | "LOCATION_COLLECTING"
  | "LOCATION_SELECTING"
  | "LOCATION_CONFIRMED"
  | "READY"
  | "COMPLETED";

export interface CandidateSlot {
  id: string;
  startDateTime: string;
}

export interface Participant {
  uid: string;
  displayName: string;
  isGuest: boolean;
  isHost: boolean;
  hasOrigin?: boolean;
  originArea?: string;
}

export interface RelationshipStat {
  otherUid: string;
  displayName: string;
  sharedMeetupCount: number;
  lastMeetupId: string | null;
}

export interface AvailabilityVote {
  participantUid: string;
  slotId: string;
  status: VoteStatus;
}

export interface Meetup {
  id: string;
  title: string;
  description?: string;
  createdByUid: string;
  status: MeetupStatus;
  durationMinutes: number;
  confirmedDateTime?: string;
  meetingPlace?: Location;
  arrivalBufferMinutes?: number;
  targetArrivalTime?: string;
}

export interface Location {
  placeId: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
}

export interface ParticipantRoute {
  participantUid: string;
  durationMinutes: number;
  transfers: number;
  routeSummary: string;
  externalMapsUrl: string;
  departureTime: string;
  arrivalTime: string;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  paidByUid: string;
  participantUids: string[];
  createdByUid: string;
}

export interface MeetupDetail {
  meetup: Meetup;
  participants: Participant[];
  candidateSlots: CandidateSlot[];
  votes: AvailabilityVote[];
  routes: ParticipantRoute[];
  expenses: Expense[];
}

export interface RecommendationSlot extends CandidateSlot {
  yes: number;
  maybe: number;
  no: number;
  totalScore: number;
  participantCount: number;
}

export interface Recommendation {
  recommended: RecommendationSlot | null;
  ranking: RecommendationSlot[];
}

export interface InvitePreview {
  meetupId: string;
  title: string;
  description: string | null;
  status: MeetupStatus;
  hostName: string;
  isAlreadyParticipant: boolean;
}

export interface OriginCollectionStatus {
  participants: Array<Pick<Participant, "uid" | "displayName" | "hasOrigin" | "originArea">>;
  completeCount: number;
}

export interface MeetingPointCandidate extends Location {
  averageDurationMinutes: number;
  maxDurationMinutes: number;
  standardDeviationMinutes: number;
  fairScore: number;
  fastScore: number;
  score: number;
  participantDurations: Array<{ participantUid: string; durationMinutes: number }>;
}

export interface Settlement {
  totalAmount: number;
  balances: Array<{ participantUid: string; amount: number }>;
  transfers: Array<{ fromUid: string; toUid: string; amount: number }>;
}

export interface Room {
  id: string;
  name: string;
  inviteCode: string;
  role: "OWNER" | "MEMBER";
}
