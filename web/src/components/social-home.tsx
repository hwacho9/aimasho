"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getMyDashboard, invalidateMyDashboardCache } from "@/services/meetup-repository";
import { getMySocialOverview } from "@/services/social-repository";
import type { HistoryMeetup, HomeDashboardData } from "@/types/meetup";
import type { SharedMemory, SocialFriend, SocialOverview } from "@/types/social";
import { AimashoIcon } from "./aimasho-icon";
import { useAuth } from "./auth-provider";
import { useLanguage } from "./language-provider";
import { MemoryNotes } from "./memory-notes";

const CalendarDashboard = dynamic(() => import("./home-dashboard").then((module) => module.HomeDashboard));
type Tab = "today" | "plans" | "friends" | "memories";

export function SocialHome() {
  const { user } = useAuth();
  // Remount on account changes so private data cannot persist across accounts.
  return user && !user.isAnonymous ? <SocialHomeContents key={user.uid} /> : null;
}

function SocialHomeContents() {
  const { user } = useAuth();
  const { language, locale } = useLanguage();
  const ko = language === "ko";
  const [tab, setTab] = useState<Tab>("today");
  const [now, setNow] = useState(() => Date.now());
  const [data, setData] = useState<HomeDashboardData>();
  const [social, setSocial] = useState<SocialOverview>();
  const [failed, setFailed] = useState(false);
  const [socialFailed, setSocialFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void getMyDashboard().then((result) => { if (active) { setData(result); setFailed(false); } }).catch(() => { if (active) setFailed(true); });
    void getMySocialOverview().then((result) => { if (active) { setSocial(result); setSocialFailed(false); } }).catch(() => { if (active) setSocialFailed(true); });
    return () => { active = false; };
  }, [revision]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const refresh = () => { invalidateMyDashboardCache(); setRevision((value) => value + 1); };
  const upcoming = data?.meetups.filter((meetup) => !["COMPLETED", "CANCELLED"].includes(meetup.status)) ?? [];
  const next = upcoming.filter((meetup) => meetup.confirmedDateTime && new Date(meetup.confirmedDateTime).getTime() >= now)
    .sort((a, b) => a.confirmedDateTime!.localeCompare(b.confirmedDateTime!))[0];
  const planning = upcoming.filter((meetup) => !meetup.confirmedDateTime);
  const wrapup = upcoming.filter((meetup) => meetup.isOwner && meetup.confirmedDateTime && new Date(meetup.confirmedDateTime).getTime() < now);
  const tabs: { id: Tab; label: string; icon: "sun" | "calendar" | "friend" | "history" }[] = [
    { id: "today", label: ko ? "우리" : "ホーム", icon: "sun" },
    { id: "plans", label: ko ? "약속" : "予定", icon: "calendar" },
    { id: "friends", label: ko ? "친구" : "友だち", icon: "friend" },
    { id: "memories", label: ko ? "추억" : "思い出", icon: "history" },
  ];
  return <div className="social-home">
    <div className="social-welcome"><div><p className="eyebrow">{ko ? "우리의 다음 이야기" : "次の思い出を、一緒に。"}</p><h1>{ko ? `${user?.displayName ?? "친구"}님, 또 만나요.` : `${user?.displayName ?? "ともだち"}さん、また会おう。`}</h1><p>{ko ? "약속 하나가, 오래 남는 우리 이야기로." : "ひとつの予定が、ずっと残る私たちの記録に。"}</p></div><Link className="primary-button" href="/new">＋ {ko ? "모임 만들기" : "予定をつくる"}</Link></div>
    <nav className="social-tabs" aria-label={ko ? "마이 aimasho 메뉴" : "マイ aimasho メニュー"}>{tabs.map((item) => <button key={item.id} aria-current={tab === item.id ? "page" : undefined} onClick={() => setTab(item.id)}><AimashoIcon name={item.icon} />{item.label}</button>)}</nav>
    {failed && <div role="alert" className="social-empty">{ko ? "일정을 불러오지 못했어요." : "予定を読み込めませんでした。"}<button onClick={refresh}>{ko ? "다시 시도" : "再試行"}</button></div>}
    {(tab === "today" || tab === "friends") && <HomeGroups rooms={data?.rooms} failed={failed} onRetry={refresh} />}
    {tab === "plans" ? <CalendarDashboard key={revision} /> : <>
      {tab === "today" && <>
        <div className="social-today-grid">
          <section className="social-next"><p className="eyebrow">{ko ? "다음에 만날 날" : "次に会う日"}</p>{!data && !failed ? <Loading ko={ko} /> : next ? <><h2>{next.title}</h2><p className="social-next-date">{new Date(next.confirmedDateTime!).toLocaleString(locale, { timeZone: "Asia/Tokyo", month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" })}</p><p>{next.meetingPlace?.name ?? (ko ? "장소는 함께 정해요" : "場所はこれから一緒に")}</p><Link className="primary-button" href={`/m/${next.id}`}>{ko ? "모임 열기" : "予定を開く"} →</Link></> : <><h2>{ko ? "가볍게, 밥 한번?" : "気軽に、ごはんでも？"}</h2><p>{ko ? "날짜와 할 일을 정하고 링크 하나로 초대해요." : "日程とやりたいことを決めて、リンクひとつで招待。"}</p><Link className="primary-button" href="/new?template=food">{ko ? "식사 모임 만들기" : "ごはんの予定をつくる"} →</Link></>}</section>
          <section className="social-card"><div className="section-heading"><h2>{ko ? "함께 정하는 중" : "みんなで相談中"}</h2><span className="social-count">{planning.length}</span></div>{planning.slice(0, 3).map((meetup) => <CompactMeetup key={meetup.id} meetup={meetup} />)}{data && planning.length === 0 && <p className="social-hint">{ko ? "조율 중인 약속이 없어요. 새 모임을 만들어보세요." : "調整中の予定はありません。次の予定をつくってみよう。"}</p>}<button className="text-button" onClick={() => setTab("plans")}>{ko ? `전체 약속 ${data?.meetups.length ?? "…"}개 보기` : `すべての予定 ${data?.meetups.length ?? "…"}件を見る`} →</button></section>
        </div>
        {wrapup.length > 0 && <section className="social-card social-wrapup"><p className="eyebrow">{ko ? "지난 모임, 기록으로 남길까요?" : "過ぎた予定を、思い出にしよう"}</p><h2>{ko ? `내가 만든 모임 ${wrapup.length}개의 마무리가 남았어요` : `作成した予定 ${wrapup.length}件を振り返ろう`}</h2><p className="social-hint">{ko ? "실제로 만났다면 방의 당일 플랜에서 완료해주세요. 자동으로 만남 횟수를 늘리지는 않아요." : "実際に会ったら、当日プランから完了にしてください。回数を自動で増やすことはありません。"}</p>{wrapup.slice(0, 2).map((meetup) => <CompactMeetup key={meetup.id} meetup={meetup} />)}</section>}
        <div className="social-section-heading"><h2>{ko ? "만날수록 쌓이는 우리" : "会うたび、増えるつながり"}</h2><button className="text-button" onClick={() => setTab("friends")}>{ko ? "모두 보기" : "すべて見る"} →</button></div>
      </>}
      {socialFailed && <div className="social-empty" role="alert">{ko ? "친구·추억을 불러오지 못했어요. 일정은 계속 관리할 수 있어요." : "友だち・思い出を読み込めませんでした。予定の管理は続けられます。"}<button className="text-button" onClick={refresh}>{ko ? "다시 시도" : "再試行"}</button></div>}
      {!social && !socialFailed && <Loading ko={ko} />}
      {social?.limited && <p className="social-hint">{ko ? "기록이 많아 일부 모임 기준으로 표시하고 있어요. 평생 누적 횟수가 아닙니다." : "記録が多いため、一部の予定をもとに表示しています。全期間の合計ではありません。"}</p>}
      {(tab === "friends" || tab === "today") && social && <>
        <div className="social-friends-grid">{(tab === "today" ? social.friends.slice(0, 3) : social.friends).map((friend) => <FriendCard key={friend.uid} friend={friend} />)}</div>
        {social.friends.length === 0 && <div className="social-empty"><AimashoIcon name="friend" /><h3>{ko ? "우리의 첫 모임부터" : "最初の予定から、つながろう"}</h3><p>{ko ? "같은 모임에 참여한 가입 친구가 여기에 모여요. 비회원 친구에게 가입을 강요하지 않아도 돼요." : "同じ予定に参加した登録済みの友だちがここに集まります。ゲストは登録せずに参加できます。"}</p><Link href="/new" className="secondary-button">{ko ? "친구 초대할 모임 만들기" : "友だちを招待する予定をつくる"}</Link></div>}
        <p className="social-hint">{ko ? "완료된 모임 중 불참 응답을 제외한 기록이에요. 우정의 점수나 실제 참석 증명이 아닌, 함께한 약속의 이정표입니다." : "完了した予定から不参加の回答を除いた記録です。友情の点数や出席の証明ではなく、一緒の予定の節目です。"}</p>
      </>}
      {(tab === "today" || tab === "memories") && <>
        <div className="social-section-heading"><div><p className="eyebrow">{ko ? "함께한 날의 기록" : "一緒に過ごした日の記録"}</p><h2>{ko ? "우리만의 작은 피드" : "私たちだけの思い出"}</h2></div><Link href="/journey" className="secondary-button"><AimashoIcon name="map" />{ko ? "지도로 되돌아보기" : "マップで振り返る"}</Link></div>
        {social?.memories.length === 0 && <div className="social-empty"><h3>{ko ? "모임이 끝나면 이야기는 시작돼요" : "予定が終わったら、思い出のはじまり"}</h3><p>{ko ? "모임 방의 당일 플랜에서 호스트가 완료하면, 여기서 한 줄 추억을 남길 수 있어요." : "予定の当日プランでホストが完了すると、ここでひとことを残せます。"}</p></div>}
        <div className="social-memory-grid">{(tab === "today" ? social?.memories.slice(0, 2) : social?.memories)?.map((memory) => <MemoryCard key={memory.id} memory={memory} />)}</div>
      </>}
    </>}
  </div>;
}

function Loading({ ko }: { ko: boolean }) { return <p className="social-loading" role="status">{ko ? "우리의 기록을 불러오고 있어요…" : "私たちの記録を読み込み中…"}</p>; }

function HomeGroups({ rooms, failed, onRetry }: { rooms?: HomeDashboardData["rooms"]; failed: boolean; onRetry: () => void }) {
  const { language } = useLanguage();
  const ko = language === "ko";
  return <section className="social-card home-groups" aria-labelledby="home-groups-title">
    <div className="section-heading">
      <div className="home-groups-title"><AimashoIcon name="group" /><h2 id="home-groups-title">{ko ? "내 그룹" : "マイグループ"}</h2>{rooms && <span className="social-count">{rooms.length}</span>}</div>
      <Link className="secondary-button" href="/profile">＋ {ko ? "그룹 만들기·참여" : "グループの作成・参加"}</Link>
    </div>
    {!rooms ? failed ? <p className="social-hint" role="alert">{ko ? "그룹을 불러오지 못했어요." : "グループを読み込めませんでした。"} <button className="text-button" onClick={onRetry}>{ko ? "다시 시도" : "再試行"}</button></p> : <p className="social-loading" role="status">{ko ? "그룹을 불러오고 있어요…" : "グループを読み込み中…"}</p>
      : rooms.length === 0 ? <p className="social-hint">{ko ? "아직 그룹이 없어요. 그룹을 만들거나 초대 코드로 참여해보세요." : "まだグループはありません。作成するか、招待コードで参加してみましょう。"}</p>
      : <div className="home-groups-grid">{rooms.map((room) => <Link className="social-group" href={`/rooms/${room.id}`} key={room.id}>
        <span className="home-group-icon"><AimashoIcon name="group" /></span>
        <span className="home-group-copy"><strong>{room.name}</strong><small>{room.role === "OWNER" ? ko ? "관리자" : "管理者" : ko ? "멤버" : "メンバー"}</small></span>
        <span aria-hidden="true">→</span>
      </Link>)}</div>}
  </section>;
}

export function CompactMeetup({ meetup }: { meetup: HistoryMeetup }) {
  const { language, locale } = useLanguage();
  const ko = language === "ko";
  const date = meetup.confirmedDateTime ?? meetup.completedAt;
  const state = meetup.status === "COMPLETED" ? ko ? "완료" : "完了" : meetup.status === "CANCELLED" ? ko ? "취소" : "中止" : meetup.confirmedDateTime ? ko ? "일정 확정" : "日程確定" : ko ? "날짜 조율 중 · 아직 미확정" : "日程を相談中・まだ未確定";
  return <Link className="social-meetup-row" href={`/m/${meetup.id}`}><span className="social-date-icon"><AimashoIcon name="calendar" /></span><span><strong>{meetup.title}</strong><small>{state}{date ? ` · ${new Date(date).toLocaleDateString(locale, { timeZone: "Asia/Tokyo", month: "short", day: "numeric" })}` : ""}</small></span><span aria-hidden="true">→</span></Link>;
}

export function FriendCard({ friend }: { friend: SocialFriend }) {
  const { language, locale } = useLanguage();
  const ko = language === "ko";
  const labels = ko ? ["첫 만남을 기다리며", "첫 추억", "반가운 사이", "우리의 단골", "쌓여가는 이야기", "오래 이어온 우리"] : ["最初の思い出へ", "はじめての思い出", "会うのが楽しみ", "いつもの仲間", "重なる思い出", "ずっと続くつながり"];
  return <article className="social-friend-card"><div className="social-friend-title"><span className="social-avatar">{Array.from(friend.displayName)[0]}</span><div><h3>{friend.displayName}</h3><small>{labels[friend.milestone.level]}</small></div></div><p className="social-friend-count"><b>{friend.completedCount}</b> {ko ? "번의 만남 기록" : "回の思い出"}</p><progress value={friend.milestone.progress} max={1} aria-label={ko ? "만남 기록 이정표" : "思い出の節目"} /><small>{friend.milestone.next ? ko ? `다음 이정표까지 ${friend.milestone.next - friend.completedCount}번` : `次の節目まであと${friend.milestone.next - friend.completedCount}回` : ko ? "함께 쌓아가는 이야기" : "これからも一緒に"}</small><p className="social-hint">{friend.lastMetAt ? `${ko ? "최근 만남" : "最近の思い出"} ${new Date(friend.lastMetAt).toLocaleDateString(locale, { timeZone: "Asia/Tokyo" })}` : ko ? "첫 추억을 기다리고 있어요" : "最初の思い出を待っています"} · {ko ? `진행 중 약속 ${friend.plannedCount}개` : `進行中の予定 ${friend.plannedCount}件`}</p><Link className="text-button" href={`/friends/${friend.uid}`}>{ko ? "둘의 기록 보기" : "ふたりの記録を見る"} →</Link></article>;
}

function MemoryCard({ memory }: { memory: SharedMemory }) {
  const { language, locale } = useLanguage();
  const ko = language === "ko";
  const [open, setOpen] = useState(false);
  return <article className="social-memory-card"><div className="social-memory-cover"><AimashoIcon name="sun" /><span>{memory.date ? new Date(memory.date).toLocaleDateString(locale, { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric" }) : ko ? "함께한 날" : "一緒に過ごした日"}</span><h3><Link href={`/m/${memory.id}`}>{memory.title}</Link></h3><p>{memory.placeName ?? (ko ? "장소 미등록" : "場所は未登録")}</p></div><div className="social-memory-body"><p>{memory.companions.map((person) => person.displayName).join(" · ") || (ko ? "나의 기록" : "自分の記録")}</p><details onToggle={(event) => setOpen(event.currentTarget.open)}><summary>{ko ? "추억 읽고 한 줄 남기기" : "ひとことを読んで、思い出を残す"}</summary>{open && <MemoryNotes meetupId={memory.id} />}</details></div></article>;
}
