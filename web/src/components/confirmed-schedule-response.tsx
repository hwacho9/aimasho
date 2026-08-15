"use client";

import { useState } from "react";
import { updateConfirmedScheduleAvailability } from "@/services/meetup-repository";
import type { Participant, VoteStatus } from "@/types/meetup";
import { useLanguage } from "./language-provider";
import { VoteButtonGroup } from "./vote-button";

export function ConfirmedScheduleResponse({ meetupId, participants, currentUid, confirmedDateTime, previousConfirmedDateTime }: { meetupId: string; participants: Participant[]; currentUid?: string; confirmedDateTime: string; previousConfirmedDateTime?: string }) {
  const { language, locale } = useLanguage();
  const korean = language === "ko";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const me = participants.find((participant) => participant.uid === currentUid);
  const displayDate = (value: string) => new Intl.DateTimeFormat(locale, { timeZone: "Asia/Tokyo", month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
  const update = async (status: VoteStatus) => {
    setBusy(true);
    setError(undefined);
    try {
      await updateConfirmedScheduleAvailability(meetupId, status);
    } catch {
      setError(korean ? "내 참석 가능 여부를 저장하지 못했어요." : "参加可否を保存できませんでした。");
    } finally {
      setBusy(false);
    }
  };
  const answered = participants.filter((participant) => participant.confirmedScheduleAvailability);

  return <section className="confirmed-schedule-card">{previousConfirmedDateTime && <div className="schedule-change-notice"><p className="eyebrow">{korean ? "일정 변경" : "日程変更"}</p><h2>{korean ? "집합 시간이 변경되었어요" : "集合日時が変更されました"}</h2><p><s>{displayDate(previousConfirmedDateTime)}</s><span>→</span><b>{displayDate(confirmedDateTime)}</b></p></div>}{me && <div className="schedule-response"><div><p className="eyebrow">{korean ? "내 응답" : "あなたの回答"}</p><h3>{previousConfirmedDateTime ? korean ? "변경된 일정에 참여할 수 있나요?" : "変更後の予定に参加できますか？" : korean ? "이 일정에 참여할 수 있나요?" : "この予定に参加できますか？"}</h3><p>{korean ? "언제든 내 응답을 다시 선택할 수 있어요." : "いつでも自分の回答を変更できます。"}</p></div><VoteButtonGroup value={me.confirmedScheduleAvailability} onChange={(status) => void update(status)} disabled={busy} />{answered.length > 0 && <div className="confirmed-response-names">{answered.map((participant) => <span className={participant.confirmedScheduleAvailability?.toLowerCase()} key={participant.uid}>{participant.confirmedScheduleAvailability === "YES" ? "○" : participant.confirmedScheduleAvailability === "MAYBE" ? "△" : "×"} {participant.displayName}</span>)}</div>}{error && <p className="error-message">{error}</p>}</div>}</section>;
}
