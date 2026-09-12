export interface SocialFriend {
  uid: string;
  displayName: string;
  completedCount: number;
  plannedCount: number;
  firstMetAt: string | null;
  lastMetAt: string | null;
  lastMeetupId: string;
  milestone: { level: number; next: number | null; progress: number };
}

export interface SharedMemory {
  id: string;
  title: string;
  date: string | null;
  placeName: string | null;
  companions: { uid: string; displayName: string }[];
}

export interface SocialOverview {
  friends: SocialFriend[];
  memories: SharedMemory[];
  limited: boolean;
}

export interface MemoryNote {
  uid: string;
  displayName: string;
  body: string;
  updatedAt: string | null;
}
