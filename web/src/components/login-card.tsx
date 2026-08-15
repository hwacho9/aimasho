"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { continueWithGoogle } from "@/lib/firebase/client";
import { saveProfile } from "@/services/meetup-repository";

export function LoginCard() {
  const router = useRouter();
  const { language } = useLanguage();
  const korean = language === "ko";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const signIn = async () => {
    setIsSubmitting(true);
    setError(undefined);
    try {
      const user = await continueWithGoogle();
      await saveProfile(user.displayName || (korean ? "aimasho 사용자" : "aimasho ユーザー"));
      router.replace("/profile");
    } catch (caught) {
      const code = typeof caught === "object" && caught && "code" in caught ? String(caught.code) : "";
      setError(code === "auth/popup-closed-by-user"
        ? korean ? "Google 로그인 창이 닫혔어요. 다시 시도해 주세요." : "Google のログイン画面が閉じられました。もう一度お試しください。"
        : korean ? "Google 로그인에 실패했어요. Firebase Authentication 설정과 허용 도메인을 확인해 주세요." : "Google ログインに失敗しました。Firebase Authentication の設定と許可済みドメインをご確認ください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return <main className="login-page"><section className="login-card" aria-labelledby="login-title"><p className="eyebrow">{korean ? "ACCOUNT" : "アカウント"}</p><h1 id="login-title">{korean ? "로그인 / 회원가입" : "ログイン・新規登録"}</h1><p className="login-description">{korean ? "Google 계정으로 로그인하세요. 처음이라면 회원가입이 자동으로 완료돼요." : "Google アカウントでログインしてください。初めての場合は自動で登録されます。"}</p><button className="google-login-button" type="button" onClick={() => void signIn()} disabled={isSubmitting}><span className="google-mark" aria-hidden="true">G</span>{isSubmitting ? korean ? "로그인 중…" : "ログイン中…" : korean ? "Google로 계속하기" : "Google で続ける"}</button><p className="login-helper">{korean ? "게스트로 만든 약속이 있다면 같은 브라우저에서 로그인할 때 계정에 그대로 연결됩니다." : "ゲストで作成した予定は、同じブラウザでログインするとアカウントにそのまま引き継がれます。"}</p>{error ? <p className="error-message" role="alert">{error}</p> : null}<Link className="secondary-link" href="/">{korean ? "로그인 없이 계속하기" : "ログインせずに続ける"}</Link></section></main>;
}
