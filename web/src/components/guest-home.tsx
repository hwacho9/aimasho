"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getMyMeetups } from "@/services/social-repository";
import type { HistoryMeetup } from "@/types/meetup";
import { useAuth } from "./auth-provider";
import { useLanguage } from "./language-provider";
import { AimashoIcon } from "./aimasho-icon";
import { CompactMeetup } from "./social-home";

export function GuestHome() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const ko = language === "ko";
  const [recent, setRecent] = useState<{ uid: string; meetups: HistoryMeetup[]; limited: boolean }>();
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [visibleCount, setVisibleCount] = useState(8);
  useEffect(() => {
    if (!user) return;
    let active = true;
    void getMyMeetups().then((result) => { if (active) { setRecent({ ...result, uid: user.uid }); setFailed(false); } }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [user, revision]);
  const mine = recent?.uid === user?.uid ? recent : undefined;
  return <div className="guest-home">
    <section className="guest-hero-grid"><div><p className="eyebrow">{ko ? "링크 하나로 모임 준비 끝" : "リンクひとつで、集まろう。"}</p><h1>{ko ? <>언제 만나서<br /><strong>뭐 할까?</strong></> : <>いつ会って、<br /><strong>何しよう？</strong></>}</h1><p>{ko ? "날짜 투표부터 할 일, 장소, 정산까지. 로그인 없이 한 모임에서 함께 정해요." : "日程投票から、やること・場所・精算まで。ログインなしで、ひとつの予定に。"}</p><Link className="primary-button" href="/new">{ko ? "로그인 없이 모임 만들기" : "ログインなしで予定をつくる"} →</Link><small>{ko ? "참가자도 링크를 열고 이름만 입력하면 돼요." : "参加者もリンクを開いて名前を入れるだけ。"}</small></div><div className="guest-plan-preview" aria-label={ko ? "모임 관리 예시" : "予定管理のイメージ"}><span className="social-count">{ko ? "이렇게 모여요 · 예시" : "こんなふうに集合・イメージ"}</span><h2>{ko ? "우리의 토요일" : "私たちの土曜日"}</h2>{[["calendar", ko ? "언제가 좋아?" : "いつがいい？", ko ? "날짜 투표" : "日程を投票"],["friend", ko ? "뭐 하고 놀까?" : "何して遊ぶ？", ko ? "식사·활동 함께 고르기" : "食事・遊びを一緒に選ぶ"],["map", ko ? "그날의 플랜" : "当日のプラン", ko ? "장소·할 일·비용 한곳에서" : "場所・やること・お金もここで"]].map(([icon, title, detail], index) => <div className="guest-preview-step" key={title}><span><AimashoIcon name={icon as "calendar" | "friend" | "map"} /></span><div><small>0{index + 1}</small><h3>{title}</h3><p>{detail}</p></div></div>)}</div></section>
    <section className="guest-templates"><h2>{ko ? "어떤 모임을 만들까요?" : "どんな予定にしよう？"}</h2><div>{[["food", ko ? "밥 한번 먹자" : "ごはんに行こう", ko ? "식사 투표 포함" : "食事投票つき"],["activity", ko ? "같이 놀러 가자" : "一緒に遊ぼう", ko ? "활동 투표 포함" : "遊びの投票つき"],["free", ko ? "자유롭게 모이자" : "自由に集まろう", ko ? "날짜부터 간단하게" : "まずは日程だけ"]].map(([template, title, detail]) => <Link href={`/new?template=${template}`} key={template}><strong>{title} →</strong><span>{detail}</span></Link>)}</div></section>
    {user && <section className="social-card"><h2>{ko ? "이 기기에서 참여한 모임" : "この端末で参加した予定"}</h2><p className="social-hint">{ko ? "로그인하지 않아도 같은 브라우저에서는 이어서 볼 수 있어요. 브라우저 데이터 삭제·기기 변경 시 접근을 잃을 수 있으니 초대 링크도 보관해주세요." : "同じブラウザなら続きから使えます。データ削除や端末変更でアクセスを失うことがあるため、招待リンクも保存してください。"}</p>{mine?.meetups.slice(0, visibleCount).map((meetup) => <CompactMeetup meetup={meetup} key={meetup.id} />)}{mine?.meetups.length === 0 && <p>{ko ? "아직 참여한 모임이 없어요." : "参加した予定はまだありません。"}</p>}{mine && mine.meetups.length > visibleCount && <button className="text-button" onClick={() => setVisibleCount((count) => count + 8)}>{ko ? "더 보기" : "もっと見る"}</button>}{mine?.limited && <p className="social-hint">{ko ? "일부 모임을 표시하고 있어요. 다른 모임은 저장한 초대 링크로 열어주세요." : "一部の予定を表示しています。他の予定は保存した招待リンクから開いてください。"}</p>}{!mine && !failed && <p role="status">{ko ? "불러오는 중…" : "読み込み中…"}</p>}{failed && <button className="text-button" onClick={() => setRevision((n) => n + 1)}>{ko ? "모임 다시 불러오기" : "予定を再読み込み"}</button>}</section>}
    <section className="guest-social-invite"><AimashoIcon name="friend" /><div><h2>{ko ? "다음에도, 그다음에도 함께" : "次も、その次も、一緒に。"}</h2><p>{ko ? "로그인하면 친구별 만남 횟수, 그룹, 함께한 추억을 이어서 기록해요." : "ログインすると、友だちとの思い出の回数やグループ、ひとことを残せます。"}</p></div><Link className="secondary-button" href="/login">{ko ? "나의 aimasho 시작하기" : "マイ aimasho をはじめる"} →</Link></section>
  </div>;
}
