"use client";

import { FormEvent, useMemo, useState } from "react";
import { addContentOption, toggleContentVote } from "@/services/meetup-repository";
import type { ContentCategory, MeetupDetail } from "@/types/meetup";
import { useLanguage } from "./language-provider";

const categoryCopy: Record<ContentCategory, { ko: string; ja: string; icon: string }> = {
  FOOD: { ko: "무엇을 먹을까요?", ja: "何を食べますか？", icon: "🍽" },
  ACTIVITY: { ko: "무엇을 할까요?", ja: "何をしますか？", icon: "✨" },
};

export function ContentVotingPanel({ meetupId, detail, currentUid }: { meetupId: string; detail: MeetupDetail; currentUid?: string }) {
  const { language } = useLanguage();
  const korean = language === "ko";
  const [busyOption, setBusyOption] = useState<string>();
  const [customText, setCustomText] = useState<Record<ContentCategory, string>>({ FOOD: "", ACTIVITY: "" });
  const [error, setError] = useState<string>();
  const config = detail.meetup.contentVoteConfig;
  const enabled = (["FOOD", "ACTIVITY"] as ContentCategory[]).filter((category) => category === "FOOD" ? config?.food : config?.activity);
  const totals = useMemo(() => new Map(detail.contentOptions.map((option) => [option.id, detail.contentVotes.filter((vote) => vote.optionId === option.id).length])), [detail.contentOptions, detail.contentVotes]);
  if (enabled.length === 0 || detail.meetup.status === "SCHEDULING" || detail.meetup.status === "COMPLETED" || detail.meetup.status === "CANCELLED") return null;
  const toggle = async (optionId: string, selected: boolean) => {
    setBusyOption(optionId); setError(undefined);
    try { await toggleContentVote(meetupId, optionId, selected); }
    catch (caught) { setError(caught instanceof Error ? caught.message : korean ? "내용 투표를 저장하지 못했어요." : "内容の投票を保存できませんでした。"); }
    finally { setBusyOption(undefined); }
  };
  const add = async (event: FormEvent, category: ContentCategory) => {
    event.preventDefault(); const label = customText[category].trim(); if (!label) return;
    setBusyOption(`add-${category}`); setError(undefined);
    try { await addContentOption(meetupId, category, label); setCustomText((current) => ({ ...current, [category]: "" })); }
    catch (caught) { setError(caught instanceof Error ? caught.message : korean ? "선택지를 추가하지 못했어요." : "選択肢を追加できませんでした。"); }
    finally { setBusyOption(undefined); }
  };
  return <section className="content-voting-panel">
    <div><p className="eyebrow">{korean ? "내용 투표" : "内容投票"}</p><h2>{korean ? "이번 약속은 어떻게 보낼까요?" : "今回の予定をどう過ごす？"}</h2><p>{korean ? (config?.allowMultiple ? "마음에 드는 선택지를 모두 고를 수 있어요." : "식사와 활동에서 각각 하나를 고를 수 있어요.") : (config?.allowMultiple ? "気になる選択肢をすべて選べます。" : "食事・活動ごとに一つ選べます。")}</p></div>
    {enabled.map((category) => {
      const options = detail.contentOptions.filter((option) => option.category === category).sort((a, b) => (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0) || a.label.localeCompare(b.label));
      return <section className="content-category" key={category}><h3>{categoryCopy[category].icon} {korean ? categoryCopy[category].ko : categoryCopy[category].ja}</h3><div className="content-options">{options.map((option) => {
        const selected = currentUid ? detail.contentVotes.some((vote) => vote.participantUid === currentUid && vote.optionId === option.id) : false;
        return <button key={option.id} type="button" className={selected ? "selected" : ""} disabled={!currentUid || busyOption === option.id} onClick={() => void toggle(option.id, !selected)}><span>{option.label}</span><b>{totals.get(option.id) ?? 0}</b></button>;
      })}</div><div className="content-ranking">{options.slice(0, 3).map((option, index) => <span key={option.id}>{index + 1}. {option.label} <b>{totals.get(option.id) ?? 0}</b></span>)}</div>{config?.allowParticipantOptions && currentUid && <form className="content-option-add" onSubmit={(event) => void add(event, category)}><input value={customText[category]} maxLength={60} onChange={(event) => setCustomText((current) => ({ ...current, [category]: event.target.value }))} placeholder={korean ? "직접 선택지 추가" : "選択肢を追加"} /><button type="submit" className="text-button" disabled={busyOption === `add-${category}`}>{korean ? "+ 추가" : "+ 追加"}</button></form>}</section>;
    })}
    {error && <p className="error-message">{error}</p>}
  </section>;
}
