"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./auth-provider";
import { Brand } from "./brand";
import { AimashoIcon } from "./aimasho-icon";

export type Language = "ko" | "ja";

interface LanguageContextValue {
  language: Language;
  locale: "ko-KR" | "ja-JP";
  setLanguage: (language: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);
const storageKey = "aimasho-language";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("ko");

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    const next = stored === "ja" || stored === "ko"
      ? stored
      : navigator.language.toLowerCase().startsWith("ja") ? "ja" : "ko";
    const frame = window.requestAnimationFrame(() => setLanguageState(next));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const setLanguage = (next: Language) => {
    window.localStorage.setItem(storageKey, next);
    setLanguageState(next);
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(() => ({ language, locale: language === "ko" ? "ko-KR" as const : "ja-JP" as const, setLanguage }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used inside LanguageProvider.");
  return value;
}

export function LanguageSelect() {
  const { language, setLanguage } = useLanguage();
  const label = language === "ko" ? "언어 선택" : "言語を選択";
  return <label className="language-select"><span className="sr-only">{label}</span><select value={language} onChange={(event) => setLanguage(event.target.value as Language)} aria-label={label}><option value="ko">한국어</option><option value="ja">日本語</option></select></label>;
}

const headerTitles = {
  meetup: { ko: "함께 만나는 약속", ja: "みんなで会う予定" },
  newMeetup: { ko: "새 약속", ja: "新しい予定" },
  profile: { ko: "내 계정", ja: "マイアカウント" },
  login: { ko: "로그인", ja: "ログイン" },
  room: { ko: "그룹", ja: "グループ" },
  roomInvite: { ko: "그룹 초대", ja: "グループ招待" },
} as const;

export function AppHeader({ title }: { title: keyof typeof headerTitles }) {
  const { language } = useLanguage();
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const korean = language === "ko";
  const loginPath = `/login?next=${encodeURIComponent(pathname)}`;
  const signedIn = Boolean(user && !user.isAnonymous);
  return <header className="page-header"><Brand /><div className="header-controls"><span className="page-context-title">{headerTitles[title][language]}</span>{loading ? <span className="header-auth-loading" aria-label={korean ? "로그인 상태 확인 중" : "ログイン状態を確認中"}>…</span> : signedIn ? <Link className="page-account-link" href="/profile"><AimashoIcon name="user" />{user?.displayName || (korean ? "내 계정" : "マイアカウント")}</Link> : title !== "login" ? <Link className="header-login-link" href={loginPath}>{korean ? "로그인 / 회원가입" : "ログイン・新規登録"}</Link> : null}<LanguageSelect /></div></header>;
}
