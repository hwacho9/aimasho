export interface ExpenseInput {
  id: string;
  title: string;
  amount: number;
  paidByUid: string;
  participantUids: string[];
}

export interface Balance { participantUid: string; amount: number }
export interface Transfer { fromUid: string; toUid: string; amount: number }

export interface SettlementResult {
  balances: Balance[];
  transfers: Transfer[];
  totalAmount: number;
}

/** Integer-yen balancing with a deterministic remainder and minimum-transfer settlement. */
export function calculateSettlement(participantUids: string[], expenses: ExpenseInput[]): SettlementResult {
  const balanceByUid = new Map(participantUids.map((uid) => [uid, 0]));
  let totalAmount = 0;
  for (const expense of expenses) {
    if (!Number.isInteger(expense.amount) || expense.amount <= 0) throw new Error("Expense amount must be a positive integer yen amount.");
    if (!balanceByUid.has(expense.paidByUid)) throw new Error("Payer is not a participant.");
    const sharers = [...new Set(expense.participantUids)];
    if (sharers.length === 0 || sharers.some((uid) => !balanceByUid.has(uid))) throw new Error("Expense participants must be meetup participants.");
    balanceByUid.set(expense.paidByUid, (balanceByUid.get(expense.paidByUid) ?? 0) + expense.amount);
    const baseShare = Math.floor(expense.amount / sharers.length);
    const remainder = expense.amount % sharers.length;
    [...sharers].sort().forEach((uid, index) => balanceByUid.set(uid, (balanceByUid.get(uid) ?? 0) - baseShare - (index < remainder ? 1 : 0)));
    totalAmount += expense.amount;
  }

  const creditors = [...balanceByUid.entries()].filter(([, amount]) => amount > 0).map(([uid, amount]) => ({ uid, amount })).sort((a, b) => b.amount - a.amount || a.uid.localeCompare(b.uid));
  const debtors = [...balanceByUid.entries()].filter(([, amount]) => amount < 0).map(([uid, amount]) => ({ uid, amount: -amount })).sort((a, b) => b.amount - a.amount || a.uid.localeCompare(b.uid));
  const transfers: Transfer[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;
  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex]!;
    const debtor = debtors[debtorIndex]!;
    const amount = Math.min(creditor.amount, debtor.amount);
    transfers.push({ fromUid: debtor.uid, toUid: creditor.uid, amount });
    creditor.amount -= amount;
    debtor.amount -= amount;
    if (creditor.amount === 0) creditorIndex += 1;
    if (debtor.amount === 0) debtorIndex += 1;
  }

  return { balances: participantUids.map((participantUid) => ({ participantUid, amount: balanceByUid.get(participantUid) ?? 0 })), transfers, totalAmount };
}
