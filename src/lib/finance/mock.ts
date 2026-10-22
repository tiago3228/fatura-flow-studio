import type { FinanceState, Transaction } from "./types";

/**
 * DADOS DE DEMONSTRAÇÃO — fictícios.
 * Os totais foram montados para que os indicadores batam com as tabelas:
 * - Tiago: R$ 1.230,00 de R$ 1.500,00 (82% — atenção)
 * - Mariana: R$ 1.150,00 de R$ 1.000,00 (ultrapassou em R$ 150,00)
 * - Pedro: R$ 857,90 de R$ 2.000,00 (normal)
 * - Fatura Itaú out/2026 com diferença de conciliação de R$ 12,40
 */
const T = "p_tiago";
const M = "p_mariana";
const P = "p_pedro";

const tx = (
  id: string,
  invoiceId: string,
  date: string,
  description: string,
  amount: number,
  type: Transaction["type"],
  allocations: Transaction["allocations"] = [],
  extra: Partial<Transaction> = {},
): Transaction => ({ id, invoiceId, date, description, amount, type, allocations, ...extra });

export const createDemoState = (): FinanceState => ({
  settings: {
    month: "2026-10",
    warnPct: 80,
    compact: false,
    csvSeparator: ";",
    duplicateCheck: true,
    persist: true,
  },
  people: [
    { id: T, name: "Tiago Cardoso", limit: 1500, active: true, cardIds: ["c_nubank", "c_itau"], notes: "Irmão" },
    { id: M, name: "Mariana Souza", limit: 1000, active: true, cardIds: ["c_nubank", "c_itau"] },
    { id: P, name: "Pedro Lima", limit: 2000, active: true, cardIds: ["c_itau", "c_nubank"], notes: "Divide a geladeira e o streaming" },
  ],
  cards: [
    { id: "c_nubank", name: "Nubank Roxinho", issuer: "Nubank", brand: "Mastercard", last4: "7432", closingDay: 16, dueDay: 23, active: true },
    { id: "c_itau", name: "Itaú Click", issuer: "Itaú", brand: "Visa", last4: "1058", closingDay: 5, dueDay: 12, active: true },
  ],
  invoices: [
    { id: "inv_nu_2026_10", cardId: "c_nubank", month: "2026-10", dueDate: "2026-10-23", officialTotal: 1685.3, status: "em_revisao", source: "demo" },
    { id: "inv_it_2026_10", cardId: "c_itau", month: "2026-10", dueDate: "2026-10-12", officialTotal: 1890.82, status: "inconsistente", source: "demo" },
    { id: "inv_nu_2026_09", cardId: "c_nubank", month: "2026-09", dueDate: "2026-09-23", officialTotal: 1146.3, status: "conferida", source: "demo" },
    { id: "inv_it_2026_09", cardId: "c_itau", month: "2026-09", dueDate: "2026-09-12", officialTotal: 690.3, status: "conferida", source: "demo" },
  ],
  plans: [
    {
      id: "pl_tv", description: "Smart TV Samsung 55\"", cardId: "c_nubank", purchaseDate: "2026-01-20",
      total: 3200, amounts: Array(10).fill(320), firstMonth: "2026-02", shares: [{ personId: T, pct: 100 }],
    },
    {
      id: "pl_note", description: "Notebook Dell Inspiron", cardId: "c_itau", purchaseDate: "2026-08-28",
      total: 2700, amounts: Array(6).fill(450), firstMonth: "2026-09", shares: [{ personId: M, pct: 100 }],
    },
    {
      id: "pl_sofa", description: "Sofá retrátil Tok&Stok", cardId: "c_itau", purchaseDate: "2026-04-02",
      total: 1500.03, amounts: [375, 375, 375, 375.03], firstMonth: "2026-05", shares: [{ personId: P, pct: 100 }],
    },
  ],
  transactions: [
    // Nubank out/2026
    tx("t1", "inv_nu_2026_10", "2026-09-18", "Supermercado Pão de Açúcar", 412.3, "compra", [{ personId: T, amount: 412.3 }]),
    tx("t2", "inv_nu_2026_10", "2026-09-20", "Posto Shell Av. Paulista", 250, "compra", [{ personId: T, amount: 250 }]),
    tx("t3", "inv_nu_2026_10", "2026-09-22", "Netflix.com", 55.9, "compra", [{ personId: T, amount: 27.95 }, { personId: M, amount: 27.95 }]),
    tx("t4", "inv_nu_2026_10", "2026-09-25", "Lojas Renner", 389.9, "compra", [{ personId: M, amount: 389.9 }]),
    tx("t5", "inv_nu_2026_10", "2026-09-27", "iFood *Restaurante", 87.4, "compra"),
    tx("t6", "inv_nu_2026_10", "2026-10-01", "Smart TV Samsung 55\"", 320, "parcela", [{ personId: T, amount: 320 }], { planId: "pl_tv", installmentNumber: 9, installmentTotal: 10 }),
    tx("t7", "inv_nu_2026_10", "2026-10-03", "Drogasil", 64.8, "compra"),
    tx("t8", "inv_nu_2026_10", "2026-10-05", "Estorno Lojas Renner", -89.9, "estorno", [{ personId: M, amount: -89.9 }]),
    tx("t9", "inv_nu_2026_10", "2026-10-08", "Amazon.com.br", 159.9, "compra", [{ personId: M, amount: 159.9 }]),
    tx("t10", "inv_nu_2026_10", "2026-10-10", "Anuidade diferenciada", 35, "tarifa"),
    tx("t11", "inv_nu_2026_10", "2026-10-02", "Pagamento recebido — fatura set/2026", -1146.3, "pagamento"),
    // Itaú out/2026
    tx("t20", "inv_it_2026_10", "2026-09-06", "Uber *Trip", 219.75, "compra", [{ personId: T, amount: 219.75 }]),
    tx("t21", "inv_it_2026_10", "2026-09-08", "Notebook Dell Inspiron", 450, "parcela", [{ personId: M, amount: 450 }], { planId: "pl_note", installmentNumber: 2, installmentTotal: 6 }),
    tx("t22", "inv_it_2026_10", "2026-09-12", "Decathlon", 212.15, "compra", [{ personId: M, amount: 212.15 }]),
    tx("t23", "inv_it_2026_10", "2026-09-15", "Leroy Merlin", 540, "compra", [{ personId: P, amount: 540 }]),
    tx("t24", "inv_it_2026_10", "2026-09-18", "Spotify", 21.9, "compra", [{ personId: P, amount: 21.9 }]),
    tx("t25", "inv_it_2026_10", "2026-09-21", "Outback Steakhouse", 296, "compra", [{ personId: P, amount: 296 }]),
    tx("t26", "inv_it_2026_10", "2026-09-28", "Mercado Livre", 134.5, "compra"),
    tx("t27", "inv_it_2026_10", "2026-10-01", "IOF compra internacional", 4.12, "tarifa"),
    // Nubank set/2026
    tx("t40", "inv_nu_2026_09", "2026-08-19", "Carrefour", 380.5, "compra", [{ personId: T, amount: 380.5 }]),
    tx("t41", "inv_nu_2026_09", "2026-08-22", "Netflix.com", 55.9, "compra", [{ personId: T, amount: 27.95 }, { personId: M, amount: 27.95 }]),
    tx("t42", "inv_nu_2026_09", "2026-08-25", "Riachuelo", 210, "compra", [{ personId: M, amount: 210 }]),
    tx("t43", "inv_nu_2026_09", "2026-09-01", "Smart TV Samsung 55\"", 320, "parcela", [{ personId: T, amount: 320 }], { planId: "pl_tv", installmentNumber: 8, installmentTotal: 10 }),
    tx("t44", "inv_nu_2026_09", "2026-09-04", "Posto Ipiranga", 180, "compra", [{ personId: P, amount: 180 }]),
    // Itaú set/2026
    tx("t50", "inv_it_2026_09", "2026-08-08", "Notebook Dell Inspiron", 450, "parcela", [{ personId: M, amount: 450 }], { planId: "pl_note", installmentNumber: 1, installmentTotal: 6 }),
    tx("t51", "inv_it_2026_09", "2026-08-10", "Uber *Trip", 98.4, "compra", [{ personId: T, amount: 98.4 }]),
    tx("t52", "inv_it_2026_09", "2026-08-18", "Spotify", 21.9, "compra", [{ personId: P, amount: 21.9 }]),
    tx("t53", "inv_it_2026_09", "2026-08-24", "Cinemark", 120, "compra", [{ personId: P, amount: 60 }, { personId: M, amount: 60 }]),
  ],
});

