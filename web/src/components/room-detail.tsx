"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getRoomDetail } from "@/services/meetup-repository";
import type { HistoryMeetup, PlaceVisit } from "@/types/meetup";
import { useLanguage } from "./language-provider";

type HistoryFilter = "ALL" | "UPCOMING" | "PAST" | "CANCELLED";
type ShareStatus = "SHARED" | "COPIED" | "ERROR";

function meetupState(meetup: HistoryMeetup, korean: boolean) {
  if (meetup.status === "COMPLETED") return korean ? "지난 약속" : "過去";
  if (meetup.status === "CANCELLED") return korean ? "취소됨" : "中止";
  return korean ? "예정" : "予定";
}

export function RoomDetail({ roomId }: { roomId: string }) {
  const { language, locale } = useLanguage(); const korean = language === "ko";
  const [data, setData] = useState<Awaited<ReturnType<typeof getRoomDetail>>>(); const [error, setError] = useState<string>();
  const [filter, setFilter] = useState<HistoryFilter>("ALL"); const [view, setView] = useState<"LIST" | "MAP">("LIST"); const [selectedPlace, setSelectedPlace] = useState<PlaceVisit>();
  const [shareStatus, setShareStatus] = useState<ShareStatus>();
  useEffect(() => { void getRoomDetail(roomId).then(setData).catch((caught) => setError(caught instanceof Error ? caught.message : korean ? "그룹을 불러올 수 없어요." : "グループを読み込めませんでした。")); }, [roomId, korean]);
  const filtered = useMemo(() => data?.meetups.filter((meetup) => filter === "ALL" || filter === "PAST" && meetup.status === "COMPLETED" || filter === "CANCELLED" && meetup.status === "CANCELLED" || filter === "UPCOMING" && !["COMPLETED", "CANCELLED"].includes(meetup.status)) ?? [], [data?.meetups, filter]);
  const mapBounds = useMemo(() => {
    const places = data?.mapPlaces ?? [];
    const latitudes = places.map((item) => item.place.latitude);
    const longitudes = places.map((item) => item.place.longitude);
    return { minLat: Math.min(...latitudes), maxLat: Math.max(...latitudes), minLng: Math.min(...longitudes), maxLng: Math.max(...longitudes) };
  }, [data?.mapPlaces]);
  const mapPosition = (place: PlaceVisit) => {
    const latitudeSpan = mapBounds.maxLat - mapBounds.minLat || 1;
    const longitudeSpan = mapBounds.maxLng - mapBounds.minLng || 1;
    return { left: `${12 + ((place.place.longitude - mapBounds.minLng) / longitudeSpan) * 76}%`, top: `${84 - ((place.place.latitude - mapBounds.minLat) / latitudeSpan) * 68}%` };
  };
  const date = (value?: string) => value ? new Intl.DateTimeFormat(locale, { timeZone: "Asia/Tokyo", year: "numeric", month: "short", day: "numeric" }).format(new Date(value)) : korean ? "날짜 미정" : "日時未定";
  const shareInvite = async () => {
    if (!data) return;
    const url = `${window.location.origin}/r/${encodeURIComponent(data.room.inviteCode)}`;
    const title = korean ? `${data.room.name} 그룹 초대` : `${data.room.name} グループへの招待`;
    const text = korean ? `「${data.room.name}」 그룹에 초대합니다!` : `「${data.room.name}」グループに招待します！`;
    setShareStatus(undefined);
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        setShareStatus("SHARED");
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setShareStatus("COPIED");
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setShareStatus("COPIED");
      } catch {
        setShareStatus("ERROR");
      }
    }
  };
  if (error) return <main className="loading-page"><p className="error-message">{error}</p></main>;
  if (!data) return <main className="loading-page"><div className="loader" /><p>{korean ? "그룹을 불러오고 있어요..." : "グループを読み込んでいます…"}</p></main>;
  return <main className="profile-page"><p className="eyebrow">{korean ? "나의 그룹" : "あなたのグループ"}</p><h1>{data.room.name}</h1><section className="room-hero"><div className="room-hero-copy"><h2>{korean ? "같은 멤버와 다음 약속도 쉽게" : "同じメンバーと次の予定も気軽に"}</h2><p>{korean ? "초대 코드" : "招待コード"} <b>{data.room.inviteCode}</b></p>{shareStatus && <small className={shareStatus === "ERROR" ? "share-error" : "share-success"}>{shareStatus === "SHARED" ? korean ? "공유했어요." : "共有しました。" : shareStatus === "COPIED" ? korean ? "초대 링크를 복사했어요." : "招待リンクをコピーしました。" : korean ? "공유하지 못했어요. 다시 시도해 주세요." : "共有できませんでした。もう一度お試しください。"}</small>}</div><div className="room-hero-actions"><button className="secondary-button" type="button" onClick={() => void shareInvite()}>{korean ? "친구 초대" : "メンバーを招待"} <span>↗</span></button><Link className="primary-button" href={`/new?roomId=${data.room.id}`}>{korean ? "+ 새 약속" : "+ 新しい予定"}</Link></div></section>
    <section className="group-memory-summary"><div><b>{data.summary.completedMeetupCount}</b><span>{korean ? "번 함께 만났어요" : "回会いました"}</span></div><div><b>{data.summary.uniquePlaceCount}</b><span>{korean ? "곳을 함께 갔어요" : "エリアに行きました"}</span></div>{data.summary.mostVisitedPlace && <div className="summary-place"><span>{korean ? "가장 자주 간 곳" : "一番よく行った場所"}</span><b>{data.summary.mostVisitedPlace.place.name} · {data.summary.mostVisitedPlace.count}{korean ? "회" : "回"}</b></div>}</section>
    <section className="room-section"><p className="eyebrow">{korean ? "멤버" : "メンバー"}</p><div className="member-list">{data.members.map((member) => <p key={member.uid}><span className="avatar tone-0">{member.displayName.slice(0, 1)}</span><b>{member.displayName}</b><small>{member.role === "OWNER" ? korean ? "관리자" : "管理者" : korean ? "멤버" : "メンバー"}</small></p>)}</div></section>
    <section className="room-section"><div className="room-history-heading"><div><p className="eyebrow">{korean ? "약속 기록" : "予定の記録"}</p><h2>{korean ? "우리의 약속" : "みんなの予定"}</h2></div><div className="history-view-toggle"><button className={view === "LIST" ? "active" : ""} onClick={() => setView("LIST")}>{korean ? "목록" : "リスト"}</button><button className={view === "MAP" ? "active" : ""} onClick={() => setView("MAP")}>{korean ? "장소" : "マップ"}</button></div></div><div className="history-filter">{(["ALL", "UPCOMING", "PAST", "CANCELLED"] as HistoryFilter[]).map((item) => <button className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)}>{item === "ALL" ? korean ? "전체" : "すべて" : item === "UPCOMING" ? korean ? "예정" : "予定" : item === "PAST" ? korean ? "과거" : "過去" : korean ? "취소" : "中止"}</button>)}</div>{view === "LIST" ? <div className="room-meetups">{filtered.length === 0 ? <p className="empty-note">{korean ? "표시할 약속이 없어요." : "表示する予定がありません。"}</p> : filtered.map((meetup) => <Link href={`/m/${meetup.id}`} key={meetup.id}><div><b>{meetup.occurrence ? (korean ? `${meetup.occurrence}번째 약속 · ` : `第${meetup.occurrence}回 · `) : ""}{meetup.title}</b><small>{date(meetup.completedAt ?? meetup.confirmedDateTime)}{meetup.meetingPlace ? ` · ${meetup.meetingPlace.name}` : ""}</small>{meetup.planPlaces.length > 0 && <em>{meetup.planPlaces.map((place) => place.name).join(" → ")}</em>}</div><span className={`history-status ${meetup.status.toLowerCase()}`}>{meetupState(meetup, korean)}</span></Link>)}</div> : <div className="history-map">{data.mapPlaces.length === 0 ? <p className="empty-note">{korean ? "완료된 약속의 장소가 쌓이면 여기에서 볼 수 있어요." : "完了した予定の場所が増えると、ここで見られます。"}</p> : <><p>{korean ? "완료된 플랜의 실제 방문 장소를 지도 좌표로 표시해요." : "完了したプランの実際の訪問場所を地図座標で表示します。"}</p><div className="history-map-canvas" aria-label={korean ? "함께 간 장소 지도" : "一緒に行った場所の地図"}>{data.mapPlaces.map((place) => <button type="button" style={mapPosition(place)} key={place.place.placeId} onClick={() => setSelectedPlace(place)} className={selectedPlace?.place.placeId === place.place.placeId ? "active" : ""} aria-label={`${place.place.name} ${place.count}${korean ? "회" : "回"}`}><span>📍</span><b>{place.count}</b></button>)}</div><div className="history-map-pins">{data.mapPlaces.map((place) => <button type="button" key={place.place.placeId} onClick={() => setSelectedPlace(place)} className={selectedPlace?.place.placeId === place.place.placeId ? "active" : ""}><span>📍</span><b>{place.place.name}</b><small>{place.count}{korean ? "회" : "回"}</small></button>)}</div>{selectedPlace && <div className="history-map-selection"><b>{selectedPlace.place.name}</b><span>{korean ? `관련 약속 ${selectedPlace.meetupIds.length}개` : `関連予定 ${selectedPlace.meetupIds.length}件`}</span><a href={`https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(selectedPlace.place.placeId.replace(/^places\//, ""))}&query=${encodeURIComponent(selectedPlace.place.name)}`} target="_blank" rel="noreferrer">Google Maps ↗</a></div>}</>}</div>}</section></main>;
}
