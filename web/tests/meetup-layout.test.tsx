// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MeetupDetail } from "@/types/meetup";

const state = vi.hoisted(() => ({ detail: undefined as MeetupDetail | undefined, anonymous: false }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('firebase/auth', () => ({ onAuthStateChanged: (_: unknown, callback: (user: unknown) => void) => { callback({ uid: 'me', isAnonymous: state.anonymous }); return () => {}; } }));
vi.mock('@/lib/firebase/client', () => ({ firebase: () => ({ auth: {} }), continueWithGoogle: vi.fn() }));
vi.mock('@/components/language-provider', () => ({ useLanguage: () => ({ language: 'ja', locale: 'ja-JP' }) }));
vi.mock('@/components/share-card', () => ({ ShareCard: () => <section>Share</section> }));
vi.mock('@/components/google-sign-in-button', () => ({ GoogleSignInButton: () => <button>Login</button> }));
vi.mock('@/components/confirmed-schedule-response', () => ({ ConfirmedScheduleResponse: () => null }));
vi.mock('@/components/content-voting-panel', () => ({ ContentVotingPanel: () => null }));
vi.mock('@/components/meetup-schedule-tools', () => ({ MeetupScheduleTools: () => null }));
vi.mock('@/components/memory-notes', () => ({ MemoryNotes: () => <p>Memory notes</p> }));
vi.mock('@/services/meetup-repository', () => ({
  subscribeToMeetup: (_: unknown, callback: (detail: MeetupDetail) => void) => { callback(state.detail!); return () => {}; },
  getMeetupRelationships: async () => [],
}));

import { MeetupView } from '@/components/meetup-view';

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  state.anonymous = false;
  state.detail = {
    meetup: { id: 'test', title: 'Weekend', createdByUid: 'me', status: 'SCHEDULING', durationMinutes: 120, collectOrigins: false },
    participants: [{ uid: 'me', displayName: 'はな', isGuest: false, isHost: true }],
    candidateSlots: [], votes: [], routes: [], expenses: [], contentOptions: [], contentVotes: [], planItems: [],
  };
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(() => root.unmount()); container.remove(); });
async function render() { await act(async () => { root.render(<MeetupView meetupId="test" />); }); }

describe('meetup page section order', () => {
  it.each([false, true])('keeps settlement last for a host (guest=%s)', async (anonymous) => {
    state.anonymous = anonymous;
    await render();
    expect(container.querySelectorAll('#plan-expenses')).toHaveLength(1);
    expect(container.querySelector('.meetup-page')!.lastElementChild!.id).toBe('plan-expenses');
    expect(container.querySelector('#plan-place #plan-expenses')).toBeNull();
    const plan = container.querySelector('#plan-timeline')!;
    expect(plan.compareDocumentPosition(container.querySelector('#plan-expenses')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it('keeps settlement after memories for completed meetups', async () => {
    state.detail!.meetup.status = 'COMPLETED';
    await render();
    expect(container.textContent).toContain('Memory notes');
    expect(container.querySelector('.meetup-page')!.lastElementChild!.id).toBe('plan-expenses');
  });
  it('preserves the existing cancellation behavior', async () => {
    state.detail!.meetup.status = 'CANCELLED';
    await render();
    expect(container.querySelector('#plan-expenses')).toBeNull();
  });
});
