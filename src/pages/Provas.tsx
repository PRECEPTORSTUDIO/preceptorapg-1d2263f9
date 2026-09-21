import { useState, useEffect, useMemo } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useAdmin } from "@/hooks/useAdmin";
import { useToast } from "@/hooks/use-toast";
import {
  useProvas,
  uploadAndIngestProva,
  deleteProva,
  type Prova,
  type ProvaStatus,
} from "@/hooks/useProvas";
import { readPdfMeta } from "@/lib/pdfMeta";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageSkeleton from "@/components/PageSkeleton";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Play,
  Edit3,
  Plus,
  X,
  Sparkles,
  ChevronRight,
  ListChecks,
  Hourglass,
  CircleAlert,
} from "lucide-react";

const STATUS_CONFIG: Record<
  ProvaStatus,
  { label: string; color: string; icon: typeof Loader2 }
> = {
  uploading:    { label: "Enviando…",        color: "bg-slate-100 text-slate-600 border-slate-200",   icon: Hourglass },
  extracting:   { label: "PreceptorMED processando…",  color: "bg-blue-50 text-blue-700 border-blue-200",       icon: Sparkles  },
  reviewing:    { label: "Revisar",          color: "bg-amber-50 text-amber-700 border-amber-200",    icon: Edit3     },
  ready:        { label: "Pronta",           color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  failed:       { label: "Falhou",           color: "bg-red-50 text-red-700 border-red-200",          icon: CircleAlert },
  archived:     { label: "Arquivada",        color: "bg-gray-100 text-gray-500 border-gray-200",      icon: FileText  },
};

const Provas = () => {
  const { user, loading: authLoading } = useAuth();
  const { hasAccess, loading: subLoading } = useSubscription();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { provas, loading, refresh } = useProvas();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [showUpload, setShowUpload] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const total = provas.length;
    const ready = provas.filter((p) => p.status === "ready").length;
    const reviewing = provas.filter((p) => p.status === "reviewing").length;
    const totalQuestoes = provas.reduce((s, p) => s + (p.num_questoes ?? 0), 0);
    return { total, ready, reviewing, totalQuestoes };
  }, [provas]);

  if (authLoading || subLoading || adminLoading) {
    return <PageSkeleton variant="dashboard" />;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!hasAccess && !isAdmin) return <Navigate to="/pricing" replace />;

  const handleDelete = async (id: string) => {
    try {
      await deleteProva(id);
      toast({ title: "Prova removida" });
      void refresh();
    } catch (err) {
      toast({
        title: "Erro ao remover",
        description: (err as Error).message,
        variant: "destructive",
      });
    }
    setConfirmDeleteId(null);
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-[#005344] inline-flex items-center gap-2.5 mb-3">
              <span className="w-6 h-px bg-[#C9A84C]" />
              Provas Importadas
            </p>
            <h1 className="font-['Manrope'] font-bold text-3xl sm:text-4xl tracking-[-0.025em] leading-[1.05] text-[#191C1D]">
              Sobe a prova,{" "}
              <em className="not-italic font-medium text-[#8a6f26]">
                o PreceptorMED monta o simulado
              </em>
              .
            </h1>
            <p className="text-sm text-[#4a5568] mt-2 max-w-[58ch] leading-relaxed">
              Envie um PDF de qualquer prova (residência, faculdade, ENAMED).
              O PreceptorMED extrai as questões, mantém o gabarito original e roda como
              simulado online com correção e justificativa.
            </p>
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="shrink-0 inline-flex items-center gap-2 px-5 h-11 rounded-xl bg-gradient-to-br from-[#003D32] via-[#005344] to-[#006D5B] text-white font-bold text-sm font-['Manrope'] shadow-[0_8px_24px_-8px_rgba(0,109,91,0.45)] hover:shadow-[0_12px_28px_-6px_rgba(0,109,91,0.55)] transition-shadow"
          >
            <Plus className="w-4 h-4" />
            Importar prova
          </button>
        </div>

        {/* Stat row */}
        {provas.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <StatCard label="Provas" value={stats.total} accent="primary" />
            <StatCard
              label="Prontas pra simular"
              value={stats.ready}
              accent="emerald"
            />
            <StatCard
              label="Aguardando revisão"
              value={stats.reviewing}
              accent="amber"
            />
            <StatCard
              label="Questões totais"
              value={stats.totalQuestoes}
              accent="gold"
            />
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-44 rounded-2xl bg-slate-100 animate-pulse"
              />
            ))}
          </div>
        ) : provas.length === 0 ? (
          <EmptyState onUpload={() => setShowUpload(true)} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {provas.map((p) => (
              <ProvaCard
                key={p.id}
                prova={p}
                onReview={() => navigate(`/provas/${p.id}/review`)}
                onSimulate={() => navigate(`/provas/${p.id}/simulado`)}
                onSimulateLive={() => navigate(`/provas/${p.id}/simulado?live=1`)}
                onDelete={() => setConfirmDeleteId(p.id)}
              />
            ))}
          </div>
        )}
      </div>

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={(provaId, live) => {
            setShowUpload(false);
            void refresh();
            if (live) {
              toast({
                title: "Modo expresso ativo",
                description: "Vai começando — o PreceptorMED continua extraindo no fundo.",
              });
              navigate(`/provas/${provaId}/simulado?live=1`);
            } else {
              toast({
                title: "Prova processada",
                description: "Revise as questões antes de simular.",
              });
              navigate(`/provas/${provaId}/review`);
            }
          }}
        />
      )}

      {confirmDeleteId && (
        <ConfirmDelete
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={() => handleDelete(confirmDeleteId)}
        />
      )}
    </DashboardLayout>
  );
};

