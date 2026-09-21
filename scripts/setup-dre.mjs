const TOKEN = "sbp_aaa3ed019b1c26f5b98f9993cb8f2f01b6be27c1";
const q = async (sql) => {
  const r = await fetch("https://api.supabase.com/v1/projects/qnyxluevbogwwtwtbpuu/database/query", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ query: sql }),
  });
  const d = await r.json();
  if (d.message) console.error("SQL Error:", d.message.substring(0, 200));
  return d;
};

// ══════════════════════════════════════════════════════════════
// SCHEMA
// ══════════════════════════════════════════════════════════════

console.log("Creating tables...");

await q(`
CREATE TABLE IF NOT EXISTS forecast_premissas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  versao TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_por TEXT,
  total_assinantes_base INTEGER NOT NULL DEFAULT 1000,
  mix_mensal NUMERIC(5,4) NOT NULL DEFAULT 0.4,
  mix_anual NUMERIC(5,4) NOT NULL DEFAULT 0.5,
  mix_bianual NUMERIC(5,4) NOT NULL DEFAULT 0.1,
  preco_mensal NUMERIC(10,2) NOT NULL DEFAULT 49.90,
  preco_anual NUMERIC(10,2) NOT NULL DEFAULT 350.90,
  preco_bianual NUMERIC(10,2) NOT NULL DEFAULT 599.90,
  taxa_renovacao_m_m NUMERIC(5,4) DEFAULT 0.3,
  taxa_renovacao_m_a NUMERIC(5,4) DEFAULT 0.5,
  taxa_renovacao_a_a NUMERIC(5,4) DEFAULT 0.5,
  cac NUMERIC(10,2) DEFAULT 60.00,
  ativo BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_fp_ativo ON forecast_premissas(ativo);
ALTER TABLE forecast_premissas ENABLE ROW LEVEL SECURITY;
`);

await q(`CREATE POLICY "Admins fp" ON forecast_premissas FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));`);

await q(`
CREATE TABLE IF NOT EXISTS dre_linhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita','deducao','custo','despesa','resultado','aporte')),
  nivel INTEGER NOT NULL CHECK (nivel BETWEEN 1 AND 3),
  ordem INTEGER NOT NULL,
  editavel BOOLEAN NOT NULL DEFAULT false,
  formula TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dl_ordem ON dre_linhas(ordem);
ALTER TABLE dre_linhas ENABLE ROW LEVEL SECURITY;
`);

await q(`CREATE POLICY "Admins dl" ON dre_linhas FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));`);

await q(`
CREATE TABLE IF NOT EXISTS dre_valores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dre_linha_id UUID NOT NULL REFERENCES dre_linhas(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano INTEGER NOT NULL CHECK (ano >= 2024),
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(dre_linha_id, mes, ano)
);
CREATE INDEX IF NOT EXISTS idx_dv_linha ON dre_valores(dre_linha_id);
CREATE INDEX IF NOT EXISTS idx_dv_periodo ON dre_valores(ano, mes);
ALTER TABLE dre_valores ENABLE ROW LEVEL SECURITY;
`);

await q(`CREATE POLICY "Admins dv" ON dre_valores FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));`);

console.log("Tables created!");

// ══════════════════════════════════════════════════════════════
// SEED: Premissas v1
// ══════════════════════════════════════════════════════════════

console.log("Seeding premissas...");
await q(`
INSERT INTO forecast_premissas (versao, criado_por, total_assinantes_base, mix_mensal, mix_anual, mix_bianual,
  preco_mensal, preco_anual, preco_bianual, taxa_renovacao_m_m, taxa_renovacao_m_a, taxa_renovacao_a_a, cac, ativo)
VALUES ('v1 - Abr/2026', 'Matheus Castro', 1000, 0.4, 0.5, 0.1, 49.90, 350.90, 599.90, 0.3, 0.5, 0.5, 60.00, true)
ON CONFLICT DO NOTHING;
`);

// ══════════════════════════════════════════════════════════════
// SEED: DRE Linhas (139 linhas)
// ══════════════════════════════════════════════════════════════

console.log("Seeding DRE linhas...");

