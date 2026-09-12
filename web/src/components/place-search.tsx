"use client";

import { type FormEvent, useId, useRef, useState } from "react";
import { searchPlaces } from "@/services/meetup-repository";
import type { Location } from "@/types/meetup";
import { useLanguage } from "./language-provider";

export function PlaceSearch({ onPick, label, disabled = false }: {
  onPick: (place: Location) => void;
  label?: string;
  disabled?: boolean;
}) {
  const { language } = useLanguage();
  const korean = language === "ko";
  const inputId = useId();
  const inputLabel = label ?? (korean ? "역 / 장소 / 주소 검색" : "駅・場所・住所を検索");
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Location[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string>();
  const request = useRef(0);
  const active = useRef(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (disabled || active.current || !query.trim()) return;
    active.current = true;
    const generation = ++request.current;
    setSearching(true); setError(undefined); setSearched(false);
    try {
      const results = await searchPlaces(query.trim());
      if (generation === request.current) { setPlaces(results); setSearched(true); }
    } catch {
      if (generation === request.current) {
        setPlaces([]);
        setError(korean ? "장소를 검색하지 못했어요. 잠시 후 다시 시도해 주세요." : "場所を検索できませんでした。少し待ってからもう一度お試しください。");
      }
    } finally {
      active.current = false;
      setSearching(false);
    }
  };
  return <div className="place-search">
    <form onSubmit={(event) => void submit(event)} role="search" aria-label={inputLabel}>
      <input id={inputId} aria-label={inputLabel} value={query} onChange={(event) => {
        request.current += 1; setQuery(event.target.value); setPlaces([]); setSearched(false); setError(undefined);
      }} placeholder={inputLabel} />
      <button type="submit" disabled={disabled || searching || !query.trim()} aria-busy={searching}>{searching ? korean ? "검색 중" : "検索中" : korean ? "검색" : "検索"}</button>
    </form>
    {error && <p className="error-message" role="alert">{error}</p>}
    {searched && places.length === 0 && <p className="inline-note" role="status">{korean ? "검색 결과가 없어요. 다른 이름으로 검색해 주세요." : "見つかりませんでした。別の名前で検索してください。"}</p>}
    {places.length > 0 && <div className="place-results">{places.map((place) => <button type="button" key={place.placeId} disabled={disabled} onClick={() => { if (!disabled) { onPick(place); setPlaces([]); } }}><strong>{place.name}</strong><small>{place.address}</small></button>)}</div>}
  </div>;
}
