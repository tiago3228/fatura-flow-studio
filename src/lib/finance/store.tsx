import { createContext, useContext, useEffect, useReducer, useRef, type ReactNode } from "react";
import { createDemoState } from "./mock";
import { planStatusAt } from "./calc";
import type {
  Allocation, CreditCard, FinanceState, InstallmentPlan, Invoice, Person, Settings, Transaction, TxType,
} from "./types";

const STORAGE_KEY = "fatura-organizer-real-itau-v2";

export type Action =
  | { type: "hydrate"; state: FinanceState }
  | { type: "reset" }
  | { type: "setMonth"; month: string }
  | { type: "updateSettings"; patch: Partial<Settings> }
  | { type: "allocate"; txIds: string[]; personId: string }
  | { type: "split"; txId: string; allocations: Allocation[]; adjustmentNote?: string }
  | { type: "unassign"; txIds: string[] }
  | { type: "setTxType"; txId: string; txType: TxType }
  | { type: "upsertPerson"; person: Person }
  | { type: "deletePerson"; personId: string }
  | { type: "upsertCard"; card: CreditCard }
  | { type: "upsertPlan"; plan: InstallmentPlan }
  | { type: "deletePlan"; planId: string }
  | { type: "importInvoice"; invoice: Invoice; transactions: Transaction[] }
  | { type: "setInvoiceStatus"; invoiceId: string; status: Invoice["status"] };

const upsert = <T extends { id: string }>(list: T[], item: T) =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];

const transactionMatchKey = (transaction: Pick<Transaction, "description" | "amount">) =>
  `${transaction.description.toLowerCase().replace(/\b\d{1,2}\s*\/\s*\d{1,2}\b/g, "").replace(/[^a-z0-9]+/g, " ").trim()}|${transaction.amount.toFixed(2)}`;

const previousInvoiceFor = (state: FinanceState, invoice: Invoice) =>
  state.invoices
    .filter((candidate) => candidate.cardId === invoice.cardId && candidate.id !== invoice.id && candidate.month <= invoice.month)
    .sort((a, b) => b.month.localeCompare(a.month))[0];

const reconcileImportedTransactions = (state: FinanceState, invoice: Invoice, incoming: Transaction[]) => {
  const previous = previousInvoiceFor(state, invoice);
  if (!previous) return incoming;
  const candidates = state.transactions.filter((transaction) => transaction.invoiceId === previous.id);
  const used = new Set<string>();
  const transactions = incoming.map((transaction) => {
    const match = candidates.find((candidate) => !used.has(candidate.id) && transactionMatchKey(candidate) === transactionMatchKey(transaction));
    if (!match) return transaction;
    used.add(match.id);
    const restored: Transaction = {
      ...transaction,
      allocations: match.allocations,
      ...(match.adjustmentNote !== undefined ? { adjustmentNote: match.adjustmentNote } : {}),
    };
    if (match.planId !== undefined) restored.planId = match.planId;
    if (transaction.installmentNumber === undefined && match.installmentNumber !== undefined) restored.installmentNumber = match.installmentNumber;
    if (transaction.installmentTotal === undefined && match.installmentTotal !== undefined) restored.installmentTotal = match.installmentTotal;
    return restored;
  });
  return transactions;
};

export function reducer(s: FinanceState, a: Action): FinanceState {
  switch (a.type) {
    case "hydrate":
      return a.state;
    case "reset":
      return createDemoState();
    case "setMonth":
      return { ...s, settings: { ...s.settings, month: a.month } };
    case "updateSettings":
      return { ...s, settings: { ...s.settings, ...a.patch } };
    case "allocate":
      return {
        ...s,
        transactions: s.transactions.map((t) =>
          a.txIds.includes(t.id) && t.type !== "pagamento"
            ? { ...t, allocations: [{ personId: a.personId, amount: t.amount }], adjustmentNote: undefined }
            : t,
        ),
      };
    case "split":
      return {
        ...s,
        transactions: s.transactions.map((t) =>
          t.id === a.txId ? { ...t, allocations: a.allocations, adjustmentNote: a.adjustmentNote } : t,
        ),
      };
    case "unassign":
      return {
        ...s,
        transactions: s.transactions.map((t) =>
          a.txIds.includes(t.id) ? { ...t, allocations: [], adjustmentNote: undefined } : t,
        ),
      };
    case "setTxType":
      return {
        ...s,
        transactions: s.transactions.map((t) =>
          t.id === a.txId
            ? { ...t, type: a.txType, allocations: a.txType === "pagamento" ? [] : t.allocations }
            : t,
        ),
      };
    case "upsertPerson":
      return { ...s, people: upsert(s.people, a.person) };
    case "deletePerson":
      return {
        ...s,
        people: s.people.filter((p) => p.id !== a.personId),
        // Compras da pessoa voltam para pendências (nada é descartado silenciosamente)
        transactions: s.transactions.map((t) =>
          t.allocations.some((x) => x.personId === a.personId) ? { ...t, allocations: [] } : t,
        ),
        plans: s.plans.map((p) => ({ ...p, shares: p.shares.filter((x) => x.personId !== a.personId) })),
      };
    case "upsertCard":
      return { ...s, cards: upsert(s.cards, a.card) };
    case "upsertPlan":
      return { ...s, plans: upsert(s.plans, a.plan) };
    case "deletePlan":
      return {
        ...s,
        plans: s.plans.filter((p) => p.id !== a.planId),
        transactions: s.transactions.map((t) => (t.planId === a.planId ? { ...t, planId: undefined } : t)),
      };
    case "importInvoice":
      {
        const reconciled = reconcileImportedTransactions(s, a.invoice, a.transactions);
        return {
          ...s,
          invoices: upsert(s.invoices, a.invoice),
          plans: s.plans.filter((plan) => plan.cardId !== a.invoice.cardId || planStatusAt(plan, a.invoice.month) !== "finalizado"),
          transactions: [
            ...s.transactions.filter((transaction) => transaction.invoiceId !== a.invoice.id),
            ...reconciled,
          ],
        };
      }
    case "setInvoiceStatus":
      return {
        ...s,
        invoices: s.invoices.map((i) => (i.id === a.invoiceId ? { ...i, status: a.status } : i)),
      };
  }
}

const Ctx = createContext<{ state: FinanceState; dispatch: React.Dispatch<Action> } | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createDemoState);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "hydrate", state: JSON.parse(raw) });
    } catch {
      /* dados corrompidos: mantém demonstração */
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      if (state.settings.persist) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, [state]);

  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useFinance() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFinance fora do FinanceProvider");
  return v;
}
