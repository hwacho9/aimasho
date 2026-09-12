"use client";

import { useEffect, useState } from "react";
import { getMyTravelTimeline } from "@/services/meetup-repository";
import type { TravelTimelineData } from "@/types/meetup";
import { JourneyPlayer } from "./journey-player";
import { useLanguage } from "./language-provider";

export function JourneyPageClient() {
  const { language } = useLanguage();
  const korean = language === "ko";
  const [data, setData] = useState<TravelTimelineData>();
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void getMyTravelTimeline().then((value) => { if (active) setData(value); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);

  if (error) return <main className="journey-page"><p className="error-message">{korean ? "여행 기록을 불러오지 못했어요." : "旅の記録を読み込めませんでした。"}</p></main>;
  if (!data) return <main className="journey-page journey-page-loading"><div className="loader" /><p>{korean ? "Journey를 준비하고 있어요…" : "Journeyを準備しています…"}</p></main>;

  const metrics = [
    [data.summary.completedMeetupCount, korean ? "함께한 약속" : "一緒の予定"],
    [data.summary.uniquePlaceCount, korean ? "방문 장소" : "訪れた場所"],
    [data.summary.totalStops, korean ? "여정 포인트" : "旅のポイント"],
  ] as const;
  return <main className="journey-page">
    <div className="journey-heading"><p className="eyebrow">MY AIMASHO JOURNEY</p><h1>{korean ? "함께한 날을 지도로 다시 만나보세요" : "一緒に過ごした日を地図でもう一度"}</h1><p>{korean ? "완료한 약속의 장소를 시간순으로 이어서 영상처럼 재생합니다." : "完了した予定の場所を時系列につなぎ、動画のように再生します。"}</p></div>
    <div className="journey-summary">{metrics.map(([value, label]) => <div key={label}><b>{value}</b><span>{label}</span></div>)}</div>
    <JourneyPlayer stops={data.stops} />
  </main>;
}
