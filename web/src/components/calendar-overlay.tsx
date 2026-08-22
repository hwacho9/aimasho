"use client";

import { useMemo, useState } from "react";
import { requestGoogleCalendarAccessToken } from "@/lib/firebase/client";
import type { MeetupDetail } from "@/types/meetup";
import { useLanguage } from "./language-provider";

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

function eventRange(event: GoogleCalendarEvent): { start: Date; end: Date } | null {
  const startText = event.start?.dateTime ?? event.start?.date;
  const endText = event.end?.dateTime ?? event.end?.date;
  if (!startText || !endText) return null;
  const start = new Date(startText);
  const end = new Date(endText);
  return Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) ? null : { start, end };
}

async function fetchCalendarEvents(token: string, timeMin: string, timeMax: string): Promise<GoogleCalendarEvent[]> {
  const query = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
    timeZone: "Asia/Tokyo",
  });
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Google Calendar API (${response.status})`);
  const body = await response.json() as { items?: GoogleCalendarEvent[] };
  return body.items ?? [];
}

export function CalendarOverlay({ detail }: { detail: MeetupDetail }) {
  const { language, locale } = useLanguage();
  const korean = language === "ko";
  const [events, setEvents] = useState<GoogleCalendarEvent[]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const candidateRange = useMemo(() => {
    const dates = detail.candidateSlots.map((slot) => new Date(slot.startDateTime)).filter((date) => !Number.isNaN(date.getTime()));
    if (dates.length === 0) return null;
    const start = new Date(Math.min(...dates.map((date) => date.getTime())) - 60 * 60 * 1000);
    const end = new Date(Math.max(...dates.map((date) => date.getTime())) + (detail.meetup.durationMinutes + 60) * 60 * 1000);
    return { start, end };
  }, [detail.candidateSlots, detail.meetup.durationMinutes]);
  const eventDisplay = (event: GoogleCalendarEvent) => {
    const range = eventRange(event);
    if (!range) return event.summary || (korean ? "제목 없는 일정" : "無題の予定");
    return `${new Intl.DateTimeFormat(locale, { timeZone: "Asia/Tokyo", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(range.start)} · ${event.summary || (korean ? "제목 없는 일정" : "無題の予定")}`;
  };
  const conflicts = (slotStart: string) => {
    const start = new Date(slotStart);
    const end = new Date(start.getTime() + detail.meetup.durationMinutes * 60 * 1000);
    return (events ?? []).filter((event) => {
      const range = eventRange(event);
      return range ? range.start < end && range.end > start : false;
    });
  };
  const connect = async () => {
    if (!candidateRange) return;
    setBusy(true); setError(undefined);
    try {
      const token = await requestGoogleCalendarAccessToken();
      setEvents(await fetchCalendarEvents(token, candidateRange.start.toISOString(), candidateRange.end.toISOString()));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : korean ? "Google Calendar를 불러오지 못했어요." : "Google Calendar を読み込めませんでした。");
    } finally {
      setBusy(false);
    }
  };

  if (detail.meetup.status !== "SCHEDULING" || !candidateRange) return null;
  return <section className="calendar-overlay" aria-labelledby="calendar-overlay-title">
    <div className="calendar-overlay-heading"><div><p className="eyebrow">{korean ? "내 일정 · 비공개" : "自分の予定・非公開"}</p><h2 id="calendar-overlay-title">{korean ? "Google Calendar와 후보 시간 겹침 확인" : "Google Calendar で候補との重なりを確認"}</h2><p>{korean ? "내 캘린더 일정은 브라우저에서만 조회하며 aimasho와 다른 참가자에게 저장·공유되지 않아요." : "カレンダーの予定はこのブラウザ内で確認するだけで、aimasho や他の参加者には保存・共有されません。"}</p></div>{events ? <button type="button" className="text-button" onClick={() => setEvents(undefined)}>{korean ? "캘린더 숨기기" : "カレンダーを隠す"}</button> : <button type="button" className="secondary-button" onClick={() => void connect()} disabled={busy}>{busy ? korean ? "연결 중..." : "接続中…" : korean ? "Google Calendar 연결" : "Google Calendar を接続"}</button>}</div>
    {events && <div className="calendar-conflicts">{detail.candidateSlots.map((slot) => { const overlap = conflicts(slot.startDateTime); return <div className={`calendar-slot ${overlap.length ? "has-conflict" : "free"}`} key={slot.id}><b>{new Intl.DateTimeFormat(locale, { timeZone: "Asia/Tokyo", month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(slot.startDateTime))}</b>{overlap.length ? <span>{korean ? `겹치는 내 일정 ${overlap.length}개` : `重なる自分の予定 ${overlap.length}件`}</span> : <span>{korean ? "등록된 내 일정과 겹치지 않음" : "登録済みの予定との重なりなし"}</span>}{overlap.length > 0 && <ul>{overlap.map((event) => <li key={event.id}>{eventDisplay(event)}</li>)}</ul>}</div>; })}</div>}
    {error && <p className="error-message">{error}<br /><small>{korean ? "Google Cloud에서 Calendar API를 사용 설정하고, 팝업의 읽기 권한을 허용했는지 확인해 주세요." : "Google Cloud で Calendar API を有効にし、ポップアップの閲覧権限を許可したか確認してください。"}</small></p>}
  </section>;
}
