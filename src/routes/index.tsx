import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, CalendarClock, CircleDollarSign, Info, TrendingUp, UserCheck, UserX, Users } from "lucide-react";
import { useFinance } from "@/lib/finance/store";
import { useAlerts } from "@/lib/finance/alerts";
import {
  addMonths, forecast, invoiceAllocatedTotal, invoiceLaunchesTotal, limitStatus, monthInvoices, monthTxs, personMonthTotal, totalFutureCommitted, txStatus,
} from "@/lib/finance/calc";
import { fmtBRL, fmtMonthLong, round2 } from "@/lib/finance/format";
import { KpiCard, LimitBar, PageHeader, Panel } from "@/components/app/common";
import { LimitBadge } from "@/components/app/badges";
import { TransactionTable } from "@/components/app/TransactionTable";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Visão geral — Fatura em Dia" },
      { name: "description", content: "Panorama do mês: total das faturas, compras atribuídas, pendências, parcelas futuras e limites." },
      { property: "og:title", content: "Visão geral — Fatura em Dia" },
      { property: "og:description", content: "Panorama financeiro mensal dos seus cartões de crédito." },
    ],
  }),
  component: Overview,
});

function Overview() {
  const { state } = useFinance();
  const m = state.settings.month;
  const invs = monthInvoices(state, m);
  const official = round2(invs.reduce((s, i) => s + i.officialTotal, 0));
  const launches = round2(invs.reduce((s, i) => s + invoiceLaunchesTotal(state, i), 0));
  const allocated = round2(invs.reduce((s, i) => s + invoiceAllocatedTotal(state, i), 0));
  const pending = monthTxs(state, m).filter((t) => txStatus(t) === "pendente");
  const pendingTotal = round2(pending.reduce((s, t) => s + t.amount, 0));
  const future = totalFutureCommitted(state, m);
  const nextMonth = addMonths(m, 1);
  const nextMonthInvoices = monthInvoices(state, nextMonth);
  const nextMonthTxs = monthTxs(state, nextMonth).filter((t) => t.type !== "pagamento");
  const nextMonthExpected = round2(forecast(state, m, 1)[0]?.value ?? 0);
  const nextMonthActual = round2(nextMonthTxs.reduce((sum, transaction) => sum + transaction.amount, 0));
  const nextMonthExtra = round2(Math.max(0, nextMonthActual - nextMonthExpected));
  const [showExtra, setShowExtra] = useState(false);
  const people = state.people.filter((p) => p.active).map((p) => ({ ...p, total: personMonthTotal(state, p.id, m) }));
  const extraByPerson = people.map((person) => {
    const actual = personMonthTotal(state, person.id, nextMonth);
    const expected = forecast(state, m, 1, person.id)[0]?.value ?? 0;
    return { ...person, extra: round2(Math.max(0, actual - expected)), actual: round2(actual), expected: round2(expected) };
  }).filter((person) => person.extra > 0);
  const atRisk = people.filter((p) => limitStatus(p.total, p.limit, state.settings.warnPct) !== "normal");
  const alerts = useAlerts();

  return (
    <>
      <PageHeader title="Visão geral" description={`Panorama de ${fmtMonthLong(m)}`} showMonth />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Total das faturas" value={fmtBRL(official)} hint={`${invs.length} fatura(s) · lançamentos ${fmtBRL(launches)}`} icon={<CircleDollarSign />} />
        <KpiCard label="Atribuído a pessoas" value={fmtBRL(allocated)} hint={official ? `${Math.round((allocated / official) * 100)}% do total oficial` : "—"} icon={<UserCheck />} tone="success" />
        <KpiCard label="A identificar" value={pending.length} hint={`${fmtBRL(pendingTotal)} sem responsável`} icon={<UserX />} tone={pending.length ? "warning" : "success"} />
        <KpiCard label="Parcelas futuras" value={fmtBRL(future)} hint="Não somado à fatura atual" icon={<CalendarClock />} />
        <KpiCard label="Perto ou acima do limite" value={atRisk.length} hint={`de ${people.length} pessoas ativas`} icon={<Users />} tone={atRisk.some((p) => p.total > p.limit) ? "danger" : atRisk.length ? "warning" : "success"} />
      </div>

      <Panel className="mt-6" title={`Próximo mês · ${fmtMonthLong(nextMonth)}`} description="Estimativa considerando apenas parcelas e compromissos já conhecidos">
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Se não gastar nada" value={fmtBRL(nextMonthExpected)} hint="Parcelas já comprometidas" icon={<CalendarClock />} />
          <KpiCard label="Já lançado" value={fmtBRL(nextMonthActual)} hint={nextMonthInvoices.length ? `${nextMonthInvoices.length} fatura(s) importada(s)` : "Nenhuma fatura importada"} />
          <KpiCard label="Gastou a mais" value={fmtBRL(nextMonthExtra)} hint="Itens novos além do previsto" tone={nextMonthExtra > 0 ? "warning" : "success"} icon={<TrendingUp />} />
          <div className="flex items-center justify-center">
            <Button variant="outline" onClick={() => setShowExtra((visible) => !visible)}><TrendingUp className="size-4" /> {showExtra ? "Ocultar gastos extras" : "Gastou a mais"}</Button>
          </div>
        </div>
        {showExtra && (
          <div className="border-t px-4 py-3">
            {!nextMonthInvoices.length ? (
              <p className="text-sm text-muted-foreground">Importe a fatura de {fmtMonthLong(nextMonth)} para identificar os itens novos e calcular quanto cada pessoa gastou a mais.</p>
            ) : extraByPerson.length === 0 ? (
              <p className="text-sm font-medium text-success">Nenhum gasto novo acima das parcelas previstas foi identificado.</p>
            ) : (
              <div>
                <p className="mb-2 text-sm font-semibold">Itens novos acima do comprometido, por pessoa</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {extraByPerson.map((person) => <div key={person.id} className="flex items-center justify-between rounded-lg bg-warning-soft px-3 py-2 text-sm"><span>{person.name}</span><span className="num font-bold">{fmtBRL(person.extra)}</span></div>)}
                </div>
              </div>
            )}
          </div>
        )}
      </Panel>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Pendências de classificação"
          description="Clique com o botão direito ou use ⋯ para direcionar"
          actions={<Button asChild variant="outline" size="sm"><Link to="/compras" search={{ status: "pendente" }}>Ver todas</Link></Button>}
        >
          <TransactionTable txs={pending} showType={false} emptyTitle="Nenhuma pendência" emptyDescription="Todas as compras deste mês já têm responsável." />
        </Panel>

        <Panel title="Alertas" description={`${alerts.length} item(ns)`}>
          <ul className="divide-y">
            {alerts.length === 0 && <li className="p-4 text-sm text-muted-foreground">Nenhum alerta para este mês.</li>}
            {alerts.map((a) => (
              <li key={a.id}>
                <Link to={a.to} className="flex gap-3 px-4 py-3 text-sm hover:bg-muted/50">
                  {a.tone === "info" ? <Info className="mt-0.5 size-4 shrink-0 text-info" /> : <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", a.tone === "danger" ? "text-danger" : "text-warning")} />}
                  {a.text}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel className="mt-6" title="Gastos por pessoa" description="Valores atribuídos no mês de referência">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="[&_th]:px-4 [&_th]:py-2.5">
                <th>Pessoa</th><th className="text-right">Atribuído</th><th className="text-right">Limite</th><th className="w-56">Uso</th><th>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {people.map((p) => (
                <tr key={p.id} className="[&_td]:px-4 [&_td]:py-3 hover:bg-muted/40">
                  <td><Link to="/pessoas/$id" params={{ id: p.id }} className="font-semibold hover:underline">{p.name}</Link></td>
                  <td className="num text-right font-semibold">{fmtBRL(p.total)}</td>
                  <td className="num text-right text-muted-foreground">{fmtBRL(p.limit)}</td>
                  <td><LimitBar total={p.total} limit={p.limit} /></td>
                  <td><LimitBadge status={limitStatus(p.total, p.limit, state.settings.warnPct)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
