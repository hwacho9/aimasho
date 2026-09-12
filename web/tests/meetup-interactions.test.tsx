// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MeetupDetail, VoteStatus } from "@/types/meetup";

const api = vi.hoisted(() => ({
  recommend: vi.fn(), choose: vi.fn(), search: vi.fn(), expense: vi.fn(), settlement: vi.fn(),
}));
vi.mock("@/components/language-provider", () => ({ useLanguage: () => ({ language: "ja", locale: "ja-JP" }) }));
vi.mock("@/components/calendar-overlay", () => ({ CalendarOverlay: () => <p>Private calendar</p> }));
vi.mock("@/services/meetup-repository", () => ({
  getMeetingPointRecommendations: api.recommend, confirmMeetingPlace: api.choose, searchPlaces: api.search,
  createExpense: api.expense, getSettlement: api.settlement, updateExpense: vi.fn(), deleteExpense: vi.fn(),
  beginLocationSelection: vi.fn(), saveOrigin: vi.fn(),
}));

import { SlotVoteEditor } from "@/components/slot-vote-editor";
import { LocationStep, MeetupExpenses } from "@/components/meetup-next-steps";
import { MeetupScheduleTools } from "@/components/meetup-schedule-tools";
import { PlaceSearch } from "@/components/place-search";

const detail: MeetupDetail = {
  meetup: { id: "test", title: "Weekend", createdByUid: "me", status: "SCHEDULING", durationMinutes: 120, collectOrigins: false },
  participants: [{ uid: "me", displayName: "はな", isGuest: false, isHost: true }],
  candidateSlots: [{ id: "slot", startDateTime: "2026-10-10T03:00:00Z" }],
  votes: [], routes: [], expenses: [], contentOptions: [], contentVotes: [], planItems: [],
};
function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.resetAllMocks(); api.search.mockResolvedValue([]); api.expense.mockResolvedValue({});
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(() => root.unmount()); container.remove(); });
async function render(node: React.ReactNode) { await act(async () => { root.render(node); }); }
function button(text: string) { return [...container.querySelectorAll<HTMLButtonElement>('button')].find((item) => item.textContent?.includes(text))!; }
async function fill(element: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit(form: HTMLFormElement) { await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }); }

