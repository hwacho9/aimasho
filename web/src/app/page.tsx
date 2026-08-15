"use client";

import Link from "next/link";
import { LanguageSelect, useLanguage } from "@/components/language-provider";

export default function Home() {
  const { language } = useLanguage();
  const korean = language === "ko";
  return (
    <main className="landing">
      <nav className="top-nav"><Link className="brand" href="/" aria-label="aimasho home"><span className="brand-mark">a</span><span>aimasho</span></Link><div className="header-controls"><Link className="nav-note" href="/profile">{korean ? "내 약속" : "マイ予定"}</Link><LanguageSelect /></div></nav>
      <section className="landing-hero">
        <div className="floating-dot dot-one" /><div className="floating-dot dot-two" /><div className="sun-orb">☀</div>
        <p className="eyebrow">{korean ? "약속을 더 쉽게" : "予定をもっと気軽に"}</p>
        <h1>{korean ? <>모두의<br /><strong>“언제·어디서·몇 시에 출발할지”</strong><br />한곳에.</> : <>みんなの<br /><strong>「いつ・どこ・何時に出る？」</strong><br />を、ひとつに。</>}</h1>
        <p className="landing-copy">{korean ? <>날짜를 맞추고, 장소를 정하고,<br />실제로 만나는 순간까지.</> : <>日程を合わせて、場所を決めて、<br />ちゃんと会えるところまで。</>}</p>
        <Link className="primary-button landing-cta" href="/new">{korean ? "약속 만들기" : "予定をつくる"} <span>→</span></Link>
        <p className="guest-note">{korean ? "로그인 없이도 바로 시작할 수 있어요" : "ログインなしですぐに始められます"}</p>
      </section>
      <section className="flow-strip"><span>{korean ? "언제 만날까?" : "いつ会う？"}</span><i>→</i><span>{korean ? "어디서 만날까?" : "どこで会う？"}</span><i>→</i><span>{korean ? "몇 시에 출발할까?" : "何時に出る？"}</span></section>
    </main>
  );
}
