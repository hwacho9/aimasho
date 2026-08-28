"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { continueWithGoogle, ensureAnonymousUser, firebase } from "@/lib/firebase/client";
import {
  createRoom,
  getMyDashboard,
  getMyRooms,
  joinRoom,
  saveDefaultOrigin,
  saveProfile,
  searchPlaces,
} from "@/services/meetup-repository";
import type { HistoryMeetup, Location, RelationshipStat, Room } from "@/types/meetup";
import { useLanguage } from "./language-provider";
import { RelationshipList } from "./relationship-list";
import { GoogleSignInButton } from "./google-sign-in-button";

function meetupDate(meetup: HistoryMeetup) {
  return meetup.confirmedDateTime ?? meetup.candidateDateTimes?.[0] ?? meetup.completedAt;
}

function meetupStatus(meetup: HistoryMeetup, korean: boolean) {
  if (meetup.status === "COMPLETED") return korean ? "완료" : "完了";
  if (meetup.status === "CANCELLED") return korean ? "취소" : "中止";
  if (meetup.status === "SCHEDULING") return korean ? "설정·조율 중" : "設定・調整中";
  if (meetup.status === "SCHEDULE_CONFIRMED") return korean ? "일정 확정" : "日程確定";
  if (meetup.status === "LOCATION_COLLECTING" || meetup.status === "LOCATION_SELECTING") return korean ? "장소 조율 중" : "場所調整中";
  if (meetup.status === "LOCATION_CONFIRMED") return korean ? "장소 확정" : "場所確定";
  return korean ? "준비 완료" : "準備完了";
}

