"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { continueWithGoogle, ensureAnonymousUser, firebase } from "@/lib/firebase/client";
import { getRoomInvitePreview, joinRoom, saveProfile } from "@/services/meetup-repository";
import { useLanguage } from "./language-provider";
import { GoogleSignInButton } from "./google-sign-in-button";

export function JoinRoomCard({ inviteCode }: { inviteCode: string }) {
  const { language } = useLanguage(); const korean = language === "ko"; const router = useRouter();
  const [preview, setPreview] = useState<{ roomId: string; name: string; ownerName: string }>(); const [name, setName] = useState(""); const [anonymous, setAnonymous] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState<string>();
  useEffect(() => { void ensureAnonymousUser(); const stop = onAuthStateChanged(firebase().auth, (user) => { setAnonymous(user?.isAnonymous ?? true); setName((current) => current || user?.displayName || ""); }); void getRoomInvitePreview(inviteCode).then(setPreview).catch((caught) => setError(caught instanceof Error ? caught.message : korean ? "그룹 초대를 불러올 수 없어요." : "グループ招待を読み込めませんでした。")); return () => stop(); }, [inviteCode, korean]);
  const upgrade = async () => { setBusy(true); try { const user = await continueWithGoogle(); const displayName = user.displayName || name || "aimasho user"; await saveProfile(displayName); setName(displayName); } catch (caught) { setError(caught instanceof Error ? caught.message : korean ? "Google 계정 연결을 완료하지 못했어요." : "Googleアカウントを連携できませんでした。"); } finally { setBusy(false); } };
  const join = async (event: FormEvent) => { event.preventDefault(); setBusy(true); try { const roomId = await joinRoom(inviteCode, name); router.replace(`/rooms/${roomId}`); } catch (caught) { setError(caught instanceof Error ? caught.message : korean ? "그룹에 참여하지 못했어요." : "グループに参加できませんでした。"); } finally { setBusy(false); } };
  if (error && !preview) return <main className="loading-page"><p className="error-message">{error}</p></main>;
  if (!preview) return <main className="loading-page"><div className="loader" /><p>{korean ? "그룹 초대를 불러오고 있어요..." : "グループ招待を読み込んでいます…"}</p></main>;
  return <main className="join-card"><div className="mini-confetti">👥</div><p className="eyebrow">{korean ? "초대받았어요" : "招待されています"}</p><h1>{preview.name}</h1><p>{korean ? <><strong>{preview.ownerName}</strong>님이 이 그룹에 초대했어요.<br />다음 약속도 계속 함께할 수 있어요.</> : <><strong>{preview.ownerName}</strong>さんがこのグループに招待しました。<br />次の予定もずっと一緒に楽しめます。</>}</p>{anonymous ? <div className="stack-md group-login-prompt"><div className="group-login-benefits"><span>✓ {korean ? "그룹의 다음 일정 확인" : "グループの次の予定を確認"}</span><span>✓ {korean ? "함께한 기록을 계속 저장" : "一緒に過ごした記録を保存"}</span></div><GoogleSignInButton onClick={() => void upgrade()} busy={busy} /><small>{korean ? "처음이라면 회원가입도 동시에 완료됩니다." : "初めての場合は新規登録も同時に完了します。"}</small></div> : <form className="stack-md" onSubmit={join}><label className="field"><span>{korean ? "표시할 이름" : "表示する名前"}</span><input value={name} onChange={(event) => setName(event.target.value)} required maxLength={60} /></label><button className="primary-button" disabled={busy || !name.trim()}>{busy ? korean ? "참여 중..." : "参加中…" : korean ? "그룹 참여하기" : "グループに参加"}</button></form>}{error && <p className="error-message">{error}</p>}</main>;
}
