"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createMeetup } from "@/services/meetup-repository";
import { useLanguage } from "./language-provider";

const defaultSlots = ["2026-08-21T19:00", "2026-08-22T18:00", "2026-08-22T19:00", "2026-08-23T18:00"];

export function MeetupCreateForm({ roomId }: { roomId?: string }) {
  const router = useRouter();
  const { language } = useLanguage();
  const korean = language === "ko";
  const [title, setTitle] = useState("");
  const [hostName, setHostName] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [slots, setSlots] = useState(defaultSlots);
  const [error, setError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const canSubmit = useMemo(() => hostName.trim() && title.trim() && slots.some(Boolean), [hostName, title, slots]);
  const updateSlot = (index: number, value: string) => setSlots((current) => current.map((slot, slotIndex) => slotIndex === index ? value : slot));
  const removeSlot = (index: number) => setSlots((current) => current.filter((_, slotIndex) => slotIndex !== index));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined); setIsSaving(true);
    try {
      const candidateSlots = slots.filter(Boolean).map((slot) => new Date(slot).toISOString());
      const meetupId = await createMeetup({ hostName, title, description: description || undefined, durationMinutes, candidateSlots, roomId });
      router.push(`/m/${meetupId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : korean ? "약속을 만들지 못했어요. 다시 시도해주세요." : "予定を作成できませんでした。もう一度お試しください。");
      setIsSaving(false);
    }
  }

  return <form className="stack-lg" onSubmit={submit}>
    {roomId && <p className="room-context">{korean ? "이 그룹의 멤버가 자동으로 약속에 참여해요." : "このグループのメンバーが自動的に予定へ参加します。"}</p>}
    <label className="field small-field"><span>{korean ? "내 이름" : "あなたの名前"}</span><input value={hostName} onChange={(event) => setHostName(event.target.value)} maxLength={60} placeholder={korean ? "예: 민수" : "例：たなか"} required /></label>
    <label className="field"><span>{korean ? "약속 이름" : "予定の名前"}</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} placeholder={korean ? "예: 친구들과 저녁" : "例：大学の友だちと夜ごはん"} required /></label>
    <label className="field"><span>{korean ? <>한마디 <em>선택</em></> : <>ひとこと <em>任意</em></>}</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder={korean ? "무엇을 할까요?" : "何をしますか？"} rows={3} /></label>
    <label className="field small-field"><span>{korean ? "예상 약속 시간" : "予定時間"}</span><select value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))}><option value={60}>{korean ? "1시간" : "1時間"}</option><option value={90}>{korean ? "1시간 30분" : "1時間30分"}</option><option value={120}>{korean ? "2시간" : "2時間"}</option><option value={180}>{korean ? "3시간" : "3時間"}</option><option value={240}>{korean ? "4시간" : "4時間"}</option></select></label>
    <section className="slot-fields" aria-labelledby="slot-heading"><div className="section-heading"><div><p className="eyebrow">{korean ? "언제" : "いつ"}</p><h2 id="slot-heading">{korean ? "후보 날짜와 시간" : "候補の日時"}</h2></div><span>{slots.length}/12</span></div>{slots.map((slot, index) => <div className="date-row" key={`${index}-${slot}`}><span className="slot-index">{index + 1}</span><input type="datetime-local" value={slot} onChange={(event) => updateSlot(index, event.target.value)} required />{slots.length > 1 && <button className="icon-button" onClick={() => removeSlot(index)} type="button" aria-label={korean ? `${index + 1}번째 후보 삭제` : `${index + 1}番目の候補を削除`}>×</button>}</div>)}{slots.length < 12 && <button className="add-row" onClick={() => setSlots((current) => [...current, ""])} type="button">{korean ? "＋ 후보 추가" : "＋ 候補を追加"}</button>}</section>
    {error && <p className="error-message" role="alert">{error}</p>}
    <button className="primary-button" type="submit" disabled={!canSubmit || isSaving}>{isSaving ? korean ? "만드는 중..." : "作成中…" : korean ? "약속 만들기" : "予定をつくる"}</button>
  </form>;
}
