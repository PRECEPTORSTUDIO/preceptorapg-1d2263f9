import { useState } from "react";
import { Target, Plus, X, Loader2, CheckCircle, AlertTriangle, Clock, TrendingUp, MessageSquare, Save, ChevronDown, Trash2 } from "lucide-react";
import MetricCard from "@/components/crm/MetricCard";
import {
  useOKRs, useAvailableQuarters, useCreateOKR, useCreateKR, useUpdateKR,
  useUpdateOKRStatus, useDeleteOKR, useDeleteKR, useMembrosSelect,
} from "@/hooks/useOKRs";
import type { OKR, KeyResult } from "@/hooks/useOKRs";

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string; icon: typeof CheckCircle }> = {
  no_prazo: { bg: "bg-green-900/30", text: "text-green-400", label: "No prazo", icon: CheckCircle },
  em_risco: { bg: "bg-yellow-900/30", text: "text-yellow-400", label: "Em risco", icon: AlertTriangle },
  atrasado: { bg: "bg-red-900/30", text: "text-red-400", label: "Atrasado", icon: Clock },
  concluido: { bg: "bg-blue-900/30", text: "text-blue-400", label: "Concluido", icon: CheckCircle },
};

function getAutoStatus(p: number) { return p >= 100 ? "concluido" : p >= 70 ? "no_prazo" : p >= 40 ? "em_risco" : "atrasado"; }
function getBarColor(p: number) { return p >= 70 ? "#16a34a" : p >= 40 ? "#f59e0b" : "#ef4444"; }
function formatValue(v: number, u: string) { return u === "R$" ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : u === "%" ? `${v}%` : `${v.toLocaleString("pt-BR")} ${u}`; }
function getInitials(n: string) { return n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase(); }
const IC = ["#ef4444", "#3b82f6", "#16a34a", "#f59e0b", "#8b5cf6", "#ec4899"];
function getColor(n: string) { let h = 0; for (let i = 0; i < n.length; i++) h = n.charCodeAt(i) + ((h << 5) - h); return IC[Math.abs(h) % IC.length]; }

export default function AdminMetas() {
  const now = new Date();
  const curQ = Math.floor(now.getMonth() / 3) + 1;
  const curY = now.getFullYear();

  const [trimestre, setTrimestre] = useState(curQ);
  const [ano, setAno] = useState(curY);
  const [creating, setCreating] = useState(false);

  const { data: okrs, isLoading } = useOKRs(trimestre, ano);
  const { data: quarters } = useAvailableQuarters();

  const isCurrent = trimestre === curQ && ano === curY;
  const totalOkrs = (okrs ?? []).length;
  const avgProg = totalOkrs > 0 ? Math.round((okrs ?? []).reduce((s, o) => s + (o.progresso_medio ?? 0), 0) / totalOkrs) : 0;
  const onTrack = (okrs ?? []).filter((o) => ["no_prazo", "concluido"].includes(o.status)).length;
  const atRisk = (okrs ?? []).filter((o) => ["em_risco", "atrasado"].includes(o.status)).length;

  if (isLoading) {
    return <div className="p-4 md:p-6 flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin text-[#C9A84C]" /></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Metas & OKRs</h1>
          <p className="text-xs md:text-sm text-gray-500 mt-0.5">Objectives and Key Results</p>
        </div>
        <select
          value={`${ano}-${trimestre}`}
          onChange={(e) => { const [a, q] = e.target.value.split("-"); setAno(Number(a)); setTrimestre(Number(q)); }}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-[#C9A84C]"
        >
          {(quarters ?? []).map((q) => (
            <option key={`${q.ano}-${q.trimestre}`} value={`${q.ano}-${q.trimestre}`}>Q{q.trimestre} {q.ano}</option>
          ))}
        </select>
      </div>

      {/* KPIs */}
      {totalOkrs > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <MetricCard title="OKRs" value={totalOkrs} icon={Target} color="gold" subtitle={`Q${trimestre} ${ano}`} />
          <MetricCard title="Progresso Medio" value={`${avgProg}%`} icon={TrendingUp} color={avgProg >= 70 ? "green" : avgProg >= 40 ? "gold" : "red"} subtitle="Todos os OKRs" />
          <MetricCard title="No Prazo" value={onTrack} icon={CheckCircle} color="green" subtitle="On track" />
          <MetricCard title="Em Risco" value={atRisk} icon={AlertTriangle} color="red" subtitle="Atencao necessaria" />
        </div>
      )}

      {/* OKR Cards */}
      <div className="space-y-4">
        {(okrs ?? []).map((okr) => (
          <OKRCard key={okr.id} okr={okr} editable={isCurrent} />
        ))}
      </div>

      {/* Inline Create OKR — always visible at bottom */}
      {isCurrent && (
        creating ? (
          <InlineOKRCreator trimestre={trimestre} ano={ano} onClose={() => setCreating(false)} />
        ) : (
          <button onClick={() => setCreating(true)}
            className="w-full py-4 rounded-xl border-2 border-dashed border-gray-800 hover:border-[#C9A84C]/40 text-gray-500 hover:text-[#C9A84C] transition-all flex items-center justify-center gap-2 group">
            <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium">Criar novo OKR para Q{trimestre} {ano}</span>
          </button>
        )
      )}

      {/* Empty state */}
      {totalOkrs === 0 && !creating && (
        <div className="text-center py-4">
          <p className="text-xs text-gray-600">Defina objetivos claros e key results mensuraveis para acompanhar o progresso do time.</p>
        </div>
      )}
    </div>
  );
}

