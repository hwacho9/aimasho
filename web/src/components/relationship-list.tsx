"use client";

import { useState } from "react";
import { relationshipLabel } from "@/lib/relationship-label";
import { getFriendHistory } from "@/services/meetup-repository";
import type { FriendHistory, RelationshipStat } from "@/types/meetup";
import { useLanguage } from "./language-provider";

export function RelationshipList({ relationships }: { relationships?: RelationshipStat[] }) {
  const { language } = useLanguage();
  const korean = language === "ko";
  const [history, setHistory] = useState<FriendHistory>();
  const [historyError, setHistoryError] = useState<string>();

  const select = async (relationship: RelationshipStat) => { setHistory(undefined); setHistoryError(undefined); try { setHistory(await getFriendHistory(relationship.otherUid)); } catch (caught) { setHistoryError(caught instanceof Error ? caught.message : korean ? "함께한 기록을 불러오지 못했어요." : "一緒の記録を読み込めませんでした。"); } };
  const date = (value?: string) => value ? new Intl.DateTimeFormat(korean ? "ko-KR" : "ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "short", day: "numeric" }).format(new Date(value)) : korean ? "날짜 미정" : "日時未定";
  if (!relationships) return null;
  return <section className="relationship-list"><p className="eyebrow">{korean ? "함께한 친구" : "一緒に会った友だち"}</p><h2>{korean ? "우리의 약속 기록" : "ふたりの予定記録"}</h2>{relationships.length === 0 ? <p className="empty-note">{korean ? "프로필이 있는 친구와 약속을 만들면 여기에서 관계를 확인할 수 있어요." : "プロフィールのある友だちと予定を作ると、ここで関係を確認できます。"}</p> : <div className="relationship-rows">{relationships.map((relationship) => <button type="button" className="relationship-row" key={relationship.otherUid} onClick={() => void select(relationship)}><span className="relationship-avatar">{relationship.displayName.slice(0, 1)}</span><span><b>{relationship.displayName}</b><small>{korean ? `함께한 약속 ${relationship.sharedMeetupCount}회` : `一緒の予定 ${relationship.sharedMeetupCount}回`}</small></span><em>{relationshipLabel(relationship.sharedMeetupCount, korean)}</em></button>)}</div>}{historyError && <p className="error-message">{historyError}</p>}{history && <section className="friend-history"><div><p className="eyebrow">{korean ? "친구 기록" : "ふたりの記録"}</p><h3>{history.displayName}</h3><p>{korean ? `완료한 약속 ${history.completedMeetupCount}회` : `完了した予定 ${history.completedMeetupCount}回`}</p></div><button className="text-button" type="button" onClick={() => setHistory(undefined)}>{korean ? "닫기" : "閉じる"}</button><div className="friend-history-list">{history.meetups.map((meetup) => <a key={meetup.id} href={`/m/${meetup.id}`}><b>{meetup.title}</b><small>{date(meetup.completedAt ?? meetup.confirmedDateTime)}{meetup.meetingPlace ? ` · ${meetup.meetingPlace.name}` : ""}</small>{meetup.planPlaces.length > 0 && <em>{meetup.planPlaces.map((place) => place.name).join(" → ")}</em>}</a>)}</div></section>}</section>;
}
