"use client";

import { FormEvent, useState } from "react";
import { joinMeetup } from "@/services/meetup-repository";
import { useLanguage } from "./language-provider";

export function JoinCard({ meetupId, title, hostName, onJoined }: { meetupId: string; title: string; hostName: string; onJoined: () => void }) {
  const { language } = useLanguage(); const korean = language === "ko";
  const [name, setName] = useState(""); const [isJoining, setIsJoining] = useState(false); const [error, setError] = useState<string>();
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setIsJoining(true); setError(undefined); try { await joinMeetup(meetupId, name); onJoined(); } catch (caught) { setError(caught instanceof Error ? caught.message : korean ? "참여할 수 없어요. 다시 시도해주세요." : "参加できませんでした。もう一度お試しください。"); setIsJoining(false); } }
  return <main className="join-card"><div className="mini-confetti">✦</div><p className="eyebrow">{korean ? "초대받았어요" : "招待されています"}</p><h1>{title}</h1><p>{korean ? <><strong>{hostName}</strong>님이 초대했어요.<br />이름을 알려주시면 바로 참여할 수 있어요.</> : <><strong>{hostName}</strong>さんから招待されています。<br />名前を入力するとすぐに参加できます。</>}</p><form onSubmit={submit} className="stack-md"><label className="field"><span>{korean ? "이름" : "名前"}</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder={korean ? "예: 유키" : "例：ユキ"} autoFocus required /></label>{error && <p className="error-message" role="alert">{error}</p>}<button className="primary-button" disabled={!name.trim() || isJoining} type="submit">{isJoining ? korean ? "참여 중..." : "参加中…" : korean ? "참여하기" : "参加する"}</button></form></main>;
}
