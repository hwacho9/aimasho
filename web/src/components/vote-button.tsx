"use client";

import type { VoteStatus } from "@/types/meetup";
import { useLanguage } from "./language-provider";

export function VoteButtonGroup({ value, onChange, disabled = false }: { value?: VoteStatus; onChange: (status: VoteStatus) => void; disabled?: boolean }) {
  const { language } = useLanguage(); const korean = language === "ko";
  const options: { value: VoteStatus; symbol: string; label: string }[] = korean ? [{ value: "YES", symbol: "○", label: "가능" }, { value: "MAYBE", symbol: "△", label: "애매" }, { value: "NO", symbol: "×", label: "불가능" }] : [{ value: "YES", symbol: "○", label: "参加できる" }, { value: "MAYBE", symbol: "△", label: "未定" }, { value: "NO", symbol: "×", label: "参加できない" }];
  return <div className="vote-group" aria-label={korean ? "일정 가능 여부" : "参加可否"}>{options.map((option) => <button key={option.value} className={`vote-option ${option.value.toLowerCase()} ${value === option.value ? "selected" : ""}`} onClick={() => onChange(option.value)} type="button" disabled={disabled} aria-pressed={value === option.value}><span>{option.symbol}</span>{option.label}</button>)}</div>;
}
