// Seed completo do Business Plan — PreceptorMED
// Popula: forecast_premissas, dre_linhas, dre_valores, membros, remuneracao, fluxo_caixa, relatorios_investidor

const TOKEN = "sbp_aaa3ed019b1c26f5b98f9993cb8f2f01b6be27c1";
const q = async (sql) => {
  const r = await fetch("https://api.supabase.com/v1/projects/qnyxluevbogwwtwtbpuu/database/query", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ query: sql }),
  });
  const d = await r.json();
  if (d.message) console.error("  SQL Error:", d.message.substring(0, 150));
  return d;
};

console.log("=== SEED BP COMPLETO ===\n");

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BLOCO 1: Premissas
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log("BLOCO 1: Premissas...");
await q(`DELETE FROM forecast_premissas WHERE versao = 'v1 - Abr/2026';`);
await q(`INSERT INTO forecast_premissas (versao, criado_por, total_assinantes_base, mix_mensal, mix_anual, mix_bianual, preco_mensal, preco_anual, preco_bianual, taxa_renovacao_m_m, taxa_renovacao_m_a, taxa_renovacao_a_a, cac, ativo) VALUES ('v1 - Abr/2026', 'Matheus Castro', 1000, 0.40, 0.50, 0.10, 49.90, 350.90, 599.90, 0.30, 0.50, 0.50, 60.00, true);`);
console.log("  ✅ Premissas v1 inseridas");

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BLOCO 2: DRE Linhas + Valores
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log("BLOCO 2: DRE Linhas + Valores...");

// Limpar e reinserir linhas
await q("DELETE FROM dre_valores;");
await q("DELETE FROM dre_linhas;");

const linhas = [
  // [codigo, descricao, tipo, nivel, ordem, editavel, formula]
  // RECEITAS
  ["1","Receitas Operacionais Totais","receita",1,1,false,"1.1 + 1.2"],
  ["1.1","Receitas Aquisição","receita",2,2,false,"1.1.01 + 1.1.02 + 1.1.03"],
  ["1.1.01","Aquisição M","receita",3,3,true,null],
  ["1.1.02","Aquisição BA","receita",3,4,true,null],
  ["1.1.03","Aquisição A","receita",3,5,true,null],
  ["1.2","Receitas Renovação","receita",2,6,false,"1.2.01 + 1.2.02"],
  ["1.2.01","Renovação M","receita",3,7,true,null],
  ["1.2.02","Renovação A","receita",3,8,true,null],
  // DEDUÇÕES
  ["2","Deduções Da Receita","deducao",1,10,false,"2.1 + 2.2"],
  ["2.1","Impostos Sobre o Faturamento","deducao",2,11,false,null],
  ["2.1.01","PIS","deducao",3,12,true,null],
  ["2.1.02","COFINS","deducao",3,13,true,null],
  ["2.1.03","ISS","deducao",3,14,true,null],
  ["2.1.04","CBS","deducao",3,15,true,null],
  ["2.1.05","IBS","deducao",3,16,true,null],
  ["2.1.06","DAS (Simples Nacional)","deducao",3,17,true,null],
  ["2.1.07","Outros Impostos","deducao",3,18,true,null],
  ["2.2","Tarifas Sobre Receita","deducao",2,19,false,null],
  ["2.2.01","Tarifas Boleto","deducao",3,20,true,null],
  ["2.2.02","Tarifas PIX","deducao",3,21,true,null],
  ["2.2.03","Tarifas Cartão de Crédito","deducao",3,22,true,null],
  ["2.2.04","Antecipação de Recebíveis","deducao",3,23,true,null],
  ["2.2.05","Stripe [USA]","deducao",3,24,true,null],
  ["2.2.06","Variação Cambial [USA]","deducao",3,25,true,null],
  // ROL
  ["ROL","Receita Operacional Líquida","resultado",1,30,false,"1 - 2"],
  // CUSTOS
  ["3","Custos Operacionais","custo",1,35,false,"3.1"],
  ["3.1","Mão de Obra Operacional (CSP)","custo",2,36,false,null],
  ["3.1.01","CSP - Gestor de Tráfego","custo",3,37,true,null],
  ["3.1.02","CSP - Design","custo",3,38,true,null],
  ["3.1.03","CAC","custo",3,39,true,null],
  ["3.1.04","CSP - Castro (Matheus)","custo",3,40,true,null],
  ["3.1.05","CSP - Thiago","custo",3,41,true,null],
  // LB
  ["LB","Lucro Bruto","resultado",1,45,false,"ROL - 3"],
  // DESPESAS
  ["4","Despesas Totais","despesa",1,50,false,"4.1 + 4.2 + 4.3"],
  ["4.1","Despesas Comerciais","despesa",2,51,false,null],
  ["4.1.01","Remuneração Coord. Receita","despesa",3,52,true,null],
  ["4.1.02","Time Comercial Aquisição","despesa",3,53,true,null],
  ["4.2","Despesas Administrativas","despesa",2,70,false,null],
  ["4.2.02","Remuneração Coord. Adm","despesa",3,72,true,null],
  ["4.2.11","Software e Ferramentas (Unidade)","despesa",3,81,true,null],
  ["4.2.13","Assessoria Contábil","despesa",3,83,true,null],
  ["4.2.14","Assessoria Jurídica","despesa",3,84,true,null],
  ["4.3","Despesas Gerais","despesa",2,100,false,null],
  ["4.3.01","Telefone e Internet","despesa",3,101,true,null],
  ["4.3.02","Energia Elétrica e Água","despesa",3,102,true,null],
  ["4.3.03","Aluguéis e Condomínio","despesa",3,103,true,null],
  ["4.3.05","Materiais de Uso e Consumo","despesa",3,105,true,null],
  ["4.3.06","Limpeza e Conservação","despesa",3,106,true,null],
  // RESULTADOS
  ["EBITDA","EBITDA","resultado",1,110,false,"LB - 4"],
  ["5","Depreciações e Amortizações","despesa",1,115,true,null],
  ["EBIT","Lucro Operacional (EBIT)","resultado",1,120,false,"EBITDA - 5"],
  ["6","Resultados Financeiros","resultado",1,125,true,null],
  ["EBT","EBT (Antes IR e CSLL)","resultado",1,130,false,"EBIT + 6"],
  ["7","Impostos Sobre Lucro","despesa",1,135,true,null],
  ["LL","Lucro Líquido","resultado",1,140,false,"EBT - 7"],
  // MOVIMENTOS DE CAIXA
  ["APORTE","Aporte de Capital (Sócios)","aporte",1,145,true,null],
  ["EMP","Entrada de Empréstimos","aporte",1,146,true,null],
  ["DIV","Distribuição de Lucros","aporte",1,147,true,null],
];

