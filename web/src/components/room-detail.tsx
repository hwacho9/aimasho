"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getRoomDetail } from "@/services/meetup-repository";
import { useLanguage } from "./language-provider";

export function RoomDetail({ roomId }: { roomId: string }) {
  const { language } = useLanguage(); const korean = language === "ko"; const [data, setData] = useState<Awaited<ReturnType<typeof getRoomDetail>>>(); const [error, setError] = useState<string>();
  useEffect(() => { void getRoomDetail(roomId).then(setData).catch((caught) => setError(caught instanceof Error ? caught.message : korean ? "그룹을 불러올 수 없어요." : "グループを読み込めませんでした。")); }, [roomId, korean]);
  if (error) return <main className="loading-page"><p className="error-message">{error}</p></main>;
  if (!data) return <main className="loading-page"><div className="loader" /><p>{korean ? "그룹을 불러오고 있어요..." : "グループを読み込んでいます…"}</p></main>;
  return <main className="profile-page"><p className="eyebrow">{korean ? "나의 그룹" : "あなたのグループ"}</p><h1>{data.room.name}</h1><section className="room-hero"><div><h2>{korean ? "같은 멤버와 다음 약속도 쉽게" : "同じメンバーと次の予定も気軽に"}</h2><p>{korean ? "초대 코드" : "招待コード"} <b>{data.room.inviteCode}</b></p></div><Link className="primary-button" href={`/new?roomId=${data.room.id}`}>{korean ? "+ 새 약속" : "+ 新しい予定"}</Link></section><section className="room-section"><p className="eyebrow">{korean ? "멤버" : "メンバー"}</p><div className="member-list">{data.members.map((member) => <p key={member.uid}><span className="avatar tone-0">{member.displayName.slice(0, 1)}</span><b>{member.displayName}</b><small>{member.role === "OWNER" ? korean ? "관리자" : "管理者" : korean ? "멤버" : "メンバー"}</small></p>)}</div></section><section className="room-section"><p className="eyebrow">{korean ? "약속" : "予定"}</p><h2>{korean ? "지난 약속과 진행 중인 약속" : "これまでの予定と進行中の予定"}</h2>{data.meetups.length === 0 ? <p className="empty-note">{korean ? "아직 그룹에서 만든 약속이 없어요." : "このグループで作った予定はまだありません。"}</p> : <div className="room-meetups">{data.meetups.map((meetup) => <Link href={`/m/${meetup.id}`} key={meetup.id}><b>{meetup.title}</b><span>{meetup.status.replaceAll("_", " ")}</span></Link>)}</div>}</section></main>;
}
