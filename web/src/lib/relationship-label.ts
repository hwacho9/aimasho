export function relationshipLabel(sharedMeetupCount: number, korean: boolean): string {
  if (sharedMeetupCount >= 8) return korean ? "찐친" : "仲良し";
  if (sharedMeetupCount >= 4) return korean ? "자주 만나는 친구" : "よく会う友だち";
  if (sharedMeetupCount >= 2) return korean ? "함께 만나는 사이" : "会う仲";
  return korean ? "새로운 친구" : "新しい友だち";
}
