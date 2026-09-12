import { afterEach, describe, expect, it, vi } from "vitest";
import { MockMapsProvider } from "./provider.js";

describe("place details providers", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns bounded, on-demand mock venue information", async () => {
    const details = await new MockMapsProvider().getPlaceDetails("mock-shibuya");
    expect(details).toMatchObject({
      placeId: "mock-shibuya",
      name: "渋谷駅",
      rating: 4.2,
      openNow: true,
    });
    expect(details.weekdayDescriptions).toHaveLength(2);
    expect(details.websiteUri).toMatch(/^https:/);
  });
});
