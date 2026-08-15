"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppHeader, useLanguage } from "@/components/language-provider";
import { MeetupCreateForm } from "@/components/meetup-create-form";

export default function NewMeetupPage() {
  return <Suspense fallback={<main className="loading-page"><div className="loader" /></main>}><NewMeetupContents /></Suspense>;
}

function NewMeetupContents() {
  const { language } = useLanguage();
  const roomId = useSearchParams().get("roomId") ?? undefined;
  const korean = language === "ko";
  return <main className="form-page"><AppHeader title="newMeetup" /><section className="form-intro"><p className="eyebrow">{korean ? "함께 만날 시간" : "会う時間を決めよう"}</p><h1>{korean ? "언제 만날까요?" : "いつ会いますか？"}</h1><p>{korean ? <>후보 날짜를 몇 개 골라주세요.<br />친구들이 편한 시간을 알려줄 거예요.</> : <>候補の日時をいくつか選んでください。<br />みんなが都合のいい時間を教えてくれます。</>}</p></section><MeetupCreateForm roomId={roomId} /></main>;
}
