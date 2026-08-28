"use client";

import Link from "next/link";
import { AimashoIcon } from "@/components/aimasho-icon";
import { useAuth } from "@/components/auth-provider";
import { Brand } from "@/components/brand";
import { HomeDashboard } from "@/components/home-dashboard";
import { LanguageSelect, useLanguage } from "@/components/language-provider";

export default function Home() {
  const { language } = useLanguage();
  const { user, loading } = useAuth();
  const korean = language === "ko";

  const signedIn = Boolean(user && !user.isAnonymous);
  const accountName = user?.displayName || (korean ? "내 계정" : "マイアカウント");

  return <main className={`landing ${signedIn ? "dashboard-home" : ""}`}>
    <nav className="top-nav">
      <Brand />
      <div className="header-controls">
        {loading ? <span className="nav-note" aria-label={korean ? "로그인 상태 확인 중" : "ログイン状態を確認中"}>…</span>
          : signedIn ? <Link className="nav-note signed-in-link" href="/profile"><AimashoIcon name="user" />{accountName} · {korean ? "내 계정" : "マイアカウント"}</Link>
            : <><Link className="nav-note" href="/login">{korean ? "로그인" : "ログイン"}</Link><Link className="nav-note" href="/profile">{korean ? "내 약속" : "マイ予定"}</Link></>}
        <LanguageSelect />
      </div>
    </nav>

    {loading ? <section className="home-entry-loading" aria-live="polite">
      <span className="brand-mark" aria-hidden="true">a</span>
      <div><span /><span /><span /></div>
      <p>{korean ? "내 aimasho를 준비하고 있어요…" : "マイ aimasho を準備しています…"}</p>
    </section> : signedIn ? <HomeDashboard /> : <>
      <section className="landing-hero">
        <div className="floating-dot dot-one" /><div className="floating-dot dot-two" /><div className="sun-orb"><AimashoIcon name="sun" /></div>
        <p className="eyebrow">{korean ? "약속을 더 쉽게" : "予定をもっと気軽に"}</p>
        <h1 className={korean ? undefined : "japanese-headline"}>{korean ? <>모두의<br /><strong>“언제·어디서 만날지”</strong><br />한곳에.</> : <><span>みんなの</span><strong><span>「いつ・どこで</span><span>会う？」</span></strong><span>を、ひとつに。</span></>}</h1>
        <p className="landing-copy">{korean ? <>날짜를 맞추고, 장소를 정하고,<br />실제로 만나는 순간까지.</> : <>日程を合わせて、場所を決めて、<br />ちゃんと会えるところまで。</>}</p>
        <Link className="primary-button landing-cta" href="/new">{korean ? "약속 만들기" : "予定をつくる"} <span>→</span></Link>
        <p className="guest-note"><span>{korean ? "로그인 없이도 바로 시작할 수 있어요" : "ログインなしですぐに始められます"}</span><Link className="guest-login-link" href="/login">{korean ? "이미 계정이 있나요? 로그인" : "アカウントをお持ちの方はログイン"}</Link></p>
      </section>
      <section className="flow-strip"><span>{korean ? "언제 만날까?" : "いつ会う？"}</span><i>→</i><span>{korean ? "어디서 만날까?" : "どこで会う？"}</span><i>→</i><span>{korean ? "약속을 확정하자" : "予定を決めよう"}</span></section>
    </>}
  </main>;
}
