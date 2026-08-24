"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createMeetup } from "@/services/meetup-repository";
import { useAuth } from "./auth-provider";
import { useLanguage } from "./language-provider";

const weekdays = [{ value: 1, ko: "월", ja: "月" }, { value: 2, ko: "화", ja: "火" }, { value: 3, ko: "수", ja: "水" }, { value: 4, ko: "목", ja: "木" }, { value: 5, ko: "금", ja: "金" }, { value: 6, ko: "토", ja: "土" }, { value: 0, ko: "일", ja: "日" }];

function initialSlots() {
  const start = new Date();
  start.setDate(start.getDate() + 7);
  start.setHours(19, 0, 0, 0);
  return [0, 1, 2, 3].map((offset) => {
    const value = new Date(start);
    value.setDate(value.getDate() + offset);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}T19:00`;
  });
}

export function MeetupCreateForm({ roomId }: { roomId?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { language } = useLanguage();
  const korean = language === "ko";
  const [title, setTitle] = useState("");
  const [hostNameInput, setHostNameInput] = useState<string>();
  const hostName = hostNameInput ?? (user && !user.isAnonymous ? user.displayName ?? "" : "");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [slots, setSlots] = useState(initialSlots);
  const [collectOrigins, setCollectOrigins] = useState(true);
  const [allowParticipantSlotAdd, setAllowParticipantSlotAdd] = useState(false);
  const [responseDeadline, setResponseDeadline] = useState("");
  const [scheduleMode, setScheduleMode] = useState<"MANUAL" | "RANGE" | "MONTH" | "NEXT_MONTH">("MANUAL");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [rangeTime, setRangeTime] = useState("19:00");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);
  const [foodVote, setFoodVote] = useState(false);
  const [activityVote, setActivityVote] = useState(false);
  const [allowMultipleContentVotes, setAllowMultipleContentVotes] = useState(false);
  const [allowPlanEditing, setAllowPlanEditing] = useState(false);
  const [error, setError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);

  const canSubmit = useMemo(() => hostName.trim() && title.trim() && slots.some(Boolean), [hostName, title, slots]);
  const updateSlot = (index: number, value: string) => setSlots((current) => current.map((slot, slotIndex) => slotIndex === index ? value : slot));
  const removeSlot = (index: number) => setSlots((current) => current.filter((_, slotIndex) => slotIndex !== index));
  const toggleWeekday = (weekday: number) => setSelectedWeekdays((current) => current.includes(weekday) ? current.filter((item) => item !== weekday) : [...current, weekday]);
  const generateSlots = () => {
    const now = new Date();
    let start: Date;
    let end: Date;
    if (scheduleMode === "RANGE") {
      if (!rangeStart || !rangeEnd) return;
      start = new Date(`${rangeStart}T${rangeTime}`);
      end = new Date(`${rangeEnd}T${rangeTime}`);
    } else {
      const sourceMonth = scheduleMode === "NEXT_MONTH" ? new Date(now.getFullYear(), now.getMonth() + 1, 1) : new Date(`${month}-01T${rangeTime}`);
      start = new Date(sourceMonth.getFullYear(), sourceMonth.getMonth(), 1, Number(rangeTime.slice(0, 2)), Number(rangeTime.slice(3)));
      end = new Date(sourceMonth.getFullYear(), sourceMonth.getMonth() + 1, 0, Number(rangeTime.slice(0, 2)), Number(rangeTime.slice(3)));
    }
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end || selectedWeekdays.length === 0) return;
    const generated: string[] = [];
    for (const cursor = new Date(start); cursor <= end && generated.length < 12; cursor.setDate(cursor.getDate() + 1)) {
      if (!selectedWeekdays.includes(cursor.getDay())) continue;
      generated.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}T${rangeTime}`);
    }
    setSlots(generated);
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined); setIsSaving(true);
    try {
      const candidateSlots = slots.filter(Boolean).map((slot) => new Date(slot).toISOString());
      const scheduleCondition = scheduleMode === "MANUAL" ? { mode: "MANUAL" as const } : {
        mode: scheduleMode,
        ...(scheduleMode === "RANGE" && rangeStart ? { rangeStart: new Date(`${rangeStart}T${rangeTime}`).toISOString() } : {}),
        ...(scheduleMode === "RANGE" && rangeEnd ? { rangeEnd: new Date(`${rangeEnd}T${rangeTime}`).toISOString() } : {}),
        weekdayNumbers: selectedWeekdays,
      };
      const trimmedDescription = description.trim();
      const meetupId = await createMeetup({ hostName, title, ...(trimmedDescription ? { description: trimmedDescription } : {}), durationMinutes, candidateSlots, roomId, collectOrigins, allowParticipantSlotAdd, responseDeadline: responseDeadline ? new Date(responseDeadline).toISOString() : undefined, scheduleCondition, contentVoteConfig: { food: foodVote, activity: activityVote, allowMultiple: allowMultipleContentVotes, allowParticipantOptions: true }, allowPlanEditing });
      router.push(`/m/${meetupId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : korean ? "약속을 만들지 못했어요. 다시 시도해주세요." : "予定を作成できませんでした。もう一度お試しください。");
      setIsSaving(false);
    }
  }

  return <form className="stack-lg" onSubmit={submit}>
    {roomId && <p className="room-context">{korean ? "이 그룹의 멤버가 자동으로 약속에 참여해요." : "このグループのメンバーが自動的に予定へ参加します。"}</p>}
    <label className="field small-field"><span>{korean ? "내 이름" : "あなたの名前"}</span><input value={hostName} onChange={(event) => setHostNameInput(event.target.value)} maxLength={60} placeholder={korean ? "예: 민수" : "例：たなか"} required /></label>
    <label className="field"><span>{korean ? "약속 이름" : "予定の名前"}</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} placeholder={korean ? "예: 친구들과 저녁" : "例：大学の友だちと夜ごはん"} required /></label>
    <label className="field"><span>{korean ? <>설명 <em>선택</em></> : <>説明 <em>任意</em></>}</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder={korean ? "비워두어도 괜찮아요" : "空欄でも作成できます"} rows={3} /></label>
    <label className="field small-field"><span>{korean ? "예상 약속 시간" : "予定時間"}</span><select value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))}><option value={60}>{korean ? "1시간" : "1時間"}</option><option value={90}>{korean ? "1시간 30분" : "1時間30分"}</option><option value={120}>{korean ? "2시간" : "2時間"}</option><option value={180}>{korean ? "3시간" : "3時間"}</option><option value={240}>{korean ? "4시간" : "4時間"}</option></select></label>
    <section className="slot-fields" aria-labelledby="slot-heading"><div className="section-heading"><div><p className="eyebrow">{korean ? "언제" : "いつ"}</p><h2 id="slot-heading">{korean ? "후보 날짜와 시간" : "候補の日時"}</h2></div><span>{slots.length}/12</span></div><label className="field small-field"><span>{korean ? "후보 만들기 방식" : "候補の作り方"}</span><select value={scheduleMode} onChange={(event) => setScheduleMode(event.target.value as typeof scheduleMode)}><option value="MANUAL">{korean ? "직접 날짜·시간 입력" : "日時を直接入力"}</option><option value="RANGE">{korean ? "기간과 요일로 생성" : "期間・曜日から作成"}</option><option value="MONTH">{korean ? "월 단위로 생성" : "月単位で作成"}</option><option value="NEXT_MONTH">{korean ? "다음 달로 생성" : "来月から作成"}</option></select></label>{scheduleMode !== "MANUAL" && <div className="condition-builder">{scheduleMode === "RANGE" ? <><label><span>{korean ? "시작일" : "開始日"}</span><input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} required /></label><label><span>{korean ? "마지막 날" : "終了日"}</span><input type="date" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} required /></label></> : scheduleMode === "MONTH" ? <label><span>{korean ? "대상 월" : "対象月"}</span><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label> : <p className="inline-note">{korean ? "다음 달의 가능한 요일로 후보를 만들어요." : "来月の選択した曜日から候補を作ります。"}</p>}<label><span>{korean ? "시간" : "時刻"}</span><input type="time" value={rangeTime} onChange={(event) => setRangeTime(event.target.value)} /></label><div className="weekday-toggle">{weekdays.map((weekday) => <label key={weekday.value}><input type="checkbox" checked={selectedWeekdays.includes(weekday.value)} onChange={() => toggleWeekday(weekday.value)} />{korean ? weekday.ko : weekday.ja}</label>)}</div><button type="button" className="secondary-button" onClick={generateSlots}>{korean ? "조건으로 후보 만들기" : "条件から候補を作る"}</button></div>}{slots.map((slot, index) => <div className="date-row" key={`${index}-${slot}`}><span className="slot-index">{index + 1}</span><input type="datetime-local" value={slot} onChange={(event) => updateSlot(index, event.target.value)} required />{slots.length > 1 && <button className="icon-button" onClick={() => removeSlot(index)} type="button" aria-label={korean ? `${index + 1}번째 후보 삭제` : `${index + 1}番目の候補を削除`}>×</button>}</div>)}{slots.length < 12 && <button className="add-row" onClick={() => setSlots((current) => [...current, ""])} type="button">{korean ? "＋ 후보 추가" : "＋ 候補を追加"}</button>}</section>
    <section className="event-options"><p className="eyebrow">{korean ? "모임 설정" : "予定の設定"}</p><label className="option-toggle"><input type="checkbox" checked={collectOrigins} onChange={(event) => setCollectOrigins(event.target.checked)} /><span><b>{korean ? "참가자 출발지 받기" : "参加者に出発地を入力してもらう"}</b><small>{korean ? "장소 추천에만 사용하고 정확한 좌표는 공개하지 않아요." : "場所のおすすめにのみ使い、正確な座標は公開しません。"}</small></span></label><label className="option-toggle"><input type="checkbox" checked={allowParticipantSlotAdd} onChange={(event) => setAllowParticipantSlotAdd(event.target.checked)} /><span><b>{korean ? "참가자의 후보 날짜 추가 허용" : "参加者による候補日の追加を許可"}</b><small>{korean ? "참가자가 직접 새 날짜·시간 후보를 제안할 수 있어요." : "参加者も新しい日時候補を提案できます。"}</small></span></label><label className="field small-field"><span>{korean ? <>응답 마감 <em>선택</em></> : <>回答期限 <em>任意</em></>}</span><input type="datetime-local" value={responseDeadline} onChange={(event) => setResponseDeadline(event.target.value)} /></label></section>
    <section className="event-options"><p className="eyebrow">{korean ? "내용 투표" : "内容投票"}</p><label className="option-toggle"><input type="checkbox" checked={foodVote} onChange={(event) => setFoodVote(event.target.checked)} /><span><b>{korean ? "식사 투표" : "食事投票"}</b><small>{korean ? "무엇을 먹을지 함께 고를 수 있어요." : "何を食べるか一緒に選べます。"}</small></span></label><label className="option-toggle"><input type="checkbox" checked={activityVote} onChange={(event) => setActivityVote(event.target.checked)} /><span><b>{korean ? "놀이·활동 투표" : "遊び・アクティビティ投票"}</b><small>{korean ? "무엇을 할지 함께 고를 수 있어요." : "何をするか一緒に選べます。"}</small></span></label>{(foodVote || activityVote) && <label className="option-toggle"><input type="checkbox" checked={allowMultipleContentVotes} onChange={(event) => setAllowMultipleContentVotes(event.target.checked)} /><span><b>{korean ? "복수 선택 허용" : "複数選択を許可"}</b><small>{korean ? "끄면 식사와 활동에서 각각 하나만 선택할 수 있어요." : "オフの場合、食事・活動ごとに一つだけ選べます。"}</small></span></label>}</section>
    <section className="event-options"><p className="eyebrow">{korean ? "당일 플랜" : "当日の予定"}</p><label className="option-toggle"><input type="checkbox" checked={allowPlanEditing} onChange={(event) => setAllowPlanEditing(event.target.checked)} /><span><b>{korean ? "참가자도 플랜을 편집할 수 있게 하기" : "参加者も予定を編集できるようにする"}</b><small>{korean ? "끄면 호스트만 항목을 추가·수정·순서 변경할 수 있어요." : "オフの場合、追加・編集・並べ替えはホストのみ可能です。"}</small></span></label></section>
    {error && <p className="error-message" role="alert">{error}</p>}
    <button className="primary-button" type="submit" disabled={!canSubmit || isSaving}>{isSaving ? korean ? "만드는 중..." : "作成中…" : korean ? "약속 만들기" : "予定をつくる"}</button>
  </form>;
}
