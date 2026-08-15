"use client";

import { FormEvent, useMemo, useState } from "react";
import { beginLocationSelection, calculateRoutes, confirmMeetingPlace, createExpense, deleteExpense, getMeetingPointRecommendations, getSettlement, saveOrigin, searchPlaces, updateExpense } from "@/services/meetup-repository";
import type { Expense, Location, MeetingPointCandidate, MeetupDetail, Settlement } from "@/types/meetup";
import { useLanguage } from "./language-provider";

function PlaceSearch({ onPick, label }: { onPick: (place: Location) => void; label?: string }) {
  const { language } = useLanguage(); const korean = language === "ko";
  const [query, setQuery] = useState(""); const [places, setPlaces] = useState<Location[]>([]); const [searching, setSearching] = useState(false); const [error, setError] = useState<string>();
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!query.trim()) return; setSearching(true); setError(undefined); try { setPlaces(await searchPlaces(query)); } catch { setPlaces([]); setError(korean ? "장소를 검색하지 못했어요. Google Places 서버 키와 결제·API 설정을 확인해 주세요." : "場所を検索できませんでした。Google Places のサーバーキー、課金、API 設定を確認してください。"); } finally { setSearching(false); } };
  return <div className="place-search"><form onSubmit={submit}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={label ?? (korean ? "역 / 장소 / 주소 검색" : "駅・場所・住所を検索")} /><button type="submit" disabled={searching}>{searching ? korean ? "검색 중" : "検索中" : korean ? "검색" : "検索"}</button></form>{error && <p className="error-message">{error}</p>}{places.length > 0 && <div className="place-results">{places.map((place) => <button type="button" key={place.placeId} onClick={() => { onPick(place); setPlaces([]); }}><strong>{place.name}</strong><small>{place.address}</small></button>)}</div>}</div>;
}

function OriginStep({ meetupId, detail, currentUid, isHost, onChanged }: { meetupId: string; detail: MeetupDetail; currentUid?: string; isHost: boolean; onChanged: () => void }) {
  const { language } = useLanguage(); const korean = language === "ko";
  const [saving, setSaving] = useState(false); const [error, setError] = useState<string>(); const mine = detail.participants.find((participant) => participant.uid === currentUid); const completed = detail.participants.filter((participant) => participant.hasOrigin).length;
  const save = async (origin: Location) => { setSaving(true); setError(undefined); try { await saveOrigin(meetupId, origin); onChanged(); } catch (caught) { setError(caught instanceof Error ? caught.message : korean ? "출발 위치를 저장하지 못했어요." : "出発地を保存できませんでした。"); } finally { setSaving(false); } };
  const proceed = async () => { setSaving(true); try { await beginLocationSelection(meetupId); onChanged(); } catch (caught) { setError(caught instanceof Error ? caught.message : korean ? "장소 선택을 시작하지 못했어요." : "場所選びを開始できませんでした。"); } finally { setSaving(false); } };
  return <section className="next-step"><p className="eyebrow">{korean ? "1단계 · 출발지" : "ステップ 1 · 出発地"}</p><h2>{korean ? "어디서 출발하나요?" : "どこから出発しますか？"}</h2><p className="step-copy">{korean ? "정확한 위치는 다른 참가자에게 보이지 않으며, 모두에게 좋은 장소와 경로 계산에만 사용돼요." : "正確な位置はほかの参加者には表示されません。みんなに合う場所と経路の計算だけに使います。"}</p>{mine?.hasOrigin ? <div className="saved-location">✓ <strong>{mine.originArea ?? (korean ? "출발 위치" : "出発地")}</strong>{korean ? "에서 출발하는 것으로 저장했어요." : "から出発する設定で保存しました。"}</div> : <PlaceSearch onPick={(place) => void save(place)} />}{saving && <p className="inline-note">{korean ? "위치를 저장하고 있어요..." : "場所を保存しています…"}</p>}{error && <p className="error-message">{error}</p>}<div className="origin-progress"><span>{korean ? "출발 위치 등록" : "出発地の登録"}</span><b>{completed}/{detail.participants.length}{korean ? "명" : "人"}</b></div><div className="origin-names">{detail.participants.map((participant) => <span key={participant.uid} className={participant.hasOrigin ? "ready" : ""}>{participant.hasOrigin ? "✓" : "○"} {participant.displayName}</span>)}</div>{isHost && completed >= 2 && <button className="primary-button proceed-button" onClick={() => void proceed()} disabled={saving}>{korean ? "장소 추천으로 계속" : "場所のおすすめへ進む"}</button>}</section>;
}

