import { useState, useMemo } from "react";
import CrmShellV3, { Kpi, PageHero, PeriodBar, CardHead } from "@/components/crm/v3/CrmShellV3";
import { ChevronRight, ChevronDown, Download, Loader2 } from "lucide-react";
import {
  useDRELinhas, useDREValores, useUpdateDREValor,
  buildDRETree, fmtDRE, exportDREtoCSV, MESES_DRE,
} from "@/hooks/useDRE";
import type { DRERow } from "@/hooks/useDRE";

const MES_LABELS = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const TIPO_COLORS: Record<string, string> = {
  receita:   "var(--crm-pos)",
  deducao:   "var(--crm-neg)",
  custo:     "var(--crm-neg)",
  despesa:   "var(--crm-warn)",
  resultado: "var(--crm-green-deep)",
  aporte:    "var(--crm-info)",
};

const fmtBRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function AdminDREv3() {
  const [ano, setAno] = useState(2026);
  const { data: linhas, isLoading: lLoading } = useDRELinhas();
  const { data: valores, isLoading: vLoading } = useDREValores(ano);
  const updateValor = useUpdateDREValor();

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editCell, setEditCell] = useState<{ linhaId: string; mes: number } | null>(null);
  const [editValue, setEditValue] = useState("");

  const valoresMap = useMemo(() => {
    const map: Record<string, Record<number, number>> = {};
    (valores ?? []).forEach((v) => {
      if (!map[v.dre_linha_id]) map[v.dre_linha_id] = {};
      map[v.dre_linha_id][v.mes] = v.valor;
    });
    return map;
  }, [valores]);

  const tree = useMemo(() => {
    if (!linhas) return [];
    return buildDRETree(linhas, valoresMap);
  }, [linhas, valoresMap]);

  const kpis = useMemo(() => {
    const find = (codigo: string) => {
      const l = (linhas ?? []).find((li) => li.codigo === codigo);
      if (!l) return 0;
      const vals = valoresMap[l.id] ?? {};
      return MESES_DRE.reduce((s, m) => s + (vals[m] ?? 0), 0);
    };
    const recBruta = find("1");
    const recLiq = find("ROL");
    const ebitda = find("EBITDA");
    const ll = find("LL");
    const ebitdaMargin = recBruta > 0 ? (ebitda / recBruta) * 100 : 0;
    return { recBruta, recLiq, ebitda, ebitdaMargin, ll };
  }, [linhas, valoresMap]);

  const toggle = (codigo: string) => {
    const next = new Set(collapsed);
    if (next.has(codigo)) next.delete(codigo); else next.add(codigo);
    setCollapsed(next);
  };

  const startEdit = (linhaId: string, mes: number, currentVal: number) => {
    setEditCell({ linhaId, mes });
    setEditValue(String(currentVal || ""));
  };

  const saveEdit = async () => {
    if (!editCell) return;
    const val = parseFloat(editValue.replace(",", ".")) || 0;
    await updateValor.mutateAsync({ linhaId: editCell.linhaId, mes: editCell.mes, ano, valor: val });
    setEditCell(null);
  };

  const isLoading = lLoading || vLoading;

  return (
    <CrmShellV3 mode="admin" crumbs={[{ label: "CRM" }, { label: "Admin" }, { label: "DRE & Receita" }]}
      topbarTools={
        <>
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))}
            style={{
              padding: "6px 10px", background: "var(--crm-surface)",
              border: "1px solid var(--crm-line)", borderRadius: 6,
              fontSize: 12.5, color: "var(--crm-ink)",
              fontFamily: "var(--crm-text)",
            }}>
            <option value={2026}>2026</option>
            <option value={2027}>2027</option>
          </select>
          <button onClick={() => exportDREtoCSV(tree, ano)} className="crm-btn crm-btn-ghost">
            <Download size={13} /> Exportar CSV
          </button>
        </>
      }
    >
      <main className="crm-page">
        <PageHero
          eyebrow={`Admin · DRE ${ano}`}
          title={<>DRE <em>& Receita</em></>}
          sub={`Demonstração de Resultado · Janeiro a Dezembro de ${ano}. Clique em qualquer célula editável para alterar.`}
        />

        {isLoading ? (
          <div style={{ padding: 48, display: "grid", placeItems: "center" }}>
            <Loader2 size={28} style={{ color: "var(--crm-green-deep)", animation: "spin 1s linear infinite" }} />
          </div>
        ) : (
          <>
            {/* KPI Bar */}
            <section className="crm-kpi-row" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
              <Kpi label="Receita Bruta" value={fmtBRL(kpis.recBruta)} deltaText={`acumulado ${ano}`} accent="mrr" />
              <Kpi label="Receita Líquida" value={fmtBRL(kpis.recLiq)} deltaText="receita - deduções" />
              <Kpi label="EBITDA" value={fmtBRL(kpis.ebitda)} deltaText="resultado operacional" accent={kpis.ebitda < 0 ? "neg" : "mrr"} />
              <Kpi label="Margem EBITDA" value={`${kpis.ebitdaMargin.toFixed(1)}%`} deltaText="EBITDA / Receita" accent="warn" />
              <Kpi label="Lucro Líquido" value={fmtBRL(kpis.ll)} deltaText={kpis.ll >= 0 ? "positivo" : "negativo"} accent={kpis.ll < 0 ? "neg" : "mrr"} />
            </section>

            {/* DRE Table */}
            <section className="crm-card">
              <CardHead title={`DRE ${ano}`} sub={`${(linhas ?? []).length} linhas · ${MESES_DRE.length} meses · clique em valores editáveis`} />
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--crm-line)" }}>
                      <th style={{
                        textAlign: "left", padding: "10px 14px",
                        fontFamily: "var(--crm-sans)", fontWeight: 600, fontSize: 11,
                        letterSpacing: "0.06em", textTransform: "uppercase",
                        color: "var(--crm-ink-4)",
                        background: "var(--crm-surface-2)",
                        position: "sticky", left: 0, zIndex: 2,
                        minWidth: 280,
                      }}>Descrição</th>
                      {MESES_DRE.map((m) => (
                        <th key={m} style={{
                          textAlign: "right", padding: "10px 8px",
                          fontFamily: "var(--crm-sans)", fontWeight: 600, fontSize: 11,
                          letterSpacing: "0.06em", textTransform: "uppercase",
                          color: "var(--crm-ink-4)",
                          background: "var(--crm-surface-2)",
                          minWidth: 90,
                        }}>{MES_LABELS[m]}</th>
                      ))}
                      <th style={{
                        textAlign: "right", padding: "10px 14px",
                        fontFamily: "var(--crm-sans)", fontWeight: 700, fontSize: 11,
                        letterSpacing: "0.06em", textTransform: "uppercase",
                        color: "var(--crm-gold-deep)",
                        background: "var(--crm-surface-2)",
                        minWidth: 110,
                      }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tree.map((row) => (
                      <DRETreeRow
                        key={row.linha.id}
                        row={row}
                        depth={0}
                        collapsed={collapsed}
                        onToggle={toggle}
                        editCell={editCell}
                        editValue={editValue}
                        onStartEdit={startEdit}
                        onEditChange={setEditValue}
                        onSaveEdit={saveEdit}
                        onCancelEdit={() => setEditCell(null)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </CrmShellV3>
  );
}

function DRETreeRow({
  row, depth, collapsed, onToggle, editCell, editValue, onStartEdit, onEditChange, onSaveEdit, onCancelEdit,
}: {
  row: DRERow;
  depth: number;
  collapsed: Set<string>;
  onToggle: (code: string) => void;
  editCell: { linhaId: string; mes: number } | null;
  editValue: string;
  onStartEdit: (linhaId: string, mes: number, val: number) => void;
  onEditChange: (val: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}) {
  const { linha, valores, children } = row;
  const isCollapsed = collapsed.has(linha.codigo);
  const hasChildren = (children?.length ?? 0) > 0;
  const total = MESES_DRE.reduce((s, m) => s + (valores[m] ?? 0), 0);
  const allZero = MESES_DRE.every((m) => (valores[m] ?? 0) === 0);
  const tipoColor = TIPO_COLORS[linha.tipo] ?? "var(--crm-ink-2)";

  const isResultado = linha.tipo === "resultado";
  const isNivel1 = linha.nivel === 1;

  const rowBg = isNivel1 && isResultado
    ? "var(--crm-green-tint)"
    : isNivel1 ? "var(--crm-surface-2)" : "transparent";

  const textColor = isNivel1
    ? (isResultado ? "var(--crm-green-deep)" : "var(--crm-ink)")
    : linha.nivel === 2 ? "var(--crm-ink-2)" : "var(--crm-ink-3)";

  return (
    <>
      <tr style={{
        background: rowBg,
        opacity: allZero ? 0.45 : 1,
        borderBottom: "1px solid var(--crm-line-soft)",
      }}>
        <td style={{
          padding: "8px 14px",
          position: "sticky", left: 0,
          background: rowBg === "transparent" ? "var(--crm-surface)" : rowBg,
          zIndex: 1,
        }}>
          <div style={{ display: "flex", alignItems: "center", paddingLeft: depth * 16 }}>
            {hasChildren ? (
              <button onClick={() => onToggle(linha.codigo)} style={{
                marginRight: 6, background: "transparent", border: "none",
                color: "var(--crm-ink-4)", cursor: "pointer", padding: 0, display: "flex",
              }}>
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>
            ) : <span style={{ width: 20 }} />}
            <span className="crm-mono" style={{ fontSize: 10.5, color: "var(--crm-ink-4)", marginRight: 8, width: 32 }}>
              {linha.codigo}
            </span>
            <span style={{
              fontSize: 12.5,
              fontWeight: isNivel1 ? 700 : 500,
              color: textColor,
              fontFamily: isNivel1 ? "var(--crm-sans)" : "var(--crm-text)",
            }}>
              {linha.descricao}
            </span>
          </div>
        </td>

        {MESES_DRE.map((m) => {
          const val = valores[m] ?? 0;
          const isEditing = editCell?.linhaId === linha.id && editCell?.mes === m;
          return (
            <td key={m} style={{ padding: "8px 6px", textAlign: "right" }}>
              {isEditing ? (
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => onEditChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) onSaveEdit(); if (e.key === "Escape") onCancelEdit(); }}
                  autoFocus
                  style={{
                    width: "100%", padding: "2px 6px",
                    background: "var(--crm-surface)",
                    border: "1px solid var(--crm-gold-deep)",
                    borderRadius: 4, fontSize: 12, fontFamily: "var(--crm-mono)",
                    textAlign: "right", color: "var(--crm-ink)",
                  }}
                />
              ) : (
                <span
                  onClick={() => linha.editavel && onStartEdit(linha.id, m, val)}
                  className="crm-mono"
                  style={{
                    fontSize: 12,
                    color: val < 0 ? "var(--crm-neg)" : isNivel1 ? (isResultado ? "var(--crm-green-deep)" : "var(--crm-ink)") : "var(--crm-ink-2)",
                    cursor: linha.editavel ? "pointer" : "default",
                    padding: linha.editavel ? "2px 4px" : "0",
                    borderRadius: 3,
                    fontWeight: isNivel1 ? 700 : 500,
                    fontFeatureSettings: '"tnum"',
                  }}
                >
                  {fmtDRE(val)}
                </span>
              )}
            </td>
          );
        })}

        <td style={{ padding: "8px 14px", textAlign: "right" }}>
          <span className="crm-mono" style={{
            fontSize: 12, fontWeight: 700,
            color: isResultado ? tipoColor : total < 0 ? "var(--crm-neg)" : "var(--crm-ink)",
            fontFeatureSettings: '"tnum"',
          }}>
            {fmtDRE(total)}
          </span>
        </td>
      </tr>

      {hasChildren && !isCollapsed && children!.map((child) => (
        <DRETreeRow
          key={child.linha.id}
          row={child}
          depth={depth + 1}
          collapsed={collapsed}
          onToggle={onToggle}
          editCell={editCell}
          editValue={editValue}
          onStartEdit={onStartEdit}
          onEditChange={onEditChange}
          onSaveEdit={onSaveEdit}
          onCancelEdit={onCancelEdit}
        />
      ))}
    </>
  );
}
