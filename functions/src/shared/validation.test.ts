import { describe, expect, it } from "vitest";
import {
  optionalIsoDateTime,
  parseIsoDate,
  requireBoolean,
  requireString,
  requireVoteStatus,
} from "./validation.js";

describe("callable validation", () => {
  it("trims required strings", () => {
    expect(requireString("  aimasho  ", "name")).toBe("aimasho");
    expect(() => requireString("   ", "name")).toThrow("name is invalid");
  });

  it("accepts only known vote states", () => {
    expect(requireVoteStatus("YES")).toBe("YES");
    expect(() => requireVoteStatus("UNKNOWN")).toThrow("status must be YES");
  });

  it("normalizes ISO dates and optional empty values", () => {
    expect(parseIsoDate("2026-09-01T10:00:00+09:00")).toBe("2026-09-01T01:00:00.000Z");
    expect(optionalIsoDateTime("", "deadline")).toBeUndefined();
    expect(() => parseIsoDate("not-a-date")).toThrow("candidateSlots");
  });

  it("applies boolean defaults without coercion", () => {
    expect(requireBoolean(undefined, "enabled", true)).toBe(true);
    expect(requireBoolean(false, "enabled", true)).toBe(false);
    expect(() => requireBoolean("false", "enabled", true)).toThrow("must be a boolean");
  });
});
