export const MEETUP_REMINDER_MINUTES = [24 * 60, 60, 10] as const;

export interface MeetupReminderTime {
  minutesBefore: number;
  sendAt: Date;
}

export function meetupReminderTimes(
  meetupAt: Date,
  now = new Date(),
): MeetupReminderTime[] {
  if (Number.isNaN(meetupAt.getTime()) || meetupAt.getTime() <= now.getTime()) {
    return [];
  }
  return MEETUP_REMINDER_MINUTES
    .map((minutesBefore) => ({
      minutesBefore,
      sendAt: new Date(meetupAt.getTime() - minutesBefore * 60_000),
    }))
    .filter(({ sendAt }) => sendAt.getTime() > now.getTime());
}

export function meetupReminderCopy(
  locale: string,
  title: string,
  minutesBefore: number,
): { title: string; body: string } {
  const normalizedTitle = title.trim() || "aimasho";
  if (locale === "ko") {
    const timing = minutesBefore >= 24 * 60
      ? "내일"
      : minutesBefore >= 60 ? "1시간 후" : `${minutesBefore}분 후`;
    return {
      title: `📅 ${timing} 약속이 있어요`,
      body: `${normalizedTitle} 일정을 확인해 주세요.`,
    };
  }
  const timing = minutesBefore >= 24 * 60
    ? "明日"
    : minutesBefore >= 60 ? "1時間後" : `${minutesBefore}分後`;
  return {
    title: `📅 ${timing}は予定があります`,
    body: `${normalizedTitle}の予定を確認しましょう。`,
  };
}