// ── Inline Multi-OKR Creator ─────────────────────────────────
interface OKRDraft {
  objetivo: string;
  responsavel: string;
  krs: { descricao: string; meta: string; unidade: string }[];
}

function InlineOKRCreator({ trimestre, ano, onClose }: { trimestre: number; ano: number; onClose: () => void }) {
  const createOKR = useCreateOKR();
  const createKR = useCreateKR();
  const { data: membros } = useMembrosSelect();

  const emptyOKR = (): OKRDraft => ({ objetivo: "", responsavel: "", krs: [{ descricao: "", meta: "", unidade: "%" }] });
  const [drafts, setDrafts] = useState<OKRDraft[]>([emptyOKR()]);
  const [saving, setSaving] = useState(false);

  const updateDraft = (i: number, field: keyof OKRDraft, value: any) => {
    const next = [...drafts]; (next[i] as any)[field] = value; setDrafts(next);
  };
  const addOKR = () => setDrafts([...drafts, emptyOKR()]);
  const removeOKR = (i: number) => setDrafts(drafts.filter((_, idx) => idx !== i));

  const addKR = (oi: number) => {
    const next = [...drafts]; next[oi].krs.push({ descricao: "", meta: "", unidade: "%" }); setDrafts(next);
  };
  const removeKR = (oi: number, ki: number) => {
    const next = [...drafts]; next[oi].krs = next[oi].krs.filter((_, idx) => idx !== ki); setDrafts(next);
  };
  const updateKRField = (oi: number, ki: number, field: string, value: string) => {
    const next = [...drafts]; (next[oi].krs[ki] as any)[field] = value; setDrafts(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = drafts.filter((d) => d.objetivo.trim());
    if (!valid.length) return;
    setSaving(true);
    try {
      for (const draft of valid) {
        const okr = await createOKR.mutateAsync({
          objetivo: draft.objetivo, responsavel_id: draft.responsavel || null, trimestre, ano,
        });
        for (const kr of draft.krs.filter((k) => k.descricao && k.meta)) {
          await createKR.mutateAsync({ okr_id: okr.id, descricao: kr.descricao, meta: Number(kr.meta), unidade: kr.unidade, progresso_atual: 0 });
        }
      }
      onClose();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-gray-900/80 border-2 border-[#C9A84C]/30 rounded-xl overflow-hidden">
      <form onSubmit={handleSubmit}>
        <div className="p-4 border-b border-gray-800/50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#C9A84C]">Novos OKRs — Q{trimestre} {ano}</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-full hover:bg-gray-800 text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="divide-y divide-gray-800/50">
          {drafts.map((draft, oi) => (
            <div key={oi} className="p-4 md:p-5 space-y-3">
              {/* OKR header */}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-[#C9A84C] bg-[#C9A84C]/10 px-2 py-0.5 rounded">OKR {oi + 1}</span>
                {drafts.length > 1 && (
                  <button type="button" onClick={() => removeOKR(oi)} className="text-gray-700 hover:text-red-400 ml-auto"><Trash2 className="w-3.5 h-3.5" /></button>
                )}
              </div>

              <div className="grid grid-cols-[1fr_200px] gap-3">
                <input value={draft.objetivo} onChange={(e) => updateDraft(oi, "objetivo", e.target.value)}
                  placeholder="Objetivo — ex: Atingir 100 assinantes pagantes" autoFocus={oi === 0}
                  className="px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-[#C9A84C] placeholder-gray-600" />
                <select value={draft.responsavel} onChange={(e) => updateDraft(oi, "responsavel", e.target.value)}
                  className="px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-[#C9A84C]">
                  <option value="">Responsavel...</option>
                  {(membros ?? []).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>

              {/* KRs */}
              <div className="pl-4 space-y-2">
                {draft.krs.map((kr, ki) => (
                  <div key={ki} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-600 w-4 text-right">{ki + 1}.</span>
                    <input value={kr.descricao} onChange={(e) => updateKRField(oi, ki, "descricao", e.target.value)}
                      placeholder="Key Result" className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 focus:outline-none focus:border-[#C9A84C] placeholder-gray-600" />
                    <input type="number" value={kr.meta} onChange={(e) => updateKRField(oi, ki, "meta", e.target.value)}
                      placeholder="Meta" className="w-20 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 focus:outline-none focus:border-[#C9A84C] placeholder-gray-600" />
                    <select value={kr.unidade} onChange={(e) => updateKRField(oi, ki, "unidade", e.target.value)}
                      className="w-20 px-1 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 focus:outline-none focus:border-[#C9A84C]">
                      <option value="%">%</option><option value="R$">R$</option><option value="usuarios">usuarios</option>
                      <option value="questoes">questoes</option><option value="entrega">entrega</option><option value="pontos">pontos</option>
                    </select>
                    {draft.krs.length > 1 && (
                      <button type="button" onClick={() => removeKR(oi, ki)} className="text-gray-700 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => addKR(oi)} className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-[#C9A84C]">
                  <Plus className="w-2.5 h-2.5" />KR
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add another OKR + Submit */}
        <div className="p-4 border-t border-gray-800/50 space-y-3">
          <button type="button" onClick={addOKR}
            className="w-full py-2 rounded-lg border border-dashed border-gray-700 hover:border-[#C9A84C]/40 text-xs text-gray-500 hover:text-[#C9A84C] transition-colors flex items-center justify-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />Adicionar mais um OKR
          </button>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving || !drafts.some((d) => d.objetivo.trim())}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-[#C9A84C] text-gray-900 hover:bg-yellow-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
              {saving ? "Criando..." : `Criar ${drafts.filter((d) => d.objetivo.trim()).length} OKR${drafts.filter((d) => d.objetivo.trim()).length !== 1 ? "s" : ""}`}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">Cancelar</button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ── OKR Card ─────────────────────────────────────────────────
function OKRCard({ okr, editable }: { okr: OKR; editable: boolean }) {
  const [showKRForm, setShowKRForm] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const updateStatus = useUpdateOKRStatus();
  const deleteOKR = useDeleteOKR();

  const sc = STATUS_CONFIG[okr.status] ?? STATUS_CONFIG.no_prazo;
  const StatusIcon = sc.icon;
  const autoStatus = getAutoStatus(okr.progresso_medio ?? 0);

  if (editable && autoStatus !== okr.status && okr.status !== "concluido") {
    updateStatus.mutate({ id: okr.id, status: autoStatus });
  }

  return (
    <div className="bg-gray-900/80 border border-gray-800 rounded-xl overflow-hidden">
      <div className="p-4 md:p-5 border-b border-gray-800/50">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: getColor(okr.responsavel_nome ?? "—") }}>
              {getInitials(okr.responsavel_nome ?? "—")}
            </div>
            <div>
              <h3 className="font-semibold text-white">{okr.objetivo}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{okr.responsavel_nome}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${sc.bg} ${sc.text}`}>
              <StatusIcon className="w-3 h-3" />{sc.label}
            </span>
            {editable && (
              confirmDel ? (
                <div className="flex items-center gap-1">
                  <button onClick={() => deleteOKR.mutate(okr.id)} className="px-2 py-0.5 rounded text-[10px] bg-red-600 text-white">Excluir</button>
                  <button onClick={() => setConfirmDel(false)} className="px-2 py-0.5 rounded text-[10px] bg-gray-800 text-gray-400">Nao</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDel(true)} className="p-1 rounded text-gray-700 hover:text-red-400 hover:bg-red-900/20 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(okr.progresso_medio ?? 0, 100)}%`, backgroundColor: getBarColor(okr.progresso_medio ?? 0) }} />
          </div>
          <span className="text-sm font-bold text-white w-12 text-right">{okr.progresso_medio ?? 0}%</span>
        </div>
      </div>

      <div className="divide-y divide-gray-800/30">
        {(okr.key_results ?? []).map((kr) => <KRRow key={kr.id} kr={kr} editable={editable} />)}
      </div>

      {editable && (
        <div className="p-3 border-t border-gray-800/50">
          {showKRForm ? (
            <KRInlineForm okrId={okr.id} onClose={() => setShowKRForm(false)} />
          ) : (
            <button onClick={() => setShowKRForm(true)} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#C9A84C] transition-colors">
              <Plus className="w-3 h-3" />Adicionar Key Result
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── KR Row ───────────────────────────────────────────────────
function KRRow({ kr, editable }: { kr: KeyResult; editable: boolean }) {
  const updateKR = useUpdateKR();
  const deleteKR = useDeleteKR();
  const [editProg, setEditProg] = useState(false);
  const [editComment, setEditComment] = useState(false);
  const [prog, setProg] = useState(String(kr.progresso_atual));
  const [comment, setComment] = useState(kr.comentario_semanal ?? "");
  const pct = kr.meta > 0 ? Math.round((kr.progresso_atual / kr.meta) * 100) : 0;

  const saveProg = () => { updateKR.mutate({ id: kr.id, progresso_atual: Number(prog) }); setEditProg(false); };
  const saveComment = () => { updateKR.mutate({ id: kr.id, comentario_semanal: comment || null }); setEditComment(false); };

  return (
    <div className="px-5 py-3 hover:bg-gray-800/20 transition-colors">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-300">{kr.descricao}</p>
          <div className="flex items-center gap-2 mt-1">
            {editable && editProg ? (
              <div className="flex items-center gap-1">
                <input type="number" value={prog} onChange={(e) => setProg(e.target.value)} autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") saveProg(); if (e.key === "Escape") setEditProg(false); }}
                  className="w-20 px-2 py-0.5 bg-gray-800 border border-[#C9A84C] rounded text-xs text-white focus:outline-none" />
                <button onClick={saveProg} className="text-green-400 hover:text-green-300"><Save className="w-3 h-3" /></button>
              </div>
            ) : (
              <button onClick={() => editable && setEditProg(true)}
                className={`text-xs font-medium ${editable ? "cursor-pointer hover:text-[#C9A84C]" : ""}`} style={{ color: getBarColor(pct) }}>
                {formatValue(kr.progresso_atual, kr.unidade)}
              </button>
            )}
            <span className="text-xs text-gray-600">/</span>
            <span className="text-xs text-gray-500">{formatValue(kr.meta, kr.unidade)}</span>
          </div>
        </div>
        <div className="w-32 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: getBarColor(pct) }} />
          </div>
          <span className="text-[10px] font-bold w-8 text-right" style={{ color: getBarColor(pct) }}>{pct}%</span>
        </div>
        {editable && (
          <button onClick={() => deleteKR.mutate(kr.id)} className="p-1 text-gray-700 hover:text-red-400 transition-colors ml-1">
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="mt-1.5 flex items-start gap-1.5">
        <MessageSquare className="w-3 h-3 text-gray-700 mt-0.5 flex-shrink-0" />
        {editable && editComment ? (
          <div className="flex-1 flex gap-1">
            <input value={comment} onChange={(e) => setComment(e.target.value)} autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) saveComment(); if (e.key === "Escape") setEditComment(false); }}
              className="flex-1 px-2 py-0.5 bg-gray-800 border border-[#C9A84C] rounded text-xs text-gray-300 focus:outline-none" placeholder="Comentario semanal..." />
            <button onClick={saveComment} className="text-green-400 hover:text-green-300"><Save className="w-3 h-3" /></button>
          </div>
        ) : (
          <button onClick={() => editable && setEditComment(true)}
            className={`text-[11px] ${editable ? "cursor-pointer hover:text-gray-400" : ""} ${kr.comentario_semanal ? "text-gray-500" : "text-gray-600 italic"}`}>
            {kr.comentario_semanal || (editable ? "Adicionar comentario..." : "—")}
          </button>
        )}
      </div>
    </div>
  );
}

// ── KR Inline Form ───────────────────────────────────────────
function KRInlineForm({ okrId, onClose }: { okrId: string; onClose: () => void }) {
  const createKR = useCreateKR();
  const [desc, setDesc] = useState("");
  const [meta, setMeta] = useState("");
  const [unidade, setUnidade] = useState("%");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc || !meta) return;
    await createKR.mutateAsync({ okr_id: okrId, descricao: desc, meta: Number(meta), unidade, progresso_atual: 0 });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div className="flex-1">
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descricao do KR" required autoFocus
          className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 focus:outline-none focus:border-[#C9A84C]" />
      </div>
      <input type="number" value={meta} onChange={(e) => setMeta(e.target.value)} placeholder="Meta" required
        className="w-20 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 focus:outline-none focus:border-[#C9A84C]" />
      <select value={unidade} onChange={(e) => setUnidade(e.target.value)}
        className="w-20 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 focus:outline-none focus:border-[#C9A84C]">
        <option value="%">%</option><option value="R$">R$</option><option value="usuarios">usuarios</option>
        <option value="questoes">questoes</option><option value="entrega">entrega</option><option value="pontos">pontos</option>
      </select>
      <button type="submit" disabled={createKR.isPending}
        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#C9A84C] text-gray-900 hover:bg-yellow-500 disabled:opacity-50">
        {createKR.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Criar"}
      </button>
      <button type="button" onClick={onClose} className="px-2 py-1.5 text-xs text-gray-500 hover:text-white">&times;</button>
    </form>
  );
}
