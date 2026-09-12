import { HttpsError } from "firebase-functions/v2/https";
import type { VoteStatus } from "./models.js";

export function requireString(value: unknown, field: string, maxLength = 140): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.trim().length > maxLength) {
    throw new HttpsError("invalid-argument", `${field} is invalid.`);
  }
  return value.trim();
}

export function requireVoteStatus(value: unknown): VoteStatus {
  if (value === "YES" || value === "MAYBE" || value === "NO") return value;
  throw new HttpsError("invalid-argument", "status must be YES, MAYBE, or NO.");
}

export function parseIsoDate(value: unknown): string {
  const date = typeof value === "string" ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    throw new HttpsError("invalid-argument", "candidateSlots must contain valid ISO datetimes.");
  }
  return date.toISOString();
}

export function requireIsoDateTime(value: unknown, field: string): Date {
  const raw = requireString(value, field);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new HttpsError("invalid-argument", `${field} must be a valid ISO datetime.`);
  }
  return date;
}

export function optionalIsoDateTime(value: unknown, field: string): Date | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requireIsoDateTime(value, field);
}

export function requireBoolean(value: unknown, field: string, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") {
    throw new HttpsError("invalid-argument", `${field} must be a boolean.`);
  }
  return value;
}
