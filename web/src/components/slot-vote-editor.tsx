"use client";

import { useRef, useState } from "react";
import type { AvailabilityVote, VoteStatus } from "@/types/meetup";
import { useLanguage } from "./language-provider";
import { VoteButtonGroup } from "./vote-button";

export function SlotVoteEditor({ vote, onVote, disabled }: {
  vote?: AvailabilityVote;
  onVote: (status: VoteStatus, comment: string) => Promise<void>;
  disabled: boolean;
}) {
  const { language } = useLanguage();
  const korean = language === "ko";
  const [comment, setComment] = useState(vote?.comment ?? "");
  const [pending, setPending] = useState<VoteStatus>();
  const [error, setError] = useState<string>();
  const saving = useRef(false);
  const save = async (status: VoteStatus) => {
    if (disabled || saving.current) return;
    saving.current = true;
    setPending(status);
    setError(undefined);
    try {
      await onVote(status, comment);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : korean ? "저장하지 못했어요. 다시 선택해 주세요." : "保存できませんでした。もう一度選んでください。");
    } finally {
      saving.current = false;
      setPending(undefined);
    }
  };
  return <div className="slot-vote-editor" aria-busy={Boolean(pending)}>
    <VoteButtonGroup value={pending ?? vote?.status} onChange={(status) => void save(status)} disabled={disabled || Boolean(pending)} />
    {pending && <p className="action-status" role="status">{korean ? "선택 저장 중 · 다른 날짜는 계속 확인할 수 있어요" : "選択を保存中・他の日程も確認できます"}</p>}
    <label><span>{korean ? "댓글 · 선택" : "コメント・任意"}</span><textarea value={comment} maxLength={240} rows={2} onChange={(event) => setComment(event.target.value)} placeholder={korean ? "예: 18시 이후라면 가능해요" : "例：18時以降なら大丈夫です"} /></label>
    {vote && <button className="text-button" type="button" onClick={() => void save(vote.status)} disabled={disabled || Boolean(pending)}>{korean ? "댓글 저장" : "コメントを保存"}</button>}
    {error && <p className="error-message" role="alert">{error}</p>}
  </div>;
}
