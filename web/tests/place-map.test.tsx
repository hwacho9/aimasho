// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Location, MeetupDetail } from "@/types/meetup";

const api = vi.hoisted(() => ({ search: vi.fn(), create: vi.fn(), details: vi.fn() }));
vi.mock("@/components/language-provider", () => ({ useLanguage: () => ({ language: "ja", locale: "ja-JP" }) }));
vi.mock("@/services/meetup-repository", () => ({
  searchPlaces: api.search, createPlanItem: api.create, updatePlanItem: vi.fn(), deletePlanItem: vi.fn(),
  reorderPlanItems: vi.fn(), setPlanItemStatus: vi.fn(), completeMeetup: vi.fn(), cancelMeetup: vi.fn(), getPlaceDetails: api.details,
}));
import { PlaceMapPreview } from "@/components/place-map-preview";
import { EventPlanPanel } from "@/components/event-plan-panel";
import { googleMapsEmbedUrl, googleMapsPlaceUrl } from "@/lib/google-maps-links";

const place: Location = { name: "No.4", address: "東京都・テスト住所", placeId: "places/example-place", latitude: 35.69, longitude: 139.73 };
const detail: MeetupDetail = {
  meetup: { id: "plan", title: "Weekend", createdByUid: "me", status: "SCHEDULE_CONFIRMED", durationMinutes: 120, confirmedDateTime: "2026-10-10T03:00:00Z", allowPlanEditing: true },
  participants: [], candidateSlots: [], votes: [], routes: [], expenses: [], contentOptions: [], contentVotes: [], planItems: [],
};
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY", "test-browser-key");
  api.search.mockResolvedValue([place]); api.create.mockResolvedValue({}); api.details.mockResolvedValue({ placeId: place.placeId, name: place.name, category: "カフェ", rating: 4.3, ratingCount: 214, priceLevel: "PRICE_LEVEL_MODERATE", openNow: true, weekdayDescriptions: ["月曜日: 10:00～20:00"], phoneNumber: "03-1234-5678", websiteUri: "https://example.test/no4" }); vi.clearAllMocks();
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(() => root.unmount()); container.remove(); vi.unstubAllEnvs(); });
async function render(node: React.ReactNode) { await act(async () => { root.render(node); }); }
async function fill(element: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("selected-place Google Maps previews", () => {
  it("uses the selected place ID, a lazy frame and an origin-only referrer", async () => {
    await render(<PlaceMapPreview place={place} />);
    const frame = container.querySelector('iframe')!;
    expect(new URL(frame.src).searchParams.get('q')).toBe('place_id:example-place');
    expect(frame.title).toBe('No.4 · Google Maps');
    expect(frame.getAttribute('loading')).toBe('lazy');
    expect(frame.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');
    expect(container.textContent).toContain(place.address);
    expect(new URL(container.querySelector('a')!.href).searchParams.get('query_place_id')).toBe('example-place');
    expect(container.querySelector('a')!.href).not.toContain('test-browser-key');
  });
  it("uses an inline coordinate map without leaking a server key when no browser key exists", async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY', '');
    vi.stubEnv('GOOGLE_MAPS_SERVER_API_KEY', 'private-test-key');
    await render(<PlaceMapPreview place={place} />);
    const frame = container.querySelector('iframe')!;
    expect(frame.title).toBe('No.4 · 地図');
    expect(frame.src).toContain('openstreetmap.org/export/embed.html');
    expect(container.querySelector('a')!.href).toContain('https://www.google.com/maps/search/');
    expect(container.innerHTML).not.toContain('private-test-key');
  });
  it("shows saved place maps in the plan and lets people collapse them", async () => {
    await render(<PlaceMapPreview place={place} collapsible />);
    const toggle = container.querySelector('button')!;
    expect(container.querySelector('iframe')).not.toBeNull();
    expect(toggle.type).toBe('button');
    await act(async () => toggle.click());
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('iframe')).toBeNull();
    await act(async () => toggle.click());
    expect(container.querySelector('iframe')).not.toBeNull();
  });
  it("uses exact coordinates when a legacy location has no place ID", () => {
    const legacy = { ...place, placeId: '' };
    expect(new URL(googleMapsPlaceUrl(legacy)).searchParams.get('query')).toBe('35.69,139.73');
    const embed = new URL(googleMapsEmbedUrl(legacy, 'ko')!);
    expect(embed.searchParams.get('q')).toBe('35.69,139.73');
    expect(embed.searchParams.get('language')).toBe('ko');
  });
  it("updates the map when the selected location changes", async () => {
    await render(<PlaceMapPreview place={place} />);
    await render(<PlaceMapPreview place={{ ...place, placeId: 'new-place', name: 'New cafe' }} />);
    expect(new URL(container.querySelector('iframe')!.src).searchParams.get('q')).toBe('place_id:new-place');
    expect(container.textContent).not.toContain('No.4');
  });
  it("loads changing restaurant information only after a person asks for it", async () => {
    await render(<PlaceMapPreview place={place} />);
    expect(api.details).not.toHaveBeenCalled();
    await act(async () => container.querySelector<HTMLButtonElement>('.place-details .text-button')!.click());
    await act(async () => {});
    expect(api.details).toHaveBeenCalledWith(place.placeId);
    expect(container.textContent).toContain('★ 4.3 (214)');
    expect(container.textContent).toContain('営業中');
    expect(container.querySelector('a[href="tel:03-1234-5678"]')).not.toBeNull();
  });
  it("only previews a selected search result and removes it when the query changes", async () => {
    await render(<EventPlanPanel meetupId="plan" detail={detail} isHost />);
    const query = container.querySelector<HTMLInputElement>('.plan-place-search input')!;
    await fill(query, 'No.4');
    expect(container.querySelector('iframe')).toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('.plan-place-search button')!.click());
    expect(container.querySelector('iframe')).toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('.plan-place-results button')!.click());
    expect(container.querySelector('iframe')!.title).toBe('No.4 · Google Maps');
    expect(api.create).not.toHaveBeenCalled();
    await fill(query, 'Another cafe');
    expect(container.querySelector('.place-map-preview')).toBeNull();
  });
  it("saves the selected place with the plan and clears the draft preview", async () => {
    await render(<EventPlanPanel meetupId="plan" detail={detail} isHost />);
    await fill(container.querySelector<HTMLInputElement>('input[required]')!, 'Cafe');
    await fill(container.querySelector<HTMLInputElement>('.plan-place-search input')!, 'No.4');
    await act(async () => container.querySelector<HTMLButtonElement>('.plan-place-search button')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('.plan-place-results button')!.click());
    await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(api.create).toHaveBeenCalledWith('plan', expect.objectContaining({ title: 'Cafe', place }));
    expect(container.querySelector('.place-map-preview')).toBeNull();
  });
});
