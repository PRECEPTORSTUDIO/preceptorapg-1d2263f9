import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useToast } from "@/hooks/use-toast";
import {
  createConsulta,
  uploadConsultaAudio,
  startTranscription,
  type ConsentMethod,
} from "@/hooks/useScribe";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageSkeleton from "@/components/PageSkeleton";
import UpgradePaywall from "@/components/UpgradePaywall";
import AudioRecorder from "@/components/scribe/AudioRecorder";
import {
  ArrowLeft, ArrowRight, Mic, ShieldCheck, Loader2, Sparkles,
  AlertTriangle, Check, FileText,
} from "lucide-react";

type Step = "setup" | "consent" | "recording" | "uploading";

const ScribeNova = () => {
  const { user, loading: authLoading } = useAuth();
  const { hasFeature, reason, loading } = useFeatureAccess("scribe");
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("setup");
  const [pacienteAlias, setPacienteAlias] = useState("");
  const [consent, setConsent] = useState({
    audio: false,
    pdf: false,
    compartilhamento_ia: false,
    method: "verbal_gravado" as ConsentMethod,
    iAmResponsible: false,
  });
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [creating, setCreating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<
    "creating" | "uploading" | "starting" | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  if (authLoading || loading) return <PageSkeleton variant="dashboard" />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!hasFeature && reason === "no_subscription") {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto py-12 px-6">
          <UpgradePaywall variant="feature-locked" />
        </div>
      </DashboardLayout>
    );
  }
  if (!hasFeature && reason === "no_invite") {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto py-12 px-6">
          <UpgradePaywall variant="beta-only" betaModule="Scribe Clínico" />
        </div>
      </DashboardLayout>
    );
  }

  const canSetup = pacienteAlias.trim().length >= 3;
  const canConsent =
    consent.audio &&
    consent.iAmResponsible &&
    !!consent.method;

  const handleAudioComplete = async (blob: Blob, durationS: number) => {
    setAudioBlob(blob);
    setAudioDuration(durationS);
    // Inicia upload + transcricao automaticamente
    await startProcessing(blob, durationS);
  };

  const startProcessing = async (blob: Blob, durationS: number) => {
    if (!user) return;
    setError(null);
    setStep("uploading");
    setCreating(true);
    try {
      setUploadProgress("creating");
      const { id } = await createConsulta({
        userId: user.id,
        pacienteAlias,
        consent: {
          audio: consent.audio,
          pdf: consent.pdf,
          compartilhamento_ia: consent.compartilhamento_ia,
          method: consent.method,
        },
      });

      setUploadProgress("uploading");
      await uploadConsultaAudio(user.id, id, blob, durationS);

      setUploadProgress("starting");
      await startTranscription(id);

      toast({
        title: "Consulta criada",
        description: "Transcrição iniciada. Você será redirecionado.",
      });
      navigate(`/scribe/${id}/review`);
    } catch (e) {
      setError((e as Error).message);
      setStep("recording");
    } finally {
      setCreating(false);
      setUploadProgress(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <button
          onClick={() => {
            if (step === "setup" || confirm("Cancelar a consulta? Áudio em andamento será descartado.")) {
              navigate("/scribe");
            }
          }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4a5568] hover:text-[#191C1D] mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Scribe
        </button>

        {/* Header */}
        <div className="mb-6">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-[#005344] inline-flex items-center gap-2.5 mb-3">
            <span className="w-6 h-px bg-[#C9A84C]" />
            Nova consulta
          </p>
          <h1 className="font-['Manrope'] font-bold text-3xl tracking-[-0.02em] text-[#191C1D]">
            {step === "setup" && "Identifique a consulta"}
            {step === "consent" && "Consentimento do paciente"}
            {step === "recording" && "Grave a consulta"}
            {step === "uploading" && "Processando…"}
          </h1>
        </div>

        {/* Progress steps */}
        <Steps current={step} />

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
            <p className="text-xs text-red-900 leading-relaxed">{error}</p>
          </div>
        )}

        {/* STEP: SETUP */}
        {step === "setup" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 mt-6">
            <label className="block text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#4a5568] mb-2">
              Apelido / identificador da consulta
            </label>
            <input
              value={pacienteAlias}
              onChange={(e) => setPacienteAlias(e.target.value.slice(0, 200))}
              placeholder="Ex: JM, 62a, HAS · ou · Sra. RC, retorno cardio"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white font-['Manrope'] text-base font-semibold text-[#191C1D] placeholder-[#94a3b8] outline-none focus:border-[#006D5B] focus:ring-4 focus:ring-[#006D5B]/10 transition-shadow"
            />
            <p className="text-xs text-[#4a5568] mt-2 leading-relaxed">
              <strong>Não use o nome completo do paciente.</strong> Use iniciais
              + idade + dado contextual breve. Os dados sensíveis ficam apenas
              no áudio e no transcript (que serão criptografados em repouso).
            </p>

            <div className="flex justify-end mt-5">
              <button
                onClick={() => setStep("consent")}
                disabled={!canSetup}
                className="inline-flex items-center gap-2 px-5 h-11 rounded-xl bg-[#191C1D] text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Próximo
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP: CONSENT */}
        {step === "consent" && (
          <div className="space-y-4 mt-6">
            {/* Banner LGPD */}
            <div className="rounded-2xl bg-amber-50 border-2 border-amber-200 p-4 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-amber-700 mb-1">
                  LGPD Art. 11 — dado sensível de saúde
                </p>
                <p className="text-sm text-amber-900 leading-relaxed">
                  Você precisa do consentimento expresso do paciente para
                  gravar a consulta. A forma mais simples e juridicamente
                  robusta é gravar o consentimento verbal no início do áudio.
                </p>
              </div>
            </div>

            {/* Método de consentimento */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <label className="block text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#4a5568] mb-3">
                Como você obteve o consentimento?
              </label>
              <div className="space-y-2">
                {[
                  {
                    value: "verbal_gravado",
                    label: "Verbal gravado",
                    desc: "Vou abrir a consulta pedindo permissão e registrando no próprio áudio (recomendado).",
                  },
                  {
                    value: "formulario_papel_arquivado",
                    label: "Termo em papel arquivado",
                    desc: "Já assinei termo físico que fica no prontuário do consultório.",
                  },
                  {
                    value: "assinatura_digital",
                    label: "Assinatura digital",
                    desc: "Paciente assinou termo digital antes da consulta.",
                  },
                  {
                    value: "testemunha",
                    label: "Testemunha presencial",
                    desc: "Acompanhante/colega presente confirmou consentimento verbal.",
                  },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                      consent.method === opt.value
                        ? "border-[#005344] bg-[#005344]/5"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="consent_method"
                      checked={consent.method === opt.value}
                      onChange={() =>
                        setConsent({ ...consent, method: opt.value as ConsentMethod })
                      }
                      className="mt-0.5 w-4 h-4 accent-[#005344]"
                    />
                    <div>
                      <p className="text-sm font-bold text-[#191C1D]">{opt.label}</p>
                      <p className="text-xs text-[#4a5568] mt-0.5 leading-relaxed">
                        {opt.desc}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Confirmações */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent.audio}
                  onChange={(e) => setConsent({ ...consent, audio: e.target.checked })}
                  className="mt-0.5 w-4 h-4 accent-[#005344]"
                />
                <span className="text-sm text-[#191C1D] leading-relaxed">
                  Confirmo que <strong>obtive consentimento expresso</strong> do
                  paciente para gravação e processamento do áudio da consulta.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent.pdf}
                  onChange={(e) => setConsent({ ...consent, pdf: e.target.checked })}
                  className="mt-0.5 w-4 h-4 accent-[#005344]"
                />
                <span className="text-sm text-[#191C1D] leading-relaxed">
                  Paciente também consentiu com <strong>geração de PDF do prontuário</strong>{" "}
                  (opcional).
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent.compartilhamento_ia}
                  onChange={(e) =>
                    setConsent({ ...consent, compartilhamento_ia: e.target.checked })
                  }
                  className="mt-0.5 w-4 h-4 accent-[#005344]"
                />
                <span className="text-sm text-[#191C1D] leading-relaxed">
                  Paciente consentiu com <strong>uso do PreceptorMED</strong> para
                  estruturar transcrição em prontuário (transcrição via Google Gemini,
                  estruturação via Claude da Anthropic; o dado
                  trafega criptografado).
                </span>
              </label>

              <div className="border-t border-slate-100 pt-3 mt-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consent.iAmResponsible}
                    onChange={(e) =>
                      setConsent({ ...consent, iAmResponsible: e.target.checked })
                    }
                    className="mt-0.5 w-4 h-4 accent-[#005344]"
                  />
                  <span className="text-sm text-[#191C1D] leading-relaxed">
                    Sou médico/residente e <strong>assumo responsabilidade integral</strong>{" "}
                    pelo conteúdo final do prontuário (CFM 1.821/2007 e
                    2.299/2021). O PreceptorMED é ferramenta de apoio à documentação.
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-between gap-2">
              <button
                onClick={() => setStep("setup")}
                className="inline-flex items-center gap-2 px-4 h-11 rounded-xl border border-slate-200 text-sm font-semibold text-[#4a5568] hover:bg-slate-50"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>
              <button
                onClick={() => setStep("recording")}
                disabled={!canConsent}
                className="inline-flex items-center gap-2 px-5 h-11 rounded-xl bg-gradient-to-br from-[#003D32] via-[#005344] to-[#006D5B] text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Mic className="w-4 h-4" />
                Ir pra gravação
              </button>
            </div>
          </div>
        )}

        {/* STEP: RECORDING */}
        {step === "recording" && (
          <div className="mt-6">
            {consent.method === "verbal_gravado" && (
              <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-900 leading-relaxed">
                  <strong>Lembrete:</strong> comece a gravação pedindo
                  permissão ao paciente em voz alta — algo como{" "}
                  <em>"Você concorda em gravar nossa consulta para apoio na
                  documentação?"</em> Pra ficar registrado no áudio.
                </p>
              </div>
            )}
            <AudioRecorder onComplete={handleAudioComplete} />

            <div className="flex justify-start mt-4">
              <button
                onClick={() => setStep("consent")}
                className="inline-flex items-center gap-2 px-4 h-9 rounded-lg text-xs font-semibold text-[#4a5568] hover:bg-slate-100"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Voltar pro consentimento
              </button>
            </div>
          </div>
        )}

        {/* STEP: UPLOADING */}
        {step === "uploading" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 mt-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#005344]/15 to-[#C9A84C]/15 mb-4">
              {creating ? (
                <Loader2 className="w-8 h-8 text-[#005344] animate-spin" />
              ) : (
                <Check className="w-8 h-8 text-emerald-600" />
              )}
            </div>
            <h3 className="font-['Manrope'] font-bold text-lg text-[#191C1D] mb-1">
              {uploadProgress === "creating" && "Criando consulta…"}
              {uploadProgress === "uploading" && "Enviando áudio criptografado…"}
              {uploadProgress === "starting" && "Iniciando transcrição PreceptorMED…"}
            </h3>
            <p className="text-sm text-[#4a5568] leading-relaxed">
              {audioDuration > 0 && (
                <>
                  {Math.floor(audioDuration / 60)}min {Math.floor(audioDuration % 60)}s de
                  áudio · {audioBlob ? `${(audioBlob.size / 1024 / 1024).toFixed(1)} MB` : ""}
                </>
              )}
            </p>
            <p className="text-xs text-[#94a3b8] mt-3">
              Não feche a página. Você será redirecionado quando começar a transcrição.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ScribeNova;

// ────────────────────────────────────────────────────────────
function Steps({ current }: { current: Step }) {
  const order: Step[] = ["setup", "consent", "recording", "uploading"];
  const labels: Record<Step, string> = {
    setup: "Setup",
    consent: "Consentimento",
    recording: "Gravação",
    uploading: "Upload",
  };
  const idx = order.indexOf(current);
  return (
    <div className="flex items-center gap-2">
      {order.map((s, i) => {
        const isActive = i === idx;
        const isDone = i < idx;
        return (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div
              className={`flex-1 h-1 rounded-full ${
                isActive
                  ? "bg-gradient-to-r from-[#005344] to-[#C9A84C]"
                  : isDone
                    ? "bg-[#005344]"
                    : "bg-slate-200"
              }`}
            />
            <span
              className={`text-[10.5px] font-bold uppercase tracking-wider ${
                isActive ? "text-[#005344]" : isDone ? "text-[#005344]/60" : "text-[#94a3b8]"
              }`}
            >
              {labels[s]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
