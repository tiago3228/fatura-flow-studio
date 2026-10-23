import { describe, expect, it } from "vitest";

import { createDemoState } from "@/lib/finance/mock";
import { monthTxs, personMonthTotal, txCard } from "@/lib/finance/calc";

describe("separação inicial da fatura por titular", () => {
  it("atribui cada compra ao titular do cartão e calcula os totais", () => {
    const state = createDemoState();
    const monthTransactions = monthTxs(state, "2026-10");

    expect(monthTransactions.length).toBeGreaterThan(0);
    expect(monthTransactions.every((transaction) => transaction.allocations.length === 1)).toBe(true);
    expect(monthTransactions.every((transaction) => {
      const card = txCard(state, transaction);
      const allocation = transaction.allocations[0];
      return card !== undefined && allocation !== undefined && state.people.find((person) => person.id === allocation.personId)?.cardIds.includes(card.id);
    })).toBe(true);

    const tiagoTotal = personMonthTotal(state, "p_tiago", "2026-10");
    const atenaTotal = personMonthTotal(state, "p_atena", "2026-10");
    expect(tiagoTotal).toBeGreaterThan(0);
    expect(atenaTotal).toBeGreaterThan(0);
    expect(tiagoTotal + atenaTotal).toBeCloseTo(monthTransactions.reduce((sum, transaction) => sum + transaction.amount, 0), 2);
  });
});
