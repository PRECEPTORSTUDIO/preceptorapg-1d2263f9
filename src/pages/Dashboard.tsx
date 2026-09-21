import { useState, useRef, useEffect } from 'react';
import PageSkeleton from '@/components/PageSkeleton';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/hooks/useSubscription';
import { useAdmin } from '@/hooks/useAdmin';
import { useGenerationGuard } from '@/hooks/useGenerationGuard';
import InputPanel from '@/components/dashboard/InputPanel';
import AnnotationLayer from '@/components/dashboard/AnnotationLayer';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import ContextChat from '@/components/ContextChat';
import GenerationProgress from '@/components/GenerationProgress';
import SeminarActions from '@/components/dashboard/SeminarActions';
import { exportToPDF } from '@/utils/pdfExport';
import type { GenerationMode } from '@/components/dashboard/ModeToggle';
import OnboardingTour, { type TourStep } from '@/components/OnboardingTour';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Loader2, ArrowLeft, Save, Copy, Download, GraduationCap, BookOpen, Sparkles } from 'lucide-react';
import { useStudyPlanContext, useAutoCompleteActivity } from '@/hooks/useStudyPlanContext';

type ViewMode = 'interactive' | 'document';

export interface AttachedArticle {
  name: string;
  mimeType: string;
  data: string; // base64 sem prefixo data:
  sizeKB: number;
}

const MI = ({ name, fill = false, className = '' }: { name: string; fill?: boolean; className?: string }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{ fontVariationSettings: fill ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : undefined }}
  >
    {name}
  </span>
);

