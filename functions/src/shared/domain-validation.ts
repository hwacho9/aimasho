import { Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import type { Location, MeetingPointMode } from "../locations/models.js";
import {
  optionalIsoDateTime,
  parseIsoDate,
  requireBoolean,
  requireString,
} from "./validation.js";

export type MeetupStatus =
  | "SCHEDULING"
  | "SCHEDULE_CONFIRMED"
  | "LOCATION_COLLECTING"
  | "LOCATION_SELECTING"
  | "LOCATION_CONFIRMED"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";

export interface ScheduleConditionInput {
  mode: "MANUAL" | "RANGE" | "MONTH" | "NEXT_MONTH";
  rangeStart?: string;
  rangeEnd?: string;
  weekdayNumbers?: number[];
}

interface ContentVoteConfigInput {
  food?: boolean;
  activity?: boolean;
  allowMultiple?: boolean;
  allowParticipantOptions?: boolean;
}

export interface CreateMeetupInput {
  displayName: string;
  title: string;
  description?: string;
  durationMinutes: number;
  candidateSlots: string[];
  roomId?: string | null;
  collectOrigins?: boolean;
  allowParticipantSlotAdd?: boolean;
  responseDeadline?: string | null;
  scheduleCondition?: ScheduleConditionInput;
  contentVoteConfig?: ContentVoteConfigInput;
  allowPlanEditing?: boolean;
}

export type ContentCategory = "FOOD" | "ACTIVITY";
export type PlanItemType =
  | "meet"
  | "food"
  | "activity"
  | "cafe"
  | "move"
  | "other"
  | "end";
export type PlanItemStatus = "planned" | "completed" | "skipped";
type PlanItemSource = "manual" | "vote" | "recommendation";

export interface ContentVoteConfig {
  food: boolean;
  activity: boolean;
  allowMultiple: boolean;
  allowParticipantOptions: boolean;
}

export interface PlanItemPayload {
  type: PlanItemType;
  title: string;
  place?: Location;
  scheduledAt?: Date;
  note?: string;
  source: PlanItemSource;
}

export interface ExpensePayload {
  title: string;
  amount: number;
  paidByUid: string;
  participantUids: string[];
}

export const defaultContentOptions: Record<ContentCategory, string[]> = {
  FOOD: ["焼肉", "居酒屋", "イタリアン", "カフェ", "ラーメン", "韓国料理", "寿司"],
  ACTIVITY: ["映画", "カラオケ", "ボウリング", "水族館", "ショッピング", "アウトドア", "ドライブ"],
};

export function requireScheduleCondition(value: unknown): ScheduleConditionInput | undefined {
  if (value === undefined || value === null) return undefined;
  if (!value || typeof value !== "object") {
    throw new HttpsError("invalid-argument", "scheduleCondition is invalid.");
  }
  const input = value as Partial<ScheduleConditionInput>;
  if (
    input.mode !== "MANUAL"
    && input.mode !== "RANGE"
    && input.mode !== "MONTH"
    && input.mode !== "NEXT_MONTH"
  ) {
    throw new HttpsError("invalid-argument", "scheduleCondition.mode is invalid.");
  }
  const rangeStart = input.rangeStart === undefined ? undefined : parseIsoDate(input.rangeStart);
  const rangeEnd = input.rangeEnd === undefined ? undefined : parseIsoDate(input.rangeEnd);
  if (rangeStart && rangeEnd && new Date(rangeStart) > new Date(rangeEnd)) {
    throw new HttpsError("invalid-argument", "scheduleCondition range is invalid.");
  }
  if (
    input.weekdayNumbers !== undefined
    && (
      !Array.isArray(input.weekdayNumbers)
      || input.weekdayNumbers.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
    )
  ) {
    throw new HttpsError("invalid-argument", "scheduleCondition.weekdayNumbers is invalid.");
  }
  return {
    mode: input.mode,
    ...(rangeStart ? { rangeStart } : {}),
    ...(rangeEnd ? { rangeEnd } : {}),
    ...(input.weekdayNumbers
      ? { weekdayNumbers: [...new Set(input.weekdayNumbers)].sort() }
      : {}),
  };
}

export function responseDeadlineHasPassed(value: unknown, now = Date.now()): boolean {
  return value instanceof Timestamp && value.toMillis() <= now;
}

export function requireContentVoteConfig(value: unknown): ContentVoteConfig {
  const input = value && typeof value === "object" ? value as ContentVoteConfigInput : {};
  return {
    food: requireBoolean(input.food, "contentVoteConfig.food", false),
    activity: requireBoolean(input.activity, "contentVoteConfig.activity", false),
    allowMultiple: requireBoolean(input.allowMultiple, "contentVoteConfig.allowMultiple", false),
    allowParticipantOptions: requireBoolean(
      input.allowParticipantOptions,
      "contentVoteConfig.allowParticipantOptions",
      true,
    ),
  };
}

export function requireContentCategory(value: unknown): ContentCategory {
  if (value === "FOOD" || value === "ACTIVITY") return value;
  throw new HttpsError("invalid-argument", "category must be FOOD or ACTIVITY.");
}

function requirePlanItemType(value: unknown): PlanItemType {
  if (["meet", "food", "activity", "cafe", "move", "other", "end"].includes(value as string)) {
    return value as PlanItemType;
  }
  throw new HttpsError("invalid-argument", "Plan item type is invalid.");
}

export function requirePlanItemStatus(value: unknown): PlanItemStatus {
  if (value === "planned" || value === "completed" || value === "skipped") return value;
  throw new HttpsError("invalid-argument", "Plan item status is invalid.");
}

function requirePlanItemSource(value: unknown): PlanItemSource {
  if (value === undefined || value === null) return "manual";
  if (value === "manual" || value === "vote" || value === "recommendation") return value;
  throw new HttpsError("invalid-argument", "Plan item source is invalid.");
}

export function requirePlanItemPayload(value: unknown): PlanItemPayload {
  if (!value || typeof value !== "object") {
    throw new HttpsError("invalid-argument", "Plan item is invalid.");
  }
  const input = value as Record<string, unknown>;
  const scheduledAt = optionalIsoDateTime(input.scheduledAt, "scheduledAt");
  const note = input.note === undefined || input.note === null || input.note === ""
    ? undefined
    : requireString(input.note, "note", 500);
  return {
    type: requirePlanItemType(input.type),
    title: requireString(input.title, "title", 120),
    ...(input.place ? { place: requireLocation(input.place, "place") } : {}),
    ...(scheduledAt ? { scheduledAt } : {}),
    ...(note ? { note } : {}),
    source: requirePlanItemSource(input.source),
  };
}

export function contentVotingEnabled(
  config: ContentVoteConfig,
  category: ContentCategory,
): boolean {
  return category === "FOOD" ? config.food : config.activity;
}

export function requireLocation(value: unknown, field = "location"): Location {
  if (!value || typeof value !== "object") {
    throw new HttpsError("invalid-argument", `${field} is invalid.`);
  }
  const input = value as Partial<Location>;
  const name = requireString(input.name, `${field}.name`, 160);
  const placeId = requireString(input.placeId, `${field}.placeId`, 256);
  if (
    typeof input.latitude !== "number"
    || typeof input.longitude !== "number"
    || !Number.isFinite(input.latitude)
    || !Number.isFinite(input.longitude)
    || Math.abs(input.latitude) > 90
    || Math.abs(input.longitude) > 180
  ) {
    throw new HttpsError("invalid-argument", `${field} coordinates are invalid.`);
  }
  return {
    placeId,
    name,
    ...(typeof input.address === "string" ? { address: input.address.slice(0, 300) } : {}),
    latitude: input.latitude,
    longitude: input.longitude,
  };
}

export function requireMeetingPointMode(value: unknown): MeetingPointMode {
  if (value === "FAIR" || value === "FAST") return value;
  throw new HttpsError("invalid-argument", "mode must be FAIR or FAST.");
}

export function requireExpensePayload(value: unknown): ExpensePayload {
  if (!value || typeof value !== "object") {
    throw new HttpsError("invalid-argument", "Expense input is invalid.");
  }
  const input = value as Partial<ExpensePayload>;
  const title = requireString(input.title, "title", 120);
  const amount = input.amount;
  if (!Number.isInteger(amount) || amount === undefined || amount <= 0 || amount > 10_000_000) {
    throw new HttpsError("invalid-argument", "amount must be a positive integer yen amount.");
  }
  const paidByUid = requireString(input.paidByUid, "paidByUid", 128);
  if (
    !Array.isArray(input.participantUids)
    || input.participantUids.length === 0
    || input.participantUids.some((id) => typeof id !== "string" || id.length === 0)
  ) {
    throw new HttpsError("invalid-argument", "participantUids is invalid.");
  }
  return {
    title,
    amount,
    paidByUid,
    participantUids: [...new Set(input.participantUids)],
  };
}