/** Fatura demonstrativa usada no fluxo de "importação de PDF" (não é extraída do arquivo) */
export const demoPdfInvoice = () => ({
  invoice: {
    id: "inv_nu_2026_11",
    cardId: "c_nubank",
    month: "2026-11",
    dueDate: "2026-11-23",
    officialTotal: 1012.4,
    status: "em_revisao" as const,
    source: "pdf_demo" as const,
  },
  transactions: [
    { id: "pd1", date: "2026-10-17", description: "Supermercado Extra", amount: 298.7, type: "compra" as const },
    { id: "pd2", date: "2026-10-19", description: "Netflix.com", amount: 55.9, type: "compra" as const },
    { id: "pd3", date: "2026-11-01", description: "Smart TV Samsung 55\" 10/10", amount: 320, type: "parcela" as const, planId: "pl_tv", installmentNumber: 10, installmentTotal: 10 },
    { id: "pd4", date: "2026-10-24", description: "Zara Brasil", amount: 249.9, type: "compra" as const },
    { id: "pd5", date: "2026-10-28", description: "Estorno Amazon", amount: -42.0, type: "estorno" as const },
    { id: "pd6", date: "2026-11-05", description: "PG *LOJA XYZ 0048", amount: 89.9, type: "compra" as const, review: "Descrição pouco clara — confira" },
    { id: "pd7", date: "2026-11-09", description: "Juros rotativo", amount: 40, type: "tarifa" as const },
  ],
});
