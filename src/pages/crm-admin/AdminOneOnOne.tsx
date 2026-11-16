import { useState } from "react";
import { Calendar, Plus, X, Loader2, AlertTriangle, CheckCircle, Clock, MessageSquare } from "lucide-react";
import MetricCard from "@/components/crm/MetricCard";
import { useMembros } from "@/hooks/useTime";
import { useOneOnOnes, useOneOnOneAlerts, useCreateOneOnOne, useUpdateCompromisso } from "@/hooks/useOneOnOne";
import type { OneOnOneInsert, OneOnOne } from "@/hooks/useOneOnOne";

const HUMORS = ["", "\u{1F614}", "\u{1F610}", "\u{1F642}", "\u{1F604}"];

export default function AdminOneOnOne() {
  const { data: membros } = useMembros();
  const [selectedMembro, setSelectedMembro] = useState("");
  const [showForm, setShowForm] = useState(false);
  const { data: oos, isLoading } = useOneOnOnes(selectedMembro || undefined);
  const { data: alerts } = useOneOnOneAlerts();
  const updateComp = useUpdateCompromisso();

  const toggleCompromisso = (oo: OneOnOne, idx: number) => {
    const next = [...oo.compromissos];
    next[idx] = { ...next[idx], concluido: !next[idx].concluido };
    updateComp.mutate({ id: oo.id, compromissos: next });
  };

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">1:1 Meetings</h1>
          <p className="text-xs md:text-sm text-gray-500 mt-0.5">Acompanhamento individual do time</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={selectedMembro} onChange={(e) => setSelectedMembro(e.target.value)}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-[#C9A84C]">
            <option value="">Selecionar membro...</option>
            {(membros ?? []).filter(m => m.status === "ativo").map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
          {selectedMembro && (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#C9A84C] text-gray-900 hover:bg-yellow-500 transition-colors">
              <Plus className="w-3.5 h-3.5" />Novo 1:1
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {(alerts ?? []).length > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold text-yellow-400">1:1s pendentes (mais de 14 dias)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(alerts ?? []).map((a) => (
              <button key={a.id} onClick={() => setSelectedMembro(a.id)}
                className="px-3 py-1 rounded-lg text-xs bg-yellow-900/30 text-yellow-400 border border-yellow-800/30 hover:bg-yellow-900/50">
                {a.nome} {a.ultimo ? `(ultimo: ${new Date(a.ultimo).toLocaleDateString("pt-BR")})` : "(nunca)"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <MetricCard title="Em dia" value={(membros ?? []).filter(m => m.status === "ativo").length - (alerts ?? []).length} icon={CheckCircle} color="green" subtitle="Ultimos 14 dias" />
        <MetricCard title="Pendentes" value={(alerts ?? []).length} icon={AlertTriangle} color="red" subtitle="Sem 1:1 recente" />
        <MetricCard title="Total 1:1s" value={(oos ?? []).length} icon={Calendar} color="blue" subtitle={selectedMembro ? "Deste membro" : "Selecione um membro"} />
        <MetricCard title="Compromissos" value={(oos ?? []).reduce((s, o) => s + (o.compromissos?.length ?? 0), 0)} icon={MessageSquare} color="gold" subtitle="Registrados" />
      </div>

      {/* Timeline */}
      {!selectedMembro ? (
        <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-12 text-center">
          <Calendar className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">Selecione um membro para ver o historico de 1:1</p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#C9A84C]" /></div>
      ) : (
        <div className="space-y-4">
          {(oos ?? []).map((oo) => (
            <div key={oo.id} className="bg-gray-900/80 border border-gray-800 rounded-xl p-4 md:p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{HUMORS[oo.humor] ?? ""}</span>
                  <div>
                    <p className="font-semibold text-white">{new Date(oo.data).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
                    <p className="text-xs text-gray-500">{oo.duracao} min</p>
                  </div>
                </div>
                {oo.proxima_data && (
                  <span className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" />Prox: {new Date(oo.proxima_data).toLocaleDateString("pt-BR")}</span>
                )}
              </div>

              {(oo.topicos as string[] ?? []).length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] uppercase text-gray-600 font-semibold mb-1">Topicos</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(oo.topicos as string[]).map((t, i) => (
                      <span key={i} className="px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-300">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {(oo.compromissos ?? []).length > 0 && (
                <div>
                  <p className="text-[10px] uppercase text-gray-600 font-semibold mb-1">Compromissos</p>
                  <div className="space-y-1">
                    {(oo.compromissos ?? []).map((c, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <button onClick={() => toggleCompromisso(oo, i)}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${c.concluido ? "bg-green-600 border-green-600" : "border-gray-600 hover:border-[#C9A84C]"}`}>
                          {c.concluido && <CheckCircle className="w-3 h-3 text-white" />}
                        </button>
                        <span className={`text-xs flex-1 ${c.concluido ? "line-through text-gray-600" : "text-gray-300"}`}>{c.texto}</span>
                        <span className="text-[10px] text-gray-600">{c.responsavel}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          {(oos ?? []).length === 0 && (
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-8 text-center text-gray-500 text-sm">Nenhum 1:1 registrado</div>
          )}
        </div>
      )}

      {showForm && selectedMembro && <OneOnOneFormModal membroId={selectedMembro} membros={membros ?? []} onClose={() => setShowForm(false)} />}
    </div>
  );
}

function OneOnOneFormModal({ membroId, membros, onClose }: { membroId: string; membros: any[]; onClose: () => void }) {
  const create = useCreateOneOnOne();
  const [form, setForm] = useState<OneOnOneInsert>({
    membro_id: membroId, lider_id: "", data: new Date().toISOString().split("T")[0],
    duracao: 30, humor: 3, topicos: [], compromissos: [], observacoes_confidenciais: "", proxima_data: "",
  });
  const [topicoInput, setTopicoInput] = useState("");
  const [compInput, setCompInput] = useState({ texto: "", responsavel: "", prazo: "" });

  const addTopico = () => { if (topicoInput.trim()) { setForm({ ...form, topicos: [...(form.topicos ?? []), topicoInput.trim()] }); setTopicoInput(""); } };
  const addComp = () => { if (compInput.texto.trim()) { setForm({ ...form, compromissos: [...(form.compromissos ?? []), { ...compInput, concluido: false }] }); setCompInput({ texto: "", responsavel: "", prazo: "" }); } };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.lider_id || !form.data) return;
    await create.mutateAsync({ ...form, proxima_data: form.proxima_data || undefined });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm sm:max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">Novo 1:1</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-800"><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Lider *</label>
              <select value={form.lider_id} onChange={(e) => setForm({ ...form, lider_id: e.target.value })} required
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-[#C9A84C]">
                <option value="">Selecionar...</option>
                {membros.filter(m => m.id !== membroId).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Data *</label>
              <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} required
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-[#C9A84C]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Duracao (min)</label>
              <input type="number" value={form.duracao} onChange={(e) => setForm({ ...form, duracao: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-[#C9A84C]" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Humor</label>
              <div className="flex gap-2 mt-1">
                {[1, 2, 3, 4].map((h) => (
                  <button key={h} type="button" onClick={() => setForm({ ...form, humor: h })}
                    className={`text-2xl p-1 rounded-lg transition-all ${form.humor === h ? "bg-[#C9A84C]/20 scale-110" : "opacity-50 hover:opacity-100"}`}>
                    {HUMORS[h]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Topicos */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Topicos</label>
            <div className="flex gap-2 mb-2">
              <input value={topicoInput} onChange={(e) => setTopicoInput(e.target.value)} placeholder="Adicionar topico..."
                onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) { e.preventDefault(); addTopico(); } }}
                className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 focus:outline-none focus:border-[#C9A84C]" />
              <button type="button" onClick={addTopico} className="px-2 py-1.5 rounded-lg text-xs bg-gray-800 text-gray-400 hover:text-white">+</button>
            </div>
            <div className="flex flex-wrap gap-1">{(form.topicos ?? []).map((t, i) => (
              <span key={i} className="px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-300 flex items-center gap-1">
                {t}<button type="button" onClick={() => setForm({ ...form, topicos: form.topicos!.filter((_, idx) => idx !== i) })} className="text-gray-600 hover:text-red-400">&times;</button>
              </span>
            ))}</div>
          </div>

          {/* Compromissos */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Compromissos</label>
            <div className="flex gap-2 mb-2">
              <input value={compInput.texto} onChange={(e) => setCompInput({ ...compInput, texto: e.target.value })} placeholder="O que..."
                className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 focus:outline-none focus:border-[#C9A84C]" />
              <input value={compInput.responsavel} onChange={(e) => setCompInput({ ...compInput, responsavel: e.target.value })} placeholder="Quem"
                className="w-20 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 focus:outline-none focus:border-[#C9A84C]" />
              <button type="button" onClick={addComp} className="px-2 py-1.5 rounded-lg text-xs bg-gray-800 text-gray-400 hover:text-white">+</button>
            </div>
            {(form.compromissos ?? []).map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-gray-300 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]" />{c.texto} <span className="text-gray-600">({c.responsavel})</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Proxima data</label>
              <input type="date" value={form.proxima_data ?? ""} onChange={(e) => setForm({ ...form, proxima_data: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-[#C9A84C]" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Observacoes do lider (confidencial)</label>
            <textarea value={form.observacoes_confidenciais ?? ""} onChange={(e) => setForm({ ...form, observacoes_confidenciais: e.target.value })} rows={2}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 focus:outline-none focus:border-[#C9A84C] resize-none" />
          </div>

          <button type="submit" disabled={create.isPending}
            className="w-full py-2.5 rounded-lg text-sm font-semibold bg-[#C9A84C] text-gray-900 hover:bg-yellow-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {create.isPending ? "Salvando..." : "Registrar 1:1"}
          </button>
        </form>
      </div>
    </div>
  );
}
