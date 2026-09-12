// Local-only, fictional examples. This module is never imported by the Next app.
import type { MeetupDetail, PlanItemStatus } from "../../src/types/meetup";
import type { PlanItemInput } from "../../src/services/meetup-repository";
export const fixtureMeetups = [
  { id: "one", title: "みんなで週末ピクニック", status: "SCHEDULE_CONFIRMED", confirmedDateTime: "2026-10-10T03:00:00Z", planPlaces: [], meetingPlace: { name: "代々木公園", placeId: "demo", latitude: 35.67, longitude: 139.69 }, isOwner: true },
  { id: "two", title: "いつものメンバーでごはん", status: "SCHEDULING", candidateDateTimes: ["2026-10-11T09:00:00Z"], planPlaces: [], isOwner: true },
  { id: "three", title: "次のお休み、どこ行く？", status: "SCHEDULING", candidateDateTimes: ["2026-10-12T03:00:00Z"], planPlaces: [], isOwner: false },
];
export const getMyDashboard = async () => ({ displayName: "はな", meetups: fixtureMeetups, relationships: [], rooms: [{ id: "group", name: "いつもの4人", role: "OWNER" }], summary: { upcomingMeetupCount: 3, completedMeetupCount: 8, friendCount: 3, groupCount: 1 } });
export const getMySocialOverview = async () => ({ limited: false, friends: [
  { uid: "ren", displayName: "れん", completedCount: 8, plannedCount: 2, firstMetAt: "2026-01-01", lastMetAt: "2026-08-30", lastMeetupId: "one", milestone: { level: 3, next: 15, progress: 0 } },
  { uid: "yui", displayName: "ゆい", completedCount: 5, plannedCount: 1, firstMetAt: "2026-03-01", lastMetAt: "2026-08-30", lastMeetupId: "one", milestone: { level: 2, next: 8, progress: 0.4 } },
  { uid: "haru", displayName: "はる", completedCount: 2, plannedCount: 1, firstMetAt: "2026-07-01", lastMetAt: "2026-08-12", lastMeetupId: "one", milestone: { level: 1, next: 3, progress: 0.5 } },
], memories: [
  { id: "memory1", title: "夏の終わりの、小さな遠足", date: "2026-08-30T03:00:00Z", placeName: "鎌倉・由比ヶ浜", companions: [{ uid: "ren", displayName: "れん" }, { uid: "yui", displayName: "ゆい" }] },
  { id: "memory2", title: "話し足りない夜ごはん", date: "2026-08-12T10:00:00Z", placeName: "恵比寿", companions: [{ uid: "haru", displayName: "はる" }] },
] });
let body = "海を見ながら話せて楽しかった。また行こう！";
export const getMeetupMemories = async () => ({ notes: body ? [{ uid: "preview", displayName: "はな", body, updatedAt: "2026-08-30" }] : [] });
export const saveMeetupMemory = async (_id: string, next: string) => { body = next; };
export const deleteMeetupMemory = async () => { body = ""; };
export const getMyMeetups = async () => ({ meetups: fixtureMeetups, limited: false });
export const createMeetup = async () => "preview-only";
export const invalidateMyDashboardCache = () => {};

// Exercise the real plan form without calling Firebase or Google Places.
let previewPlan: MeetupDetail = {
  meetup: { id: "preview-plan", title: "週末の予定", createdByUid: "preview", status: "SCHEDULE_CONFIRMED", durationMinutes: 120, confirmedDateTime: "2026-10-10T03:00:00Z", allowPlanEditing: true },
  participants: [{ uid: "preview", displayName: "はな", isGuest: false, isHost: true }, { uid: "ren", displayName: "れん", isGuest: false, isHost: false }], candidateSlots: [{ id: "sample", startDateTime: "2026-10-10T03:00:00Z" }], votes: [], routes: [], expenses: [], contentOptions: [], contentVotes: [], planItems: [],
};
const planListeners = new Set<() => void>();
const publishPlan = (next: MeetupDetail) => { previewPlan = next; planListeners.forEach((listener) => listener()); };
export const getPreviewPlan = () => previewPlan;
export const subscribePreviewPlan = (listener: () => void) => { planListeners.add(listener); return () => { planListeners.delete(listener); }; };
export const createPlanItem = async (_id: string, input: PlanItemInput) => publishPlan({ ...previewPlan, planItems: [...previewPlan.planItems, { ...input, source: input.source ?? "manual", id: crypto.randomUUID(), status: "planned", order: previewPlan.planItems.length, createdByUid: "preview" }] });
export const updatePlanItem = async (_id: string, itemId: string, input: PlanItemInput) => publishPlan({ ...previewPlan, planItems: previewPlan.planItems.map((item) => item.id === itemId ? { ...item, ...input } : item) });
export const deletePlanItem = async (_id: string, itemId: string) => publishPlan({ ...previewPlan, planItems: previewPlan.planItems.filter((item) => item.id !== itemId) });
export const setPlanItemStatus = async (_id: string, itemId: string, status: PlanItemStatus) => publishPlan({ ...previewPlan, planItems: previewPlan.planItems.map((item) => item.id === itemId ? { ...item, status } : item) });
export const reorderPlanItems = async (_id: string, ids: string[]) => publishPlan({ ...previewPlan, planItems: ids.map((id, order) => ({ ...previewPlan.planItems.find((item) => item.id === id)!, order })) });
export const completeMeetup = async () => publishPlan({ ...previewPlan, meetup: { ...previewPlan.meetup, status: "COMPLETED" } });
export const cancelMeetup = async () => publishPlan({ ...previewPlan, meetup: { ...previewPlan.meetup, status: "CANCELLED" } });
// Use coordinates rather than a fictitious Google Place ID for map previews.
export const searchPlaces = async () => [{ placeId: "", name: "横浜駅 · サンプル", address: "샘플 장소 / 架空データ", latitude: 35.466, longitude: 139.622 }];
export const beginLocationSelection = async () => {};
export const saveOrigin = async () => {};
export const getMeetingPointRecommendations = async () => {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return [{ ...(await searchPlaces())[0], averageDurationMinutes: 25, maxDurationMinutes: 30, standardDeviationMinutes: 5, fairScore: 1, fastScore: 1, score: 1, participantDurations: [] }];
};
export const confirmMeetingPlace = async (_id: string, place: NonNullable<MeetupDetail["meetup"]["meetingPlace"]>) => publishPlan({ ...previewPlan, meetup: { ...previewPlan.meetup, meetingPlace: place } });
export const createExpense = async (_id: string, input: Omit<MeetupDetail["expenses"][number], "id" | "createdByUid">) => publishPlan({ ...previewPlan, expenses: [...previewPlan.expenses, { ...input, id: crypto.randomUUID(), createdByUid: "preview" }] });
export const updateExpense = async (_id: string, expenseId: string, input: Omit<MeetupDetail["expenses"][number], "id" | "createdByUid">) => publishPlan({ ...previewPlan, expenses: previewPlan.expenses.map((item) => item.id === expenseId ? { ...item, ...input } : item) });
export const deleteExpense = async (_id: string, expenseId: string) => publishPlan({ ...previewPlan, expenses: previewPlan.expenses.filter((item) => item.id !== expenseId) });
export const getSettlement = async () => ({ totalAmount: previewPlan.expenses.reduce((sum, item) => sum + item.amount, 0), balances: [], transfers: [] });
