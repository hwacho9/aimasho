import type { AvailabilityVote, CandidateSlot, Recommendation } from "@/types/meetup";

/**
 * Schedule votes already arrive through Firestore's live subscription, so the
 * UI can rank them immediately without another Cloud Function round trip.
 */
export function rankSchedule(
  slots: CandidateSlot[],
  votes: AvailabilityVote[],
  participantCount: number,
): Recommendation {
  const ranking = slots
    .map((slot) => {
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
    .sort((first, second) =>
      first.no - second.no
      || second.yes - first.yes
      || second.totalScore - first.totalScore
      || first.startDateTime.localeCompare(second.startDateTime),
    );

  return { recommended: ranking[0] ?? null, ranking };
}
