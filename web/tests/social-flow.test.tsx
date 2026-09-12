// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { uid: "me", displayName: "Hana", isAnonymous: false }, language: "ko",
  create: vi.fn().mockResolvedValue("new-id"), push: vi.fn(),
  save: vi.fn().mockResolvedValue({ ok: true }),
  notes: vi.fn().mockResolvedValue({ notes: [] }),
  dashboard: vi.fn(), overview: vi.fn(),
}));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ user: state.user, loading: false }) }));
vi.mock("@/components/language-provider", () => ({ useLanguage: () => ({ language: state.language, locale: state.language === "ko" ? "ko-KR" : "ja-JP" }) }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock("next/dynamic", () => ({ default: () => () => <div>Calendar dashboard</div> }));
vi.mock("@/services/meetup-repository", () => ({ createMeetup: state.create, invalidateMyDashboardCache: vi.fn(), getMyDashboard: state.dashboard }));
vi.mock("@/services/social-repository", () => ({
  getMySocialOverview: state.overview,
  getMyMeetups: vi.fn().mockResolvedValue({ meetups: [], limited: false }),
  getMeetupMemories: state.notes, saveMeetupMemory: state.save, deleteMeetupMemory: vi.fn(),
}));

import { SocialHome } from "@/components/social-home";
import { GuestHome } from "@/components/guest-home";
import { MeetupCreateForm } from "@/components/meetup-create-form";
import { MemoryNotes } from "@/components/memory-notes";
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  state.language = "ko"; state.user.isAnonymous = false; vi.clearAllMocks();
  state.dashboard.mockResolvedValue({ displayName: "Hana", meetups: [{ id: "pending", title: "미완성 모임", status: "SCHEDULING", planPlaces: [], candidateDateTimes: [] }], rooms: [], relationships: [], summary: {} });
  state.overview.mockResolvedValue({ friends: [], memories: [], limited: false });
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(() => root.unmount()); container.remove(); });
async function render(node: React.ReactNode) { await act(async () => { root.render(node); }); }
async function click(element: Element) { await act(async () => { (element as HTMLElement).click(); }); }
async function input(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("guest and social planning flows", () => {
  it("shows owned and joined groups on home even when friends fail to load", async () => {
    state.dashboard.mockResolvedValueOnce({ meetups: [], rooms: [
      { id: "owned", name: "내 그룹 PD4", role: "OWNER" },
      { id: "joined", name: "참여한 그룹", role: "MEMBER" },
    ] });
    state.overview.mockRejectedValueOnce(new Error("offline"));
    await render(<SocialHome />);
    const groups = container.querySelector('.home-groups')!;
    expect(groups.textContent).toContain("내 그룹 PD4관리자");
    expect(groups.textContent).toContain("참여한 그룹멤버");
    expect(groups.querySelector('a[href="/rooms/joined"]')).not.toBeNull();
    expect(groups.querySelector('a[href="/profile"]')).not.toBeNull();
    await click([...container.querySelectorAll('nav button')].find(b => b.textContent === "친구")!);
    expect(container.querySelectorAll('.home-groups')).toHaveLength(1);
    expect(state.dashboard).toHaveBeenCalledTimes(1);
    expect(state.overview).toHaveBeenCalledTimes(1);
  });
  it("distinguishes empty groups from groups still loading", async () => {
    state.dashboard.mockReturnValueOnce(new Promise(() => {}));
    await render(<SocialHome />);
    expect(container.querySelector('.home-groups')!.textContent).toContain("그룹을 불러오고 있어요");
    expect(container.querySelector('.home-groups')!.textContent).not.toContain("아직 그룹이 없어요");
  });
  it("offers group creation and joining when there are no groups", async () => {
    await render(<SocialHome />);
    expect(container.querySelector('.home-groups')!.textContent).toContain("아직 그룹이 없어요");
    expect(container.querySelector('.home-groups a[href="/profile"]')).not.toBeNull();
  });
  it("shows unfinished meetups and changes tabs without showing the guest hero", async () => {
    await render(<SocialHome />);
    expect(container.textContent).toContain("미완성 모임");
    expect(container.textContent).not.toContain("로그인 없이 모임 만들기");
    const memories = [...container.querySelectorAll("nav button")].find((item) => item.textContent === "추억")!;
    await click(memories);
    expect(container.textContent).toContain("모임이 끝나면 이야기는 시작돼요");
    const plans = [...container.querySelectorAll("nav button")].find((item) => item.textContent === "약속")!;
    await click(plans);
    expect(container.textContent).toContain("Calendar dashboard");
  });
  it("keeps guests out of the social account home and offers signup-free templates", async () => {
    state.user.isAnonymous = true;
    await render(<><SocialHome /><GuestHome /></>);
    expect(container.textContent).toContain("로그인 없이 모임 만들기");
    expect(container.querySelector('.social-tabs')).toBeNull();
    expect(container.querySelector('a[href="/new?template=food"]')).not.toBeNull();
  });
  it("creates a simple food meetup with blank optional description and editable plans", async () => {
    await render(<MeetupCreateForm template="food" />);
    const inputs = container.querySelectorAll<HTMLInputElement>('input:not([type])');
    expect(inputs[0].value).toBe("Hana");
    await input(inputs[1], "금요일 밥 모임");
    expect(container.querySelectorAll('.date-row')).toHaveLength(2);
    await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(state.create).toHaveBeenCalledWith(expect.objectContaining({ title: "금요일 밥 모임", collectOrigins: false, allowPlanEditing: true, contentVoteConfig: expect.objectContaining({ food: true }) }));
    expect(state.create.mock.calls[0][0]).not.toHaveProperty("description");
    expect(state.push).toHaveBeenCalledWith("/m/new-id");
  });
  it("preserves a memory draft after a save failure", async () => {
    state.save.mockRejectedValueOnce(new Error("offline"));
    await render(<MemoryNotes meetupId="completed" />);
    const textarea = container.querySelector('textarea')!;
    await input(textarea, "또 만나자");
    await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(state.save).toHaveBeenCalledWith("completed", "또 만나자");
    expect(textarea.value).toBe("또 만나자");
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });
  it("uses Japanese copy for the social navigation", async () => {
    state.language = "ja";
    await render(<SocialHome />);
    expect(container.querySelector('nav')!.textContent).toBe("ホーム予定友だち思い出");
  });
});
