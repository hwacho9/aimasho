"use client";

import { FormEvent, useId, useMemo, useRef, useState } from "react";
import { cancelMeetup, completeMeetup, createPlanItem, deletePlanItem, reorderPlanItems, searchPlaces, setPlanItemStatus, updatePlanItem, type PlanItemInput } from "@/services/meetup-repository";
import type { Location, MeetupDetail, PlanItem, PlanItemStatus, PlanItemType } from "@/types/meetup";
import { useLanguage } from "./language-provider";
import { PlaceMapPreview } from "./place-map-preview";

const types: Array<{ value: PlanItemType; ko: string; ja: string; icon: string }> = [
  { value: "meet", ko: "집합", ja: "集合", icon: "📍" }, { value: "food", ko: "식사", ja: "食事", icon: "🍽" }, { value: "activity", ko: "활동", ja: "遊び", icon: "✨" }, { value: "cafe", ko: "카페", ja: "カフェ", icon: "☕" }, { value: "move", ko: "이동", ja: "移動", icon: "🚶" }, { value: "other", ko: "기타", ja: "その他", icon: "•" }, { value: "end", ko: "해산", ja: "解散", icon: "👋" },
];

function timeInput(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const part = (kind: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === kind)?.value ?? "";
  return `${part("hour")}:${part("minute")}`;
}

function dateAtTime(baseValue: string | undefined, time: string) {
  const base = baseValue ? new Date(baseValue) : new Date();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(base);
  const part = (kind: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === kind)?.value ?? "";
  return new Date(`${part("year")}-${part("month")}-${part("day")}T${time}:00+09:00`).toISOString();
}

