import { useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { AppHeader, LanguageProvider } from "../../src/components/language-provider";
import Home from "../../src/app/page";
import { MeetupCreateForm } from "../../src/components/meetup-create-form";
import { EventPlanPanel } from "../../src/components/event-plan-panel";
import { MeetupExpenses, MeetupNextSteps } from "../../src/components/meetup-next-steps";
import { MeetupScheduleTools } from "../../src/components/meetup-schedule-tools";
import { SlotVoteEditor } from "../../src/components/slot-vote-editor";
import type { VoteStatus } from "../../src/types/meetup";
import { getPreviewPlan, subscribePreviewPlan } from "./fixtures";
import "../../src/app/globals.css";

const mode = new URLSearchParams(window.location.search).get("mode");
function PlanPreview() {
  const detail = useSyncExternalStore(subscribePreviewPlan, getPreviewPlan);
  return <EventPlanPanel meetupId="preview-plan" detail={detail} isHost />;
}
function ControlsPreview() {
  const detail = useSyncExternalStore(subscribePreviewPlan, getPreviewPlan);
  const [vote, setVote] = useState<VoteStatus>("MAYBE");
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const scheduling = { ...detail, meetup: { ...detail.meetup, status: "SCHEDULING" as const, collectOrigins: false } };
  const save = async (status: VoteStatus) => {
    setPending(true);
    try { await new Promise((resolve) => setTimeout(resolve, 1500)); setVote(status); }
    finally { setPending(false); }
  };
  return <>
    <p className="inline-note">LOCAL · 保存に1.5秒の待ち時間を入れた架空データです。</p>
    <article className="slot-card"><div className="slot-date">10月10日(土) 12:00</div><SlotVoteEditor vote={{ participantUid: "preview", slotId: "sample", status: vote }} onVote={save} disabled={confirming} /></article>
    <MeetupScheduleTools detail={scheduling} recommended={scheduling.candidateSlots[0]} isHost confirming={confirming} pendingVotes={pending} onConfirm={() => { setConfirming(true); setTimeout(() => setConfirming(false), 1500); }} />
    <MeetupNextSteps meetupId="preview-plan" detail={scheduling} currentUid="preview" isHost />
    <PlanPreview />
    <MeetupExpenses meetupId="preview-plan" detail={detail} uid="preview" />
  </>;
}
createRoot(document.getElementById("root")!).render(<LanguageProvider>
  <div style={{ background: "#302823", color: "white", fontSize: 12, padding: "8px 16px", display: "flex", gap: 18, flexWrap: "wrap" }}>
    LOCAL PREVIEW · 架空データ · 샘플
    <a href="?mode=guest">Guest</a><a href="?mode=social">Social</a><a href="?mode=create">Create</a><a href="?mode=plan">Plan</a><a href="?mode=controls">Controls</a>
  </div>
  {mode === "create" || mode === "plan" || mode === "controls" ? <main className="app-shell">
    <AppHeader title={mode === "create" ? "newMeetup" : "meetup"} />
    {mode === "controls" ? <div className="meetup-page"><ControlsPreview /></div> : mode === "plan" ? <div className="meetup-page"><PlanPreview /></div> : <div className="form-page"><MeetupCreateForm template="food" /></div>}
  </main> : <Home />}
</LanguageProvider>);