/** Split markdown into sections by ## headings */
function splitIntoSections(markdown: string): { title: string; content: string }[] {
  const sections: { title: string; content: string }[] = [];
  const parts = markdown.split(/(?=^## )/m);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const headingMatch = trimmed.match(/^## (.+)/);
    if (headingMatch) {
      sections.push({
        title: headingMatch[1].trim(),
        content: trimmed,
      });
    } else {
      // Content before the first ## (intro)
      if (trimmed.length > 20) {
        sections.push({ title: '', content: trimmed });
      }
    }
  }

  return sections;
}

const dashboardTourSteps: TourStep[] = [
  { target: '[data-tour="tema-input"]',    title: 'Tema do Resumo',       description: 'Digite o tema central. Use os chips de sugestão ou escreva livremente.', placement: 'right' },
  { target: '[data-tour="objetivos-input"]', title: 'Objetivos (Opcional)', description: 'Liste objetivos específicos ou deixe em branco para o PreceptorMED sugerir.', placement: 'right' },
  { target: '[data-tour="mode-toggle"]',   title: 'Tipo de Conteúdo',     description: 'Escolha entre Resumo (conteúdo focado) ou Seminário (apresentação completa).', placement: 'right' },
  { target: '[data-tour="generate-btn"]',  title: 'Gerar Conteúdo',       description: 'Clique para iniciar. O conteúdo aparecerá em tempo real no painel ao lado.', placement: 'right' },
  { target: '[data-tour="highlight-tip"]', title: 'Grifar e anotar',      description: 'Depois que o resumo for gerado, selecione qualquer trecho com o mouse para abrir a paleta de cores. Você pode marcar pontos importantes ou adicionar anotações pessoais — tudo fica salvo automaticamente.', placement: 'top' },
];

interface RecentItem {
  id: string;
  tema: string;
  created_at: string;
  modo?: string;
}

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { hasAccess, loading: subLoading } = useSubscription();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { toast } = useToast();

  const [tema, setTema] = useState('');
  const [objetivos, setObjetivos] = useState('');
  const [modo, setModo] = useState<GenerationMode>('fechamento');
  // Profundidade do fechamento: completo (máx. profundidade) vs reduzido (enxuto)
  const [tamanho, setTamanho] = useState<'completo' | 'reduzido'>('completo');
  // Seções do resumo — todas marcadas por padrão
  const DEFAULT_SECOES = {
    nosologia: true,
    epidemiologia: true,
    anatomia: true,
    histologia: true,
    fisiologia: true,
    embriologia: true,
    revisao_geral: true,
    etiologia: true,
    fisiopatologia: true,
    manifestacoes: true,
    diagnostico_exames: true,
    tratamento: true,
    prognostico: true,
    prevencao: true,
  };
  const [secoes, setSecoes] = useState<Record<string, boolean>>(DEFAULT_SECOES);
  // Artigos PDF anexados pelo estudante como fonte preferencial
  const [artigos, setArtigos] = useState<AttachedArticle[]>([]);
  // ID do fechamento salvo (para anotações — marca-texto/comentários)
  const [fechamentoId, setFechamentoId] = useState<string | null>(null);

  // Cronograma context: se a página foi aberta via "começar atividade" no plano
  const planCtx = useStudyPlanContext();
  // Pré-preenche o tema vindo do plano UMA vez ao montar
  useEffect(() => {
    if (planCtx.isFromPlan && planCtx.tema && !tema) setTema(planCtx.tema);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planCtx.isFromPlan]);
  const [resultado, setResultado] = useState('');
  const [generating, setGenerating] = useState(false);
  const [hasStartedReceiving, setHasStartedReceiving] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('interactive');
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const resultRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const { canGenerate, cooldown } = useGenerationGuard(generating);

  useEffect(() => {
    // Only auto-show result when generation starts streaming (not when resetting)
    if (hasStartedReceiving && !showResult && generating) setShowResult(true);
  }, [hasStartedReceiving, showResult, generating]);

  // Auto-marca atividade do cronograma como concluída quando o fechamento termina
  useAutoCompleteActivity(
    isComplete && !!fechamentoId,
    { planDay: planCtx.planDay, actIdx: planCtx.actIdx },
    fechamentoId,
  );

  // Fetch recent items for sidebar
  useEffect(() => {
    if (!user) return;
    const fetchRecent = async () => {
      const { data } = await supabase
        .from('fechamentos')
        .select('id, tema, created_at')
        .order('created_at', { ascending: false })
        .limit(3);
      if (data) setRecentItems(data);
    };
    fetchRecent();
  }, [user]);

  if (authLoading || subLoading || adminLoading) return <PageSkeleton variant="dashboard" />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!hasAccess && !isAdmin) return <Navigate to="/pricing" replace />;

  const isSeminario = modo === 'seminario';

  // Executa uma tentativa de geracao via SSE.
  // Retorna {fullText, finishMeta} OU lanca erro de rede/servidor.
  const runGeneration = async (accessToken: string): Promise<{
    fullText: string;
    finishMeta: { finish_reason?: string; chars?: number; message?: string; error_code?: number; error_status?: string; retryable?: boolean } | null;
  }> => {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-fechamento`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ tema, objetivos, modo, tamanho, secoes, artigos: artigos.map(a => ({ name: a.name, mimeType: a.mimeType, data: a.data })) }) }
    );
    if (!response.ok) {
      const e = await response.json().catch(() => ({}));
      throw new Error(e.error || 'Erro ao gerar fechamento');
    }
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';
    let finishMeta: { finish_reason?: string; chars?: number; message?: string; error_code?: number; error_status?: string; retryable?: boolean } | null = null;
    const consumeLine = (line: string) => {
      if (!line.startsWith('data: ')) return;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr || jsonStr === '[DONE]') return;
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.meta?.finish_reason) {
          finishMeta = parsed.meta;
          return;
        }
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          if (!hasStartedReceiving) setHasStartedReceiving(true);
          fullText += content;
          setResultado(fullText);
        }
      } catch { /* partial JSON ja tratado pelo buffer */ }
    };
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) consumeLine(line);
      }
      if (buffer.length > 0) consumeLine(buffer);
    }
    return { fullText, finishMeta };
  };

  const handleGenerate = async () => {
    if (!tema.trim()) {
      toast({ title: 'Tema obrigatório', description: 'Por favor, insira o tema central.', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    setResultado(''); setFechamentoId(null);
    setHasStartedReceiving(false);
    setIsComplete(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      // If session belongs to the CRM service account, it's corrupted — clear and redirect
      if (session?.user?.email === 'crm-service@thepreceptor.com.br') {
        await supabase.auth.signOut();
        window.location.href = '/auth';
        return;
      }
      if (!session) {
        window.location.href = '/auth';
        return;
      }

      // Tentativa com retry automatico unico: se a primeira chegar truncada
      // (provavelmente proxy fechou conexao SSE) ou der erro de rede, reseta
      // o estado de exibicao e tenta uma vez antes de avisar o usuario.
      const MAX_ATTEMPTS = 2;
      let result: { fullText: string; finishMeta: { finish_reason?: string; chars?: number } | null } = { fullText: '', finishMeta: null };
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        if (attempt > 1) {
          // reset de UI antes do retry
          setResultado('');
          setHasStartedReceiving(false);
          console.info(`generate-fechamento: retry ${attempt}/${MAX_ATTEMPTS}`);
        }
        try {
          result = await runGeneration(session.access_token);
          lastError = null;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          // erro de rede/HTTP — vale retry se tivermos tentativa restante
          if (attempt < MAX_ATTEMPTS) continue;
          throw lastError;
        }
        // Erro do upstream — retry apenas se backend marcou retryable
        // (503/502/504/UNAVAILABLE). Quota/key/permissao nao resolve com retry.
        if (result.finishMeta?.finish_reason === 'ERROR') {
          if (result.finishMeta.retryable && attempt < MAX_ATTEMPTS) continue;
          break;
        }
        const truncated = (result.finishMeta?.finish_reason && result.finishMeta.finish_reason !== 'STOP')
          || result.fullText.length < 500;
        if (!truncated) break; // sucesso
        if (attempt >= MAX_ATTEMPTS) break; // esgotou retries
      }

      setIsComplete(true);
      const { fullText, finishMeta } = result;

      // Se mesmo apos retry o backend sinalizou parada anormal, avisa e NAO
      // auto-salva — evita salvar resumo truncado na biblioteca como se
      // estivesse completo.
      if (finishMeta?.finish_reason === 'ERROR') {
        // Erro mid-stream do Claude (quota/key/etc) — surfaca a mensagem
        // traduzida que o backend ja preparou.
        toast({
          title: finishMeta.error_code === 429 ? 'Quota do PreceptorMED esgotada' : 'Erro do provedor PreceptorMED',
          description: finishMeta.message ?? 'Erro desconhecido da IA. Cheque os logs.',
          variant: 'destructive',
        });
      } else if (finishMeta?.finish_reason && finishMeta.finish_reason !== 'STOP') {
        const reasonMsg: Record<string, string> = {
          MAX_TOKENS: 'O modelo atingiu o limite de tokens antes de terminar. Tente um tema mais especifico ou reduza os objetivos.',
          SAFETY: 'O conteudo gerado foi bloqueado por filtros de seguranca. Tente reformular o tema.',
          RECITATION: 'O conteudo foi bloqueado por similaridade com fontes protegidas. Tente reformular.',
          OTHER: 'A geracao foi interrompida por um motivo desconhecido. Tente novamente.',
        };
        toast({
          title: 'Geracao interrompida',
          description: reasonMsg[finishMeta.finish_reason] ?? `Motivo: ${finishMeta.finish_reason}. Tente novamente.`,
          variant: 'destructive',
        });
      } else if (fullText.length < 500) {
        // Stream foi cortado prematuramente (provavelmente rede/proxy) e
        // ainda nao recuperou apos retry. Nao salva, avisa o usuario.
        toast({
          title: 'Conexao instavel',
          description: 'A geracao foi interrompida antes de terminar. Verifique sua conexao (tente outra rede ou desabilite extensoes do navegador) e tente novamente.',
          variant: 'destructive',
        });
      } else if (fullText && user) {
        // Auto-save apenas em geracao bem-sucedida.
        try {
          const { data: saved, error: saveError } = await supabase.from('fechamentos').insert({
            user_id: user.id,
            tema: tema.trim(),
            objetivos: objetivos.trim() || null,
            resultado: fullText,
          }).select('id').single();
          if (!saveError && saved?.id) {
            setFechamentoId(saved.id);
          }
          toast({ title: 'Salvo na biblioteca', description: 'Voce pode acessar em Biblioteca a qualquer hora.' });
        } catch (saveErr) {
          console.warn('auto-save falhou:', saveErr);
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Não foi possível gerar.';
      const isFetch = msg.includes('fetch') || msg.includes('network') || msg.includes('Failed');
      toast({
        title: isFetch ? 'Erro de conexão' : 'Erro',
        description: isFetch ? 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.' : msg,
        variant: 'destructive',
      });
    } finally { setGenerating(false); }
  };

  const handleCopy = () => {
    const clean = resultado.replace(/^#{1,6}\s+/gm,'').replace(/\*\*\*(.*?)\*\*\*/g,'$1').replace(/\*\*(.*?)\*\*/g,'$1').replace(/\*(.*?)\*/g,'$1').replace(/`{1,3}(.*?)`{1,3}/gs,'$1').replace(/^\s*[-*+]\s+/gm,'• ').replace(/^>\s+/gm,'').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/^---+$/gm,'').replace(/\n{3,}/g,'\n\n');
    navigator.clipboard.writeText(clean.trim());
    toast({ title: 'Copiado!', description: 'Resumo copiado para a área de transferência.' });
  };

  const handleExportPDF = async () => {
    if (!resultado) return;
    setExporting(true);
    try {
      await exportToPDF({ tema: tema.trim(), markdown: resultado });
      toast({ title: 'PDF exportado!' });
    }
    catch (e) { console.error('PDF export error:', e); toast({ title: 'Erro ao exportar', variant: 'destructive' }); }
    finally { setExporting(false); }
  };

  const handleSave = async () => {
    if (!resultado || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('fechamentos').insert({ user_id: user.id, tema: tema.trim(), objetivos: objetivos.trim() || null, resultado });
      if (error) throw error;
      toast({ title: 'Salvo!', description: 'Resumo salvo na sua biblioteca.' });
    } catch { toast({ title: 'Erro ao salvar', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const handleGenerateExam = async () => {
    if (!resultado || !user) return;
    try {
      const { error } = await supabase.from('fechamentos').insert({ user_id: user.id, tema: tema.trim(), objetivos: objetivos.trim() || null, resultado }).select('id').single();
      if (error) throw error;
      toast({ title: 'Salvo!', description: 'Redirecionando para o Modo Prática...' });
      navigate('/exam');
    } catch { toast({ title: 'Erro ao salvar', variant: 'destructive' }); }
  };

  const showActions = resultado && !generating;
  const readingTime = resultado ? Math.max(1, Math.ceil(resultado.split(/\s+/).length / 200)) : 0;

  const formatRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      return `Hoje, às ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    if (diffDays === 1) return `Ontem, às ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${date.getDate().toString().padStart(2, '0')} ${months[date.getMonth()]}, ${date.getFullYear()}`;
  };

  return (
    <DashboardLayout mainClassName="pt-6 sm:pt-8 pb-4 px-4 sm:px-6">
      <OnboardingTour steps={dashboardTourSteps} tourKey="dashboard" />

      <div className="max-w-6xl mx-auto w-full">
        {showResult ? (
          <>
            {/* ── Page Header ── */}
            <div className="mb-6 sm:mb-10">
              <div className="flex items-center gap-2 text-[#006D5B] font-semibold mb-2 sm:mb-3">
                <MI name="auto_awesome" fill className="text-[16px]" />
                <span className="text-[11px] uppercase tracking-widest font-bold">
                  {isSeminario ? 'Roteiro de Seminário' : 'AI Summary Insight'}
                </span>
              </div>
              <h1 className="text-xl sm:text-3xl lg:text-4xl font-extrabold text-[#191c1d] tracking-tight mb-3 sm:mb-4 font-['Manrope']">
                {tema}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 bg-[#c8eade] text-[#4c6a62] text-[11px] font-bold rounded-full uppercase">
                  {isSeminario ? 'Seminário' : 'Resumo'}
                </span>
                {isComplete && (
                  <span className="px-3 py-1 bg-[#9df3dc] text-[#005143] text-[11px] font-bold rounded-full uppercase">
                    Tempo de Leitura: {readingTime} min
                  </span>
                )}
                {generating && (
                  <span className="px-3 py-1 bg-[#e7e8e9] text-[#3e4945] text-[11px] font-bold rounded-full uppercase flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#006D5B] animate-pulse" />
                    Gerando...
                  </span>
                )}
              </div>
            </div>

            {/* ── Toolbar ── */}
            <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setShowResult(false); setResultado(''); setIsComplete(false); setHasStartedReceiving(false); }}
                  className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#006D5B] transition-colors active:scale-95"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Novo Resumo</span>
                </button>

                {/* View mode toggle */}
                <div className="flex items-center gap-0.5 bg-[#f3f4f5] rounded-lg p-0.5">
                  <button
                    onClick={() => setViewMode('interactive')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'interactive' ? 'bg-white shadow-sm text-[#006D5B]' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <MI name="auto_awesome" className="text-[16px]" />
                    <span className="hidden sm:inline">Estudo Interativo</span>
                  </button>
                  <button
                    onClick={() => setViewMode('document')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'document' ? 'bg-white shadow-sm text-[#006D5B]' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <MI name="description" className="text-[16px]" />
                    <span className="hidden sm:inline">Documento</span>
                  </button>
                </div>
              </div>

              {showActions && (
                <div className="flex items-center gap-1.5">
                  {[
                    { icon: saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />, label: 'Salvar', onClick: handleSave, disabled: saving },
                    { icon: <Copy className="h-4 w-4" />, label: 'Copiar', onClick: handleCopy, disabled: false },
                    { icon: exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />, label: 'PDF', onClick: handleExportPDF, disabled: exporting },
                  ].map(({ icon, label, onClick, disabled }) => (
                    <button
                      key={label}
                      onClick={onClick}
                      disabled={disabled}
                      className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium text-slate-500 hover:text-[#191c1d] hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200/60 transition-all duration-200 active:scale-95 disabled:opacity-50"
                    >
                      {icon}
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Content ── */}
            {viewMode === 'interactive' ? (
              /* ═══ INTERACTIVE VIEW — pmed-summary com seções ═══ */
              <div className="grid grid-cols-12 gap-4 sm:gap-6 lg:gap-8">
                {/* Main Article Column */}
                <div className="col-span-12 lg:col-span-8 space-y-4 sm:space-y-6" ref={resultRef}>
                  {/* Summary wrapper editorial — ribbon + header + body unificados */}
                  <article className="pmed-summary animate-fade-up">
                    <header className="pmed-summary__head">
                      <p className="pmed-eyebrow">
                        {isSeminario ? 'Roteiro de seminário' : 'Fechamento gerado'}
                      </p>
                      <h2 className="pmed-editorial-title" style={{ fontSize: 'clamp(20px, 2.5vw, 26px)' }}>
                        {tema}
                      </h2>
                      <div className="pmed-summary__meta">
                        {isComplete && (
                          <span>
                            <span className="material-symbols-outlined">schedule</span>
                            {readingTime} min de leitura
                          </span>
                        )}
                        <span>
                          <span className="material-symbols-outlined">category</span>
                          {isSeminario ? 'Seminário acadêmico' : 'Fechamento de PBL'}
                        </span>
                        <span>
                          <span className="material-symbols-outlined">auto_awesome</span>
                          Gerado por PreceptorMED
                        </span>
                      </div>
                    </header>

                    {/* Body — markdown herda estilos .pmed-summary__body (ver index.css) */}
                    <div className="pmed-summary__body">
                      {(() => {
                        const sections = splitIntoSections(resultado);
                        if (sections.length <= 1) {
                          return (
                            <MarkdownRenderer content={resultado} isTyping={generating && resultado.length > 0} />
                          );
                        }
                        return sections.map((section, i) => (
                          <MarkdownRenderer
                            key={i}
                            content={section.content}
                            isTyping={generating && i === sections.length - 1 && resultado.length > 0}
                          />
                        ));
                      })()}
                    </div>

                    {/* Footer com refs */}
                    {isComplete && (
                      <footer className="pmed-summary__foot">
                        <div className="flex gap-2 flex-wrap">
                          <span className="pmed-ref-chip">
                            <span className="material-symbols-outlined">menu_book</span>
                            Harrison
                          </span>
                          <span className="pmed-ref-chip">
                            <span className="material-symbols-outlined">menu_book</span>
                            Guyton
                          </span>
                          <span className="pmed-ref-chip">
                            <span className="material-symbols-outlined">menu_book</span>
                            UpToDate
                          </span>
                        </div>
                        <span style={{ color: 'rgb(var(--brand-primary-dark))', fontWeight: 600 }}>
                          Exporte em PDF acima ↑
                        </span>
                      </footer>
                    )}
                  </article>

                  {/* Dica de marca-texto */}
                  {isComplete && resultado && fechamentoId && (
                    <div data-tour="highlight-tip" className="flex items-start gap-2 px-3 py-2.5 bg-brand-gold/10 border border-brand-gold/30 rounded-lg">
                      <span className="material-symbols-outlined text-brand-gold text-[18px] mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>ink_highlighter</span>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-brand-ink">Selecione um trecho para grifar ou comentar</p>
                        <p className="text-[11px] text-brand-ink-2 leading-snug">Arraste o mouse sobre qualquer texto pra abrir a paleta de cores. Pra adicionar uma anotação pessoal, clique em "Comentar". Suas marcações ficam salvas e reaparecem quando você reabrir o resumo na Biblioteca.</p>
                      </div>
                    </div>
                  )}

                  {/* Disclaimer */}
                  {!generating && resultado && (
                    <p className="text-[10px] text-slate-400 leading-relaxed px-2">
                      Conteúdo gerado por IA para fins educacionais. Pode conter imprecisões. Valide com fontes primárias. Não substitui orientação médica. (CFM 2.338/2023)
                    </p>
                  )}

                  {/* Seminar actions */}
                  {showActions && isSeminario && (
                    <SeminarActions resultado={resultado} tema={tema} />
                  )}

                  {/* Annotation layer — marca-texto e comentários */}
                  {isComplete && resultado && user && (
                    <AnnotationLayer
                      fechamentoId={fechamentoId}
                      containerRef={resultRef}
                      userId={user.id}
                    />
                  )}
                </div>

                {/* Sidebar Column */}
                <div className="col-span-12 lg:col-span-4">
                  <div className="lg:sticky lg:top-24 space-y-6">
                    {/* Clinical Pearls Card */}
                    <div className="bg-brand-primary-dark p-5 sm:p-6 rounded-xl text-white">
                      <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                        <MI name="diamond" fill className="text-[18px]" />
                        Pérolas Clínicas
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <p className="text-xs font-semibold text-white/60 mb-1">Atenção médica</p>
                          <p className="text-sm leading-relaxed text-white/90">
                            Use o chat do Preceptor para extrair pérolas clínicas e aprofundar nos pontos-chave deste resumo.
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-white/60 mb-1">Dica de prova</p>
                          <p className="text-sm leading-relaxed text-white/90">
                            Pergunte quais pontos mais caem em provas sobre este tema.
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-white/60 mb-1">Manejo</p>
                          <p className="text-sm leading-relaxed text-white/90">
                            Gere simulados a partir deste conteúdo para consolidar com active recall.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Progress Card */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-brand-ink-2">Seu progresso</h4>
                        {isComplete && <span className="text-xs font-semibold text-brand-primary">+15 XP</span>}
                      </div>
                      {generating ? (
                        <GenerationProgress
                          isGenerating={generating}
                          hasStartedReceiving={hasStartedReceiving}
                          isComplete={isComplete}
                        />
                      ) : (
                        <div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full mb-2 overflow-hidden">
                            <div className="bg-brand-primary h-full transition-all duration-500" style={{ width: isComplete ? '100%' : '65%' }} />
                          </div>
                          <div className="flex justify-between text-xs font-medium text-brand-ink-2">
                            <span>{isComplete ? '100%' : '65%'} concluído</span>
                            {isComplete && <span className="text-brand-primary font-semibold">Pronto</span>}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Dúvidas prompt */}
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent('open-context-chat'))}
                      className="w-full text-left bg-white p-4 rounded-xl border border-slate-200 hover:border-brand-primary/40 hover:shadow-sm transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-brand-primary/10 flex items-center justify-center">
                          <MI name="chat_bubble" fill className="text-[16px] text-brand-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-brand-ink">Dúvidas clínicas?</p>
                          <p className="text-xs text-brand-ink-2">Pergunte ao Preceptor Chat.</p>
                        </div>
                        <MI name="arrow_forward" className="text-[16px] text-slate-400 group-hover:text-brand-primary transition-colors" />
                      </div>
                    </button>

                    {/* Generate Exam Button */}
                    {showActions && (
                      <button
                        onClick={handleGenerateExam}
                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-white border-2 border-[#006D5B]/20 text-[#005344] rounded-xl text-sm font-bold hover:bg-[#006D5B]/5 hover:border-[#006D5B]/40 hover:shadow-sm transition-all duration-200 active:scale-[0.98]"
                      >
                        <GraduationCap className="h-5 w-5" />
                        Gerar Simulado a partir deste Resumo
                      </button>
                    )}

                    {/* Library link */}
                    {showActions && (
                      <button
                        onClick={() => navigate('/library')}
                        className="w-full flex items-center justify-center gap-2 py-3 text-xs font-medium text-slate-500 hover:text-[#006D5B] transition-colors"
                      >
                        <BookOpen className="h-4 w-4" />
                        Ver na Biblioteca
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* ═══ DOCUMENT VIEW — pmed-summary (design system spec) ═══ */
              <div className="max-w-4xl mx-auto">
                <article ref={docRef} className="pmed-summary">
                  {/* Header editorial */}
                  <header className="pmed-summary__head">
                    <p className="pmed-eyebrow">
                      {isSeminario ? 'Roteiro de seminário' : 'Fechamento gerado'}
                    </p>
                    <h1 className="pmed-editorial-title" style={{ fontSize: 'clamp(22px, 3vw, 30px)' }}>
                      {tema}
                    </h1>
                    <div className="pmed-summary__meta">
                      {isComplete && (
                        <span>
                          <span className="material-symbols-outlined">schedule</span>
                          {readingTime} min de leitura
                        </span>
                      )}
                      <span>
                        <span className="material-symbols-outlined">category</span>
                        {isSeminario ? 'Seminário acadêmico' : 'Fechamento de PBL'}
                      </span>
                      <span>
                        <span className="material-symbols-outlined">auto_awesome</span>
                        Gerado por PreceptorMED
                      </span>
                    </div>
                  </header>

                  {/* Body */}
                  <div className="pmed-summary__body">
                    <MarkdownRenderer content={resultado} isTyping={generating && resultado.length > 0} />
                  </div>

                  {/* Footer com refs */}
                  {isComplete && (
                    <footer className="pmed-summary__foot">
                      <div className="flex gap-2 flex-wrap">
                        <span className="pmed-ref-chip">
                          <span className="material-symbols-outlined">menu_book</span>
                          Harrison
                        </span>
                        <span className="pmed-ref-chip">
                          <span className="material-symbols-outlined">menu_book</span>
                          Guyton
                        </span>
                        <span className="pmed-ref-chip">
                          <span className="material-symbols-outlined">menu_book</span>
                          UpToDate
                        </span>
                      </div>
                      <span style={{ color: 'rgb(var(--brand-primary-dark))', fontWeight: 600 }}>
                        Exporte em PDF acima ↑
                      </span>
                    </footer>
                  )}
                </article>

                {/* Disclaimer */}
                {!generating && resultado && (
                  <p className="text-[10px] text-slate-400 leading-relaxed px-2 mt-4">
                    Conteúdo gerado por IA para fins educacionais. Pode conter imprecisões. Valide com fontes primárias. Não substitui orientação médica. (CFM 2.338/2023)
                  </p>
                )}

                {/* Seminar actions */}
                {showActions && isSeminario && (
                  <div className="mt-6">
                    <SeminarActions resultado={resultado} tema={tema} />
                  </div>
                )}

                {/* Dica de marca-texto (document view) */}
                {isComplete && resultado && fechamentoId && (
                  <div className="flex items-start gap-2 px-3 py-2.5 bg-brand-gold/10 border border-brand-gold/30 rounded-lg mt-4 max-w-4xl mx-auto">
                    <span className="material-symbols-outlined text-brand-gold text-[18px] mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>ink_highlighter</span>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-brand-ink">Selecione um trecho para grifar ou comentar</p>
                      <p className="text-[11px] text-brand-ink-2 leading-snug">Arraste o mouse sobre qualquer texto para destacar em cores ou adicionar uma anotação. Suas marcações ficam salvas e aparecem quando você reabrir o resumo na Biblioteca.</p>
                    </div>
                  </div>
                )}

                {/* Annotation layer — marca-texto em modo documento */}
                {isComplete && resultado && user && (
                  <AnnotationLayer
                    fechamentoId={fechamentoId}
                    containerRef={docRef}
                    userId={user.id}
                  />
                )}
              </div>
            )}

            {/* ContextChat FAB */}
            {resultado && (
              <ContextChat
                context={resultado}
                contextLabel="resumo"
                suggestions={[
                  'Quais são as pérolas clínicas deste tema?',
                  'O que mais cai em prova sobre isso?',
                  'Explique a fisiopatologia em detalhes',
                  'Quais são os diagnósticos diferenciais?',
                ]}
              />
            )}
          </>
        ) : (
          /* ══════════════════════════════════════════════
             INPUT FORM STATE — layout editorial
             ══════════════════════════════════════════════ */
          <div className="animate-fade-up">
            {/* Grid principal: form (mais largo) + sidebar lateral */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 lg:gap-6">
              {/* Form */}
              <div>
                <InputPanel
                  tema={tema}
                  setTema={setTema}
                  objetivos={objetivos}
                  setObjetivos={setObjetivos}
                  modo={modo}
                  setModo={setModo}
                  tamanho={tamanho}
                  setTamanho={setTamanho}
                  secoes={secoes}
                  setSecoes={setSecoes}
                  artigos={artigos}
                  setArtigos={setArtigos}
                  generating={generating}
                  hasStartedReceiving={hasStartedReceiving}
                  isComplete={isComplete}
                  onGenerate={handleGenerate}
                  canGenerate={canGenerate}
                  cooldown={cooldown}
                />
              </div>

              {/* Sidebar — Recentes + dica + chat link */}
              <aside className="hidden lg:flex flex-col gap-4">
                {/* Recentes */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-[0_1px_2px_rgba(25,28,29,0.04)]">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#4a5568] inline-flex items-center gap-2">
                      <span className="w-4 h-px bg-[#C9A84C]" />
                      Recentes
                    </h3>
                    <button
                      onClick={() => navigate('/library')}
                      className="text-[10px] font-semibold text-[#005344] hover:underline"
                    >
                      Ver tudo
                    </button>
                  </div>
                  {recentItems.length > 0 ? (
                    <div className="space-y-1">
                      {recentItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => navigate('/library')}
                          className="w-full text-left p-2 -mx-1 rounded-lg hover:bg-slate-50 transition-colors group"
                        >
                          <p className="text-[13px] font-semibold text-[#191C1D] leading-snug truncate group-hover:text-[#005344]">
                            {item.tema}
                          </p>
                          <p className="text-[10.5px] text-[#94a3b8] mt-0.5 font-mono">
                            {formatRelativeDate(item.created_at)}
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="py-4 text-center">
                      <p className="text-[11px] text-[#94a3b8] leading-relaxed">
                        Seus fechamentos recentes aparecem aqui.
                      </p>
                    </div>
                  )}
                </div>

                {/* Tip card editorial */}
                <div className="rounded-2xl border border-[#C9A84C]/30 bg-gradient-to-br from-[#C9A84C]/8 to-[#005344]/5 p-5">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#8a6f26] inline-flex items-center gap-2 mb-3">
                    <Sparkles className="w-3 h-3" />
                    Pérola
                  </p>
                  <p className="text-[13px] text-[#191C1D] leading-relaxed">
                    Objetivos em <strong>linguagem técnica</strong> guiam o PreceptorMED a
                    estruturar diretrizes em vez de enciclopédia. Ex: prefira{' '}
                    <em>"Critérios de Framingham"</em> a <em>"como diagnosticar IC"</em>.
                  </p>
                </div>

                {/* Chat link */}
                <button
                  onClick={() => navigate('/ai-chat')}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-slate-200 hover:border-[#005344]/30 hover:shadow-[0_4px_12px_-4px_rgba(0,109,91,0.12)] transition-all group"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#005344]/8 flex items-center justify-center group-hover:bg-[#005344]/15 transition-all">
                    <MI name="chat_bubble" fill className="text-[18px] text-[#005344]" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-[13px] font-bold text-[#191C1D] group-hover:text-[#005344] transition-colors">
                      Preceptor Chat
                    </p>
                    <p className="text-[10.5px] text-[#94a3b8]">
                      Tirar dúvida sem gerar resumo
                    </p>
                  </div>
                  <MI
                    name="arrow_forward"
                    className="text-[16px] text-slate-300 group-hover:text-[#005344] group-hover:translate-x-1 transition-all"
                  />
                </button>
              </aside>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