const linhas = [
  // RECEITAS
  ["1",       "Receitas Operacionais Totais",   "receita",   1, 1,  false, "1.1 + 1.2"],
  ["1.1",     "Receitas Aquisição",             "receita",   2, 2,  false, "1.1.01 + 1.1.02 + 1.1.03"],
  ["1.1.01",  "Aquisição Mensal",               "receita",   3, 3,  true,  null],
  ["1.1.02",  "Aquisição Bianual",              "receita",   3, 4,  true,  null],
  ["1.1.03",  "Aquisição Anual",                "receita",   3, 5,  true,  null],
  ["1.2",     "Receitas Renovação",             "receita",   2, 6,  false, "1.2.01 + 1.2.02"],
  ["1.2.01",  "Renovação Mensal",               "receita",   3, 7,  true,  null],
  ["1.2.02",  "Renovação Anual",                "receita",   3, 8,  true,  null],

  // DEDUÇÕES
  ["2",       "Deduções Receita",               "deducao",   1, 10, false, "2.01 + 2.02 + 2.03"],
  ["2.01",    "DAS Simples",                    "deducao",   3, 11, true,  null],
  ["2.02",    "Tarifas Cartão",                 "deducao",   3, 12, true,  null],
  ["2.03",    "Tarifas Antecipação",            "deducao",   3, 13, true,  null],

  // RECEITA LÍQUIDA
  ["3",       "Receita Operacional Líquida",    "resultado", 1, 15, false, "1 - 2"],

  // CUSTOS
  ["4",       "Custos Operacionais",            "custo",     1, 20, false, "4.01 + 4.02 + 4.03 + 4.04 + 4.05"],
  ["4.01",    "CSP Gestor Tráfego",             "custo",     3, 21, true,  null],
  ["4.02",    "CSP Design",                     "custo",     3, 22, true,  null],
  ["4.03",    "CAC (Custo Aquisição)",          "custo",     3, 23, true,  null],
  ["4.04",    "CSP Castro",                     "custo",     3, 24, true,  null],
  ["4.05",    "CSP Thiago",                     "custo",     3, 25, true,  null],

  // LUCRO BRUTO
  ["5",       "Lucro Bruto",                    "resultado", 1, 30, false, "3 - 4"],

  // DESPESAS
  ["6",       "Despesas Totais",                "despesa",   1, 35, false, "6.01 + 6.02 + 6.03 + 6.04 + 6.05 + 6.06 + 6.07 + 6.08 + 6.09"],
  ["6.01",    "Remuneração Coordenador Adm",    "despesa",   3, 36, true,  null],
  ["6.02",    "Software e Ferramentas",         "despesa",   3, 37, true,  null],
  ["6.03",    "Assessoria Contábil",            "despesa",   3, 38, true,  null],
  ["6.04",    "Assessoria Jurídica",            "despesa",   3, 39, true,  null],
  ["6.05",    "Telefone e Internet",            "despesa",   3, 40, true,  null],
  ["6.06",    "Energia Elétrica",               "despesa",   3, 41, true,  null],
  ["6.07",    "Aluguel",                        "despesa",   3, 42, true,  null],
  ["6.08",    "Materiais",                      "despesa",   3, 43, true,  null],
  ["6.09",    "Limpeza",                        "despesa",   3, 44, true,  null],

  // RESULTADOS
  ["7",       "EBITDA",                         "resultado", 1, 50, false, "5 - 6"],
  ["8",       "EBIT",                           "resultado", 1, 55, false, "7"],
  ["9",       "Lucro Líquido",                  "resultado", 1, 60, false, "8"],

  // APORTE
  ["10",      "Aporte de Capital",              "aporte",    1, 65, true,  null],
];

for (const [codigo, descricao, tipo, nivel, ordem, editavel, formula] of linhas) {
  const formulaVal = formula ? `'${formula}'` : 'NULL';
  await q(`INSERT INTO dre_linhas (codigo, descricao, tipo, nivel, ordem, editavel, formula) VALUES ('${codigo}', '${descricao}', '${tipo}', ${nivel}, ${ordem}, ${editavel}, ${formulaVal}) ON CONFLICT (codigo) DO NOTHING;`);
}

console.log(`Seeded ${linhas.length} DRE linhas`);

// ══════════════════════════════════════════════════════════════
// SEED: DRE Valores (abril a dezembro 2026)
// ══════════════════════════════════════════════════════════════

console.log("Seeding DRE valores...");

