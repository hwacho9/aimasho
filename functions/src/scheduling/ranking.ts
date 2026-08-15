import type { CandidateSlot, ScheduleRecommendation, SlotScore, Vote } from "../shared/models.js";

/** Pure source-of-truth ranking. Earlier slots break every remaining tie. */
export function rankSchedule(
  slots: CandidateSlot[],
  votes: Vote[],
  participantCount: number,
): ScheduleRecommendation {
  const ranking = slots
    .map<SlotScore>((slot) => {
      const slotVotes = votes.filter((vote) => vote.slotId === slot.id);
      const yes = slotVotes.filter((vote) => vote.status === "YES").length;
      const maybe = slotVotes.filter((vote) => vote.status === "MAYBE").length;
      const no = slotVotes.filter((vote) => vote.status === "NO").length;
      return {
        ...slot,
        yes,
        maybe,
        no,
        totalScore: yes * 2 + maybe,
        participantCount,
      };
    })
    .sort((a, b) =>
      a.no - b.no ||
      b.yes - a.yes ||
      b.totalScore - a.totalScore ||
      a.startDateTime.localeCompare(b.startDateTime),
    );

  return { recommended: ranking[0] ?? null, ranking };
}
