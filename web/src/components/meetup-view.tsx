"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { confirmSchedule, getMeetupRelationships, getRecommendation, saveProfile, submitVote, subscribeToMeetup, updateConfirmedSchedule } from "@/services/meetup-repository";
import { continueWithGoogle, firebase } from "@/lib/firebase/client";
import { relationshipLabel } from "@/lib/relationship-label";
import type { MeetupDetail, Recommendation, RelationshipStat, VoteStatus } from "@/types/meetup";
import { VoteButtonGroup } from "./vote-button";
import { ShareCard } from "./share-card";
import { MeetupNextSteps } from "./meetup-next-steps";
import { useLanguage } from "./language-provider";
import { ConfirmedScheduleResponse } from "./confirmed-schedule-response";

function tokyoDateTimeInput(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function MeetupView({ meetupId }: { meetupId: string }) {
  const { language, locale } = useLanguage();
  const korean = language === "ko";
  const displayDate = (value: string) => new Intl.DateTimeFormat(locale, { timeZone: "Asia/Tokyo", month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
  const [detail, setDetail] = useState<MeetupDetail>();
  const [recommendation, setRecommendation] = useState<Recommendation>();
  const [relationships, setRelationships] = useState<RelationshipStat[]>([]);
  const [uid, setUid] = useState<string>();
  const [error, setError] = useState<string>();
  const [busySlot, setBusySlot] = useState<string>();
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [scheduledTimeInput, setScheduledTimeInput] = useState("");

  const refreshRecommendation = useCallback(async () => {
    try {
      setRecommendation(await getRecommendation(meetupId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : korean ? "추천을 계산하지 못했어요." : "おすすめを計算できませんでした。");
    }
  }, [meetupId, korean]);

  useEffect(() => {
    const { auth } = firebase();
    const stopAuth = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid);
      setIsAnonymous(user?.isAnonymous ?? false);
    });
    const stopMeetup = subscribeToMeetup(meetupId, (next) => {
      setDetail(next);
      void refreshRecommendation();
    }, (caught) => setError(caught.message));
    return () => {
      stopAuth();
      stopMeetup();
    };
  }, [meetupId, refreshRecommendation]);

  useEffect(() => {
    if (!uid || isAnonymous) return;
    let cancelled = false;
    void getMeetupRelationships(meetupId)
      .then((next) => { if (!cancelled) setRelationships(next); })
      .catch(() => { if (!cancelled) setRelationships([]); });
    return () => { cancelled = true; };
  }, [detail?.participants.length, isAnonymous, meetupId, uid]);

  const me = detail?.participants.find((participant) => participant.uid === uid);
  const isHost = me?.isHost === true;
  const myVotes = useMemo(() => new Map(detail?.votes.filter((vote) => vote.participantUid === uid).map((vote) => [vote.slotId, vote.status])), [detail?.votes, uid]);

  const vote = async (slotId: string, status: VoteStatus) => {
    setBusySlot(slotId);
    setError(undefined);
    try {
      await submitVote(meetupId, slotId, status);
      await refreshRecommendation();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : korean ? "투표를 저장하지 못했어요." : "投票を保存できませんでした。");
    } finally {
      setBusySlot(undefined);
    }
  };

  const confirm = async () => {
    if (!recommendation?.recommended) return;
    setBusySlot(recommendation.recommended.id);
    setError(undefined);
    try {
      await confirmSchedule(meetupId, recommendation.recommended.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : korean ? "일정을 확정하지 못했어요." : "日程を確定できませんでした。");
    } finally {
      setBusySlot(undefined);
    }
  };

  const changeConfirmedTime = async (value = scheduledTimeInput) => {
    if (!value) return;
    const nextDate = new Date(`${value}:00+09:00`);
    if (Number.isNaN(nextDate.getTime())) {
      setError(korean ? "올바른 날짜와 시간을 입력해 주세요." : "正しい日時を入力してください。");
      return;
    }
    setBusySlot("schedule-change");
    setError(undefined);
    try {
      await updateConfirmedSchedule(meetupId, nextDate.toISOString());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : korean ? "집합 시간을 변경하지 못했어요." : "集合日時を変更できませんでした。");
    } finally {
      setBusySlot(undefined);
    }
  };

  const upgradeAccount = async () => {
    setAccountBusy(true);
    setError(undefined);
    try {
      const user = await continueWithGoogle();
      await saveProfile(user.displayName ?? "aimasho user");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : korean ? "Google 계정 연결을 완료하지 못했어요." : "Googleアカウントを連携できませんでした。");
    } finally {
      setAccountBusy(false);
    }
  };

  if (!detail) return <main className="loading-page"><div className="loader" /><p>{korean ? "약속을 불러오고 있어요..." : "予定を読み込んでいます…"}</p></main>;

  const { meetup, participants, candidateSlots, votes } = detail;
  const confirmed = meetup.status !== "SCHEDULING";
  const confirmedTimeInput = meetup.confirmedDateTime ? tokyoDateTimeInput(meetup.confirmedDateTime) : "";
  const scheduleInputValue = scheduledTimeInput || confirmedTimeInput;

  return <main className="meetup-page">
    <section className="meetup-hero">
      <div className="event-badge">☀</div>
      <p className="eyebrow">{confirmed ? korean ? "일정 확정" : "日程確定" : korean ? "일정 조율 중" : "日程調整中"}</p>
      <h1>{meetup.title}</h1>
      {meetup.description && <p className="hero-description">{meetup.description}</p>}
      {meetup.confirmedDateTime && <div className="confirmed-pill">✓ {displayDate(meetup.confirmedDateTime)} {korean ? "로 확정됐어요" : "に決まりました"}</div>}
      <div className="avatar-row">{participants.slice(0, 5).map((participant, index) => <span className={`avatar tone-${index % 4}`} key={participant.uid}>{participant.displayName.slice(0, 1)}</span>)}<span className="participant-count">{participants.length}{korean ? "명 참여" : "人が参加"}</span></div>
      {relationships.length > 0 && <div className="meetup-relationships">{relationships.map((relationship) => <div className="meetup-relationship" key={relationship.otherUid}><div><b>{relationship.displayName}</b><small>{korean ? `함께한 약속 ${relationship.sharedMeetupCount}회` : `一緒の予定 ${relationship.sharedMeetupCount}回`}</small></div><em>{relationshipLabel(relationship.sharedMeetupCount, korean)}</em></div>)}</div>}
    </section>

    {confirmed && meetup.confirmedDateTime && <ConfirmedScheduleResponse meetupId={meetupId} participants={participants} currentUid={uid} confirmedDateTime={meetup.confirmedDateTime} previousConfirmedDateTime={meetup.previousConfirmedDateTime} />}
    {isHost && !confirmed && <ShareCard meetupId={meetupId} title={meetup.title} />}

    <section className="schedule-section">
      <div className="section-heading"><div><p className="eyebrow">{korean ? "언제" : "いつ"}</p><h2>{confirmed ? korean ? "정해진 일정" : "決まった予定" : korean ? "언제가 좋아요?" : "いつがいい？"}</h2></div><span>{votes.length}/{participants.length * candidateSlots.length} {korean ? "응답" : "回答"}</span></div>
      {candidateSlots.map((slot) => {
        const result = recommendation?.ranking.find((item) => item.id === slot.id);
        const isRecommended = recommendation?.recommended?.id === slot.id && !confirmed;
        const voteGroups = (["YES", "MAYBE", "NO"] as VoteStatus[]).map((status) => ({
          status,
          voters: votes.filter((vote) => vote.slotId === slot.id && vote.status === status).map((vote) => participants.find((participant) => participant.uid === vote.participantUid)?.displayName ?? (korean ? "알 수 없음" : "不明")),
        }));
        return <article className={`slot-card ${isRecommended ? "recommended" : ""} ${meetup.confirmedDateTime === slot.startDateTime ? "confirmed" : ""}`} key={slot.id}>
          <div className="slot-date"><span>{displayDate(slot.startDateTime)}</span>{isRecommended && <b>{korean ? "aimasho 추천" : "aimasho おすすめ"}</b>}</div>
          {result && <div className="vote-summary"><span className="yes">○ {result.yes}</span><span className="maybe">△ {result.maybe}</span><span className="no">× {result.no}</span>{result.no === 0 && result.yes === participants.length && <small>{korean ? "모두 가능해요!" : "全員参加できます！"}</small>}</div>}
          {votes.some((vote) => vote.slotId === slot.id) && <div className="vote-people">{voteGroups.map(({ status, voters }) => voters.length > 0 && <div className={`vote-person-row ${status.toLowerCase()}`} key={status}><b>{status === "YES" ? "○" : status === "MAYBE" ? "△" : "×"}</b>{voters.map((name, index) => <span className="vote-person-chip" key={`${name}-${index}`}>{name}</span>)}</div>)}</div>}
          {!confirmed && me && <VoteButtonGroup value={myVotes.get(slot.id)} onChange={(status) => void vote(slot.id, status)} disabled={busySlot === slot.id} />}
          {confirmed && isHost && meetup.confirmedDateTime !== slot.startDateTime && <button className="text-button schedule-slot-change" type="button" disabled={busySlot === "schedule-change"} onClick={() => { const next = tokyoDateTimeInput(slot.startDateTime); setScheduledTimeInput(next); void changeConfirmedTime(next); }}>{korean ? "이 시간으로 변경" : "この日時に変更"}</button>}
        </article>;
      })}
      {!me && <p className="empty-note">{korean ? "참여하면 투표할 수 있어요." : "参加すると投票できます。"}</p>}
      {confirmed && isHost && <section className="schedule-change-card"><div><p className="eyebrow">{korean ? "호스트 설정" : "ホスト設定"}</p><h3>{korean ? "집합 날짜·시간 변경" : "集合日時を変更"}</h3><p>{korean ? "날짜와 시간은 변경할 수 있어요. 출발·도착 시간 계산과 출발 알림은 현재 비활성화되어 있어요." : "日時は変更できます。出発・到着時刻の計算と出発通知は現在停止しています。"}</p></div><div className="schedule-change-form"><input aria-label={korean ? "집합 날짜와 시간" : "集合日時"} type="datetime-local" value={scheduleInputValue} onChange={(event) => setScheduledTimeInput(event.target.value)} /><button className="secondary-button" type="button" disabled={!scheduleInputValue || busySlot === "schedule-change"} onClick={() => void changeConfirmedTime(scheduleInputValue)}>{busySlot === "schedule-change" ? korean ? "변경 중..." : "変更中…" : korean ? "시간 변경" : "日時を変更"}</button></div></section>}
    </section>

    {!confirmed && isHost && recommendation?.recommended && <section className="recommendation-box"><div><span className="recommendation-star">✦</span><div><p className="eyebrow">{korean ? "AIMASHO 추천" : "AIMASHO おすすめ"}</p><h2>{displayDate(recommendation.recommended.startDateTime)}</h2><p>{korean ? "불가능한 사람이 가장 적고, 가장 많은 친구가 참여할 수 있어요." : "参加できない人が最も少なく、いちばん多くの友だちが参加できます。"}</p></div></div><button className="primary-button" type="button" onClick={confirm} disabled={Boolean(busySlot)}>{korean ? "이 일정으로 결정" : "この日程で決定"}</button></section>}
    <MeetupNextSteps meetupId={meetupId} detail={detail} currentUid={uid} isHost={isHost} onChanged={() => void refreshRecommendation()} />
    {isAnonymous && <section className="account-card"><div><p className="eyebrow">{korean ? "약속을 계속 저장하기" : "予定を保存しよう"}</p><h2>{korean ? "다음 약속도 aimasho에서?" : "次の予定もaimashoで？"}</h2><p>{korean ? "계정을 만들면 이번 약속을 저장하고, 그룹으로 친구들과 더 쉽게 만날 수 있어요." : "アカウントを作るとこの予定を保存し、グループで友だちともっと気軽に会えます。"}</p></div><button className="secondary-button" onClick={() => void upgradeAccount()} disabled={accountBusy}>{accountBusy ? korean ? "연결 중..." : "連携中…" : korean ? "Google로 계속하기" : "Googleで続ける"}</button></section>}
    {error && <p className="error-message page-error" role="alert">{error}</p>}
  </main>;
}
