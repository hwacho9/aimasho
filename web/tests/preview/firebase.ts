// Never open a real account popup or request private calendar data in the preview.
export const requestGoogleCalendarAccessToken = async (): Promise<string> => {
  throw new Error("LOCAL PREVIEW: Google Calendar への接続は無効です。");
};
