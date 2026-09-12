import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  member: true, meetupExists: true, status: "COMPLETED", availability: "YES", registered: true,
  set: vi.fn(), remove: vi.fn(),
}));
vi.mock("firebase-functions/v2/https", async (importOriginal) => {
  const actual = await importOriginal<typeof import("firebase-functions/v2/https")>();
  return { ...actual, onCall: (_options: unknown, handler: unknown) => handler };
});
vi.mock("firebase-admin/firestore", () => {
  const meetup = () => ({ exists: fixture.meetupExists, data: () => ({ status: fixture.status }) });
  const member = () => ({ exists: fixture.member, data: () => ({ confirmedScheduleAvailability: fixture.availability, displayName: "Member" }) });
  const ref = (path: string) => ({
    path,
    get: async () => path.startsWith("users/") ? { exists: true, data: () => ({ accountType: fixture.registered ? "REGISTERED" : "ANONYMOUS", displayName: "Verified name" }) } : path.includes("/participants/") ? member() : meetup(),
    collection: (collection: string) => ({ doc: (id: string) => ref(`${path}/${collection}/${id}`) }),
    delete: async () => fixture.remove(path),
  });
  return {
    Timestamp: class {}, FieldValue: { serverTimestamp: () => "server-time" },
    getFirestore: () => ({ doc: ref, runTransaction: async (callback: (transaction: unknown) => unknown) => callback({
      getAll: async () => [meetup(), member()], set: fixture.set,
    }) }),
  };
});
import { saveMeetupMemory, deleteMeetupMemory } from "./service.js";
// onCall is replaced with its handler so authorization can be tested without live writes.
const save = saveMeetupMemory as unknown as (input: unknown) => Promise<unknown>;
const remove = deleteMeetupMemory as unknown as (input: unknown) => Promise<unknown>;
const request = (provider = "google.com", data: Record<string, unknown> = {}) => ({
  auth: { uid: "me", token: { firebase: { sign_in_provider: provider } } },
  data: { meetupId: "event", body: "  A good day  ", ...data },
});
beforeEach(() => {
  Object.assign(fixture, { member: true, meetupExists: true, status: "COMPLETED", availability: "YES", registered: true });
  vi.clearAllMocks();
});
describe("shared memory authorization", () => {
  it("rejects unauthenticated and anonymous writes", async () => {
    await expect(save({ data: {} })).rejects.toMatchObject({ code: "unauthenticated" });
    await expect(save(request("anonymous"))).rejects.toMatchObject({ code: "failed-precondition" });
    expect(fixture.set).not.toHaveBeenCalled();
  });
  it("rejects strangers and declined participants", async () => {
    fixture.member = false;
    await expect(save(request())).rejects.toMatchObject({ code: "permission-denied" });
    fixture.member = true; fixture.availability = "NO";
    await expect(save(request())).rejects.toMatchObject({ code: "permission-denied" });
  });
  it("rejects missing, planned and cancelled events", async () => {
    fixture.meetupExists = false;
    await expect(save(request())).rejects.toMatchObject({ code: "not-found" });
    fixture.meetupExists = true;
    for (const status of ["SCHEDULING", "CANCELLED"]) {
      fixture.status = status;
      await expect(save(request())).rejects.toMatchObject({ code: "failed-precondition" });
    }
  });
  it("validates length and document identifiers", async () => {
    await expect(save(request("google.com", { body: " " }))).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(save(request("google.com", { body: "x".repeat(281) }))).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(save(request("google.com", { meetupId: "event/participants/other" }))).rejects.toMatchObject({ code: "invalid-argument" });
  });
  it("uses server identity and saves one note per member, ignoring impersonation input", async () => {
    await save(request("google.com", { uid: "other", displayName: "Fake" }));
    expect(fixture.set).toHaveBeenCalledWith(expect.objectContaining({ path: "meetups/event/memories/me" }), {
      uid: "me", displayName: "Verified name", body: "A good day", updatedAt: "server-time",
    });
  });
  it("deletes only the caller's note", async () => {
    await remove(request("google.com", { uid: "other" }));
    expect(fixture.remove).toHaveBeenCalledWith("meetups/event/memories/me");
    fixture.member = false;
    await expect(remove(request())).rejects.toMatchObject({ code: "permission-denied" });
  });
});