// [codigo, [abr, mai, jun, jul, ago, set, out, nov, dez]]
const valores = [
  ["1",      [255400, 331568, 331568, 331568, 331568, 331568, 331568, 331568, 331568]],
  ["1.1",    [255400, 255400, 255400, 255400, 255400, 255400, 255400, 255400, 255400]],
  ["1.1.01", [19960, 19960, 19960, 19960, 19960, 19960, 19960, 19960, 19960]],
  ["1.1.02", [59990, 59990, 59990, 59990, 59990, 59990, 59990, 59990, 59990]],
  ["1.1.03", [175450, 175450, 175450, 175450, 175450, 175450, 175450, 175450, 175450]],
  ["1.2",    [0, 76168, 76168, 76168, 76168, 76168, 76168, 76168, 76168]],
  ["1.2.01", [0, 5988, 5988, 5988, 5988, 5988, 5988, 5988, 5988]],
  ["1.2.02", [0, 70180, 70180, 70180, 70180, 70180, 70180, 70180, 70180]],
  ["2",      [45794.5, 52649.62, 52649.62, 52649.62, 52649.62, 52649.62, 52649.62, 52649.62, 52649.62]],
  ["2.01",   [15324, 19894.08, 19894.08, 19894.08, 19894.08, 19894.08, 19894.08, 19894.08, 19894.08]],
  ["2.02",   [7662, 9947.04, 9947.04, 9947.04, 9947.04, 9947.04, 9947.04, 9947.04, 9947.04]],
  ["2.03",   [22808.5, 22808.5, 22808.5, 22808.5, 22808.5, 22808.5, 22808.5, 22808.5, 22808.5]],
  ["3",      [209605.5, 278918.38, 278918.38, 278918.38, 278918.38, 278918.38, 278918.38, 278918.38, 278918.38]],
  ["4",      [66000, 66000, 75000, 75000, 75000, 75000, 75000, 75000, 75000]],
  ["4.01",   [1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500]],
  ["4.02",   [1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500]],
  ["4.03",   [60000, 60000, 60000, 60000, 60000, 60000, 60000, 60000, 60000]],
  ["4.04",   [1500, 1500, 6000, 6000, 6000, 6000, 6000, 6000, 6000]],
  ["4.05",   [1500, 1500, 6000, 6000, 6000, 6000, 6000, 6000, 6000]],
  ["5",      [143605.5, 212918.38, 203918.38, 203918.38, 203918.38, 203918.38, 203918.38, 203918.38, 203918.38]],
  ["6",      [9200, 9200, 18200, 18200, 18200, 18200, 18200, 18200, 18500]],
  ["6.01",   [3000, 3000, 12000, 12000, 12000, 12000, 12000, 12000, 12000]],
  ["6.02",   [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000]],
  ["6.03",   [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000]],
  ["6.04",   [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000]],
  ["6.05",   [200, 200, 200, 200, 200, 200, 200, 200, 200]],
  ["6.06",   [200, 200, 200, 200, 200, 200, 200, 200, 200]],
  ["6.07",   [2200, 2200, 2200, 2200, 2200, 2200, 2200, 2200, 2500]],
  ["6.08",   [200, 200, 200, 200, 200, 200, 200, 200, 200]],
  ["6.09",   [400, 400, 400, 400, 400, 400, 400, 400, 400]],
  ["7",      [134405.5, 203718.38, 185718.38, 185718.38, 185718.38, 185718.38, 185718.38, 185718.38, 185418.38]],
  ["8",      [134405.5, 203718.38, 185718.38, 185718.38, 185718.38, 185718.38, 185718.38, 185718.38, 185418.38]],
  ["9",      [134405.5, 203718.38, 185718.38, 185718.38, 185718.38, 185718.38, 185718.38, 185718.38, 185418.38]],
  ["10",     [200000, 0, 0, 0, 0, 0, 0, 0, 0]],
];

// Get linha IDs
const linhaIds = {};
const linhasDb = await q("SELECT id, codigo FROM dre_linhas;");
for (const l of linhasDb) {
  linhaIds[l.codigo] = l.id;
}

let valCount = 0;
for (const [codigo, meses] of valores) {
  const linhaId = linhaIds[codigo];
  if (!linhaId) { console.error(`Linha ${codigo} not found!`); continue; }

  for (let i = 0; i < meses.length; i++) {
    const mes = 4 + i; // abril=4 ... dezembro=12
    const valor = meses[i];
    await q(`INSERT INTO dre_valores (dre_linha_id, mes, ano, valor) VALUES ('${linhaId}', ${mes}, 2026, ${valor}) ON CONFLICT (dre_linha_id, mes, ano) DO UPDATE SET valor = ${valor};`);
    valCount++;
  }
}

console.log(`Seeded ${valCount} DRE valores`);
console.log("\nDone!");
