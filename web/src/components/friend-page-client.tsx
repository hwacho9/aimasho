"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getFriendHistory } from "@/services/meetup-repository";
import type { FriendHistory } from "@/types/meetup";
import { useAuth } from "./auth-provider";
import { AppHeader, useLanguage } from "./language-provider";
import { JourneyPlayer } from "./journey-player";
import { CompactMeetup } from "./social-home";

export function FriendPageClient({ otherUid }: { otherUid: string }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const ko = language === "ko";
  const [history, setHistory] = useState<{ uid: string; data: FriendHistory }>();
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!user || user.isAnonymous) return;
    let active = true;
    void getFriendHistory(otherUid).then((data) => { if (active) { setHistory({ uid: user.uid, data }); setFailed(false); } }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [user, otherUid, retry]);
  const data = history?.uid === user?.uid && history?.data.otherUid === otherUid ? history.data : undefined;
  return <main className="form-page"><AppHeader title="profile" />{!user || user.isAnonymous ? <Link href={`/login?next=${encodeURIComponent(`/friends/${otherUid}`)}`}>{ko ? "로그인하고 둘의 기록 보기" : "ログインしてふたりの記録を見る"}</Link> : data ? <><p className="eyebrow">{ko ? "둘의 이야기" : "ふたりの記録"}</p><h1>{data.displayName}</h1><p>{ko ? `함께 완료한 모임 ${data.completedMeetupCount}회` : `一緒に完了した予定 ${data.completedMeetupCount}回`}</p><p className="social-hint">{ko ? "둘 다 참여한 모임 기록만 보여요. 실제 이동 경로는 수집하지 않아요." : "ふたりが参加した予定だけを表示します。実際の移動経路は収集しません。"}</p><JourneyPlayer stops={data.stops} compact /><h2>{ko ? "함께한 약속들" : "一緒の予定"}</h2>{data.meetups.map((meetup) => <CompactMeetup key={meetup.id} meetup={meetup} />)}<Link href="/new" className="primary-button">{ko ? "다음 모임 만들어 초대하기" : "次の予定をつくって招待"}</Link></> : failed ? <div role="alert"><p>{ko ? "둘의 기록을 불러오지 못했어요." : "ふたりの記録を読み込めませんでした。"}</p><button onClick={() => setRetry((n) => n + 1)}>{ko ? "다시 시도" : "再試行"}</button></div> : <p role="status">{ko ? "불러오는 중…" : "読み込み中…"}</p>}</main>;
}
