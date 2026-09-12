"use client";

import { httpsCallable } from "firebase/functions";
import { firebase } from "@/lib/firebase/client";
import type { HistoryMeetup } from "@/types/meetup";
import type { MemoryNote, SocialOverview } from "@/types/social";

async function call<Input, Output>(name: string, input: Input): Promise<Output> {
  return (await httpsCallable<Input, Output>(firebase().functions, name)(input)).data;
}

export const getMySocialOverview = () => call<undefined, SocialOverview>("getMySocialOverview", undefined);
// Does not create a new anonymous account just to browse the landing page.
export const getMyMeetups = () => call<undefined, { meetups: HistoryMeetup[]; limited: boolean }>("getMyMeetups", undefined);
export const getMeetupMemories = (meetupId: string) => call<{ meetupId: string }, { notes: MemoryNote[] }>("getMeetupMemories", { meetupId });
export const saveMeetupMemory = (meetupId: string, body: string) => call("saveMeetupMemory", { meetupId, body });
export const deleteMeetupMemory = (meetupId: string) => call("deleteMeetupMemory", { meetupId });