export function EventPlanPanel({ meetupId, detail, isHost }: { meetupId: string; detail: MeetupDetail; isHost: boolean }) {
  const { language, locale } = useLanguage();
  const korean = language === "ko";
  const placeSearchId = useId();
  const canEdit = isHost || detail.meetup.allowPlanEditing === true;
  const [editing, setEditing] = useState<PlanItem>();
  const [title, setTitle] = useState(""); const [type, setType] = useState<PlanItemType>("other"); const [scheduledAt, setScheduledAt] = useState(""); const [note, setNote] = useState("");
  const [placeQuery, setPlaceQuery] = useState(""); const [place, setPlace] = useState<Location>(); const [placeResults, setPlaceResults] = useState<Location[]>([]);
  const [busy, setBusy] = useState(false);
  const [savingForm, setSavingForm] = useState(false);
  const [searching, setSearching] = useState(false);
  const [finishing, setFinishing] = useState<"complete" | "cancel">();
  const mutationPending = useRef(false);
  const searchPending = useRef(false);
  const searchVersion = useRef(0);
  const [error, setError] = useState<string>();
  const [dragId, setDragId] = useState<string>();
  const dateTime = (value?: string) => value ? new Intl.DateTimeFormat(locale, { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)) : korean ? "시간 미정" : "時間未定";
  const reset = () => { searchVersion.current += 1; setEditing(undefined); setTitle(""); setType("other"); setScheduledAt(""); setNote(""); setPlaceQuery(""); setPlace(undefined); setPlaceResults([]); };
  const startEdit = (item: PlanItem) => { if (mutationPending.current) return; searchVersion.current += 1; setEditing(item); setTitle(item.title); setType(item.type); setScheduledAt(timeInput(item.scheduledAt)); setNote(item.note ?? ""); setPlace(item.place); setPlaceQuery(item.place?.name ?? ""); setPlaceResults([]); };
  const input = (): PlanItemInput => ({ type, title: title.trim(), ...(place ? { place } : {}), ...(scheduledAt ? { scheduledAt: dateAtTime(detail.meetup.confirmedDateTime ?? detail.candidateSlots[0]?.startDateTime, scheduledAt) } : {}), ...(note.trim() ? { note: note.trim() } : {}), source: editing?.source ?? "manual" });
  const mutate = async (action: () => Promise<void>) => {
    if (mutationPending.current) return;
    mutationPending.current = true;
    setBusy(true); setError(undefined);
    try { await action(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : korean ? "변경을 저장하지 못했어요. 다시 시도해 주세요." : "変更を保存できませんでした。もう一度お試しください。"); }
    finally { mutationPending.current = false; setBusy(false); setSavingForm(false); setFinishing(undefined); setDragId(undefined); }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || mutationPending.current) return;
    setSavingForm(true);
    await mutate(async () => {
      if (editing) await updatePlanItem(meetupId, editing.id, input());
      else await createPlanItem(meetupId, input());
      reset();
    });
  };
  const findPlace = async () => {
    if (!placeQuery.trim() || searchPending.current) return;
    searchPending.current = true;
    const version = ++searchVersion.current;
    setSearching(true); setError(undefined);
    try { const results = await searchPlaces(placeQuery.trim()); if (version === searchVersion.current) setPlaceResults(results); }
    catch { if (version === searchVersion.current) setError(korean ? "장소를 검색하지 못했어요." : "場所を検索できませんでした。"); }
    finally { searchPending.current = false; setSearching(false); }
  };
  const remove = async (item: PlanItem) => {
    if (mutationPending.current || !window.confirm(korean ? `‘${item.title}’ 항목을 삭제할까요?` : `「${item.title}」を削除しますか？`)) return;
    await mutate(async () => { await deletePlanItem(meetupId, item.id); if (editing?.id === item.id) reset(); });
  };
  const changeStatus = (item: PlanItem, status: PlanItemStatus) => mutate(async () => { await setPlanItemStatus(meetupId, item.id, status); });
  const reorder = async (fromId: string, toId: string) => {
    if (fromId === toId || !canEdit || mutationPending.current) return;
    const ids = detail.planItems.map((item) => item.id);
    const from = ids.indexOf(fromId); const to = ids.indexOf(toId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    await mutate(async () => { await reorderPlanItems(meetupId, ids); });
  };
  const finish = async (action: "complete" | "cancel") => {
    if (mutationPending.current) return;
    setFinishing(action);
    await mutate(async () => { if (action === "complete") await completeMeetup(meetupId); else await cancelMeetup(meetupId); });
  };
  const move = (index: number, direction: -1 | 1) => { const target = index + direction; if (target < 0 || target >= detail.planItems.length) return; void reorder(detail.planItems[index].id, detail.planItems[target].id); };
  const topVotes = useMemo(() => detail.contentOptions.map((option) => ({ option, count: detail.contentVotes.filter((vote) => vote.optionId === option.id).length })).filter((item) => item.count > 0).sort((a, b) => b.count - a.count).slice(0, 3), [detail.contentOptions, detail.contentVotes]);
  if (detail.meetup.status === "CANCELLED") return null;
  return <section className="event-plan-panel"><div className="plan-heading"><div><p className="eyebrow">{korean ? "당일 플랜" : "当日の予定"}</p><h2>{korean ? "그날의 계획" : "当日のプラン"}</h2><p>{korean ? "계획과 실제 진행을 함께 기록해요." : "予定と実際の進行を一緒に記録します。"}</p></div>{isHost && detail.meetup.status !== "COMPLETED" && <div className="event-status-actions"><button type="button" className="text-button" onClick={() => void finish("cancel")} disabled={busy}>{finishing === "cancel" ? korean ? "취소 중..." : "中止中…" : korean ? "약속 취소" : "予定を中止"}</button><button type="button" className="secondary-button" onClick={() => void finish("complete")} disabled={busy}>{finishing === "complete" ? korean ? "완료 처리 중..." : "完了処理中…" : korean ? "약속 완료" : "予定を完了"}</button></div>}</div>
    {detail.meetup.status === "COMPLETED" && <p className="completed-note">✓ {korean ? "완료된 약속은 자동으로 그룹과 친구 히스토리에 남아요." : "完了した予定はグループと友だちの履歴に自動で残ります。"}</p>}
    {topVotes.length > 0 && <div className="plan-vote-hints">{korean ? "투표 결과" : "投票結果"}: {topVotes.map(({ option, count }) => <button type="button" key={option.id} onClick={() => { setTitle(option.label); setType(option.category === "FOOD" ? "food" : "activity"); }} disabled={!canEdit}>{option.label} <b>{count}</b></button>)}</div>}
    {detail.planItems.length === 0 ? <p className="empty-note">{korean ? "아직 등록된 당일 일정이 없어요." : "当日の予定はまだありません。"}</p> : <ol className="plan-list">{detail.planItems.map((item, index) => { const meta = types.find((candidate) => candidate.value === item.type)!; return <li key={item.id} draggable={canEdit && !busy} onDragStart={() => setDragId(item.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragId) void reorder(dragId, item.id); }} className={`plan-item ${item.status}`}><div className="plan-marker">{item.status === "completed" ? "✓" : item.status === "skipped" ? "–" : meta.icon}</div><div className="plan-main"><small>{dateTime(item.scheduledAt)}</small><b>{item.title}</b>{item.note && <p>{item.note}</p>}</div><div className="plan-actions"><select value={item.status} aria-label={korean ? "일정 상태" : "予定の状態"} onChange={(event) => void changeStatus(item, event.target.value as PlanItemStatus)} disabled={busy || detail.meetup.status === "COMPLETED"}><option value="planned">{korean ? "예정" : "予定"}</option><option value="completed">{korean ? "완료" : "完了"}</option><option value="skipped">{korean ? "건너뜀" : "スキップ"}</option></select>{canEdit && detail.meetup.status !== "COMPLETED" && <><span className="plan-move-controls"><button type="button" className="text-button" aria-label={korean ? "위로 이동" : "上へ移動"} disabled={busy || index === 0} onClick={() => move(index, -1)}>↑</button><button type="button" className="text-button" aria-label={korean ? "아래로 이동" : "下へ移動"} disabled={busy || index === detail.planItems.length - 1} onClick={() => move(index, 1)}>↓</button></span><button type="button" className="text-button" disabled={busy} onClick={() => startEdit(item)}>{korean ? "수정" : "編集"}</button><button type="button" className="text-button danger-button" disabled={busy} onClick={() => void remove(item)}>{korean ? "삭제" : "削除"}</button></>}</div>{item.place && <PlaceMapPreview key={item.place.placeId} place={item.place} collapsible />}</li>; })}</ol>}
    {canEdit && detail.meetup.status !== "COMPLETED" && <form className="plan-form" onSubmit={(event) => void save(event)}><h3>{editing ? (korean ? "일정 수정" : "予定を編集") : (korean ? "+ 일정 추가" : "+ 予定を追加")}</h3><div className="plan-form-grid"><label><span>{korean ? "종류" : "種類"}</span><select value={type} onChange={(event) => setType(event.target.value as PlanItemType)}>{types.map((item) => <option value={item.value} key={item.value}>{item.icon} {korean ? item.ko : item.ja}</option>)}</select></label><label><span>{korean ? "시간만 선택" : "時刻だけ選択"}</span><input type="time" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label></div><label><span>{korean ? "제목" : "タイトル"}</span><input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder={korean ? "예: 横浜駅에서 만나기" : "例：横浜駅で集合"} required /></label><div className="plan-place-field"><label htmlFor={placeSearchId}>{korean ? "장소 · 선택" : "場所・任意"}</label><div className="plan-place-search"><input id={placeSearchId} value={placeQuery} onChange={(event) => { searchVersion.current += 1; setPlaceQuery(event.target.value); setPlaceResults([]); setPlace(undefined); }} placeholder={korean ? "장소 검색" : "場所を検索"} /><button type="button" className="secondary-button" onClick={() => void findPlace()} disabled={searching || !placeQuery.trim()} aria-busy={searching}>{searching ? korean ? "검색 중" : "検索中" : korean ? "검색" : "検索"}</button></div></div>{placeResults.length > 0 && <div className="plan-place-results">{placeResults.map((item) => <button key={item.placeId} type="button" onClick={() => { setPlace(item); setPlaceQuery(item.name); setPlaceResults([]); }}><b>{item.name}</b><small>{item.address}</small></button>)}</div>}{place && <PlaceMapPreview key={place.placeId} place={place} />}<label><span>{korean ? "메모 · 선택" : "メモ・任意"}</span><textarea rows={2} value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} /></label><div className="plan-form-actions"><button type="submit" className="secondary-button" disabled={busy}>{savingForm ? korean ? "저장 중..." : "保存中…" : editing ? korean ? "변경 저장" : "変更を保存" : korean ? "일정 추가" : "予定を追加"}</button>{editing && <button type="button" className="text-button" onClick={reset} disabled={busy}>{korean ? "취소" : "キャンセル"}</button>}</div></form>}
    {busy && !savingForm && <p className="action-status" role="status">{korean ? "변경을 저장하고 있어요..." : "変更を保存しています…"}</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
  </section>;
}
