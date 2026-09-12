"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TravelTimelineStop } from "@/types/meetup";
import { useLanguage } from "./language-provider";

interface Point { x: number; y: number }

function normalizedPoints(stops: TravelTimelineStop[]): Point[] {
  if (stops.length === 0) return [];
  const latitudes = stops.map((stop) => stop.place.latitude);
  const longitudes = stops.map((stop) => stop.place.longitude);
  let minLatitude = Math.min(...latitudes);
  let maxLatitude = Math.max(...latitudes);
  let minLongitude = Math.min(...longitudes);
  let maxLongitude = Math.max(...longitudes);
  if (Math.abs(maxLatitude - minLatitude) < 0.01) { minLatitude -= 0.01; maxLatitude += 0.01; }
  if (Math.abs(maxLongitude - minLongitude) < 0.01) { minLongitude -= 0.01; maxLongitude += 0.01; }
  return stops.map((stop) => ({
    x: 8 + ((stop.place.longitude - minLongitude) / (maxLongitude - minLongitude)) * 84,
    y: 62 - ((stop.place.latitude - minLatitude) / (maxLatitude - minLatitude)) * 52,
  }));
}

export function JourneyPlayer({ stops, compact = false }: { stops: TravelTimelineStop[]; compact?: boolean }) {
  const { language, locale } = useLanguage();
  const korean = language === "ko";
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const points = useMemo(() => normalizedPoints(stops), [stops]);
  const duration = Math.max(4_000, stops.length * 1_800);

  useEffect(() => {
    if (!playing || stops.length < 2) return;
    const timer = window.setInterval(() => {
      const next = Math.min(1, progressRef.current + 40 / duration);
      progressRef.current = next;
      setProgress(next);
      if (next >= 1) setPlaying(false);
    }, 40);
    return () => window.clearInterval(timer);
  }, [duration, playing, stops.length]);

  if (stops.length === 0) return <div className="journey-empty">{korean ? <>완료한 약속에 장소를 저장하면<br />여기에 여행 기록이 생겨요.</> : <>完了した予定に場所を保存すると<br />ここに旅の記録ができます。</>}</div>;

  const scaled = points.length < 2 ? 0 : progress * (points.length - 1);
  const segment = Math.min(points.length - 1, Math.floor(scaled));
  const fraction = scaled - segment;
  const marker = points.length < 2 || segment >= points.length - 1
    ? points[Math.min(segment, points.length - 1)]
    : {
      x: points[segment].x + (points[segment + 1].x - points[segment].x) * fraction,
      y: points[segment].y + (points[segment + 1].y - points[segment].y) * fraction,
    };
  const activeIndex = Math.min(stops.length - 1, Math.round(scaled));
  const stop = stops[activeIndex];
  const activePoints = [...points.slice(0, segment + 1), marker];
  const pointsValue = points.map((point) => `${point.x},${point.y}`).join(" ");
  const activeValue = activePoints.map((point) => `${point.x},${point.y}`).join(" ");
  const date = new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Tokyo" }).format(new Date(stop.visitedAt));

  const toggle = () => {
    if (stops.length < 2) return;
    if (progress >= 1) {
      progressRef.current = 0;
      setProgress(0);
    }
    setPlaying((current) => !current);
  };

  return <div className={`journey-player ${compact ? "compact" : ""}`}>
    <div className="journey-map" aria-label={korean ? "약속 장소 여행 지도" : "予定場所の旅マップ"}>
      <svg viewBox="0 0 100 74" role="img">
        <defs><filter id="journey-shadow"><feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity=".18" /></filter></defs>
        <polyline className="journey-line-base" points={pointsValue} />
        <polyline className="journey-line-active" points={activeValue} />
        {points.map((point, index) => <circle className={index <= segment ? "visited" : ""} cx={point.x} cy={point.y} r="1.7" key={stops[index].id} />)}
        <g className="journey-marker" transform={`translate(${marker.x} ${marker.y})`} filter="url(#journey-shadow)"><circle r="4.5" /><circle r="2.6" /><circle r=".8" /></g>
      </svg>
      <div className="journey-map-meta"><span>⌁ {activeIndex + 1}/{stops.length}</span><span>🔒 {korean ? "약속 기록" : "予定の記録"}</span></div>
      <Link className="journey-place-card" href={`/m/${stop.meetupId}`}>
        <span className="journey-place-pin">●</span><span><b>{stop.place.name}</b><small>{date} · {stop.title}</small></span><em>›</em>
      </Link>
    </div>
    <div className="journey-controls">
      <button type="button" onClick={toggle} disabled={stops.length < 2} aria-label={playing ? korean ? "일시정지" : "一時停止" : korean ? "재생" : "再生"}>{playing ? "Ⅱ" : "▶"}</button>
      <input type="range" min="0" max="1" step="0.001" value={progress} onChange={(event) => { const next = Number(event.target.value); setPlaying(false); progressRef.current = next; setProgress(next); }} aria-label={korean ? "여행 재생 위치" : "旅の再生位置"} />
      <small>{activeIndex + 1}/{stops.length}</small>
    </div>
    {!compact ? <p className="journey-privacy">{korean ? "저장된 약속 장소를 날짜순으로 보여줍니다. GPS 이동 경로는 기록하지 않아요." : "保存された予定場所を日付順に表示します。GPSの移動経路は記録しません。"}</p> : null}
  </div>;
}
