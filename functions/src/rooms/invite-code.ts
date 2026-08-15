import { randomBytes } from "node:crypto";

export function createInviteCode(): string {
  return randomBytes(5).toString("base64url").toUpperCase();
}
