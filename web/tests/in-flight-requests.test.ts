import { describe, expect, it, vi } from "vitest";
import { createInFlightRequests } from "@/services/in-flight-requests";

describe("concurrent read deduplication", () => {
  it("shares only the active read, not completed results", async () => {
    const request = createInFlightRequests<string[]>();
    const read = vi.fn(async () => ["station"]);
    const first = request("uid:query", read);
    const second = request("uid:query", read);
    expect(first).toBe(second);
    expect(await first).toEqual(["station"]);
    expect(read).toHaveBeenCalledOnce();
    await request("uid:query", read);
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("isolates different accounts/queries and lets failed requests be retried", async () => {
    const request = createInFlightRequests<string[]>();
    const fail = vi.fn(async () => { throw new Error("offline"); });
    await expect(request("a:query", fail)).rejects.toThrow("offline");
    const read = vi.fn(async () => ["station"]);
    await Promise.all([request("a:query", read), request("b:query", read), request("a:other", read)]);
    expect(read).toHaveBeenCalledTimes(3);
  });
});
