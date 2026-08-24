"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { addCandidateSlot, confirmSchedule, deleteMeetup, getMeetupRelationships, saveProfile, submitVote, subscribeToMeetup, updateConfirmedSchedule } from "@/services/meetup-repository";
import { continueWithGoogle, firebase } from "@/lib/firebase/client";
import { relationshipLabel } from "@/lib/relationship-label";
import { rankSchedule } from "@/lib/schedule-ranking";
import type { AvailabilityVote, MeetupDetail, RelationshipStat, VoteStatus } from "@/types/meetup";
import { VoteButtonGroup } from "./vote-button";
import { ShareCard } from "./share-card";
import { MeetupNextSteps } from "./meetup-next-steps";
import { useLanguage } from "./language-provider";
import { ConfirmedScheduleResponse } from "./confirmed-schedule-response";
import { ContentVotingPanel } from "./content-voting-panel";
import { EventPlanPanel } from "./event-plan-panel";
import { CalendarOverlay } from "./calendar-overlay";

function SlotVoteEditor({ vote, onVote, disabled }: { vote?: AvailabilityVote; onVote: (status: VoteStatus, comment: string) => void; disabled: boolean }) {
  const { language } = useLanguage();
  const korean = language === "ko";
  const [comment, setComment] = useState(vote?.comment ?? "");
  return <div className="slot-vote-editor"><VoteButtonGroup value={vote?.status} onChange={(status) => onVote(status, comment)} disabled={disabled} /><label><span>{korean ? "댓글 · 선택" : "コメント・任意"}</span><textarea value={comment} maxLength={240} rows={2} onChange={(event) => setComment(event.target.value)} placeholder={korean ? "예: 18시 이후라면 가능해요" : "例：18時以降なら大丈夫です"} /></label>{vote && <button className="text-button" type="button" onClick={() => onVote(vote.status, comment)} disabled={disabled}>{korean ? "댓글 저장" : "コメントを保存"}</button>}</div>;
}