function LocationStep({ meetupId, isHost, onChanged }: { meetupId: string; isHost: boolean; onChanged: () => void }) {
  const { language } = useLanguage(); const korean = language === "ko";
  const [mode, setMode] = useState<"FAIR" | "FAST">("FAIR"); const [candidates, setCandidates] = useState<MeetingPointCandidate[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState<string>();
  const recommend = async (nextMode = mode) => { setMode(nextMode); setLoading(true); setError(undefined); try { setCandidates(await getMeetingPointRecommendations(meetupId, nextMode)); } catch { setError(korean ? "중간지점 이동 시간을 계산하지 못했어요. 잠시 후 다시 시도해 주세요." : "中間地点までの移動時間を計算できませんでした。少し待ってからもう一度お試しください。"); } finally { setLoading(false); } };
  const choose = async (place: Location) => { setLoading(true); try { await confirmMeetingPlace(meetupId, place); onChanged(); } catch (caught) { setError(caught instanceof Error ? caught.message : korean ? "장소를 확정하지 못했어요." : "場所を確定できませんでした。"); } finally { setLoading(false); } };
  return <section className="next-step"><p className="eyebrow">{korean ? "2단계 · 장소" : "ステップ 2 · 場所"}</p><h2>{korean ? "어디서 만날까요?" : "どこで会いますか？"}</h2>{!isHost ? <p className="step-copy">{korean ? "호스트가 모든 출발 위치를 바탕으로 만날 장소를 고르고 있어요." : "ホストがみんなの出発地をもとに、会う場所を選んでいます。"}</p> : <><p className="step-copy">{korean ? "중간지점은 각자의 이동 시간을 기준으로 추천해요." : "中間地点は、みんなの移動時間をもとにおすすめします。"}</p><div className="mode-toggle"><button className={mode === "FAIR" ? "active" : ""} onClick={() => void recommend("FAIR")}>{korean ? "⚖️ 공평하게" : "⚖️ 公平に"}</button><button className={mode === "FAST" ? "active" : ""} onClick={() => void recommend("FAST")}>{korean ? "⚡ 전체적으로 빠르게" : "⚡ 全体的に早く"}</button></div><button className="secondary-button" onClick={() => void recommend()} disabled={loading}>{loading ? korean ? "추천 계산 중..." : "計算中…" : korean ? "✨ 중간지점 추천" : "✨ 中間地点をおすすめ"}</button><div className="direct-place"><span>{korean ? "또는 직접 장소 정하기" : "または場所を直接決める"}</span><PlaceSearch label={korean ? "장소 검색" : "場所を検索"} onPick={(place) => void choose(place)} /></div>{candidates.map((candidate, index) => <article className="place-candidate" key={candidate.placeId}><div><p>{index === 0 ? korean ? "🥇 AIMASHO 추천" : "🥇 AIMASHO おすすめ" : korean ? `후보 ${index + 1}` : `候補 ${index + 1}`}</p><h3>{candidate.name}</h3><small>{korean ? `평균 ${candidate.averageDurationMinutes}분 · 가장 긴 이동 ${candidate.maxDurationMinutes}분` : `平均 ${candidate.averageDurationMinutes}分 · 最長 ${candidate.maxDurationMinutes}分`}</small></div><button className="primary-button" disabled={loading} onClick={() => void choose(candidate)}>{korean ? "여기서 만나기" : "ここで会う"}</button></article>)}</>}{error && <p className="error-message">{error}</p>}</section>;
}

function RoutesStep({ meetupId, detail, isHost, uid, onChanged }: { meetupId: string; detail: MeetupDetail; isHost: boolean; uid?: string; onChanged: () => void }) {
  const { language, locale } = useLanguage(); const korean = language === "ko"; const clock = (value?: string) => value ? new Intl.DateTimeFormat(locale, { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)) : "—";
  const [loading, setLoading] = useState(false); const [error, setError] = useState<string>(); const calculate = async () => { setLoading(true); try { await calculateRoutes(meetupId); onChanged(); } catch { setError(korean ? "출발 시간을 계산하지 못했어요. 잠시 후 다시 시도해 주세요." : "出発時間を計算できませんでした。少し待ってからもう一度お試しください。"); } finally { setLoading(false); } };
  if (detail.routes.length === 0) return <section className="next-step"><p className="eyebrow">{korean ? "3단계 · 경로" : "ステップ 3 · 経路"}</p><h2>{korean ? "각자의 출발 시간을 계산할게요" : "みんなの出発時間を計算します"}</h2><p className="step-copy">{korean ? `${detail.meetup.meetingPlace?.name}에 약속 10분 전 도착하도록 맞춰드려요.` : `${detail.meetup.meetingPlace?.name}に予定の10分前に着くように計算します。`}</p>{isHost ? <button className="primary-button" onClick={() => void calculate()} disabled={loading}>{loading ? korean ? "경로 계산 중..." : "経路を計算中…" : korean ? "🚃 출발 시간 계산" : "🚃 出発時間を計算"}</button> : <p className="inline-note">{korean ? "호스트가 경로를 계산하면 여기에서 확인할 수 있어요." : "ホストが経路を計算すると、ここで確認できます。"}</p>}{error && <p className="error-message">{error}</p>}</section>;
  const myRoute = detail.routes.find((route) => route.participantUid === uid);
  return <section className="next-step route-step"><p className="eyebrow">{korean ? "준비 완료" : "準備完了"}</p><h2>{detail.meetup.meetingPlace?.name}{korean ? "에서 만나요" : "で会いましょう"}</h2><p className="target-arrival">{korean ? "목표 도착" : "目標到着"} <b>{clock(detail.meetup.targetArrivalTime)}</b></p>{myRoute && <article className="my-route"><p>🚃 <b>{clock(myRoute.departureTime)}{korean ? "에 출발하세요" : "に出発しましょう"}</b></p><h3>{myRoute.routeSummary}</h3><span>{korean ? `약 ${myRoute.durationMinutes}분 · ${clock(myRoute.arrivalTime)} 도착 예정` : `約${myRoute.durationMinutes}分 · ${clock(myRoute.arrivalTime)} 到着予定`}</span>{myRoute.isEstimate && <small className="map-time-note">{korean ? "Google 대중교통 경로를 받지 못해 거리 기반 예상 시간입니다. Google Maps에서 실제 경로를 확인해 주세요." : "Googleの公共交通経路を取得できなかったため、距離に基づく参考時間です。Google Mapsで実際の経路をご確認ください。"}</small>}<a href={myRoute.externalMapsUrl} target="_blank" rel="noreferrer">{korean ? "Google Maps에서 경로 다시 확인 ↗" : "Google Mapsで経路を再確認 ↗"}</a><small className="map-time-note">{korean ? "Google Maps 링크는 계획된 출발 시각을 전달하지 못해 현재 시각 기준으로 표시될 수 있어요. 출발 시각은 위 안내를 기준으로 해주세요." : "Google Mapsのリンクは予定した出発時刻を渡せないため、現在時刻基準で表示されることがあります。出発時刻は上の案内を基準にしてください。"}</small></article>}<div className="route-list">{detail.routes.map((route) => { const participant = detail.participants.find((item) => item.uid === route.participantUid); return <div key={route.participantUid}><span>{participant?.displayName ?? (korean ? "참가자" : "参加者")}</span><b>{clock(route.departureTime)}</b><span>{korean ? `${route.durationMinutes}분` : `${route.durationMinutes}分`}</span><b>{clock(route.arrivalTime)}</b></div>; })}</div></section>;
}

function ExpensesStep({ meetupId, detail, uid }: { meetupId: string; detail: MeetupDetail; uid?: string }) {
  const { language, locale } = useLanguage();
  const korean = language === "ko";
  const yen = (value: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(value);
  const defaultPayer = uid ?? detail.participants[0]?.uid ?? "";
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [paidByUid, setPaidByUid] = useState(defaultPayer);
  const [sharers, setSharers] = useState<string[]>(detail.participants.map((participant) => participant.uid));
  const [editingExpense, setEditingExpense] = useState<Expense>();
  const [saving, setSaving] = useState(false);
  const [settlement, setSettlement] = useState<Settlement>();
  const [error, setError] = useState<string>();
  const names = useMemo(() => new Map(detail.participants.map((participant) => [participant.uid, participant.displayName])), [detail.participants]);

  const clearForm = () => {
    setEditingExpense(undefined);
    setTitle("");
    setAmount("");
    setPaidByUid(defaultPayer);
    setSharers(detail.participants.map((participant) => participant.uid));
  };
  const startEditing = (expense: Expense) => {
    setEditingExpense(expense);
    setTitle(expense.title);
    setAmount(String(expense.amount));
    setPaidByUid(expense.paidByUid);
    setSharers(expense.participantUids);
    setError(undefined);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      const input = { title, amount: Number(amount), paidByUid, participantUids: sharers };
      if (editingExpense) await updateExpense(meetupId, editingExpense.id, input);
      else await createExpense(meetupId, input);
      clearForm();
      setSettlement(await getSettlement(meetupId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : korean ? "비용을 저장하지 못했어요." : "支出を保存できませんでした。");
    } finally {
      setSaving(false);
    }
  };
  const remove = async (expense: Expense) => {
    const confirmed = window.confirm(korean ? `‘${expense.title}’ 지출을 삭제할까요?` : `「${expense.title}」の支出を削除しますか？`);
    if (!confirmed) return;
    setSaving(true);
    setError(undefined);
    try {
      await deleteExpense(meetupId, expense.id);
      if (editingExpense?.id === expense.id) clearForm();
      setSettlement(await getSettlement(meetupId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : korean ? "비용을 삭제하지 못했어요." : "支出を削除できませんでした。");
    } finally {
      setSaving(false);
    }
  };
  const refresh = async () => {
    try {
      setSettlement(await getSettlement(meetupId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : korean ? "정산을 계산하지 못했어요." : "精算を計算できませんでした。");
    }
  };

  return <section className="next-step expenses-step">
    <p className="eyebrow">{korean ? "정산" : "精算"}</p>
    <h2>{korean ? "정산하기" : "精算する"}</h2>
    <p className="step-copy">{korean ? "송금은 직접 진행하고, aimasho는 가장 간단한 정산 경로를 알려드려요." : "送金は直接行い、aimashoは最もシンプルな精算方法を案内します。"}</p>
    <p className="inline-note">{korean ? "등록한 지출은 등록한 사람만 수정하거나 삭제할 수 있어요." : "登録した支出は、登録した本人だけが編集・削除できます。"}</p>
    {editingExpense && <p className="editing-note">{korean ? `‘${editingExpense.title}’ 수정 중` : `「${editingExpense.title}」を編集中`}</p>}
    <form className="expense-form" onSubmit={submit}>
      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={korean ? "항목 · 예: 저녁" : "項目・例：夕食"} required />
      <input type="number" min="1" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={korean ? "금액 (¥)" : "金額 (¥)"} required />
      <select value={paidByUid} onChange={(event) => setPaidByUid(event.target.value)}>{detail.participants.map((participant) => <option key={participant.uid} value={participant.uid}>{participant.displayName}{korean ? " 결제" : "が支払い"}</option>)}</select>
      <div className="sharer-list">{detail.participants.map((participant) => <label key={participant.uid}><input type="checkbox" checked={sharers.includes(participant.uid)} onChange={() => setSharers((current) => current.includes(participant.uid) ? current.filter((id) => id !== participant.uid) : [...current, participant.uid])} /> {participant.displayName}</label>)}</div>
      <div className="expense-form-actions">
        <button className="secondary-button" type="submit" disabled={saving || sharers.length === 0}>{saving ? korean ? "저장 중..." : "保存中…" : editingExpense ? korean ? "지출 수정 저장" : "変更を保存" : korean ? "비용 추가" : "支出を追加"}</button>
        {editingExpense && <button className="text-button" type="button" onClick={clearForm} disabled={saving}>{korean ? "취소" : "キャンセル"}</button>}
      </div>
    </form>
    {detail.expenses.length > 0 && <div className="expense-list">{detail.expenses.map((expense) => {
      const canManage = expense.createdByUid === uid;
      return <article className="expense-item" key={expense.id}>
        <span><strong>{expense.title}</strong><small>{names.get(expense.paidByUid)}{korean ? ` 결제 · ${expense.participantUids.length}명` : `が支払い · ${expense.participantUids.length}人`}</small></span>
        <b>{yen(expense.amount)}</b>
        {canManage && <span className="expense-actions"><button className="text-button" type="button" onClick={() => startEditing(expense)} disabled={saving}>{korean ? "수정" : "編集"}</button><button className="text-button danger-button" type="button" onClick={() => void remove(expense)} disabled={saving}>{korean ? "삭제" : "削除"}</button></span>}
      </article>;
    })}</div>}
    <button className="primary-button" onClick={() => void refresh()} disabled={detail.expenses.length === 0}>{korean ? "정산 결과 보기" : "精算結果を見る"}</button>
    {settlement && <div className="settlement-result"><h3>{korean ? "총" : "合計"} {yen(settlement.totalAmount)}</h3>{settlement.transfers.length === 0 ? <p>{korean ? "모두 정산되었어요!" : "精算は完了しています！"}</p> : settlement.transfers.map((transfer) => <p key={`${transfer.fromUid}-${transfer.toUid}`}><b>{names.get(transfer.fromUid)}</b> → <b>{names.get(transfer.toUid)}</b><span>{yen(transfer.amount)}</span></p>)}</div>}
    {error && <p className="error-message">{error}</p>}
  </section>;
}

export function MeetupNextSteps({ meetupId, detail, currentUid, isHost, onChanged }: { meetupId: string; detail: MeetupDetail; currentUid?: string; isHost: boolean; onChanged: () => void }) {
  if (detail.meetup.status === "SCHEDULE_CONFIRMED" || detail.meetup.status === "LOCATION_COLLECTING") return <OriginStep meetupId={meetupId} detail={detail} currentUid={currentUid} isHost={isHost} onChanged={onChanged} />;
  if (detail.meetup.status === "LOCATION_SELECTING") return <LocationStep meetupId={meetupId} isHost={isHost} onChanged={onChanged} />;
  if (detail.meetup.status === "LOCATION_CONFIRMED") return <RoutesStep meetupId={meetupId} detail={detail} isHost={isHost} uid={currentUid} onChanged={onChanged} />;
  if (detail.meetup.status === "READY") return <><RoutesStep meetupId={meetupId} detail={detail} isHost={isHost} uid={currentUid} onChanged={onChanged} /><ExpensesStep meetupId={meetupId} detail={detail} uid={currentUid} /></>;
  return null;
}
