"use client";

import { useId, useState } from "react";
import { googleMapsEmbedUrl, googleMapsPlaceUrl, openStreetMapEmbedUrl } from "@/lib/google-maps-links";
import { getPlaceDetails } from "@/services/meetup-repository";
import type { Location, PlaceDetails } from "@/types/meetup";
import { useLanguage } from "./language-provider";

/** Selected places show a map immediately; saved plan items load only on demand. */
export function PlaceMapPreview({ place, collapsible = false }: { place: Location; collapsible?: boolean }) {
  return <PlaceMapPreviewContents key={place.placeId} place={place} collapsible={collapsible} />;
}

function PlaceMapPreviewContents({ place, collapsible }: { place: Location; collapsible: boolean }) {
  const { language } = useLanguage();
  const korean = language === "ko";
  const mapId = useId();
  const [expanded, setExpanded] = useState(true);
  const [detailsRequested, setDetailsRequested] = useState(false);
  const [details, setDetails] = useState<PlaceDetails>();
  const [detailsError, setDetailsError] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const googleSrc = googleMapsEmbedUrl(place, language);
  const src = googleSrc ?? openStreetMapEmbedUrl(place);
  const price = priceLabel(details?.priceLevel);
  const requestDetails = async () => {
    if (detailsLoading || details) return;
    setDetailsRequested(true);
    setDetailsError(false);
    setDetailsLoading(true);
    try {
      setDetails(await getPlaceDetails(place.placeId));
    } catch {
      setDetailsError(true);
    } finally {
      setDetailsLoading(false);
    }
  };

  return <div className="place-map-preview">
    <div className="place-map-heading">
      <div className="place-map-address"><strong>{place.name}</strong>{place.address && <span>{place.address}</span>}</div>
      <a className="place-map-link" href={googleMapsPlaceUrl(place)} target="_blank" rel="noopener noreferrer">
        {korean ? "Google Maps에서 열기 ↗" : "Google Mapsで開く ↗"}
      </a>
    </div>
    {src ? <>
      {collapsible && <button type="button" className="text-button place-map-toggle" aria-expanded={expanded} aria-controls={mapId} onClick={() => setExpanded((value) => !value)}>
        {expanded ? korean ? "지도 접기" : "地図を閉じる" : korean ? "지도 보기" : "地図を見る"}
      </button>}
      <div id={mapId} hidden={!expanded}>
        {expanded && <><iframe className="place-map-frame" title={`${place.name} · ${googleSrc ? "Google Maps" : korean ? "지도" : "地図"}`} src={src} width="600" height="280" loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
          {!googleSrc && <p className="place-map-attribution">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors</p>}</>}
      </div>
    </> : <p className="place-map-note">{korean ? "이 장소에는 지도 좌표가 없어요. 위 Google Maps 링크에서 위치를 확인해 주세요." : "この場所には地図座標がありません。上の Google Maps リンクで場所を確認してください。"}</p>}
    <section className="place-details" aria-label={korean ? "음식점 정보" : "お店の情報"}>
      <div className="place-details-heading"><b>{korean ? "음식점 정보" : "お店の情報"}</b>{details?.category && <span>{details.category}</span>}</div>
      {!detailsRequested && <button type="button" className="text-button" onClick={() => void requestDetails()}>{korean ? "평점·영업시간 보기" : "評価・営業時間を見る"}</button>}
      {detailsRequested && !details && !detailsError && <p className="place-map-note" role="status">{korean ? "음식점 정보를 불러오는 중…" : "お店の情報を読み込み中…"}</p>}
      {detailsError && <p className="place-map-note" role="alert">{korean ? "음식점 정보를 불러오지 못했어요." : "お店の情報を読み込めませんでした。"} <button type="button" className="text-button" onClick={() => void requestDetails()}>{korean ? "다시 시도" : "再試行"}</button></p>}
      {details && <div className="place-details-grid">
        {(details.rating !== undefined || details.ratingCount !== undefined) && <span>★ {details.rating?.toFixed(1) ?? "–"}{details.ratingCount !== undefined && ` (${details.ratingCount.toLocaleString()})`}</span>}
        {price && <span>{korean ? "가격대" : "価格帯"} {price}</span>}
        {details.openNow !== undefined && <span className={details.openNow ? "open" : "closed"}>{details.openNow ? korean ? "영업 중" : "営業中" : korean ? "영업 종료" : "営業時間外"}</span>}
        {details.phoneNumber && <a href={`tel:${details.phoneNumber}`}>{details.phoneNumber}</a>}
        {details.websiteUri && <a href={details.websiteUri} target="_blank" rel="noopener noreferrer">{korean ? "공식 웹사이트 ↗" : "公式サイト ↗"}</a>}
        {details.weekdayDescriptions?.length && <details className="place-hours"><summary>{korean ? "영업시간" : "営業時間"}</summary><ul>{details.weekdayDescriptions.map((hour) => <li key={hour}>{hour}</li>)}</ul></details>}
        <small>{korean ? "Google Maps 제공" : "Google Maps 提供"}</small>
      </div>}
    </section>
  </div>;
}

function priceLabel(value?: string) {
  return value === "PRICE_LEVEL_FREE" ? "¥" : value === "PRICE_LEVEL_INEXPENSIVE" ? "¥" : value === "PRICE_LEVEL_MODERATE" ? "¥¥" : value === "PRICE_LEVEL_EXPENSIVE" ? "¥¥¥" : value === "PRICE_LEVEL_VERY_EXPENSIVE" ? "¥¥¥¥" : undefined;
}