export default Provas;

// ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "primary" | "emerald" | "amber" | "gold";
}) {
  const colors = {
    primary: "from-[#006D5B]/10 text-[#005344]",
    emerald: "from-emerald-100 text-emerald-700",
    amber:   "from-amber-100 text-amber-700",
    gold:    "from-[#C9A84C]/15 text-[#8a6f26]",
  }[accent];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-[0_1px_2px_rgba(25,28,29,0.04)]">
      <div
        className={`inline-block px-2 py-0.5 rounded-md bg-gradient-to-br ${colors} text-[10.5px] font-bold uppercase tracking-wider mb-2`}
      >
        {label}
      </div>
      <div className="font-['Manrope'] text-2xl font-bold text-[#191C1D] tracking-tight">
        {value}
      </div>
    </div>
  );
}

function ProvaCard({
  prova,
  onReview,
  onSimulate,
  onSimulateLive,
  onDelete,
}: {
  prova: Prova;
  onReview: () => void;
  onSimulate: () => void;
  onSimulateLive: () => void;
  onDelete: () => void;
}) {
  const cfg = STATUS_CONFIG[prova.status];
  const Icon = cfg.icon;
  const isWorking = prova.status === "uploading" || prova.status === "extracting";
  // Heuristica: se a prova esta extraindo MAS ja tem questoes aprovadas,
  // o user usou modo expresso e pode ir direto pro simulado live.
  const hasLiveQuestions =
    prova.status === "extracting" && prova.num_questoes_aprovadas > 0;
  const created = new Date(prova.created_at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
  const aprovPct =
    prova.num_questoes > 0
      ? Math.round((prova.num_questoes_aprovadas / prova.num_questoes) * 100)
      : 0;
  // Em modo expresso (auto-aprovado), label "Disponíveis" faz mais
  // sentido que "Revisão"
  const progressLabel = hasLiveQuestions ? "Disponíveis ao vivo" : "Revisão";

  return (
    <div className="group bg-white rounded-2xl border border-slate-200 p-5 shadow-[0_1px_2px_rgba(25,28,29,0.04)] hover:shadow-[0_8px_28px_-12px_rgba(0,109,91,0.18)] hover:border-[#006D5B]/30 transition-all">
      <div className="flex items-start gap-3 mb-3">
        <div
          className={`shrink-0 w-10 h-10 rounded-xl border ${cfg.color} flex items-center justify-center`}
        >
          <Icon
            className={`w-5 h-5 ${isWorking ? "animate-spin" : ""}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-['Manrope'] font-bold text-base text-[#191C1D] tracking-tight leading-snug truncate">
            {prova.titulo}
          </h3>
          <p className="text-xs text-[#4a5568] mt-0.5">
            {prova.num_alternativas} alternativas · {created}
            {prova.num_paginas ? ` · ${prova.num_paginas} pgs` : ""}
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="shrink-0 w-8 h-8 rounded-lg text-[#4a5568] hover:text-red-600 hover:bg-red-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Remover"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${cfg.color} text-[11px] font-semibold mb-3`}
      >
        {cfg.label}
      </div>

      {prova.status === "failed" && prova.status_message && (
        <div className="mb-3 p-2.5 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700 leading-relaxed">
          <strong>Erro:</strong> {prova.status_message}
        </div>
      )}

      {prova.num_questoes > 0 && (
        <div className="mb-3">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#4a5568]">
              {progressLabel}
            </span>
            <span className="font-mono text-[11px] text-[#191C1D]">
              {prova.num_questoes_aprovadas}/{prova.num_questoes}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#005344] to-[#C9A84C] transition-all"
              style={{ width: `${aprovPct}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-4">
        {hasLiveQuestions && (
          <>
            <button
              onClick={onSimulateLive}
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-lg bg-gradient-to-br from-[#003D32] via-[#005344] to-[#006D5B] text-white text-sm font-bold hover:brightness-110 transition-all shadow-[0_4px_12px_-4px_rgba(0,109,91,0.4)]"
            >
              <Play className="w-4 h-4" />
              Continuar ao vivo
              <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/15 text-[9.5px] font-mono uppercase tracking-wider">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                {prova.num_questoes_aprovadas}
              </span>
            </button>
          </>
        )}
        {!hasLiveQuestions && prova.status === "reviewing" && (
          <button
            onClick={onReview}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-lg bg-[#191C1D] text-white text-sm font-bold hover:bg-[#000] transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            Revisar
            <ChevronRight className="w-4 h-4 opacity-60" />
          </button>
        )}
        {prova.status === "ready" && (
          <>
            <button
              onClick={onSimulate}
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-lg bg-gradient-to-br from-[#003D32] via-[#005344] to-[#006D5B] text-white text-sm font-bold hover:brightness-110 transition-all shadow-[0_4px_12px_-4px_rgba(0,109,91,0.4)]"
            >
              <Play className="w-4 h-4" />
              Simular
            </button>
            <button
              onClick={onReview}
              className="inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-lg border border-slate-200 text-[#4a5568] text-sm font-semibold hover:border-slate-300 hover:bg-slate-50"
            >
              <ListChecks className="w-4 h-4" />
            </button>
          </>
        )}
        {/* Sem questoes aprovadas ainda E em uploading/extracting: spinner */}
        {!hasLiveQuestions &&
          (prova.status === "uploading" || prova.status === "extracting") && (
            <div className="flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-slate-50 border border-slate-200 text-sm text-[#4a5568]">
              <Loader2 className="w-4 h-4 animate-spin" />
              {prova.status === "uploading" ? "Enviando…" : "Extraindo questões…"}
            </div>
          )}
        {prova.status === "failed" && (
          <button
            onClick={onReview}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700"
          >
            <AlertTriangle className="w-4 h-4" />
            Ver erro
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-gradient-to-br from-white to-slate-50 p-10 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#006D5B]/10 mb-4">
        <FileText className="w-8 h-8 text-[#005344]" />
      </div>
      <h3 className="font-['Manrope'] font-bold text-xl text-[#191C1D] tracking-tight mb-2">
        Nenhuma prova importada ainda
      </h3>
      <p className="text-sm text-[#4a5568] max-w-md mx-auto leading-relaxed mb-6">
        Suba o PDF de uma prova de residência, ENAMED ou da sua faculdade. O PreceptorMED
        extrai as questões com o gabarito original e monta um simulado online no
        nosso formato.
      </p>
      <button
        onClick={onUpload}
        className="inline-flex items-center gap-2 px-6 h-11 rounded-xl bg-gradient-to-br from-[#003D32] via-[#005344] to-[#006D5B] text-white font-bold text-sm font-['Manrope'] shadow-[0_8px_24px_-8px_rgba(0,109,91,0.45)]"
      >
        <Upload className="w-4 h-4" />
        Importar primeira prova
      </button>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-3 max-w-2xl mx-auto text-left">
        {[
          {
            n: "01",
            t: "Suba o PDF",
            d: "Até 20MB. Funciona com PDFs digitais ou scaneados.",
          },
          {
            n: "02",
            t: "PreceptorMED extrai e revisa",
            d: "O Claude lê o PDF em ~40s e mantém o texto literal da prova.",
          },
          {
            n: "03",
            t: "Roda como simulado",
            d: "Cronômetro, correção, gabarito comentado — tudo no nosso layout.",
          },
        ].map((s) => (
          <div
            key={s.n}
            className="p-4 rounded-xl border border-slate-200 bg-white"
          >
            <div className="font-mono text-xs text-[#8a6f26] font-bold mb-1">
              {s.n}
            </div>
            <div className="font-['Manrope'] font-bold text-sm text-[#191C1D] mb-1">
              {s.t}
            </div>
            <p className="text-xs text-[#4a5568] leading-relaxed">{s.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function UploadModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (provaId: string, live?: boolean) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [titulo, setTitulo] = useState("");
  const [numAlt, setNumAlt] = useState<4 | 5>(4);
  const [gerarIa, setGerarIa] = useState(true);
  const [modoExpresso, setModoExpresso] = useState(false);
  const [chunkProgress, setChunkProgress] = useState<{
    done: number;
    total: number;
    questoes: number;
  } | null>(null);
  const [pdfMeta, setPdfMeta] = useState<{
    numPages: number;
    fileSizeBytes: number;
    snippet: string;
  } | null>(null);
  const [stage, setStage] = useState<
    | "select"
    | "reading"
    | "extracting_text"
    | "uploading"
    | "ingesting"
  >("select");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPdfMeta(null);
      return;
    }
    setStage("reading");
    setError(null);
    void (async () => {
      try {
        const meta = await readPdfMeta(file);
        setPdfMeta({
          numPages: meta.numPages,
          fileSizeBytes: meta.fileSizeBytes,
          snippet: meta.firstPageTextSnippet,
        });
        // Auto-titulo a partir do nome do arquivo
        if (!titulo) {
          setTitulo(
            file.name.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ").trim(),
          );
        }
        setStage("select");
      } catch (e) {
        setError(`Falha ao ler PDF: ${(e as Error).message}`);
        setStage("select");
      }
    })();
  }, [file]);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== "application/pdf") {
      setError("Arquivo deve ser PDF");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setError(
        `PDF muito grande (${(f.size / 1024 / 1024).toFixed(1)} MB). Limite: 20 MB.`,
      );
      return;
    }
    setError(null);
    setFile(f);
  };

  const handleSubmit = async () => {
    if (!user || !file || !pdfMeta || !titulo.trim()) return;
    setStage("uploading");
    setProgress(0);
    setError(null);
    setChunkProgress(null);
    let didEarlyNavigate = false;
    try {
      await uploadAndIngestProva(user.id, {
        titulo: titulo.trim(),
        numAlternativas: numAlt,
        gerarJustificativaIa: gerarIa,
        modoExpresso,
        pdfFile: file,
        numPaginas: pdfMeta.numPages,
        onProgress: (s, info) => {
          if (s === "extracting_text") setStage("extracting_text");
          else if (s === "uploading") {
            setStage("uploading");
            if (typeof info?.pct === "number") setProgress(info.pct);
          } else if (s === "ingesting") {
            setStage("ingesting");
            if (info) {
              setChunkProgress({
                done: info.chunksDone ?? 0,
                total: info.chunksTotal ?? 1,
                questoes: info.questoesAteAgora ?? 0,
              });
            }
          }
        },
        onFirstChunkReady: (provaId) => {
          // Modo expresso: redireciona pro simulado live assim que o
          // primeiro chunk volta com questoes
          if (modoExpresso && !didEarlyNavigate) {
            didEarlyNavigate = true;
            onSuccess(provaId, /* live */ true);
          }
        },
      }).then(({ provaId }) => {
        // Modo padrao: aguarda todos os chunks e vai pra revisao
        if (!modoExpresso && !didEarlyNavigate) {
          onSuccess(provaId, false);
        }
      });
    } catch (e) {
      setError((e as Error).message);
      setStage("select");
    }
  };

  const isProcessing =
    stage === "extracting_text" ||
    stage === "uploading" ||
    stage === "ingesting";
  const canSubmit = file && pdfMeta && titulo.trim().length > 2 && !isProcessing;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={() => !isProcessing && onClose()}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="relative h-1 bg-gradient-to-r from-[#003D32] via-[#005344] via-[#006D5B] to-[#C9A84C]" />
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-[#005344] inline-flex items-center gap-2 mb-2">
                <span className="w-5 h-px bg-[#C9A84C]" />
                Nova prova
              </p>
              <h2 className="font-['Manrope'] font-bold text-xl text-[#191C1D] tracking-[-0.015em]">
                Importar prova em PDF
              </h2>
            </div>
            {!isProcessing && (
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg text-[#4a5568] hover:bg-slate-100 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Step 1: file */}
          <div>
            <label className="block text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#4a5568] mb-2">
              ① Arquivo PDF
            </label>
            {!file ? (
              <label className="relative flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 hover:border-[#006D5B] hover:bg-[#006D5B]/5 transition-colors cursor-pointer">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={onSelectFile}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <Upload className="w-6 h-6 text-[#4a5568] mb-1.5" />
                <span className="text-sm font-semibold text-[#191C1D]">
                  Clique para selecionar
                </span>
                <span className="text-xs text-[#4a5568] mt-0.5">
                  PDF até 20 MB
                </span>
              </label>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <FileText className="w-5 h-5 text-emerald-700 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#191C1D] truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-[#4a5568]">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                    {pdfMeta && ` · ${pdfMeta.numPages} páginas`}
                  </p>
                </div>
                {!isProcessing && (
                  <button
                    onClick={() => {
                      setFile(null);
                      setPdfMeta(null);
                    }}
                    className="text-[#4a5568] hover:text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Step 2: titulo */}
          <div>
            <label className="block text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#4a5568] mb-2">
              ② Título da prova
            </label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value.slice(0, 200))}
              disabled={isProcessing}
              placeholder="Ex: USP 2024, ENAMED 2023, R+ UFRJ Clínica…"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white font-['Manrope'] text-base font-semibold text-[#191C1D] placeholder-[#94a3b8] outline-none focus:border-[#006D5B] focus:ring-4 focus:ring-[#006D5B]/10 transition-shadow"
            />
          </div>

          {/* Step 3: alternativas */}
          <div>
            <label className="block text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#4a5568] mb-2">
              ③ Quantas alternativas por questão?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setNumAlt(n as 4 | 5)}
                  disabled={isProcessing}
                  className={`h-11 rounded-xl font-['Manrope'] font-bold text-sm border-2 transition-all ${
                    numAlt === n
                      ? "border-[#006D5B] bg-[#006D5B] text-white shadow-[0_4px_12px_-4px_rgba(0,109,91,0.4)]"
                      : "border-slate-200 bg-white text-[#4a5568] hover:border-slate-300"
                  }`}
                >
                  {n} alternativas{" "}
                  <span className="font-mono font-normal text-xs opacity-70">
                    A–{String.fromCharCode(64 + n)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Step 4: justificativa PreceptorMED */}
          <div>
            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 cursor-pointer hover:border-slate-300 has-[:checked]:border-[#006D5B] has-[:checked]:bg-[#006D5B]/5 transition-colors">
              <input
                type="checkbox"
                checked={gerarIa}
                onChange={(e) => setGerarIa(e.target.checked)}
                disabled={isProcessing}
                className="mt-0.5 w-4 h-4 accent-[#006D5B]"
              />
              <div>
                <p className="text-sm font-bold text-[#191C1D] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#C9A84C]" />
                  Gerar justificativa via PreceptorMED
                </p>
                <p className="text-xs text-[#4a5568] leading-relaxed mt-0.5">
                  Para questões onde o PDF não tem gabarito comentado, o PreceptorMED gera
                  uma explicação acadêmica baseada no enunciado e no gabarito.
                </p>
              </div>
            </label>
          </div>

          {/* Step 5: modo expresso */}
          <div>
            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 cursor-pointer hover:border-slate-300 has-[:checked]:border-[#C9A84C] has-[:checked]:bg-[#C9A84C]/5 transition-colors">
              <input
                type="checkbox"
                checked={modoExpresso}
                onChange={(e) => setModoExpresso(e.target.checked)}
                disabled={isProcessing}
                className="mt-0.5 w-4 h-4 accent-[#C9A84C]"
              />
              <div>
                <p className="text-sm font-bold text-[#191C1D] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#8a6f26]" />
                  Modo expresso
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#C9A84C]/15 text-[#8a6f26] font-mono uppercase tracking-wider">
                    novo
                  </span>
                </p>
                <p className="text-xs text-[#4a5568] leading-relaxed mt-0.5">
                  Comece a fazer a prova assim que as primeiras questões forem
                  extraídas. As demais aparecem ao vivo enquanto você responde.
                  Pula a etapa de revisão.
                </p>
              </div>
            </label>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Progress states */}
          {isProcessing && (
            <div className="p-4 bg-gradient-to-br from-[#005344]/5 to-[#C9A84C]/5 border border-[#006D5B]/20 rounded-xl">
              <div className="flex items-center gap-3 mb-2">
                <Loader2 className="w-5 h-5 text-[#005344] animate-spin shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-[#191C1D]">
                    {stage === "extracting_text"
                      ? "Lendo texto do PDF…"
                      : stage === "uploading"
                        ? "Enviando arquivo…"
                        : chunkProgress
                          ? `PreceptorMED processando lote ${chunkProgress.done}/${chunkProgress.total}…`
                          : "PreceptorMED estruturando questões…"}
                  </p>
                  <p className="text-xs text-[#4a5568] mt-0.5">
                    {stage === "extracting_text"
                      ? "Extraindo texto página-a-página no seu navegador"
                      : stage === "uploading"
                        ? "Não feche essa janela"
                        : chunkProgress && chunkProgress.questoes > 0
                          ? `${chunkProgress.questoes} questões já extraídas${modoExpresso && chunkProgress.done > 0 ? " — abrindo simulado…" : ""}`
                          : "Cada lote leva ~10–20s"}
                  </p>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-white/60 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#005344] to-[#C9A84C] transition-all"
                  style={{
                    width:
                      stage === "extracting_text"
                        ? "20%"
                        : stage === "uploading"
                          ? `${20 + progress * 0.15}%`
                          : chunkProgress
                            ? `${35 + (chunkProgress.done / Math.max(1, chunkProgress.total)) * 65}%`
                            : "40%",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-2">
          {!isProcessing && (
            <button
              onClick={onClose}
              className="px-4 h-10 rounded-lg text-sm font-semibold text-[#4a5568] hover:bg-slate-100"
            >
              Cancelar
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 px-5 h-10 rounded-lg bg-gradient-to-br from-[#003D32] via-[#005344] to-[#006D5B] text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_12px_-4px_rgba(0,109,91,0.4)]"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 text-[#C9A84C]" />
            )}
            {isProcessing ? "Processando…" : "Importar e processar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDelete({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="font-['Manrope'] font-bold text-lg text-[#191C1D]">
              Excluir prova?
            </h3>
          </div>
        </div>
        <div className="p-5">
          <p className="text-sm text-[#4a5568] leading-relaxed">
            Todas as questões extraídas, suas edições e o histórico de
            tentativas serão apagados. O PDF original também será removido. Não
            dá pra desfazer.
          </p>
        </div>
        <div className="p-5 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 h-10 rounded-lg text-sm font-semibold text-[#4a5568] hover:bg-slate-100"
          >
            Voltar
          </button>
          <button
            onClick={onConfirm}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700"
          >
            <Trash2 className="w-4 h-4" />
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
