import {
  TX_TYPE_LABEL, addMonths, forecast, monthTxs, personMonthTotal, planAmountAt, planFutureCommitted, planNumberAt, planStatusAt, txCard,
} from "./calc";
import { fmtDate, fmtMonth, fmtMonthLong, round2 } from "./format";
import type { ExportTable } from "./export";
import type { FinanceState } from "./types";

export function personReport(s: FinanceState, personId: string, month: string) {
  const p = s.people.find((x) => x.id === personId)!;
  const txs = monthTxs(s, month).filter((t) => t.allocations.some((a) => a.personId === personId));
  const rows = txs
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => {
      const share = t.allocations.find((a) => a.personId === personId)!.amount;
      const c = txCard(s, t);
      return {
        tx: t,
        share,
        split: t.allocations.length > 1,
        card: c ? `${c.name} •••• ${c.last4}` : "—",
      };
    });
  const total = personMonthTotal(s, personId, month);
  const plans = s.plans
    .filter((pl) => pl.shares.some((x) => x.personId === personId) && planStatusAt(pl, month) === "ativo")
    .map((pl) => {
      const pct = pl.shares.find((x) => x.personId === personId)!.pct;
      return {
        plan: pl,
        pct,
        current: planNumberAt(pl, month),
        monthValue: round2((planAmountAt(pl, month) * pct) / 100),
        future: round2((planFutureCommitted(pl, month) * pct) / 100),
      };
    });
  const history = Array.from({ length: 6 }, (_, i) => addMonths(month, -5 + i)).map((m) => ({ month: m, total: personMonthTotal(s, personId, m) }));
  const fc = forecast(s, month, 6, personId);
  return { person: p, rows, total, plans, history, forecast: fc, splitTotal: round2(rows.filter((r) => r.split).reduce((a, r) => a + r.share, 0)) };
}

export function personReportTable(s: FinanceState, personId: string, month: string): ExportTable {
  const r = personReport(s, personId, month);
  return {
    title: `Relatório de gastos — ${r.person.name}`,
    subtitle: `${fmtMonthLong(month)} · Limite ${r.person.limit.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · Saldo ${(r.person.limit - r.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
    headers: ["Data", "Descrição", "Cartão", "Tipo", "Valor original", "Parte da pessoa"],
    rows: r.rows.map((x) => [
      fmtDate(x.tx.date),
      x.tx.description + (x.tx.installmentNumber ? ` (${x.tx.installmentNumber}/${x.tx.installmentTotal})` : "") + (x.split ? " [dividida]" : ""),
      x.card,
      TX_TYPE_LABEL[x.tx.type],
      x.tx.amount,
      x.share,
    ]),
    footer: ["", "Total do mês", "", "", "", r.total],
  };
}

export function peopleSummaryTable(s: FinanceState, month: string): ExportTable {
  return {
    title: "Gastos por pessoa",
    subtitle: fmtMonthLong(month),
    headers: ["Pessoa", "Limite", "Atribuído", "Saldo", "% usado"],
    rows: s.people.map((p) => {
      const t = personMonthTotal(s, p.id, month);
      return [p.name, p.limit, t, round2(p.limit - t), `${Math.round(p.limit ? (t / p.limit) * 100 : 0)}%`];
    }),
  };
}

export const monthLabel = fmtMonth;