describe("meetup controls with a slow server", () => {
  it("shows the chosen vote immediately, prevents duplicate writes and rolls back a failure", async () => {
    const pending = deferred<void>();
    const save = vi.fn(() => pending.promise);
    await render(<SlotVoteEditor vote={{ participantUid: "me", slotId: "slot", status: "NO" }} onVote={save} disabled={false} />);
    await act(async () => button("参加できる").click());
    expect(button("参加できる").getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector('[role="status"]')?.textContent).toContain("保存中");
    await act(async () => button("参加できる").click());
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => pending.reject(new Error("Network unavailable")));
    expect(button("参加できない").getAttribute("aria-pressed")).toBe("true");
    expect(button("参加できる").disabled).toBe(false);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Network unavailable");
  });
  it("allows a second date to be answered while the first one is pending", async () => {
    const pending = deferred<void>(); const save = vi.fn(() => pending.promise);
    await render(<><SlotVoteEditor onVote={save} disabled={false} /><SlotVoteEditor onVote={save} disabled={false} /></>);
    const buttons = container.querySelectorAll<HTMLButtonElement>('.vote-option.yes');
    await act(async () => buttons[0].click());
    expect(buttons[1].disabled).toBe(false);
    await act(async () => buttons[1].click());
    expect(save).toHaveBeenCalledTimes(2);
    await act(async () => pending.resolve());
  });
  it("retains the saved choice when the server acknowledges it", async () => {
    const pending = deferred<void>();
    function Editor() {
      const [status, setStatus] = useState<VoteStatus>("MAYBE");
      return <SlotVoteEditor vote={{ participantUid: "me", slotId: "slot", status }} disabled={false} onVote={async (next) => { await pending.promise; setStatus(next); }} />;
    }
    await render(<Editor />);
    await act(async () => button("参加できる").click());
    await act(async () => pending.resolve());
    expect(button("参加できる").getAttribute("aria-pressed")).toBe("true");
    expect(button("参加できる").disabled).toBe(false);
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
  it("does not send an external recommendation request when only changing the mode", async () => {
    const pending = deferred<never[]>(); api.recommend.mockReturnValue(pending.promise);
    await render(<LocationStep meetupId="test" isHost />);
    await act(async () => button("全体的に早く").click());
    expect(button("全体的に早く").getAttribute("aria-pressed")).toBe("true");
    expect(api.recommend).not.toHaveBeenCalled();
    await act(async () => button("中間地点をおすすめ").click());
    expect(api.recommend).toHaveBeenCalledExactlyOnceWith("test", "FAST");
    await fill(container.querySelector<HTMLInputElement>('.place-search input')!, "横浜駅");
    expect(button("検索").disabled).toBe(false);
    await act(async () => button("検索").click());
    expect(api.search).toHaveBeenCalledExactlyOnceWith("横浜駅");
    await act(async () => pending.resolve([]));
  });
  it("discards a search response for an input the user has already changed", async () => {
    const pending = deferred<Array<{ name: string; placeId: string; latitude: number; longitude: number }>>();
    api.search.mockReturnValue(pending.promise);
    await render(<PlaceSearch onPick={vi.fn()} />);
    const input = container.querySelector('input')!;
    await fill(input, "横浜駅"); await submit(container.querySelector('form')!);
    await fill(input, "東京駅");
    await act(async () => pending.resolve([{ name: "Old station", placeId: "old", latitude: 0, longitude: 0 }]));
    expect(container.textContent).not.toContain("Old station");
    expect(button("検索").disabled).toBe(false);
  });
  it("finishes saving an expense without waiting for an extra settlement request", async () => {
    await render(<MeetupExpenses meetupId="test" detail={detail} uid="me" />);
    const form = container.querySelector<HTMLFormElement>('.expense-form')!;
    await fill(form.querySelector<HTMLInputElement>('input[required]')!, "Dinner");
    await fill(form.querySelector<HTMLInputElement>('input[type="number"]')!, "2000");
    await submit(form);
    expect(api.expense).toHaveBeenCalledOnce();
    expect(api.settlement).not.toHaveBeenCalled();
    expect(button("支出を追加").disabled).toBe(false);
  });
  it("discards an older settlement response if an expense was changed meanwhile", async () => {
    const pending = deferred<{ totalAmount: number; balances: never[]; transfers: never[] }>();
    api.settlement.mockReturnValue(pending.promise);
    await render(<MeetupExpenses meetupId="test" detail={{ ...detail, expenses: [{ id: "expense", title: "Cafe", amount: 100, paidByUid: "me", participantUids: ["me"], createdByUid: "me" }] }} uid="me" />);
    await act(async () => button("精算結果を見る").click());
    const form = container.querySelector<HTMLFormElement>('.expense-form')!;
    await fill(form.querySelector<HTMLInputElement>('input[required]')!, "Dinner");
    await fill(form.querySelector<HTMLInputElement>('input[type="number"]')!, "2000");
    await submit(form);
    await act(async () => pending.resolve({ totalAmount: 100, balances: [], transfers: [] }));
    expect(container.querySelector('.settlement-result')).toBeNull();
    expect(api.settlement).toHaveBeenCalledOnce();
    expect(button("支出を追加").disabled).toBe(false);
  });
  it("keeps recommendation confirmation locked until outstanding votes finish", async () => {
    await render(<MeetupScheduleTools detail={detail} recommended={detail.candidateSlots[0]} isHost confirming={false} pendingVotes onConfirm={vi.fn()} />);
    expect(button("投票を保存中").disabled).toBe(true);
    expect(container.querySelector('summary')?.textContent).toBe("自分のカレンダーと比較");
    await render(<MeetupScheduleTools detail={{ ...detail, meetup: { ...detail.meetup, status: "SCHEDULE_CONFIRMED" } }} isHost confirming={false} pendingVotes={false} onConfirm={vi.fn()} />);
    expect(container.querySelector('summary')).toBeNull();
  });
});
