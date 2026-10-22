import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useFinance } from "@/lib/finance/store";
import { allocatedSum, invoiceAllocatedTotal, invoiceDiff, invoiceLaunchesTotal, invoiceTxs, isCreditType, txStatus } from "@/lib/finance/calc";
import { fmtBRL, fmtDate, fmtMonthLong } from "@/lib/finance/format";
import { EmptyState, KpiCard, Panel } from "@/components/app/common";
import { InvoiceStatusBadge } from "@/components/app/badges";
import { TransactionTable } from "@/components/app/TransactionTable";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/faturas/$id")({
  head: () => ({
    meta: [
      { title: "Detalhes da fatura — Fatura em Dia" },
      { name: "description", content: "Lançamentos da fatura, conciliação com o total oficial e distribuição por pessoa." },
      { property: "og:title", content: "Detalhes da fatura — Fatura em Dia" },
      { property: "og:description", content: "Confira os lançamentos e a conciliação da fatura." },
    ],
  }),
  component: FaturaDetalhe,
});

const TABS = [
  ["todas", "Todas"], ["atribuidas", "Atribuídas"], ["pendentes", "Pendentes"], ["parcelas", "Parcelamentos"], ["creditos", "Créditos e estornos"], ["tarifas", "Tarifas e encargos"],
] as const;

function FaturaDetalhe() {
  const { id } = Route.useParams();
  const { state, dispatch } = useFinance();
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("todas");
  const inv = state.invoices.find((i) => i.id === id);
  if (!inv) return <EmptyState title="Fatura não encontrada" action={<Button asChild variant="outline"><Link to="/faturas">Voltar para faturas</Link></Button>} />;
  const card = state.cards.find((c) => c.id === inv.cardId);
  const all = invoiceTxs(state, inv.id);
  const launches = invoiceLaunchesTotal(state, inv);
  const allocated = invoiceAllocatedTotal(state, inv);
  const diff = invoiceDiff(state, inv);
  const pend = all.filter((t) => txStatus(t) === "pendente");
  const filtered = all.filter((t) => {
    switch (tab) {
      case "atribuidas": return t.allocations.length > 0;
      case "pendentes": return txStatus(t) === "pendente";
      case "parcelas": return t.type === "parcela";
      case "creditos": return isCreditType(t.type);
      case "tarifas": return t.type === "tarifa";
      default: return true;
    }
  });
  const unallocated = all.filter((t) => t.type !== "pagamento").reduce((s, t) => s + (t.amount - allocatedSum(t)), 0);

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2"><Link to="/faturas"><ArrowLeft className="size-4" /> Faturas</Link></Button>
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2"><h1 className="text-2xl font-bold">{card?.name} •••• {card?.last4}</h1><InvoiceStatusBadge status={inv.status} /></div>
          <p className="text-sm text-muted-foreground">{card?.issuer} · {fmtMonthLong(inv.month)} · vencimento {fmtDate(inv.dueDate)}</p>
        </div>
        {inv.status !== "conferida" && (
          <Button
            variant="outline"
            onClick={() => {
              if (pend.length || diff !== 0) {
                toast.error("Ainda não é possível marcar como conferida", { description: `${pend.length} pendência(s)${diff !== 0 ? ` e diferença de ${fmtBRL(diff)}` : ""}.` });
                return;
              }
              dispatch({ type: "setInvoiceStatus", invoiceId: inv.id, status: "conferida" });
              toast.success("Fatura marcada como conferida");
            }}
          >
            <CheckCircle2 className="size-4" /> Marcar como conferida
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total oficial da fatura" value={fmtBRL(inv.officialTotal)} hint="Valor informado pelo banco" />
        <KpiCard label="Soma dos lançamentos" value={fmtBRL(launches)} hint={diff === 0 ? "Confere com o total oficial" : `Diferença de ${fmtBRL(diff)}`} tone={diff === 0 ? "success" : "danger"} />
        <KpiCard label="Distribuído entre pessoas" value={fmtBRL(allocated)} hint={`Falta distribuir ${fmtBRL(unallocated)}`} tone={unallocated ? "warning" : "success"} />
        <KpiCard label="Pendentes" value={pend.length} hint="Compras sem responsável" tone={pend.length ? "warning" : "success"} />
      </div>

      {diff !== 0 && (
        <p className="mt-4 flex gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
          <AlertTriangle className="size-4 shrink-0" /> A soma dos lançamentos não confere com o total oficial (diferença de {fmtBRL(diff)}). Verifique se falta algum lançamento — a diferença não é corrigida automaticamente.
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">Parcelas futuras de compras parceladas não entram neste total — veja em Parcelamentos.</p>

      <Panel className="mt-4">
        <div className="overflow-x-auto border-b p-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              {TABS.map(([k, l]) => <TabsTrigger key={k} value={k}>{l}</TabsTrigger>)}
            </TabsList>
          </Tabs>
        </div>
        <TransactionTable txs={filtered} showCard={false} emptyTitle="Nada nesta categoria" />
      </Panel>
    </>
  );
}