for (const [codigo, descricao, tipo, nivel, ordem, editavel, formula] of linhas) {
  const fVal = formula ? `'${formula}'` : "NULL";
  await q(`INSERT INTO dre_linhas (codigo, descricao, tipo, nivel, ordem, editavel, formula) VALUES ('${codigo}', '${descricao.replace(/'/g, "''")}', '${tipo}', ${nivel}, ${ordem}, ${editavel}, ${fVal}) ON CONFLICT (codigo) DO NOTHING;`);
}
console.log(`  ✅ ${linhas.length} linhas DRE inseridas`);

// Valores
const linhaIds = {};
const dbLinhas = await q("SELECT id, codigo FROM dre_linhas;");
for (const l of dbLinhas) linhaIds[l.codigo] = l.id;

const valores = [
  ["1",[255400,331568,331568,331568,331568,331568,331568,331568,331568]],
  ["1.1",[255400,255400,255400,255400,255400,255400,255400,255400,255400]],
  ["1.1.01",[19960,19960,19960,19960,19960,19960,19960,19960,19960]],
  ["1.1.02",[59990,59990,59990,59990,59990,59990,59990,59990,59990]],
  ["1.1.03",[175450,175450,175450,175450,175450,175450,175450,175450,175450]],
  ["1.2",[0,76168,76168,76168,76168,76168,76168,76168,76168]],
  ["1.2.01",[0,5988,5988,5988,5988,5988,5988,5988,5988]],
  ["1.2.02",[0,70180,70180,70180,70180,70180,70180,70180,70180]],
  ["2",[45794.5,52649.62,52649.62,52649.62,52649.62,52649.62,52649.62,52649.62,52649.62]],
  ["2.1",[15324,19894.08,19894.08,19894.08,19894.08,19894.08,19894.08,19894.08,19894.08]],
  ["2.1.06",[15324,19894.08,19894.08,19894.08,19894.08,19894.08,19894.08,19894.08,19894.08]],
  ["2.2",[30470.5,32755.54,32755.54,32755.54,32755.54,32755.54,32755.54,32755.54,32755.54]],
  ["2.2.03",[7662,9947.04,9947.04,9947.04,9947.04,9947.04,9947.04,9947.04,9947.04]],
  ["2.2.04",[22808.5,22808.5,22808.5,22808.5,22808.5,22808.5,22808.5,22808.5,22808.5]],
  ["ROL",[209605.5,278918.38,278918.38,278918.38,278918.38,278918.38,278918.38,278918.38,278918.38]],
  ["3",[66000,66000,75000,75000,75000,75000,75000,75000,75000]],
  ["3.1",[66000,66000,75000,75000,75000,75000,75000,75000,75000]],
  ["3.1.01",[1500,1500,1500,1500,1500,1500,1500,1500,1500]],
  ["3.1.02",[1500,1500,1500,1500,1500,1500,1500,1500,1500]],
  ["3.1.03",[60000,60000,60000,60000,60000,60000,60000,60000,60000]],
  ["3.1.04",[1500,1500,6000,6000,6000,6000,6000,6000,6000]],
  ["3.1.05",[1500,1500,6000,6000,6000,6000,6000,6000,6000]],
  ["LB",[143605.5,212918.38,203918.38,203918.38,203918.38,203918.38,203918.38,203918.38,203918.38]],
  ["4",[9200,9200,18200,18200,18200,18200,18200,18200,18500]],
  ["4.2",[6000,6000,15000,15000,15000,15000,15000,15000,15000]],
  ["4.2.02",[3000,3000,12000,12000,12000,12000,12000,12000,12000]],
  ["4.2.11",[1000,1000,1000,1000,1000,1000,1000,1000,1000]],
  ["4.2.13",[1000,1000,1000,1000,1000,1000,1000,1000,1000]],
  ["4.2.14",[1000,1000,1000,1000,1000,1000,1000,1000,1000]],
  ["4.3",[3200,3200,3200,3200,3200,3200,3200,3200,3500]],
  ["4.3.01",[200,200,200,200,200,200,200,200,200]],
  ["4.3.02",[200,200,200,200,200,200,200,200,200]],
  ["4.3.03",[2200,2200,2200,2200,2200,2200,2200,2200,2500]],
  ["4.3.05",[200,200,200,200,200,200,200,200,200]],
  ["4.3.06",[400,400,400,400,400,400,400,400,400]],
  ["EBITDA",[134405.5,203718.38,185718.38,185718.38,185718.38,185718.38,185718.38,185718.38,185418.38]],
  ["EBIT",[134405.5,203718.38,185718.38,185718.38,185718.38,185718.38,185718.38,185718.38,185418.38]],
  ["EBT",[134405.5,203718.38,185718.38,185718.38,185718.38,185718.38,185718.38,185718.38,185418.38]],
  ["LL",[134405.5,203718.38,185718.38,185718.38,185718.38,185718.38,185718.38,185718.38,185418.38]],
  ["APORTE",[200000,0,0,0,0,0,0,0,0]],
];

