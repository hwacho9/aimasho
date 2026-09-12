import { describe, expect, it } from "vitest";
import { relationshipPairId } from "./service.js";

describe("relationship service", () => {
  it("creates the same collision-safe pair id regardless of order", () => {
    expect(relationshipPairId("user-a", "user-b"))
      .toBe(relationshipPairId("user-b", "user-a"));
    expect(relationshipPairId("user-a", "user-b"))
      .not.toBe(relationshipPairId("user-a", "user-c"));
  });
});
