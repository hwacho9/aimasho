"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useLanguage } from "@/components/language-provider";
import { continueWithGoogle, firebase } from "@/lib/firebase/client";
import { saveProfile } from "@/services/meetup-repository";
import { GoogleSignInButton } from "./google-sign-in-button";

export function LoginCard({ nextPath }: { nextPath?: string }) {
  const { language } = useLanguage();
  const korean = language === "ko";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const completionStarted = useRef(false);

  const finishLogin = async (user: User) => {
    if (completionStarted.current) return;
    completionStarted.current = true;
    setIsSubmitting(true);
    setError(undefined);
    try {
      // After linking an anonymous user, force a fresh ID token so the
      // callable function sees the Google sign-in provider immediately.
      await user.getIdToken(true);
      await saveProfile(user.displayName || (korean ? "aimasho 사용자" : "aimasho ユーザー"));
      window.location.replace(nextPath ?? "/");
    } catch (caught) {
      completionStarted.current = false;
      const code = typeof caught === "object" && caught && "code" in caught ? String(caught.code) : "";
      setError(code.startsWith("functions/")
        ? korean ? "로그인은 완료됐지만 프로필 저장에 실패했어요. 잠시 후 다시 시도해 주세요." : "ログインは完了しましたが、プロフィールの保存に失敗しました。少し待ってからもう一度お試しください。"
        : korean ? "로그인 완료 처리를 하지 못했어요. 다시 시도해 주세요." : "ログインの完了処理に失敗しました。もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    // This also completes a login if the popup has already authenticated the
    // user but the page was left open by the browser.
    const stop = onAuthStateChanged(firebase().auth, (user) => {
      if (user && !user.isAnonymous) void finishLogin(user);
    });
    return () => stop();
  // finishLogin intentionally uses the language visible when this page opens.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async () => {
    setIsSubmitting(true);
    setError(undefined);
    try {
      const user = await continueWithGoogle();
      await finishLogin(user);
    } catch (caught) {
      const code = typeof caught === "object" && caught && "code" in caught ? String(caught.code) : "";
      setError(code === "auth/popup-closed-by-user"
        ? korean ? "Google 로그인 창이 닫혔어요. 다시 시도해 주세요." : "Google のログイン画面が閉じられました。もう一度お試しください。"
        : korean ? "Google 로그인에 실패했어요. Firebase Authentication 설정과 허용 도메인을 확인해 주세요." : "Google ログインに失敗しました。Firebase Authentication の設定と許可済みドメインをご確認ください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return <main className="login-page"><section className="login-card" aria-labelledby="login-title"><p className="eyebrow">{korean ? "ACCOUNT" : "アカウント"}</p><h1 id="login-title">{korean ? "로그인 / 회원가입" : "ログイン・新規登録"}</h1><p className="login-description">{korean ? "Google 계정으로 로그인하세요. 처음이라면 회원가입이 자동으로 완료돼요." : "Google アカウントでログインしてください。初めての場合は自動で登録されます。"}</p>{nextPath?.startsWith("/r/") || nextPath?.startsWith("/rooms/") ? <p className="login-return-note">👥 {korean ? "로그인 후 보고 있던 그룹 화면으로 돌아갑니다." : "ログイン後、見ていたグループ画面に戻ります。"}</p> : null}<GoogleSignInButton className="login-google-button" onClick={() => void signIn()} busy={isSubmitting} /><p className="login-helper">{korean ? "게스트로 만든 약속이 있다면 같은 브라우저에서 로그인할 때 계정에 그대로 연결됩니다." : "ゲストで作成した予定は、同じブラウザでログインするとアカウントにそのまま引き継がれます。"}</p>{error ? <p className="error-message" role="alert">{error}</p> : null}<Link className="secondary-link" href={nextPath ?? "/"}>{korean ? nextPath ? "로그인 없이 이전 화면으로" : "로그인 없이 계속하기" : nextPath ? "ログインせず前の画面へ" : "ログインせずに続ける"}</Link></section></main>;
}
