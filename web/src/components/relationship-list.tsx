"use client";

import { useEffect, useState } from "react";
import { relationshipLabel } from "@/lib/relationship-label";
import { getMyRelationships } from "@/services/meetup-repository";
import type { RelationshipStat } from "@/types/meetup";
import { useLanguage } from "./language-provider";

export function RelationshipList() {
  const { language } = useLanguage();
  const korean = language === "ko";
  const [relationships, setRelationships] = useState<RelationshipStat[]>();

  useEffect(() => {
    void getMyRelationships().then(setRelationships).catch(() => setRelationships([]));
  }, []);

  if (!relationships) return null;
  return <section className="relationship-list"><p className="eyebrow">{korean ? "함께한 친구" : "一緒に会った友だち"}</p><h2>{korean ? "우리의 약속 기록" : "ふたりの予定記録"}</h2>{relationships.length === 0 ? <p className="empty-note">{korean ? "프로필이 있는 친구와 약속을 만들면 여기에서 관계를 확인할 수 있어요." : "プロフィールのある友だちと予定を作ると、ここで関係を確認できます。"}</p> : <div className="relationship-rows">{relationships.map((relationship) => <div className="relationship-row" key={relationship.otherUid}><span className="relationship-avatar">{relationship.displayName.slice(0, 1)}</span><div><b>{relationship.displayName}</b><small>{korean ? `함께한 약속 ${relationship.sharedMeetupCount}회` : `一緒の予定 ${relationship.sharedMeetupCount}回`}</small></div><em>{relationshipLabel(relationship.sharedMeetupCount, korean)}</em></div>)}</div>}</section>;
}
