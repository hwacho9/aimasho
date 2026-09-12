// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MeetupDetail } from "@/types/meetup";

const state = vi.hoisted(() => ({
  user: { displayName: "ながい名前のテストユーザー", isAnonymous: true },
  loading: false, language: "ja", create: vi.fn().mockResolvedValue({}), search: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ user: state.user, loading: state.loading }) }));
vi.mock("@/components/language-provider", () => ({
  useLanguage: () => ({ language: state.language, locale: state.language === "ja" ? "ja-JP" : "ko-KR" }),
  LanguageSelect: () => <label className="language-select"><select aria-label="Language"><option>日本語</option></select></label>,
}));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));
vi.mock("@/services/meetup-repository", () => ({
  cancelMeetup: vi.fn(), completeMeetup: vi.fn(), createPlanItem: state.create, deletePlanItem: vi.fn(),
  reorderPlanItems: vi.fn(), searchPlaces: state.search, setPlanItemStatus: vi.fn(), updatePlanItem: vi.fn(),
}));

import { HomeHeader } from "@/components/home-header";
import { EventPlanPanel } from "@/components/event-plan-panel";

const detail: MeetupDetail = {
  meetup: { id: "plan", title: "Weekend", createdByUid: "me", status: "SCHEDULE_CONFIRMED", durationMinutes: 120, confirmedDateTime: "2026-10-10T03:00:00Z", allowPlanEditing: true },
  participants: [], candidateSlots: [], votes: [], routes: [], expenses: [], contentOptions: [], contentVotes: [], planItems: [],
};
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  state.user.isAnonymous = true; state.loading = false; state.language = "ja"; vi.clearAllMocks();
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(() => root.unmount()); container.remove(); });
async function render(node: React.ReactNode) { await act(async () => { root.render(node); }); }
async function fill(element: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("home header and day plan controls", () => {
  it("groups guest links and language apart from the brand", async () => {
    await render(<HomeHeader />);
    expect(container.querySelector('.top-nav > .brand')).not.toBeNull();
    const controls = container.querySelector('.top-nav > .header-controls')!;
    expect(controls.querySelector('a[href="/login"]')?.textContent).toBe("ログイン");
    expect(controls.querySelector('a[href="/profile"]')?.textContent).toBe("マイ予定");
    expect(controls.querySelector('select')).not.toBeNull();
  });
  it("keeps a full accessible account name in a truncatable span", async () => {
    state.user.isAnonymous = false;
    await render(<HomeHeader />);
    expect(container.querySelector('a[href="/login"]')).toBeNull();
    expect(container.querySelector('.nav-account-name')?.textContent).toContain(state.user.displayName);
    expect(container.querySelector('.signed-in-link')?.getAttribute('title')).toContain(state.user.displayName);
  });
  it("associates the place label with only its input and searches without submitting", async () => {
    await render(<EventPlanPanel meetupId="plan" detail={detail} isHost />);
    const field = container.querySelector<HTMLInputElement>('.plan-place-search input')!;
    expect(field.labels?.length).toBe(1);
    expect(field.labels?.[0].textContent).toBe("場所・任意");
    const search = container.querySelector<HTMLButtonElement>('.plan-place-search button')!;
    expect(search.closest('label')).toBeNull();
    expect(search.type).toBe("button");
    await fill(field, "横浜駅");
    await act(async () => search.click());
    expect(state.search).toHaveBeenCalledWith("横浜駅");
    expect(state.create).not.toHaveBeenCalled();
  });
  it("still saves the title and time on the confirmed meeting day", async () => {
    state.language = "ko";
    await render(<EventPlanPanel meetupId="plan" detail={detail} isHost />);
    await fill(container.querySelector<HTMLInputElement>('input[required]')!, "역에서 만나기");
    await fill(container.querySelector<HTMLInputElement>('input[type="time"]')!, "12:30");
    await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(state.create).toHaveBeenCalledWith("plan", expect.objectContaining({ title: "역에서 만나기", scheduledAt: "2026-10-10T03:30:00.000Z" }));
  });
  it("does not put the whole plan into a saving state while searching", async () => {
    let resolve!: (value: never[]) => void;
    state.search.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    await render(<EventPlanPanel meetupId="plan" detail={detail} isHost />);
    await fill(container.querySelector<HTMLInputElement>('.plan-place-search input')!, "横浜駅");
    await act(async () => container.querySelector<HTMLButtonElement>('.plan-place-search button')!.click());
    expect(container.querySelector('.plan-place-search button')?.textContent).toBe("検索中");
    const submit = container.querySelector<HTMLButtonElement>('.plan-form button[type="submit"]')!;
    expect(submit.disabled).toBe(false);
    expect(submit.textContent).toBe("予定を追加");
    expect(container.querySelector<HTMLButtonElement>('.event-status-actions button')!.disabled).toBe(false);
    await act(async () => resolve([]));
  });
});
