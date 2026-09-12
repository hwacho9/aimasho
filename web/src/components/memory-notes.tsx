"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getMeetupMemories, saveMeetupMemory, deleteMeetupMemory } from "@/services/social-repository";
import type { MemoryNote } from "@/types/social";
import { useAuth } from "./auth-provider";
import { useLanguage } from "./language-provider";

export function MemoryNotes({ meetupId }: { meetupId: string }) {
  const { user } = useAuth();
  return <MemoryNotesContents key={`${meetupId}:${user?.uid ?? "signed-out"}`} meetupId={meetupId} />;
}

function MemoryNotesContents({ meetupId }: { meetupId: string }) {
  const { language } = useLanguage();
  const ko = language === "ko";
  const { user } = useAuth();
  const [notes, setNotes] = useState<MemoryNote[]>();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    void getMeetupMemories(meetupId).then(({ notes: next }) => {
      if (!active) return;
      setNotes(next); setDraft(next.find((note) => note.uid === user?.uid)?.body ?? ""); setError(false);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [meetupId, user?.uid, revision]);
  const ownNote = notes?.find((note) => note.uid === user?.uid);
  async function save(remove = false) {
    if (remove && !window.confirm(ko ? "내 추억 글을 삭제할까요?" : "自分のひとことを削除しますか？")) return;
    setBusy(true); setError(false); setSaved(false);
    try {
      if (remove) await deleteMeetupMemory(meetupId); else await saveMeetupMemory(meetupId, draft.trim());
      const result = await getMeetupMemories(meetupId);
      setNotes(result.notes); setDraft(result.notes.find((note) => note.uid === user?.uid)?.body ?? ""); setSaved(true);
    } catch { setError(true); } finally { setBusy(false); }
  }
  return <div className="memory-notes">
    <p className="social-hint">{ko ? "이 모임 참가자에게만 공유돼요. 위치 추적이나 공개 피드가 아니에요." : "この予定の参加者だけに共有されます。位置追跡や公開フィードではありません。"}</p>
    {!notes && !error && <p role="status">{ko ? "추억을 불러오는 중…" : "思い出を読み込み中…"}</p>}
    {notes?.map((note) => <blockquote key={note.uid}><b>{note.displayName}</b><p>{note.body}</p></blockquote>)}
    {user && !user.isAnonymous && notes ? <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <label className="field"><span>{ko ? "그날의 한 줄" : "あの日のひとこと"}</span><textarea rows={3} maxLength={280} value={draft} onChange={(event) => { setDraft(event.target.value); setSaved(false); }} placeholder={ko ? "다음에도 여기서 만나자!" : "またここで会おう！"} disabled={busy} /></label>
      <div className="social-actions"><small>{draft.length}/280</small><button className="secondary-button" disabled={busy || !draft.trim()}>{busy ? ko ? "저장 중…" : "保存中…" : ownNote ? ko ? "수정 저장" : "変更を保存" : ko ? "추억 남기기" : "思い出を残す"}</button>{ownNote && <button type="button" className="text-button" disabled={busy} onClick={() => void save(true)}>{ko ? "내 글 삭제" : "自分の投稿を削除"}</button>}</div>
    </form> : user?.isAnonymous ? <Link href={`/login?next=${encodeURIComponent(`/m/${meetupId}`)}`} className="text-button">{ko ? "로그인하고 내 추억도 남기기" : "ログインして思い出を残す"}</Link> : null}
    {saved && <p role="status">{ko ? "반영했어요." : "反映しました。"}</p>}
    {error && <p role="alert">{ko ? "추억을 불러오거나 저장하지 못했어요. 입력한 글은 그대로예요." : "読み込み・保存に失敗しました。入力した文章は残っています。"} {!notes && <button type="button" onClick={() => setRevision((n) => n + 1)}>{ko ? "다시 시도" : "再試行"}</button>}</p>}
  </div>;
}
