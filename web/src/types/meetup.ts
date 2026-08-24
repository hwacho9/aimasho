export type VoteStatus = "YES" | "MAYBE" | "NO";
export type MeetupStatus =
  | "SCHEDULING"
  | "SCHEDULE_CONFIRMED"
  | "LOCATION_COLLECTING"
  | "LOCATION_SELECTING"
  | "LOCATION_CONFIRMED"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";

export interface ScheduleCondition {
  mode: "MANUAL" | "RANGE" | "MONTH" | "NEXT_MONTH";
  rangeStart?: string;
  rangeEnd?: string;
  weekdayNumbers?: number[];
}

export type ContentCategory = "FOOD" | "ACTIVITY";
export type PlanItemType = "meet" | "food" | "activity" | "cafe" | "move" | "other" | "end";
export type PlanItemStatus = "planned" | "completed" | "skipped";

export interface ContentVoteConfig {
  food: boolean;
  activity: boolean;
  allowMultiple: boolean;
  allowParticipantOptions: boolean;
}

export interface ContentOption {
  id: string;
  category: ContentCategory;
  label: string;
  createdByUid?: string;
  builtIn?: boolean;
}

export interface ContentVote {
  participantUid: string;
  optionId: string;
  category: ContentCategory;
}

export interface PlanItem {
  id: string;
  type: PlanItemType;
  title: string;
  place?: Location;
  scheduledAt?: string;
  status: PlanItemStatus;
  source: "manual" | "vote" | "recommendation";
  order: number;
  note?: string;
  createdByUid: string;
  completedAt?: string;
}

export interface CandidateSlot {
  id: string;
  startDateTime: string;
  createdByUid?: string;
}

export interface Participant {
  uid: string;
  displayName: string;
  isGuest: boolean;
  isHost: boolean;
  hasOrigin?: boolean;
  originArea?: string;
  confirmedScheduleAvailability?: VoteStatus;
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
  comment?: string;
}

export interface Meetup {
  id: string;
  title: string;
  description?: string;
  createdByUid: string;
  status: MeetupStatus;
  durationMinutes: number;
  confirmedDateTime?: string;
  previousConfirmedDateTime?: string;
  scheduleChangedAt?: string;
  meetingPlace?: Location;
  arrivalBufferMinutes?: number;
  targetArrivalTime?: string;
  /** Hosts can opt out of origin collection for voting-only events. */
  collectOrigins?: boolean;
  allowParticipantSlotAdd?: boolean;
  responseDeadline?: string;
  scheduleCondition?: ScheduleCondition;
  contentVoteConfig?: ContentVoteConfig;
  allowPlanEditing?: boolean;
  completedAt?: string;
  cancelledAt?: string;
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
  /** Chosen origin name, shared with participants only after route calculation. */
  originName?: string;
  destinationName?: string;
  durationMinutes: number;
  transfers: number;
  routeSummary: string;
  isEstimate?: boolean;
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
  contentOptions: ContentOption[];
  contentVotes: ContentVote[];
  planItems: PlanItem[];
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
  completedMeetupCount?: number;
  nextMeetupDate?: string | null;
}

export interface HistoryMeetup {
  id: string;
  title: string;
  status: MeetupStatus;
  confirmedDateTime?: string;
  completedAt?: string;
  meetingPlace?: Location;
  planPlaces: Location[];
  candidateDateTimes?: string[];
  roomId?: string | null;
  roomName?: string | null;
  occurrence?: number;
  isOwner?: boolean;
}

export interface HomeDashboardData {
  displayName: string;
  meetups: HistoryMeetup[];
  relationships: RelationshipStat[];
  rooms: Room[];
  summary: {
    upcomingMeetupCount: number;
    completedMeetupCount: number;
    friendCount: number;
    groupCount: number;
  };
}

export interface PlaceVisit {
  place: Location;
  count: number;
  meetupIds: string[];
}

export interface RoomDetailData {
  room: { id: string; name: string; inviteCode: string; ownerUid: string };
  members: Array<{ uid: string; displayName: string; role: "OWNER" | "MEMBER" }>;
  meetups: HistoryMeetup[];
  summary: { completedMeetupCount: number; uniquePlaceCount: number; mostVisitedPlace?: PlaceVisit };
  mapPlaces: PlaceVisit[];
}

export interface FriendHistory {
  otherUid: string;
  displayName: string;
  completedMeetupCount: number;
  meetups: HistoryMeetup[];
}
