"use client";

import { useState } from "react";
import { useLanguage } from "./language-provider";

export function ShareCard({ meetupId, title }: { meetupId: string; title: string }) {
  const { language } = useLanguage(); const korean = language === "ko";
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? `/m/${meetupId}` : `${window.location.origin}/m/${meetupId}`;
  const shareText = korean ? `「${title}」 모임에 초대합니다!\n${url}` : `「${title}」に招待します！\n${url}`;
  const complete = () => { setCopied(true); window.setTimeout(() => setCopied(false), 1800); };
  const share = async () => { try { if (navigator.share) await navigator.share({ title, text: korean ? `${title}에 같이 와요!` : `${title}に一緒に行こう！`, url }); else await navigator.clipboard.writeText(shareText); complete(); } catch (caught) { if (caught instanceof DOMException && caught.name === "AbortError") return; await navigator.clipboard.writeText(shareText); complete(); } };
  const copy = async () => { await navigator.clipboard.writeText(shareText); complete(); };
  return <aside className="share-card"><div className="share-sparkle">✦</div><div><p className="eyebrow">{korean ? "친구 초대" : "友だちを招待"}</p><h2>{korean ? "친구를 초대해주세요" : "友だちを招待しよう"}</h2><p>{korean ? "링크를 열면 로그인 없이 바로 투표할 수 있어요." : "リンクを開くとログインなしですぐに投票できます。"}</p></div><div className="share-link"><span>{url}</span><button type="button" onClick={copy}>{copied ? korean ? "복사됨" : "コピー済み" : korean ? "복사" : "コピー"}</button></div><button className="secondary-button" type="button" onClick={share}>{korean ? "공유하기" : "共有する"} <span>↗</span></button></aside>;
}