export function ProfileDashboard() {
  const { language, locale } = useLanguage();
  const korean = language === "ko";
  const router = useRouter();
  const [name, setName] = useState("");
  const [anonymous, setAnonymous] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [meetups, setMeetups] = useState<HistoryMeetup[]>([]);
  const [relationships, setRelationships] = useState<RelationshipStat[]>();
  const [accountLoading, setAccountLoading] = useState(false);
  const [meetupLoadFailed, setMeetupLoadFailed] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [originQuery, setOriginQuery] = useState("");
  const [originResults, setOriginResults] = useState<Location[]>([]);
  const [defaultOrigin, setDefaultOrigin] = useState<Location>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const loadAccountData = useCallback(async (force = false) => {
    setAccountLoading(true);
    setMeetupLoadFailed(false);
    try {
      const dashboard = await getMyDashboard({ force });
      setMeetups(dashboard.meetups);
      setRooms(dashboard.rooms);
      setRelationships(dashboard.relationships);
      setName((current) => current || dashboard.displayName);
    } catch {
      setMeetups([]);
      setRelationships([]);
      setMeetupLoadFailed(true);
      // Keep group management available even if the combined dashboard read
      // fails because an older profile or a Firestore index is incomplete.
      try {
        setRooms(await getMyRooms());
      } catch {
        setRooms([]);
      }
    } finally {
      setAccountLoading(false);
    }
  }, []);

  useEffect(() => {
    const start = async () => {
      const user = await ensureAnonymousUser();
      setName(user.displayName ?? "");
    };
    void start();
    const stop = onAuthStateChanged(firebase().auth, (user) => {
      setName(user?.displayName ?? "");
      setAnonymous(user?.isAnonymous ?? true);
      if (user && !user.isAnonymous) void loadAccountData();
      else {
        setMeetups([]);
        setRooms([]);
        setRelationships([]);
        setAccountLoading(false);
      }
    });
    return () => stop();
  }, [loadAccountData]);

  const ownedMeetups = useMemo(() => meetups.filter((meetup) => meetup.isOwner), [meetups]);
  const displayDate = (meetup: HistoryMeetup) => {
    const value = meetupDate(meetup);
    if (!value) return korean ? "날짜를 아직 설정하지 않았어요" : "日程はまだ設定されていません";
    return new Intl.DateTimeFormat(locale, {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "short",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(value));
  };

  const upgrade = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const user = await continueWithGoogle();
      const profile = await saveProfile(user.displayName || name || "aimasho user");
      setName(profile.displayName);
      await loadAccountData(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : korean ? "Google 계정 연결을 완료하지 못했어요." : "Googleアカウントを連携できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const addRoom = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await createRoom(roomName, name || "aimasho user");
      setRoomName("");
      await loadAccountData(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : korean ? "그룹을 만들지 못했어요." : "グループを作成できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const enterRoom = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const id = await joinRoom(inviteCode, name || "aimasho user");
      router.push(`/rooms/${id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : korean ? "그룹에 참여하지 못했어요." : "グループに参加できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const findOrigin = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      setOriginResults(await searchPlaces(originQuery));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : korean ? "장소를 찾지 못했어요." : "場所を見つけられませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const setOrigin = async (origin: Location) => {
    setBusy(true);
    try {
      await saveDefaultOrigin(origin);
      setDefaultOrigin(origin);
      setOriginResults([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : korean ? "기본 출발 위치를 저장하지 못했어요." : "既定の出発地を保存できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  return <main className="profile-page">
    <p className="eyebrow">{korean ? "나의 AIMASHO" : "わたしの AIMASHO"}</p>
    <h1>{name || (korean ? "내" : "わたしの")}{korean ? "의 약속" : "予定"}</h1>
    {anonymous ? <section className="account-card group-account-prompt">
      <div>
        <p className="eyebrow">{korean ? "그룹 시작하기" : "グループを始める"}</p>
        <h2>{korean ? "그룹을 만들거나 참여하려면 로그인해 주세요" : "グループの作成・参加にはログインが必要です"}</h2>
        <p>{korean ? "Google 계정 하나로 그룹 멤버, 다음 일정, 함께한 기록을 여러 기기에서 이어볼 수 있어요." : "Googleアカウントで、メンバー・次の予定・一緒に過ごした記録を複数の端末から確認できます。"}</p>
        <div className="group-login-benefits"><span>✓ {korean ? "그룹 만들기와 초대" : "グループ作成と招待"}</span><span>✓ {korean ? "초대 코드로 참여" : "招待コードで参加"}</span></div>
      </div>
      <GoogleSignInButton onClick={() => void upgrade()} busy={busy} />
    </section> : <>
      <section className="profile-meetup-section">
        <div className="section-heading">
          <div><p className="eyebrow">CREATED BY ME</p><h2>{korean ? "내가 만든 약속" : "自分が作った予定"}</h2></div>
          {!accountLoading && <span>{ownedMeetups.length}{korean ? "개" : "件"}</span>}
        </div>
        {accountLoading ? <div className="profile-meetup-loading"><span className="loader" /><p>{korean ? "내 약속을 불러오고 있어요..." : "予定を読み込んでいます…"}</p></div>
          : meetupLoadFailed ? <div className="profile-meetup-empty"><p>{korean ? "약속 목록을 불러오지 못했어요." : "予定一覧を読み込めませんでした。"}</p><button className="text-button" type="button" onClick={() => void loadAccountData(true)}>{korean ? "다시 시도" : "再試行"}</button></div>
            : ownedMeetups.length === 0 ? <div className="profile-meetup-empty"><p>{korean ? "아직 만든 약속이 없어요. 링크로 초대할 첫 약속을 만들어보세요." : "作成した予定はまだありません。招待リンクを送る最初の予定を作りましょう。"}</p><Link className="secondary-button" href="/new">{korean ? "+ 약속 만들기" : "+ 予定を作る"}</Link></div>
              : <div className="profile-meetup-list">{ownedMeetups.map((meetup) => <Link href={`/m/${meetup.id}`} key={meetup.id}>
                <span className={`profile-meetup-status ${meetup.status.toLowerCase()}`}>{meetupStatus(meetup, korean)}</span>
                <span className="profile-meetup-copy"><b>{meetup.title}</b><small>{displayDate(meetup)}{meetup.roomName ? ` · ${meetup.roomName}` : ""}</small></span>
                <span className="profile-meetup-arrow" aria-hidden="true">→</span>
              </Link>)}</div>}
      </section>
      <RelationshipList relationships={relationships} />
      <section className="room-section">
        <p className="eyebrow">{korean ? "기본 출발지" : "既定の出発地"}</p><h2>{korean ? "기본 출발 위치" : "既定の出発地"}</h2>
        {defaultOrigin ? <p className="saved-location">✓ {defaultOrigin.name}</p> : <p className="empty-note">{korean ? "자주 출발하는 장소를 저장해두세요." : "よく出発する場所を保存しましょう。"}</p>}
        <form className="inline-form" onSubmit={findOrigin}><input value={originQuery} onChange={(event) => setOriginQuery(event.target.value)} placeholder={korean ? "역 / 장소 검색" : "駅・場所を検索"} required /><button className="secondary-button" disabled={busy}>{korean ? "검색" : "検索"}</button></form>
        {originResults.map((origin) => <button className="profile-place" onClick={() => void setOrigin(origin)} key={origin.placeId}><b>{origin.name}</b><small>{origin.address}</small></button>)}
      </section>
      <section className="room-section">
        <div className="section-heading"><div><p className="eyebrow">{korean ? "내 그룹" : "マイグループ"}</p><h2>{korean ? "내 모임" : "マイグループ"}</h2></div></div>
        {rooms.length === 0 ? <p className="empty-note">{korean ? "아직 그룹이 없어요. 첫 모임을 만들어보세요." : "まだグループはありません。最初のグループを作りましょう。"}</p> : <div className="room-grid">{rooms.map((room) => <Link href={`/rooms/${room.id}`} key={room.id}><span>👥</span><strong>{room.name}</strong><small>{room.role === "OWNER" ? korean ? "관리자" : "管理者" : korean ? "멤버" : "メンバー"}</small></Link>)}</div>}
        <form className="inline-form" onSubmit={addRoom}><input value={roomName} onChange={(event) => setRoomName(event.target.value)} placeholder={korean ? "새 그룹 이름" : "新しいグループ名"} required /><button className="secondary-button" disabled={busy}>{korean ? "+ 새 그룹" : "+ グループを作る"}</button></form>
        <form className="inline-form" onSubmit={enterRoom}><input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder={korean ? "초대 코드" : "招待コード"} required /><button className="secondary-button" disabled={busy}>{korean ? "참여하기" : "参加する"}</button></form>
      </section>
    </>}
    {error && <p className="error-message">{error}</p>}
  </main>;
}
