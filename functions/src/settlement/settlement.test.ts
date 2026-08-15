import { describe, expect, it } from "vitest";
import { calculateSettlement } from "./settlement.js";

describe("calculateSettlement", () => {
  it("produces minimum transfers for shared expenses", () => {
    const result = calculateSettlement(["s", "m", "y", "j"], [{ id: "dinner", title: "Dinner", amount: 16000, paidByUid: "s", participantUids: ["s", "m", "y", "j"] }, { id: "dessert", title: "Dessert", amount: 2000, paidByUid: "m", participantUids: ["m", "y"] }]);
    expect(result.balances).toEqual([{ participantUid: "s", amount: 12000 }, { participantUid: "m", amount: -3000 }, { participantUid: "y", amount: -5000 }, { participantUid: "j", amount: -4000 }]);
    expect(result.transfers).toEqual([{ fromUid: "y", toUid: "s", amount: 5000 }, { fromUid: "j", toUid: "s", amount: 4000 }, { fromUid: "m", toUid: "s", amount: 3000 }]);
  });

  it("distributes yen remainders deterministically", () => {
    const result = calculateSettlement(["a", "b", "c"], [{ id: "x", title: "Snack", amount: 1000, paidByUid: "a", participantUids: ["a", "b", "c"] }]);
    expect(result.balances).toEqual([{ participantUid: "a", amount: 666 }, { participantUid: "b", amount: -333 }, { participantUid: "c", amount: -333 }]);
  });
});
