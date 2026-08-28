"use client";

import Image from "next/image";
import { useLanguage } from "./language-provider";

type GoogleSignInButtonProps = {
  onClick: () => void;
  busy?: boolean;
  className?: string;
};

/** Google의 사전 승인된 Android + Web Light/Pill 자산을 그대로 사용합니다. */
export function GoogleSignInButton({ onClick, busy = false, className = "" }: GoogleSignInButtonProps) {
  const { language } = useLanguage();
  const korean = language === "ko";
  const label = busy
    ? korean ? "Google 로그인 중" : "Google ログイン中"
    : korean ? "Google로 로그인" : "Google でログイン";

  return <button
    type="button"
    className={`google-identity-button ${className}`.trim()}
    onClick={onClick}
    disabled={busy}
    aria-label={label}
    aria-busy={busy}
  >
    <Image
      src="/google-sign-in-light-pill.svg"
      alt=""
      width={180}
      height={40}
      unoptimized
    />
    {busy ? <span className="google-identity-progress" aria-hidden="true"><span className="loader" /></span> : null}
  </button>;
}
