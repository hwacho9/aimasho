"use client";

import Link from "next/link";
import { AimashoIcon } from "./aimasho-icon";
import { useAuth } from "./auth-provider";
import { Brand } from "./brand";
import { LanguageSelect, useLanguage } from "./language-provider";

/** Shared by the real home and its preview so both exercise the same layout. */
export function HomeHeader() {
  const { language } = useLanguage();
  const { user, loading } = useAuth();
  const korean = language === "ko";
  const signedIn = Boolean(user && !user.isAnonymous);
  const accountName = user?.displayName || (korean ? "내 계정" : "マイアカウント");

  return <nav className="top-nav" aria-label={korean ? "메인 메뉴" : "メインメニュー"}>
    <Brand />
    <div className="header-controls">
      {loading ? <span className="nav-note" aria-label={korean ? "로그인 상태 확인 중" : "ログイン状態を確認中"}>…</span>
        : signedIn ? <Link className="nav-note signed-in-link" href="/profile" title={`${accountName} · ${korean ? "내 계정" : "マイアカウント"}`}>
          <AimashoIcon name="user" /><span className="nav-account-name">{accountName} · {korean ? "내 계정" : "マイアカウント"}</span>
        </Link>
          : <><Link className="nav-note" href="/login">{korean ? "로그인" : "ログイン"}</Link><Link className="nav-note" href="/profile">{korean ? "내 약속" : "マイ予定"}</Link></>}
      <LanguageSelect />
    </div>
  </nav>;
}
