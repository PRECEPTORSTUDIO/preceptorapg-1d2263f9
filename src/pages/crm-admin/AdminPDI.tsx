import { useState } from "react";
import { Target, Plus, X, Loader2, CheckCircle, ChevronDown } from "lucide-react";
import MetricCard from "@/components/crm/MetricCard";
import { useMembros } from "@/hooks/useTime";
import { usePDIs, useCreatePDI, useCreateCompetencia, useCreateAcao, useToggleAcao, usePDIStats } from "@/hooks/usePDI";

export default function AdminPDI() {
  const { data: membros } = useMembros();
  const [selectedMembro, setSelectedMembro] = useState("");
  const [showNewPDI, setShowNewPDI] = useState(false);
  const [newPeriodo, setNewPeriodo] = useState("Q2 2026");
  const { data: pdis, isLoading } = usePDIs(selectedMembro || undefined);
  const { data: stats } = usePDIStats();
  const createPDI = useCreatePDI();

  const handleCreatePDI = async () => {
    if (!selectedMembro || !newPeriodo) return;
    await createPDI.mutateAsync({ membro_id: selectedMembro, periodo: newPeriodo });
    setShowNewPDI(false);
  };

  const ativo = (pdis ?? []).find((p) => p.status === "ativo");
  const historico = (pdis ?? []).filter((p) => p.status === "concluido");

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">PDI</h1>
          <p className="text-xs md:text-sm text-gray-500 mt-0.5">Plano de Desenvolvimento Individual</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={selectedMembro} onChange={(e) => setSelectedMembro(e.target.value)}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-[#C9A84C]">
            <option value="">Selecionar membro...</option>
            {(membros ?? []).filter(m => m.status === "ativo").map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <MetricCard title="PDIs Ativos" value={stats?.ativos ?? 0} icon={Target} color="gold" subtitle="Em andamento" />
        <MetricCard title="Competencias" value={(ativo as any)?.competencias?.length ?? 0} icon={CheckCircle} color="blue" subtitle={selectedMembro ? "Deste PDI" : "—"} />
      </div>

      {!selectedMembro ? (
        <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-12 text-center">
          <Target className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">Selecione um membro para ver o PDI</p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#C9A84C]" /></div>
      ) : (
        <div className="space-y-4">
          {/* Active PDI */}
          {ativo ? (
            <PDICard pdi={ativo as any} active />
          ) : (
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-8 text-center">
              <p className="text-gray-500 mb-3">Nenhum PDI ativo</p>
            </div>
          )}

          {/* New PDI button */}
          {!ativo && !showNewPDI && selectedMembro && (
            <button onClick={() => setShowNewPDI(true)}
              className="w-full py-3 rounded-xl border-2 border-dashed border-gray-800 hover:border-[#C9A84C]/40 text-gray-500 hover:text-[#C9A84C] transition-all flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" />Criar PDI
            </button>
          )}
          {showNewPDI && (
            <div className="bg-gray-900/80 border-2 border-[#C9A84C]/30 rounded-xl p-4 md:p-5 flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">Periodo</label>
                <input value={newPeriodo} onChange={(e) => setNewPeriodo(e.target.value)} placeholder="Q2 2026"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-[#C9A84C]" />
              </div>
              <button onClick={handleCreatePDI} disabled={createPDI.isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[#C9A84C] text-gray-900 hover:bg-yellow-500 disabled:opacity-50">
                {createPDI.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar"}
              </button>
              <button onClick={() => setShowNewPDI(false)} className="px-3 py-2 text-sm text-gray-500 hover:text-white">&times;</button>
            </div>
          )}

          {/* Historico */}
          {historico.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Historico</p>
              {historico.map((p: any) => <PDICard key={p.id} pdi={p} active={false} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PDICard({ pdi, active }: { pdi: any; active: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showNewComp, setShowNewComp] = useState(false);
  const [compForm, setCompForm] = useState({ competencia: "", situacao_atual: "", situacao_desejada: "", indicador_sucesso: "" });
  const createComp = useCreateCompetencia();
  const createAcao = useCreateAcao();
  const toggleAcao = useToggleAcao();
  const [acaoInput, setAcaoInput] = useState("");

  const comps = pdi.competencias ?? [];
  const totalAcoes = comps.reduce((s: number, c: any) => s + (c.acoes?.length ?? 0), 0);
  const concluidas = comps.reduce((s: number, c: any) => s + (c.acoes?.filter((a: any) => a.status === "concluida").length ?? 0), 0);
  const pct = totalAcoes > 0 ? Math.round((concluidas / totalAcoes) * 100) : 0;

  const handleAddComp = async () => {
    if (!compForm.competencia) return;
    await createComp.mutateAsync({ pdi_id: pdi.id, ...compForm });
    setCompForm({ competencia: "", situacao_atual: "", situacao_desejada: "", indicador_sucesso: "" });
    setShowNewComp(false);
  };

  const handleAddAcao = async (compId: string) => {
    if (!acaoInput.trim()) return;
    await createAcao.mutateAsync({ competencia_id: compId, descricao: acaoInput.trim() });
    setAcaoInput("");
  };

  return (
    <div className={`bg-gray-900/80 border rounded-xl overflow-hidden ${active ? "border-[#C9A84C]/30" : "border-gray-800"}`}>
      <div className="p-4 border-b border-gray-800/50 flex items-center justify-between">
        <div>
          <span className={`text-xs font-semibold ${active ? "text-[#C9A84C]" : "text-gray-500"}`}>{pdi.periodo}</span>
          <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold ${active ? "bg-green-900/30 text-green-400" : "bg-gray-800 text-gray-500"}`}>
            {active ? "Ativo" : "Concluido"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-[#C9A84C]" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-bold text-white">{pct}%</span>
        </div>
      </div>

      <div className="divide-y divide-gray-800/30">
        {comps.map((c: any) => {
          const isExp = expanded === c.id;
          const cAcoes = c.acoes ?? [];
          const cConc = cAcoes.filter((a: any) => a.status === "concluida").length;
          const cPct = cAcoes.length > 0 ? Math.round((cConc / cAcoes.length) * 100) : 0;

          return (
            <div key={c.id}>
              <div className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-800/20" onClick={() => setExpanded(isExp ? null : c.id)}>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${isExp ? "rotate-180" : ""}`} />
                <span className="text-sm text-white flex-1">{c.competencia}</span>
                <div className="w-16 h-1 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${cPct}%`, backgroundColor: cPct >= 70 ? "#16a34a" : cPct >= 40 ? "#f59e0b" : "#ef4444" }} />
                </div>
                <span className="text-[10px] text-gray-500">{cConc}/{cAcoes.length}</span>
              </div>
              {isExp && (
                <div className="px-4 pb-4 pl-10 space-y-3">
                  {c.situacao_atual && <div><p className="text-[10px] text-gray-600 uppercase">Situacao atual</p><p className="text-xs text-gray-400">{c.situacao_atual}</p></div>}
                  {c.situacao_desejada && <div><p className="text-[10px] text-gray-600 uppercase">Situacao desejada</p><p className="text-xs text-gray-400">{c.situacao_desejada}</p></div>}
                  {c.indicador_sucesso && <div><p className="text-[10px] text-gray-600 uppercase">Indicador de sucesso</p><p className="text-xs text-gray-400">{c.indicador_sucesso}</p></div>}

                  <div>
                    <p className="text-[10px] text-gray-600 uppercase mb-1">Acoes</p>
                    {cAcoes.map((a: any) => (
                      <div key={a.id} className="flex items-center gap-2 mb-1">
                        <button onClick={() => toggleAcao.mutate({ id: a.id, status: a.status === "concluida" ? "pendente" : "concluida" })}
                          className={`w-4 h-4 rounded border flex items-center justify-center ${a.status === "concluida" ? "bg-green-600 border-green-600" : "border-gray-600 hover:border-[#C9A84C]"}`}>
                          {a.status === "concluida" && <CheckCircle className="w-3 h-3 text-white" />}
                        </button>
                        <span className={`text-xs ${a.status === "concluida" ? "line-through text-gray-600" : "text-gray-300"}`}>{a.descricao}</span>
                      </div>
                    ))}
                    {active && (
                      <div className="flex gap-1 mt-1">
                        <input value={acaoInput} onChange={(e) => setAcaoInput(e.target.value)} placeholder="Nova acao..."
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) { e.preventDefault(); handleAddAcao(c.id); } }}
                          className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 focus:outline-none focus:border-[#C9A84C]" />
                        <button onClick={() => handleAddAcao(c.id)} className="px-2 py-1 rounded text-xs bg-gray-800 text-gray-400 hover:text-white">+</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {active && (
        <div className="p-3 border-t border-gray-800/50">
          {showNewComp ? (
            <div className="space-y-2">
              <input value={compForm.competencia} onChange={(e) => setCompForm({ ...compForm, competencia: e.target.value })} placeholder="Competencia *" autoFocus
                className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 focus:outline-none focus:border-[#C9A84C]" />
              <div className="grid grid-cols-2 gap-2">
                <input value={compForm.situacao_atual} onChange={(e) => setCompForm({ ...compForm, situacao_atual: e.target.value })} placeholder="Situacao atual"
                  className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 focus:outline-none focus:border-[#C9A84C]" />
                <input value={compForm.situacao_desejada} onChange={(e) => setCompForm({ ...compForm, situacao_desejada: e.target.value })} placeholder="Situacao desejada"
                  className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 focus:outline-none focus:border-[#C9A84C]" />
              </div>
              <input value={compForm.indicador_sucesso} onChange={(e) => setCompForm({ ...compForm, indicador_sucesso: e.target.value })} placeholder="Indicador de sucesso"
                className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 focus:outline-none focus:border-[#C9A84C]" />
              <div className="flex gap-2">
                <button onClick={handleAddComp} disabled={createComp.isPending}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#C9A84C] text-gray-900 hover:bg-yellow-500 disabled:opacity-50">
                  {createComp.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Criar"}
                </button>
                <button onClick={() => setShowNewComp(false)} className="text-xs text-gray-500 hover:text-white">&times;</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowNewComp(true)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#C9A84C]">
              <Plus className="w-3 h-3" />Adicionar competencia
            </button>
          )}
        </div>
      )}
    </div>
  );
}