let valCount = 0;
for (const [codigo, meses] of valores) {
  const lid = linhaIds[codigo];
  if (!lid) { console.error(`  ❌ Linha ${codigo} not found`); continue; }
  for (let i = 0; i < meses.length; i++) {
    await q(`INSERT INTO dre_valores (dre_linha_id, mes, ano, valor) VALUES ('${lid}', ${4+i}, 2026, ${meses[i]}) ON CONFLICT (dre_linha_id, mes, ano) DO UPDATE SET valor = ${meses[i]};`);
    valCount++;
  }
}
console.log(`  ✅ ${valCount} valores DRE inseridos`);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BLOCO 5: Fluxo de Caixa
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log("BLOCO 5: Fluxo de Caixa...");
await q(`INSERT INTO admin_fluxo_caixa (saldo_atual, data_atualizacao, observacoes) VALUES (200000.00, '2026-04-01', 'Aporte inicial dos sócios — conforme BP_PULSE v1') ON CONFLICT DO NOTHING;`);
console.log("  ✅ Saldo inicial inserido");

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BLOCO 6: Relatório Investidor
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log("BLOCO 6: Relatório Investidor...");
await q(`INSERT INTO admin_relatorios_investidor (mes, ano, mrr, arr, total_usuarios, novos_usuarios, churn_rate, cac, ltv, burn_rate, runway, headcount) VALUES (4, 2026, 255400, 3064800, 22, 3, 0, 60, 374, 75200, 8, 4) ON CONFLICT (mes, ano) DO UPDATE SET mrr=255400, arr=3064800, total_usuarios=22, novos_usuarios=3, burn_rate=75200;`);
console.log("  ✅ Relatório abr/2026 inserido");

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VERIFICAÇÃO FINAL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log("\n=== VERIFICAÇÃO ===");
const counts = {};
for (const table of ["forecast_premissas", "dre_linhas", "dre_valores", "admin_membros", "admin_remuneracao", "admin_fluxo_caixa", "admin_relatorios_investidor"]) {
  const r = await q(`SELECT count(*) c FROM ${table};`);
  counts[table] = r[0]?.c ?? "?";
}
console.log(JSON.stringify(counts, null, 2));
console.log("\n=== SEED COMPLETO ===");
