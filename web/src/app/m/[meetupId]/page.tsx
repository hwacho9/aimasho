"use client";

import { useEffect, useState } from "react";
import { AppHeader, useLanguage } from "@/components/language-provider";
import { JoinCard } from "@/components/join-card";
import { MeetupView } from "@/components/meetup-view";
import { ensureAnonymousUser } from "@/lib/firebase/client";
import { getInvitePreview } from "@/services/meetup-repository";
import type { InvitePreview } from "@/types/meetup";

export default function MeetupPage({ params }: { params: Promise<{ meetupId: string }> }) {
  const { language } = useLanguage();
  const [meetupId, setMeetupId] = useState<string>();
  const [preview, setPreview] = useState<InvitePreview>();
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => { void params.then(({ meetupId: id }) => setMeetupId(id)); }, [params]);
  useEffect(() => {
    if (!meetupId) return;
    void (async () => { try { await ensureAnonymousUser(); const invite = await getInvitePreview(meetupId); setPreview(invite); setJoined(invite.isAlreadyParticipant); } catch (caught) { setError(caught instanceof Error ? caught.message : "초대를 불러올 수 없어요."); } })();
  }, [meetupId]);
  return <div className="app-shell"><AppHeader title="meetup" />{error ? <main className="loading-page"><p className="error-message">{error}</p></main> : !preview ? <main className="loading-page"><div className="loader" /><p>{language === "ko" ? "초대를 준비하고 있어요..." : "招待を準備しています…"}</p></main> : !joined ? <JoinCard meetupId={preview.meetupId} title={preview.title} hostName={preview.hostName} onJoined={() => setJoined(true)} /> : <MeetupView meetupId={preview.meetupId} />}</div>;
}
