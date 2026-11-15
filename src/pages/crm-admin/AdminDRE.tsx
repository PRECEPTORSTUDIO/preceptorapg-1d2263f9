import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, Download, Loader2 } from "lucide-react";
import MetricCard from "@/components/crm/MetricCard";
import {
  useDRELinhas, useDREValores, useUpdateDREValor,
  buildDRETree, fmtDRE, exportDREtoCSV, MESES_DRE,
} from "@/hooks/useDRE";
import type { DRERow } from "@/hooks/useDRE";

const MES_LABELS = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const TIPO_COLORS: Record<string, { text: string; bg: string }> = {
  receita:   { text: "text-green-400",  bg: "bg-green-900/10" },
  deducao:   { text: "text-red-400",    bg: "bg-red-900/10" },
  custo:     { text: "text-red-300",    bg: "bg-red-900/5" },
  despesa:   { text: "text-orange-300", bg: "bg-orange-900/5" },
  resultado: { text: "text-purple-400", bg: "bg-purple-900/10" },
  aporte:    { text: "text-blue-400",   bg: "bg-blue-900/10" },
};

export default function AdminDRE() {
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

  // KPIs
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

  if (isLoading) {
    return <div className="p-6 flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin text-[#C9A84C]" /></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">DRE — Demonstração de Resultado</h1>
          <p className="text-xs md:text-sm text-gray-500 mt-0.5">Projeção {ano} — Abril a Dezembro</p>
        </div>
        <div className="flex items-center gap-3 self-start">
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-[#C9A84C]">
            <option value={2026}>2026</option>
            <option value={2027}>2027</option>
          </select>
          <button onClick={() => exportDREtoCSV(tree, ano)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 text-gray-300 hover:bg-gray-700">
            <Download className="w-3.5 h-3.5" />Exportar CSV
          </button>
        </div>
      </div>

      {/* KPI Bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-3">
          <p className="text-[9px] text-gray-500 uppercase">Receita Bruta</p>
          <p className="text-lg font-bold text-green-400">R$ {(kpis.recBruta / 1000).toFixed(0)}k</p>
        </div>
        <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-3">
          <p className="text-[9px] text-gray-500 uppercase">Receita Líquida</p>
          <p className="text-lg font-bold text-blue-400">R$ {(kpis.recLiq / 1000).toFixed(0)}k</p>
        </div>
        <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-3">
          <p className="text-[9px] text-gray-500 uppercase">EBITDA</p>
          <p className="text-lg font-bold text-purple-400">R$ {(kpis.ebitda / 1000).toFixed(0)}k</p>
        </div>
        <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-3">
          <p className="text-[9px] text-gray-500 uppercase">Margem EBITDA</p>
          <p className="text-lg font-bold text-[#C9A84C]">{kpis.ebitdaMargin.toFixed(1)}%</p>
        </div>
        <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-3">
          <p className="text-[9px] text-gray-500 uppercase">Lucro Líquido</p>
          <p className={`text-lg font-bold ${kpis.ll >= 0 ? "text-green-400" : "text-red-400"}`}>R$ {(kpis.ll / 1000).toFixed(0)}k</p>
        </div>
      </div>

      {/* DRE Table */}
      <div className="bg-gray-900/80 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-900 z-10 min-w-[260px]">
                  Descrição
                </th>
                {MESES_DRE.map((m) => (
                  <th key={m} className="text-right py-3 px-3 text-xs font-semibold text-gray-500 uppercase min-w-[95px]">
                    {MES_LABELS[m]}
                  </th>
                ))}
                <th className="text-right py-3 px-4 text-xs font-semibold text-[#C9A84C] uppercase min-w-[110px]">
                  Total
                </th>
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
      </div>
    </div>
  );
}

// ── Recursive Tree Row ──
function DRETreeRow({ row, depth, collapsed, onToggle, editCell, editValue, onStartEdit, onEditChange, onSaveEdit, onCancelEdit }: {
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
  const tc = TIPO_COLORS[linha.tipo] ?? TIPO_COLORS.receita;

  const isResultado = linha.tipo === "resultado";
  const isNivel1 = linha.nivel === 1;

  const rowClass = [
    "border-b border-gray-800/50 transition-colors",
    isNivel1 && isResultado ? `${tc.bg} font-bold` : "",
    isNivel1 && !isResultado ? "bg-gray-800/20 font-semibold" : "",
    allZero ? "opacity-40" : "",
    "hover:bg-gray-800/30",
  ].join(" ");

  const textClass = isNivel1 ? (isResultado ? tc.text : "text-white") : linha.nivel === 2 ? "text-gray-200" : "text-gray-400";
  const valClass = isNivel1 ? (isResultado ? tc.text : "text-white font-semibold") : "text-gray-300";

  return (
    <>
      <tr className={rowClass}>
        {/* Description */}
        <td className="py-2.5 px-4 sticky left-0 bg-gray-900/95 z-10">
          <div className="flex items-center" style={{ paddingLeft: `${depth * 16}px` }}>
            {hasChildren ? (
              <button onClick={() => onToggle(linha.codigo)} className="mr-1.5 text-gray-500 hover:text-white">
                {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <span className="w-5" />
            )}
            <span className="text-[10px] text-gray-600 mr-2 w-8 font-mono">{linha.codigo}</span>
            <span className={`text-xs ${textClass}`}>{linha.descricao}</span>
          </div>
        </td>

        {/* Monthly values */}
        {MESES_DRE.map((m) => {
          const val = valores[m] ?? 0;
          const isEditing = editCell?.linhaId === linha.id && editCell?.mes === m;

          return (
            <td key={m} className="py-2 px-2 text-right">
              {isEditing ? (
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => onEditChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) onSaveEdit(); if (e.key === "Escape") onCancelEdit(); }}
                  autoFocus
                  className="w-full px-1.5 py-0.5 bg-gray-800 border border-[#C9A84C] rounded text-xs text-white text-right focus:outline-none"
                />
              ) : (
                <span
                  onClick={() => linha.editavel && onStartEdit(linha.id, m, val)}
                  className={`text-xs ${valClass} ${linha.editavel ? "cursor-pointer hover:bg-gray-700/50 px-1 py-0.5 rounded" : ""} ${val < 0 ? "text-red-400" : ""}`}
                >
                  {fmtDRE(val)}
                </span>
              )}
            </td>
          );
        })}

        {/* Total */}
        <td className="py-2 px-4 text-right">
          <span className={`text-xs font-bold ${isResultado ? tc.text : total < 0 ? "text-red-400" : "text-white"}`}>
            {fmtDRE(total)}
          </span>
        </td>
      </tr>

      {/* Children */}
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