function tokyoDateTimeInput(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function MeetupView({ meetupId }: { meetupId: string }) {
  const router = useRouter();
  const { language, locale } = useLanguage();
  const korean = language === "ko";
  const displayDate = (value: string) => new Intl.DateTimeFormat(locale, { timeZone: "Asia/Tokyo", month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
  const [detail, setDetail] = useState<MeetupDetail>();
  const [relationships, setRelationships] = useState<RelationshipStat[]>([]);
  const [uid, setUid] = useState<string>();
  const [error, setError] = useState<string>();
  const [busySlot, setBusySlot] = useState<string>();
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [scheduledTimeInput, setScheduledTimeInput] = useState("");
  const [newCandidateDateTime, setNewCandidateDateTime] = useState("");
  const [candidateBusy, setCandidateBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const participantCount = detail?.participants.length;
  const recommendation = useMemo(
    () => detail ? rankSchedule(detail.candidateSlots, detail.votes, detail.participants.length) : { recommended: null, ranking: [] },
    [detail],
  );

  useEffect(() => {
    const { auth } = firebase();
    const stopAuth = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid);
      setIsAnonymous(user?.isAnonymous ?? false);
    });
    const stopMeetup = subscribeToMeetup(meetupId, (next) => {
      setDetail(next);
    }, (caught) => setError(caught.message));
    return () => {
      stopAuth();
      stopMeetup();
    };
  }, [meetupId]);

  useEffect(() => {
    if (!uid || isAnonymous || participantCount === undefined) return;
    let cancelled = false;
    void getMeetupRelationships(meetupId)
      .then((next) => { if (!cancelled) setRelationships(next); })
      .catch(() => { if (!cancelled) setRelationships([]); });
    return () => { cancelled = true; };
  }, [isAnonymous, meetupId, participantCount, uid]);

  const me = detail?.participants.find((participant) => participant.uid === uid);
  const isHost = me?.isHost === true;
  const vote = async (slotId: string, status: VoteStatus, comment = "") => {
    setBusySlot(slotId);
    setError(undefined);
    try {
      await submitVote(meetupId, slotId, status, comment);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : korean ? "투표를 저장하지 못했어요." : "投票を保存できませんでした。");
    } finally {
      setBusySlot(undefined);
    }
  };

  const addCandidate = async () => {
    if (!newCandidateDateTime) return;
    setCandidateBusy(true);
    setError(undefined);
    try {
      await addCandidateSlot(meetupId, new Date(`${newCandidateDateTime}:00+09:00`).toISOString());
      setNewCandidateDateTime("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : korean ? "후보 날짜를 추가하지 못했어요." : "候補日時を追加できませんでした。");
    } finally {
      setCandidateBusy(false);
    }
  };

  const confirm = async (slotId: string) => {
    setBusySlot(slotId);
    setError(undefined);
    try {
      await confirmSchedule(meetupId, slotId);
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

  const removeMeetup = async () => {
    const confirmed = window.confirm(korean
      ? "이 일정을 삭제할까요? 투표, 플랜, 정산을 포함한 모든 내용이 삭제되며 되돌릴 수 없어요."
      : "この予定を削除しますか？投票、プラン、精算を含むすべての内容が削除され、元に戻せません。");
    if (!confirmed) return;
    setDeleting(true);
    setError(undefined);
    try {
      await deleteMeetup(meetupId);
      router.replace("/profile");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : korean ? "일정을 삭제하지 못했어요." : "予定を削除できませんでした。");
      setDeleting(false);
    }
  };

  if (!detail) return <main className="loading-page"><div className="loader" /><p>{korean ? "약속을 불러오고 있어요..." : "予定を読み込んでいます…"}</p></main>;

  const { meetup, participants, candidateSlots, votes } = detail;
  const cancelled = meetup.status === "CANCELLED";
  const confirmed = meetup.status !== "SCHEDULING" && !cancelled;
  const finished = meetup.status === "COMPLETED" || cancelled;
  const confirmedTimeInput = meetup.confirmedDateTime ? tokyoDateTimeInput(meetup.confirmedDateTime) : "";
  const scheduleInputValue = scheduledTimeInput || confirmedTimeInput;
  const renderVoteSlot = (slot: (typeof candidateSlots)[number]) => {
    const result = recommendation?.ranking.find((item) => item.id === slot.id);
    const isRecommended = recommendation?.recommended?.id === slot.id && !confirmed;
    const voteGroups = (["YES", "MAYBE", "NO"] as VoteStatus[]).map((status) => ({ status, voters: votes.filter((vote) => vote.slotId === slot.id && vote.status === status) }));
    const myVote = votes.find((vote) => vote.slotId === slot.id && vote.participantUid === uid);
    const creator = slot.createdByUid ? participants.find((participant) => participant.uid === slot.createdByUid) : undefined;
    const isChosen = meetup.confirmedDateTime === slot.startDateTime;
    return <article className={`slot-card ${isRecommended ? "recommended" : ""} ${isChosen ? "confirmed" : ""}`} key={slot.id}>
      <div className="slot-date"><span>{displayDate(slot.startDateTime)}</span>{isChosen ? <b>{korean ? "결정된 일정" : "決定した日程"}</b> : isRecommended ? <b>{korean ? "aimasho 추천" : "aimasho おすすめ"}</b> : null}</div>
      {creator && creator.uid !== meetup.createdByUid && <p className="candidate-owner">{korean ? `${creator.displayName}님이 제안` : `${creator.displayName}さんが提案`}</p>}
      {result && <div className="vote-summary"><span className="yes">○ {result.yes}</span><span className="maybe">△ {result.maybe}</span><span className="no">× {result.no}</span>{result.no === 0 && result.yes === participants.length && <small>{korean ? "모두 가능해요!" : "全員参加できます！"}</small>}</div>}
      {votes.some((vote) => vote.slotId === slot.id) && <div className="vote-people">{voteGroups.map(({ status, voters: grouped }) => grouped.length > 0 && <div className={`vote-person-row ${status.toLowerCase()}`} key={status}><b>{status === "YES" ? "○" : status === "MAYBE" ? "△" : "×"}</b>{grouped.map((item) => <span className="vote-person-chip" key={item.participantUid}><strong>{participants.find((participant) => participant.uid === item.participantUid)?.displayName ?? (korean ? "알 수 없음" : "不明")}</strong>{item.comment && <small>“{item.comment}”</small>}</span>)}</div>)}</div>}
      {me && !finished && <SlotVoteEditor vote={myVote} onVote={(status, comment) => void vote(slot.id, status, comment)} disabled={busySlot === slot.id} />}
      {!confirmed && isHost && <button className="text-button schedule-slot-change" type="button" disabled={Boolean(busySlot)} onClick={() => void confirm(slot.id)}>{busySlot === slot.id ? korean ? "확정 중..." : "確定中…" : korean ? "이 일정으로 결정" : "この日程で決定"}</button>}
      {confirmed && isHost && !finished && !isChosen && <button className="text-button schedule-slot-change" type="button" disabled={busySlot === "schedule-change"} onClick={() => { const next = tokyoDateTimeInput(slot.startDateTime); setScheduledTimeInput(next); void changeConfirmedTime(next); }}>{korean ? "이 시간으로 변경" : "この日時に変更"}</button>}
    </article>;
  };
  const candidateAddCard = (isHost || meetup.allowParticipantSlotAdd) && me && !finished ? <section className="candidate-add-card"><div><p className="eyebrow">{korean ? "후보 제안" : "候補を提案"}</p><h3>{korean ? "새 날짜·시간 추가" : "新しい日時を追加"}</h3><p>{korean ? "확정 후에도 후보를 추가하고 투표 결과를 다시 정리할 수 있어요." : "確定後も候補を追加し、投票結果を見直せます。"}</p></div><div><input type="datetime-local" aria-label={korean ? "새 후보 날짜와 시간" : "新しい候補日時"} value={newCandidateDateTime} onChange={(event) => setNewCandidateDateTime(event.target.value)} /><button className="secondary-button" type="button" disabled={!newCandidateDateTime || candidateBusy} onClick={() => void addCandidate()}>{candidateBusy ? korean ? "추가 중..." : "追加中…" : korean ? "후보 추가" : "候補を追加"}</button></div></section> : null;

  return <main className="meetup-page">
    <section className="meetup-hero">
      <div className="event-badge">☀</div>
      <p className="eyebrow">{cancelled ? korean ? "약속 취소" : "予定中止" : confirmed ? korean ? "일정 확정" : "日程確定" : korean ? "일정 조율 중" : "日程調整中"}</p>
      <h1>{meetup.title}</h1>
      {meetup.description && <p className="hero-description">{meetup.description}</p>}
      {cancelled ? <div className="confirmed-pill cancelled-pill">{korean ? "이 약속은 취소됐어요" : "この予定は中止されました"}</div> : meetup.confirmedDateTime && <div className="confirmed-pill">✓ {displayDate(meetup.confirmedDateTime)} {korean ? "로 확정됐어요" : "に決まりました"}</div>}
      <div className="avatar-row">{participants.slice(0, 5).map((participant, index) => <span className={`avatar tone-${index % 4}`} key={participant.uid}>{participant.displayName.slice(0, 1)}</span>)}<span className="participant-count">{participants.length}{korean ? "명 참여" : "人が参加"}</span></div>
      {relationships.length > 0 && <div className="meetup-relationships">{relationships.map((relationship) => <div className="meetup-relationship" key={relationship.otherUid}><div><b>{relationship.displayName}</b><small>{korean ? `함께한 약속 ${relationship.sharedMeetupCount}회` : `一緒の予定 ${relationship.sharedMeetupCount}回`}</small></div><em>{relationshipLabel(relationship.sharedMeetupCount, korean)}</em></div>)}</div>}
    </section>

    {confirmed && !finished && meetup.confirmedDateTime && <ConfirmedScheduleResponse meetupId={meetupId} participants={participants} currentUid={uid} confirmedDateTime={meetup.confirmedDateTime} previousConfirmedDateTime={meetup.previousConfirmedDateTime} />}
    <ShareCard meetupId={meetupId} title={meetup.title} />

    <section className="schedule-section">
      <div className="section-heading"><div><p className="eyebrow">{korean ? "언제" : "いつ"}</p><h2>{cancelled ? korean ? "취소된 일정" : "中止された予定" : confirmed ? korean ? "정해진 일정" : "決まった予定" : korean ? "언제가 좋아요?" : "いつがいい？"}</h2></div><span>{votes.length}/{participants.length * candidateSlots.length} {korean ? "응답" : "回答"}</span></div>
      {!confirmed && meetup.responseDeadline && <p className="response-deadline">{korean ? "응답 마감" : "回答期限"} <b>{displayDate(meetup.responseDeadline)}</b></p>}
      {confirmed && meetup.confirmedDateTime ? <article className="finalized-schedule"><span className="finalized-date-mark">✓</span><div><p>{korean ? "결정된 일정" : "決定した日程"}</p><h3>{displayDate(meetup.confirmedDateTime)}</h3><small>{meetup.meetingPlace ? `📍 ${meetup.meetingPlace.name}` : korean ? "장소는 별도로 계속 정할 수 있어요" : "場所は別に引き続き決められます"}</small></div></article> : candidateSlots.map(renderVoteSlot)}
      {confirmed && <details className="schedule-wrapup"><summary><span>{korean ? "투표 결과와 다른 후보" : "投票結果と他の候補"}</span><b>{candidateSlots.length}{korean ? "개 후보 · 언제든 다시 수정" : "件・いつでも再編集"}</b></summary><div className="schedule-wrapup-content">{candidateSlots.map(renderVoteSlot)}{candidateAddCard}</div></details>}
      {!confirmed && candidateAddCard}
      {!me && <p className="empty-note">{korean ? "참여하면 투표할 수 있어요." : "参加すると投票できます。"}</p>}
      {confirmed && isHost && !finished && <section className="schedule-change-card"><div><p className="eyebrow">{korean ? "호스트 설정" : "ホスト設定"}</p><h3>{korean ? "집합 날짜·시간 변경" : "集合日時を変更"}</h3><p>{korean ? "날짜와 시간은 언제든 바꿀 수 있고, 장소와 당일 플랜도 독립적으로 수정할 수 있어요." : "日時はいつでも変更でき、場所と当日のプランも個別に編集できます。"}</p></div><div className="schedule-change-form"><input aria-label={korean ? "집합 날짜와 시간" : "集合日時"} type="datetime-local" value={scheduleInputValue} onChange={(event) => setScheduledTimeInput(event.target.value)} /><button className="secondary-button" type="button" disabled={!scheduleInputValue || busySlot === "schedule-change"} onClick={() => void changeConfirmedTime(scheduleInputValue)}>{busySlot === "schedule-change" ? korean ? "변경 중..." : "変更中…" : korean ? "시간 변경" : "日時を変更"}</button></div></section>}
    </section>

    {!confirmed && isHost && recommendation?.recommended && <section className="recommendation-box"><div><span className="recommendation-star">✦</span><div><p className="eyebrow">{korean ? "AIMASHO 추천" : "AIMASHO おすすめ"}</p><h2>{displayDate(recommendation.recommended.startDateTime)}</h2><p>{korean ? "불가능한 사람이 가장 적고, 가장 많은 친구가 참여할 수 있어요." : "参加できない人が最も少なく、いちばん多くの友だちが参加できます。"}</p></div></div><button className="primary-button" type="button" onClick={() => void confirm(recommendation.recommended!.id)} disabled={Boolean(busySlot)}>{korean ? "추천 일정으로 결정" : "おすすめの日程で決定"}</button></section>}
    <CalendarOverlay detail={detail} />
    <ContentVotingPanel meetupId={meetupId} detail={detail} currentUid={uid} />
    <MeetupNextSteps meetupId={meetupId} detail={detail} currentUid={uid} isHost={isHost} />
    <EventPlanPanel meetupId={meetupId} detail={detail} isHost={isHost} />
    {isAnonymous && <section className="account-card"><div><p className="eyebrow">{korean ? "약속을 계속 저장하기" : "予定を保存しよう"}</p><h2>{korean ? "다음 약속도 aimasho에서?" : "次の予定もaimashoで？"}</h2><p>{korean ? "계정을 만들면 이번 약속을 저장하고, 그룹으로 친구들과 더 쉽게 만날 수 있어요." : "アカウントを作るとこの予定を保存し、グループで友だちともっと気軽に会えます。"}</p></div><button className="secondary-button" onClick={() => void upgradeAccount()} disabled={accountBusy}>{accountBusy ? korean ? "연결 중..." : "連携中…" : korean ? "Google로 계속하기" : "Googleで続ける"}</button></section>}
    {isHost && <section className="danger-zone"><div><p className="eyebrow">{korean ? "일정 관리" : "予定の管理"}</p><h2>{korean ? "이 일정 삭제" : "この予定を削除"}</h2><p>{korean ? "투표, 플랜, 정산을 포함한 일정 전체가 영구 삭제됩니다." : "投票、プラン、精算を含む予定全体が完全に削除されます。"}</p></div><button className="danger-button" type="button" onClick={() => void removeMeetup()} disabled={deleting}>{deleting ? korean ? "삭제 중..." : "削除中…" : korean ? "일정 삭제" : "予定を削除"}</button></section>}
    {error && <p className="error-message page-error" role="alert">{error}</p>}
  </main>;
}
