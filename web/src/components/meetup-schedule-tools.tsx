"use client";

import type { CandidateSlot, MeetupDetail } from "@/types/meetup";
import { useLanguage } from "./language-provider";
import { CalendarOverlay } from "./calendar-overlay";

export function MeetupScheduleTools({ detail, recommended, isHost, confirming, pendingVotes, onConfirm }: {
  detail: MeetupDetail;
  recommended?: CandidateSlot | null;
  isHost: boolean;
  confirming: boolean;
  pendingVotes: boolean;
  onConfirm: (slotId: string) => void;
}) {
  const { language, locale } = useLanguage();
  const korean = language === "ko";
  if (detail.meetup.status !== "SCHEDULING") return null;
  return <>
    {isHost && recommended && <section className="recommendation-box">
      <div><span className="recommendation-star" aria-hidden="true">✦</span><div>
        <p className="eyebrow">{korean ? "AIMASHO 추천" : "AIMASHO おすすめ"}</p>
        <h2>{new Intl.DateTimeFormat(locale, { timeZone: "Asia/Tokyo", month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(recommended.startDateTime))}</h2>
        <p>{korean ? "불가능한 사람이 가장 적고, 가장 많은 친구가 참여할 수 있어요." : "参加できない人が最も少なく、いちばん多くの友だちが参加できます。"}</p>
      </div></div>
      <button className="primary-button" type="button" onClick={() => onConfirm(recommended.id)} disabled={confirming || pendingVotes} aria-busy={confirming}>
        {confirming ? korean ? "확정 중..." : "確定中…" : pendingVotes ? korean ? "투표 저장 중..." : "投票を保存中…" : korean ? "추천 일정으로 결정" : "おすすめの日程で決定"}
      </button>
    </section>}
    {detail.candidateSlots.length > 0 && <details className="social-disclosure meetup-calendar-disclosure">
      <summary>{korean ? "내 캘린더와 비교" : "自分のカレンダーと比較"}</summary>
      <CalendarOverlay detail={detail} />
    </details>}
  </>;
}
