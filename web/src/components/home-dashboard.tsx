"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { relationshipLabel } from "@/lib/relationship-label";
import { getMyDashboard } from "@/services/meetup-repository";
import type { HistoryMeetup, HomeDashboardData } from "@/types/meetup";
import { useLanguage } from "./language-provider";

function meetupDate(meetup: HistoryMeetup) {
  return meetup.confirmedDateTime ?? meetup.candidateDateTimes?.[0] ?? meetup.completedAt;
}

function dateKey(value?: string) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const part = (kind: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === kind)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function statusCopy(meetup: HistoryMeetup, korean: boolean) {
  if (meetup.status === "COMPLETED") return korean ? "완료" : "完了";
  if (meetup.status === "CANCELLED") return korean ? "취소" : "中止";
  if (meetup.status === "SCHEDULING") return korean ? "조율 중" : "調整中";
  return korean ? "예정" : "予定";
}

export function HomeDashboard() {
  const { language, locale } = useLanguage();
  const korean = language === "ko";
  const now = new Date();
  const [data, setData] = useState<HomeDashboardData>();
  const [loadFailed, setLoadFailed] = useState(false);
  const [view, setView] = useState<"CALENDAR" | "TIMELINE">("CALENDAR");
  const [month, setMonth] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });

  useEffect(() => {
    let active = true;
    void getMyDashboard()
      .then((next) => { if (active) setData(next); })
      .catch(() => { if (active) setLoadFailed(true); });
    return () => { active = false; };
  }, []);

  const monthCells = useMemo(() => {
    const firstWeekday = new Date(Date.UTC(month.year, month.month - 1, 1)).getUTCDay();
    const days = new Date(Date.UTC(month.year, month.month, 0)).getUTCDate();
    return [...Array(firstWeekday).fill(null), ...Array.from({ length: days }, (_, index) => index + 1)];
  }, [month]);
  const eventsByDate = useMemo(() => {
    const result = new Map<string, HistoryMeetup[]>();
    for (const meetup of data?.meetups ?? []) {
      const key = dateKey(meetupDate(meetup));
      if (key) result.set(key, [...(result.get(key) ?? []), meetup]);
    }
    return result;
  }, [data?.meetups]);
  const timeline = useMemo(() => data?.meetups.filter((meetup) => meetupDate(meetup)).slice(0, 12) ?? [], [data?.meetups]);
  const moveMonth = (offset: number) => setMonth((current) => {
    const value = new Date(Date.UTC(current.year, current.month - 1 + offset, 1));
    return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1 };
  });
  const displayDate = (value?: string) => value ? new Intl.DateTimeFormat(locale, { timeZone: "Asia/Tokyo", month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)) : korean ? "날짜 조율 중" : "日程調整中";

  if (loadFailed) return <section className="home-dashboard"><p className="error-message">{korean ? "내 일정을 불러오지 못했어요." : "予定を読み込めませんでした。"}</p></section>;
  if (!data) return <section className="home-dashboard dashboard-loading"><div className="loader" /><p>{korean ? "내 일정 보드를 준비하고 있어요..." : "予定ボードを準備しています…"}</p></section>;

  return <section className="home-dashboard" aria-labelledby="home-dashboard-title">
    <div className="dashboard-heading"><div><p className="eyebrow">MY AIMASHO</p><h2 id="home-dashboard-title">{korean ? `${data.displayName}님의 일정 보드` : `${data.displayName}さんの予定ボード`}</h2><p>{korean ? "다가오는 약속과 함께한 기록을 한 흐름에서 확인해요." : "これからの予定と一緒に過ごした記録を一つの流れで確認できます。"}</p></div><Link className="secondary-button" href="/new">{korean ? "+ 약속 만들기" : "+ 予定を作る"}</Link></div>
    <div className="dashboard-summary"><div><b>{data.summary.upcomingMeetupCount}</b><span>{korean ? "다가오는 약속" : "これからの予定"}</span></div><div><b>{data.summary.completedMeetupCount}</b><span>{korean ? "함께한 날" : "一緒に過ごした日"}</span></div><div><b>{data.summary.friendCount}</b><span>{korean ? "함께한 친구" : "一緒に会った友だち"}</span></div><div><b>{data.summary.groupCount}</b><span>{korean ? "그룹" : "グループ"}</span></div></div>
    <div className="dashboard-view-heading"><h3>{korean ? "내 캘린더" : "マイカレンダー"}</h3><div className="history-view-toggle"><button className={view === "CALENDAR" ? "active" : ""} onClick={() => setView("CALENDAR")}>{korean ? "캘린더" : "カレンダー"}</button><button className={view === "TIMELINE" ? "active" : ""} onClick={() => setView("TIMELINE")}>{korean ? "타임라인" : "タイムライン"}</button></div></div>
    {view === "CALENDAR" ? <div className="dashboard-calendar"><div className="calendar-month-heading"><button type="button" onClick={() => moveMonth(-1)} aria-label={korean ? "이전 달" : "前の月"}>‹</button><b>{month.year}. {String(month.month).padStart(2, "0")}</b><button type="button" onClick={() => moveMonth(1)} aria-label={korean ? "다음 달" : "次の月"}>›</button></div><div className="calendar-weekdays">{(korean ? ["일", "월", "화", "수", "목", "금", "토"] : ["日", "月", "火", "水", "木", "金", "土"]).map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{monthCells.map((day, index) => {
      if (!day) return <span className="calendar-day empty" key={`empty-${index}`} />;
      const key = `${month.year}-${String(month.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const events = eventsByDate.get(key) ?? [];
      return <span className={`calendar-day ${events.length ? "has-event" : ""}`} key={key}><b>{day}</b>{events.slice(0, 2).map((meetup) => <Link href={`/m/${meetup.id}`} title={meetup.title} key={meetup.id}>{meetup.title}</Link>)}{events.length > 2 && <small>+{events.length - 2}</small>}</span>;
    })}</div></div> : <div className="dashboard-timeline">{timeline.length === 0 ? <p className="empty-note">{korean ? "표시할 일정이 없어요." : "表示する予定がありません。"}</p> : timeline.map((meetup) => <Link href={`/m/${meetup.id}`} key={meetup.id} className={meetup.status.toLowerCase()}><time>{displayDate(meetupDate(meetup))}</time><span className="timeline-dot" /><span><b>{meetup.title}</b><small>{meetup.roomName ? `${meetup.roomName} · ` : ""}{meetup.meetingPlace?.name ?? statusCopy(meetup, korean)}</small></span><em>{statusCopy(meetup, korean)}</em></Link>)}</div>}
    <div className="dashboard-columns"><section><div className="mini-section-heading"><div><p className="eyebrow">FRIENDS</p><h3>{korean ? "함께한 친구" : "一緒に会った友だち"}</h3></div><Link href="/profile">{korean ? "전체 보기" : "すべて見る"}</Link></div>{data.relationships.length === 0 ? <p className="empty-note">{korean ? "친구와 약속을 완료하면 기록이 쌓여요." : "友だちとの予定を完了すると記録が増えます。"}</p> : <div className="dashboard-friends">{data.relationships.slice(0, 6).map((friend) => <Link href={friend.lastMeetupId ? `/m/${friend.lastMeetupId}` : "/profile"} key={friend.otherUid}><span className="relationship-avatar">{friend.displayName.slice(0, 1)}</span><span><b>{friend.displayName}</b><small>{korean ? `${friend.sharedMeetupCount}번 함께` : `${friend.sharedMeetupCount}回一緒に`}</small></span><em>{relationshipLabel(friend.sharedMeetupCount, korean)}</em></Link>)}</div>}</section><section><div className="mini-section-heading"><div><p className="eyebrow">GROUPS</p><h3>{korean ? "내 그룹" : "マイグループ"}</h3></div><Link href="/profile">{korean ? "관리" : "管理"}</Link></div>{data.rooms.length === 0 ? <p className="empty-note">{korean ? "자주 만나는 친구들과 그룹을 만들어보세요." : "よく会う友だちとグループを作りましょう。"}</p> : <div className="dashboard-groups">{data.rooms.slice(0, 6).map((room) => <Link href={`/rooms/${room.id}`} key={room.id}><span>👥</span><span><b>{room.name}</b><small>{room.nextMeetupDate ? `${displayDate(room.nextMeetupDate)} · ` : ""}{korean ? `${room.completedMeetupCount ?? 0}번 함께` : `${room.completedMeetupCount ?? 0}回一緒に`}</small></span><em>→</em></Link>)}</div>}</section></div>
  </section>;
}
