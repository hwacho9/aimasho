"use client";

import { useAuth } from "@/components/auth-provider";
import { HomeHeader } from "@/components/home-header";
import { SocialHome } from "@/components/social-home";
import { GuestHome } from "@/components/guest-home";
import { useLanguage } from "@/components/language-provider";

export default function Home() {
  const { language } = useLanguage();
  const { user, loading } = useAuth();
  const korean = language === "ko";

  const signedIn = Boolean(user && !user.isAnonymous);

  return <main className={`landing ${signedIn ? "dashboard-home" : ""}`}>
    <HomeHeader />

    {loading ? <section className="home-entry-loading" aria-live="polite">
      <span className="brand-mark" aria-hidden="true">a</span>
      <div><span /><span /><span /></div>
      <p>{korean ? "내 aimasho를 준비하고 있어요…" : "マイ aimasho を準備しています…"}</p>
    </section> : signedIn ? <SocialHome /> : <GuestHome />}

  </main>;
}
