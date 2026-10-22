import { useRef, useState } from "react";
import { AlertTriangle, Check, FileText, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useFinance } from "@/lib/finance/store";
import { demoPdfInvoice } from "@/lib/finance/mock";
import { TX_TYPE_LABEL, isCreditType } from "@/lib/finance/calc";
import { fmtBRL, fmtDate, fmtMonthLong, parseBRL, round2 } from "@/lib/finance/format";
import type { Transaction, TxType } from "@/lib/finance/types";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DemoTag } from "./common";
import { cn } from "@/lib/utils";

type Step = "select" | "processing" | "review";
const STAGES = ["Arquivo selecionado", "Leitura simulada", "Conferência", "Conclusão"];

export function PdfImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { state, dispatch } = useFinance();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("select");
  const [stage, setStage] = useState(0);
  const [drag, setDrag] = useState(false);
  const [onlyReview, setOnlyReview] = useState(false);
  const demo = demoPdfInvoice();
  const [rows, setRows] = useState(() => demo.transactions.map((t) => ({ ...t, amountStr: t.amount.toFixed(2).replace(".", ",") })));
  const input = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null); setError(null); setStep("select"); setStage(0); setOnlyReview(false);
    setRows(demo.transactions.map((t) => ({ ...t, amountStr: t.amount.toFixed(2).replace(".", ",") })));
  };
  const close = () => { onOpenChange(false); setTimeout(reset, 200); };

  const pick = (f?: File | null) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf")) { setError("Selecione um arquivo com extensão .pdf"); setFile(null); return; }
    setError(null); setFile(f);
  };

  const process = () => {
    if (!file) { setError("Nenhum arquivo selecionado."); return; }
    setStep("processing"); setStage(1);
    setTimeout(() => setStage(2), 900);
    setTimeout(() => { setStage(3); setStep("review"); }, 1800);
  };

  const card = state.cards.find((c) => c.id === demo.invoice.cardId)!;
  const parsed = rows.map((r) => ({ ...r, value: parseBRL(r.amountStr) }));
  const invalid = parsed.filter((r) => r.value === null || !r.description.trim());
  const sum = round2(parsed.reduce((s, r) => s + (r.value ?? 0), 0));
  const diff = round2(demo.invoice.officialTotal - sum);
  const already = state.invoices.some((i) => i.id === demo.invoice.id);
  const credits = parsed.filter((r) => isCreditType(r.type));
  const installments = parsed.filter((r) => r.type === "parcela");
  const reviewItems = parsed.filter((r) => "review" in r && r.review);
  const visible = onlyReview ? parsed.filter((r) => ("review" in r && r.review) || r.value === null) : parsed;

  const confirm = () => {
    const txs: Transaction[] = parsed.map((r) => ({
      id: `${demo.invoice.id}_${r.id}`,
      invoiceId: demo.invoice.id,
      date: r.date,
      description: r.description.trim(),
      amount: r.value!,
      type: r.type,
      planId: "planId" in r ? r.planId : undefined,
      installmentNumber: "installmentNumber" in r ? r.installmentNumber : undefined,
      installmentTotal: "installmentTotal" in r ? r.installmentTotal : undefined,
      allocations: [],
    }));
    dispatch({ type: "importInvoice", invoice: { ...demo.invoice, status: diff === 0 ? "em_revisao" : "inconsistente" }, transactions: txs });
    toast.success("Importação demonstrativa concluída", { description: `Fatura ${card.name} de ${fmtMonthLong(demo.invoice.month)} adicionada com ${txs.length} lançamentos fictícios.` });
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className={cn("max-h-[92vh] overflow-y-auto", step === "review" ? "sm:max-w-4xl" : "sm:max-w-lg")}>
        <DialogHeader>
          <DialogTitle>Importar fatura PDF</DialogTitle>
          <DialogDescription>
            Nesta versão o PDF <b>não é lido</b>. Após selecionar o arquivo, mostramos uma fatura fictícia para demonstrar a conferência.
          </DialogDescription>
        </DialogHeader>

        <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {STAGES.map((s, i) => (
            <li key={s} className={cn("flex items-center gap-1.5", i <= stage ? "font-semibold text-primary" : "text-muted-foreground")}>
              <span className={cn("grid size-5 place-items-center rounded-full border text-[10px]", i < stage && "border-primary bg-primary text-primary-foreground", i === stage && "border-primary")}>
                {i < stage ? <Check className="size-3" /> : i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>

        {step === "select" && (
          <>
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
              onClick={() => input.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
              className={cn("flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors hover:bg-muted/50", drag && "border-primary bg-accent", error && "border-danger")}
            >
              <Upload className="size-6 text-muted-foreground" />
              <p className="font-semibold">Arraste o PDF aqui ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground">Apenas arquivos .pdf</p>
              <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => pick(e.target.files?.[0])} aria-label="Arquivo PDF da fatura" />
            </div>
            {file && (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
                <FileText className="size-5 text-primary" />
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{file.name}</p><p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p></div>
                <Button variant="ghost" size="sm" onClick={() => setFile(null)}>Trocar</Button>
              </div>
            )}
            {error && <p className="text-sm font-medium text-danger">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={close}>Cancelar</Button>
              <Button onClick={process} disabled={!file}>Continuar</Button>
            </DialogFooter>
          </>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="font-semibold">{stage === 1 ? "Leitura simulada…" : "Preparando conferência…"}</p>
            <p className="text-sm text-muted-foreground">Nenhum dado está sendo extraído do arquivo.</p>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2"><DemoTag /><span className="text-xs text-muted-foreground">Arquivo: {file?.name} — conteúdo abaixo é fictício</span></div>
            <div className="grid gap-3 rounded-lg border p-3 text-sm sm:grid-cols-4">
              <div><p className="text-xs text-muted-foreground">Cartão identificado</p><p className="font-semibold">{card.name} •••• {card.last4}</p></div>
              <div><p className="text-xs text-muted-foreground">Mês de referência</p><p className="font-semibold">{fmtMonthLong(demo.invoice.month)}</p></div>
              <div><p className="text-xs text-muted-foreground">Vencimento</p><p className="num font-semibold">{fmtDate(demo.invoice.dueDate)}</p></div>
              <div><p className="text-xs text-muted-foreground">Total oficial</p><p className="num font-semibold">{fmtBRL(demo.invoice.officialTotal)}</p></div>
            </div>

            <div className="grid gap-2 text-sm sm:grid-cols-4">
              <Stat label="Lançamentos" value={String(parsed.length)} />
              <Stat label="Parcelas identificadas" value={String(installments.length)} />
              <Stat label="Créditos e estornos" value={`${credits.length} · ${fmtBRL(credits.reduce((s, r) => s + (r.value ?? 0), 0))}`} />
              <Stat label="Soma x total oficial" value={diff === 0 ? "Confere" : `Diferença ${fmtBRL(diff)}`} tone={diff === 0 ? "ok" : "bad"} />
            </div>

            {(reviewItems.length > 0 || diff !== 0 || already || invalid.length > 0) && (
              <div className="space-y-1 rounded-lg bg-warning-soft p-3 text-sm text-warning">
                {already && <p className="flex gap-2"><AlertTriangle className="size-4 shrink-0" /> Esta fatura já foi importada. Confirmar substituirá os lançamentos anteriores dela.</p>}
                {reviewItems.length > 0 && <p className="flex gap-2"><AlertTriangle className="size-4 shrink-0" /> {reviewItems.length} item(ns) precisam de revisão.</p>}
                {diff !== 0 && <p className="flex gap-2"><AlertTriangle className="size-4 shrink-0" /> A soma dos lançamentos ({fmtBRL(sum)}) não confere com o total oficial. A diferença será mantida para conferência.</p>}
                {invalid.length > 0 && <p className="flex gap-2"><AlertTriangle className="size-4 shrink-0" /> {invalid.length} linha(s) com valor ou descrição inválidos.</p>}
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                  <tr className="[&_th]:px-3 [&_th]:py-2"><th>Data</th><th>Descrição</th><th>Tipo</th><th className="text-right">Valor (R$)</th></tr>
                </thead>
                <tbody className="divide-y">
                  {visible.map((r) => {
                    const flagged = ("review" in r && r.review) || r.value === null;
                    return (
                      <tr key={r.id} className={cn("[&_td]:px-3 [&_td]:py-1.5", flagged && "bg-warning-soft/50")}>
                        <td className="num whitespace-nowrap text-muted-foreground">{fmtDate(r.date)}</td>
                        <td>
                          <Input value={r.description} aria-label="Descrição" className="h-8" onChange={(e) => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, description: e.target.value } : x)))} />
                          {"review" in r && r.review && <p className="mt-0.5 text-xs text-warning">{r.review}</p>}
                        </td>
                        <td>
                          <Select value={r.type} onValueChange={(v) => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, type: v as TxType } : x)))}>
                            <SelectTrigger className="h-8 w-36" aria-label="Tipo"><SelectValue /></SelectTrigger>
                            <SelectContent>{(Object.keys(TX_TYPE_LABEL) as TxType[]).map((k) => <SelectItem key={k} value={k}>{TX_TYPE_LABEL[k]}</SelectItem>)}</SelectContent>
                          </Select>
                        </td>
                        <td><Input value={r.amountStr} aria-label="Valor" inputMode="decimal" className={cn("num h-8 w-28 text-right ml-auto", r.value === null && "border-danger")} onChange={(e) => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, amountStr: e.target.value } : x)))} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setStep("select"); setStage(0); }}>Voltar</Button>
              <Button variant="outline" onClick={() => setOnlyReview((v) => !v)}>{onlyReview ? "Mostrar todas" : "Revisar compras"}</Button>
              <Button onClick={confirm} disabled={invalid.length > 0}>Confirmar importação demonstrativa</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("num font-bold", tone === "ok" && "text-success", tone === "bad" && "text-danger")}>{value}</p>
    </div>
  );
}
