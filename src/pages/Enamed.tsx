import { useState, useRef, useMemo, useEffect } from 'react';

import PageSkeleton from '@/components/PageSkeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useAdmin } from '@/hooks/useAdmin';
import { useToast } from '@/hooks/use-toast';
import { useEnamedBank, type EnamedArea, AREA_LABELS } from '@/hooks/useEnamedBank';
import { useEnamedGenerator } from '@/hooks/useEnamedGenerator';
import { Navigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import EnamedBankSimulation from '@/components/enamed/EnamedBankSimulation';
import SimulationView from '@/components/exam/SimulationView';
import ContextChat from '@/components/ContextChat';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';

type EnamedMode = 'menu' | 'completo' | 'revisao' | 'ia_completo' | 'ia_area';
type EnamedSource = 'banco' | 'ia';

const MI = ({ name, fill = false, className = '' }: { name: string; fill?: boolean; className?: string }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{ fontVariationSettings: fill ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : undefined }}
  >
    {name}
  </span>
);

const AREA_OPTIONS: { value: EnamedArea; label: string; icon: string; desc: string; iconBg: string; iconColor: string }[] = [
  { value: 'clinica_medica', label: 'Clínica Médica', icon: 'cardiology', desc: '20 Questões • Médio', iconBg: 'bg-red-100', iconColor: 'text-red-600' },
  { value: 'cirurgia', label: 'Cirurgia', icon: 'surgical', desc: '20 Questões • Médio', iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
  { value: 'ginecologia_obstetricia', label: 'GO', icon: 'pregnant_woman', desc: '20 Questões • Fácil', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
  { value: 'pediatria', label: 'Pediatria', icon: 'child_care', desc: '20 Questões • Difícil', iconBg: 'bg-amber-100', iconColor: 'text-amber-600' },
  { value: 'saude_coletiva', label: 'Saúde Coletiva', icon: 'groups', desc: '20 Questões • Médio', iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
];

const Enamed = () => {
  const { user, loading: authLoading } = useAuth();
  const { hasAccess, loading: subLoading } = useSubscription();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { toast } = useToast();
  const resultRef = useRef<HTMLDivElement>(null);

  const { questions, loading: bankLoading, fetchQuestions, saveAttempt } = useEnamedBank();
  const { resultado, generating, hasStartedReceiving, isComplete, generate, reset } = useEnamedGenerator();

  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<EnamedMode>(searchParams.get('area') === 'true' ? 'ia_area' : 'menu');
  const [selectedArea, setSelectedArea] = useState<EnamedArea | null>(null);
  const [source, setSource] = useState<EnamedSource>('banco');
  // Filtro do banco: ENAMED INEP, Revalida ou ambos. A banca eh a mesma
  // (INEP/MEC) — Revalida usa o mesmo padrao tecnico.
  const [bankSource, setBankSource] = useState<'all' | 'enamed' | 'revalida'>('all');

  // Sync mode with URL params when navigating between ENAMED and Simulado por Área
  useEffect(() => {
    const isArea = searchParams.get('area') === 'true';
    if (isArea && mode === 'menu') setMode('ia_area');
    if (!isArea && mode === 'ia_area' && !generating) setMode('menu');
  }, [searchParams]);
  const [userStats, setUserStats] = useState({ avg: 0, trend: 0, simCount: 0, topArea: '' });
  const [bankStats, setBankStats] = useState({ total: 0, enamed: 0, revalida: 0 });
  const [recentAttempts, setRecentAttempts] = useState<Array<{ percentage: number; correct: number; total: number; created_at: string; modo: string }>>([]);

  // Conta questoes disponiveis por fonte (banco oficial INEP + Revalida)
  useEffect(() => {
    (async () => {
      const { count: total } = await supabase.from('enamed_questions').select('*', { count: 'exact', head: true }).eq('anulada', false);
      const { count: revalida } = await supabase.from('enamed_questions').select('*', { count: 'exact', head: true }).eq('anulada', false).eq('source', 'revalida');
      setBankStats({
        total: total ?? 0,
        revalida: revalida ?? 0,
        enamed: (total ?? 0) - (revalida ?? 0),
      });
    })();
  }, []);

  // Ultimos simulados realizados
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('enamed_attempts')
        .select('percentage, correct_answers, total_questions, created_at, modo')
        .order('created_at', { ascending: false })
        .limit(3);
      setRecentAttempts((data ?? []).map(a => ({
        percentage: Number(a.percentage),
        correct: a.correct_answers,
        total: a.total_questions,
        created_at: a.created_at,
        modo: a.modo,
      })));
    })();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('enamed_attempts').select('percentage, correct_answers, total_questions, created_at, modo').order('created_at', { ascending: true });
      if (!data || data.length === 0) return;
      const total = data.reduce((s, a) => s + (a.total_questions || 0), 0);
      const correct = data.reduce((s, a) => s + (a.correct_answers || 0), 0);
      const avg = total > 0 ? Math.round((correct / total) * 100) : 0;
      const recent = data.slice(-5);
      const previous = data.slice(-10, -5);
      const recentAvg = recent.length > 0 ? recent.reduce((s, a) => s + (a.percentage || 0), 0) / recent.length : 0;
      const prevAvg = previous.length > 0 ? previous.reduce((s, a) => s + (a.percentage || 0), 0) / previous.length : 0;
      setUserStats({ avg, trend: Math.round(recentAvg - prevAvg), simCount: data.length, topArea: '' });
    })();
  }, [user]);

  const bankQuestionsContext = useMemo(() => {
    if (!questions || questions.length === 0) return '';
    return questions.map((q, i) => {
      return `## Questão ${i + 1} (${AREA_LABELS[q.area] || q.area} — ENAMED ${q.ano})\n\n${q.enunciado}\n\n**A)** ${q.alternativa_a}\n**B)** ${q.alternativa_b}\n**C)** ${q.alternativa_c}\n**D)** ${q.alternativa_d}\n\n**Gabarito:** ${q.gabarito}${q.explicacao ? `\n**Explicação:** ${q.explicacao}` : ''}`;
    }).join('\n\n---\n\n');
  }, [questions]);

  const enamedChatSuggestions = useMemo(() => [
    'Por que a alternativa correta está certa?',
    'Quais são os diagnósticos diferenciais?',
    'Explique a fisiopatologia envolvida',
    'Que pegadinhas comuns caem sobre esse tema?',
  ], []);

  if (authLoading || subLoading || adminLoading) return <PageSkeleton variant="exam" />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!hasAccess && !isAdmin) return <Navigate to="/pricing" replace />;

  const startBankMode = async (m: 'completo' | 'revisao', area?: EnamedArea) => {
    setSource('banco');
    setMode(m);
    setSelectedArea(area || null);

    const opts: { area?: EnamedArea; limit?: number; shuffle?: boolean; source?: 'all' | 'enamed' | 'revalida' } = {
      source: bankSource,
    };
    if (m === 'revisao') { opts.shuffle = true; opts.limit = 20; }
    await fetchQuestions(opts);
  };

  const startIaMode = async (m: 'ia_completo' | 'ia_area', area?: EnamedArea) => {
    setSource('ia');
    setMode(m);
    setSelectedArea(area || null);
    reset();
    await generate({
      quantidade: m === 'ia_completo' ? 50 : 20,
      area: area || undefined,
    });
  };

  const handleFinishBank = (score: { correct: number; total: number; percentage: number; answers: Record<string, string> }) => {
    saveAttempt({
      modo: mode === 'completo' ? 'completo' : 'revisao',
      area_filter: selectedArea || undefined,
      total_questions: score.total,
      correct_answers: score.correct,
      percentage: score.percentage,
      answers: score.answers,
      source: 'banco',
    });
    toast({ title: 'Resultado salvo!', description: `${score.percentage}% de acerto — ${score.correct}/${score.total}` });
  };

  const handleBackToMenu = () => {
    setMode('menu');
    setSelectedArea(null);
    reset();
  };

  const isSimulationMode = source === 'banco' && (mode === 'completo' || mode === 'revisao');
  const isIaMode = mode === 'ia_completo' || mode === 'ia_area';

  return (
    <DashboardLayout mainClassName="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="w-full">

        {/* ═══════════════════════ MENU (2-col layout) ═══════════════════════ */}
        {mode === 'menu' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 lg:gap-6">

            {/* ─── COLUNA PRINCIPAL ─── */}
            <div className="xl:col-span-8">
              <div className="relative bg-white rounded-3xl border border-slate-200 shadow-[0_1px_2px_rgba(25,28,29,0.04)] overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-[#003D32] via-[#005344] via-[#006D5B] to-[#C9A84C]" />

                <div className="px-5 sm:px-8 md:px-10 py-7 sm:py-9 space-y-9">
                  {/* Header editorial */}
                  <header>
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-[#005344] inline-flex items-center gap-2.5 mb-3">
                      <span className="w-6 h-px bg-[#C9A84C]" />
                      Central de Provas · Médico
                    </p>
                    <h1 className="font-['Manrope'] font-bold text-[28px] sm:text-[34px] tracking-[-0.025em] leading-[1.05] text-[#191C1D]">
                      Prepare-se para{' '}
                      <em className="not-italic font-medium text-[#8a6f26]">
                        ENAMED + Revalida
                      </em>
                      .
                    </h1>
                    <p className="text-sm text-[#4a5568] mt-3 max-w-[52ch] leading-relaxed">
                      Banco oficial INEP/MEC — {bankStats.total} questões reais com gabarito comentado, simulado cronometrado e questões inéditas geradas por PreceptorMED.
                    </p>
                  </header>

                  {/* ── DESTAQUE: ENAMED + Revalida = mesma banca ── */}
                  <div className="relative overflow-hidden rounded-2xl border-2 border-[#C9A84C]/30 bg-gradient-to-br from-[#C9A84C]/12 via-[#C9A84C]/06 to-transparent">
                    <div className="absolute right-0 top-0 h-full pointer-events-none opacity-[0.08]">
                      <svg width="180" height="100%" viewBox="0 0 180 200" preserveAspectRatio="xMaxYMid slice">
                        <defs>
                          <pattern id="bk-dots" width="14" height="14" patternUnits="userSpaceOnUse">
                            <circle cx="7" cy="7" r="0.7" fill="#8a6f26" />
                          </pattern>
                        </defs>
                        <rect width="180" height="200" fill="url(#bk-dots)" />
                        <circle cx="130" cy="100" r="50" fill="none" stroke="#8a6f26" strokeWidth="1" />
                        <circle cx="130" cy="100" r="32" fill="none" stroke="#8a6f26" strokeWidth="0.6" strokeDasharray="3 3" />
                      </svg>
                    </div>
                    <div className="relative p-5 sm:p-6">
                      <p className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-[#8a6f26] inline-flex items-center gap-2 mb-2">
                        <span className="w-5 h-px bg-[#8a6f26]" />
                        Por que estudar ambos juntos
                      </p>
                      <h3 className="font-['Manrope'] font-bold text-[16px] sm:text-[18px] text-[#191C1D] tracking-[-0.01em] leading-tight mb-2">
                        ENAMED e Revalida: <em className="not-italic font-medium text-[#8a6f26]">mesma banca, mesmo padrão técnico</em>.
                      </h3>
                      <p className="text-[12.5px] leading-relaxed text-[#3E4945] max-w-[58ch]">
                        Ambas são organizadas pelo <strong className="text-[#191C1D]">INEP/MEC</strong> e cobram o mesmo conjunto de competências clínicas — fisiopatologia, raciocínio diagnóstico, conduta baseada em diretrizes brasileiras. Usar os {bankStats.total} itens juntos multiplica seu treino sem perder qualidade.
                      </p>
                      <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-[#C9A84C]/20">
                        <div className="inline-flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-[#005344]" />
                          <span className="text-[12.5px] text-[#3E4945]">
                            <strong className="text-[#191C1D]">{bankStats.enamed}</strong> ENAMED
                          </span>
                        </div>
                        <span className="text-[#94a3b8]">+</span>
                        <div className="inline-flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-[#C9A84C]" />
                          <span className="text-[12.5px] text-[#3E4945]">
                            <strong className="text-[#191C1D]">{bankStats.revalida}</strong> Revalida
                          </span>
                        </div>
                        <span className="text-[#94a3b8]">=</span>
                        <div className="inline-flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-gradient-to-r from-[#005344] to-[#C9A84C]" />
                          <span className="text-[12.5px] text-[#3E4945]">
                            <strong className="text-[#191C1D]">{bankStats.total}</strong> questões INEP
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Banco oficial INEP ── */}
                <section>
                  <div className="mb-3">
                    <label className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#4a5568] inline-flex items-center gap-2 mb-3">
                      ② Banco oficial INEP
                      <span className="text-[9.5px] font-medium normal-case tracking-normal text-[#94a3b8]">
                        questões reais com gabarito comentado
                      </span>
                    </label>

                    {/* Toggle MAIOR + destacado */}
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      {([
                        { v: 'all',      label: 'Ambos',     count: bankStats.total,    chipColor: 'from-[#005344] to-[#C9A84C]' },
                        { v: 'enamed',   label: 'ENAMED',    count: bankStats.enamed,   chipColor: 'from-[#003D32] to-[#005344]' },
                        { v: 'revalida', label: 'Revalida',  count: bankStats.revalida, chipColor: 'from-[#8a6f26] to-[#C9A84C]' },
                      ] as const).map((opt) => (
                        <button
                          key={opt.v}
                          onClick={() => setBankSource(opt.v)}
                          className={`relative p-3 rounded-xl border-2 transition-all text-left ${
                            bankSource === opt.v
                              ? 'border-[#005344] bg-[#005344]/04 shadow-[0_2px_8px_-4px_rgba(0,83,68,0.25)]'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className={`h-1 w-8 rounded-full bg-gradient-to-r ${opt.chipColor} mb-2`} />
                          <p className={`text-[12px] font-['Manrope'] font-bold ${bankSource === opt.v ? 'text-[#005344]' : 'text-[#191C1D]'}`}>
                            {opt.label}
                          </p>
                          <p className="text-[10.5px] text-[#94a3b8] mt-0.5 font-mono tabular-nums">
                            {opt.count} questões
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* CTA contextual — aparece dinamicamente conforme bankSource muda */}
                  {(() => {
                    const cfg = bankSource === 'revalida'
                      ? {
                          eyebrow: 'Revalida selecionado',
                          title: 'Iniciar simulado Revalida',
                          desc: `${bankStats.revalida} questões oficiais das edições 2024.2 e 2025.1. Padrão real da prova, com gabarito e cronômetro.`,
                          ribbon: 'from-[#8a6f26] to-[#C9A84C]',
                          accent: '#8a6f26',
                        }
                      : bankSource === 'enamed'
                        ? {
                            eyebrow: 'ENAMED selecionado',
                            title: 'Iniciar simulado ENAMED',
                            desc: `${bankStats.enamed} questões oficiais do banco INEP. Padrão real da prova, com gabarito e cronômetro.`,
                            ribbon: 'from-[#003D32] to-[#005344]',
                            accent: '#005344',
                          }
                        : {
                            eyebrow: 'Banco completo selecionado',
                            title: 'Iniciar simulado com ambos os bancos',
                            desc: `${bankStats.total} questões combinadas ENAMED + Revalida. Maior cobertura possível.`,
                            ribbon: 'from-[#005344] to-[#C9A84C]',
                            accent: '#005344',
                          };
                    return (
                      <div
                        key={bankSource}
                        className="relative rounded-xl border-2 overflow-hidden mb-3 animate-fade-up"
                        style={{ borderColor: `${cfg.accent}30`, background: `linear-gradient(135deg, ${cfg.accent}06, ${cfg.accent}02)` }}
                      >
                        <div className={`h-1 bg-gradient-to-r ${cfg.ribbon}`} />
                        <div className="p-4 sm:p-5 flex items-center gap-4">
                          <div className="shrink-0 hidden sm:block">
                            <div className="h-12 w-12 rounded-xl flex items-center justify-center text-white shadow-[0_4px_12px_-4px_rgba(0,0,0,0.2)]"
                                 style={{ background: `linear-gradient(135deg, ${cfg.accent}, ${cfg.accent}dd)` }}>
                              <MI name="play_arrow" fill className="text-[22px]" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] inline-flex items-center gap-2 mb-1" style={{ color: cfg.accent }}>
                              <span className="w-4 h-px" style={{ background: cfg.accent }} />
                              {cfg.eyebrow}
                            </p>
                            <h4 className="font-['Manrope'] font-bold text-[14px] sm:text-[15px] text-[#191C1D] tracking-[-0.01em] leading-tight">
                              {cfg.title}
                            </h4>
                            <p className="text-[11.5px] text-[#4a5568] mt-1 leading-snug">
                              {cfg.desc}
                            </p>
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            <button
                              onClick={() => startBankMode('revisao')}
                              className="hidden sm:inline-flex h-10 px-3 rounded-lg text-[11.5px] font-bold border-2 transition-all"
                              style={{
                                borderColor: `${cfg.accent}40`,
                                color: cfg.accent,
                                background: 'white',
                              }}
                            >
                              Só 20
                            </button>
                            <button
                              onClick={() => startBankMode('completo')}
                              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg font-['Manrope'] text-[12px] font-bold text-white transition-all group relative overflow-hidden"
                              style={{
                                background: `linear-gradient(135deg, ${cfg.accent}, ${cfg.accent}cc)`,
                                boxShadow: `0 4px 14px -4px ${cfg.accent}80`,
                              }}
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                              <span className="relative">Iniciar agora</span>
                              <MI name="arrow_forward" className="text-[16px] relative group-hover:translate-x-0.5 transition-transform" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => startBankMode('completo')}
                      className="text-left p-5 rounded-xl border-2 border-slate-200 bg-white hover:border-[#005344] hover:bg-[#005344]/[0.02] transition-all group"
                    >
                      <div className="flex items-start gap-3 mb-2">
                        <div className="w-9 h-9 rounded-lg bg-[#005344] text-white flex items-center justify-center shrink-0">
                          <MI name="inventory" fill className="text-[18px]" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-['Manrope'] font-bold text-[14px] text-[#191C1D]">Simulado completo</h4>
                          <p className="text-[11px] text-[#94a3b8] mt-0.5">5 grandes áreas · padrão prova</p>
                        </div>
                      </div>
                      <p className="text-[12px] leading-relaxed text-[#4a5568] mb-3">
                        Prova estruturada cronometrada, igual à experiência real do ENAMED.
                      </p>
                      <span className="text-[11px] font-bold text-[#005344] inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                        Iniciar agora <MI name="arrow_forward" className="text-[14px]" />
                      </span>
                    </button>

                    <button
                      onClick={() => startBankMode('revisao')}
                      className="text-left p-5 rounded-xl border-2 border-slate-200 bg-white hover:border-[#005344] hover:bg-[#005344]/[0.02] transition-all group"
                    >
                      <div className="flex items-start gap-3 mb-2">
                        <div className="w-9 h-9 rounded-lg bg-[#C9A84C] text-white flex items-center justify-center shrink-0">
                          <MI name="flash_on" fill className="text-[18px]" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-['Manrope'] font-bold text-[14px] text-[#191C1D]">Revisão rápida</h4>
                          <p className="text-[11px] text-[#94a3b8] mt-0.5">20 questões · ~15 min</p>
                        </div>
                      </div>
                      <p className="text-[12px] leading-relaxed text-[#4a5568] mb-3">
                        Bateria curta de alta intensidade. Ideal para manter o ritmo entre plantões.
                      </p>
                      <span className="text-[11px] font-bold text-[#8a6f26] inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                        Praticar <MI name="arrow_forward" className="text-[14px]" />
                      </span>
                    </button>
                  </div>
                </section>

                {/* ── Questões inéditas PreceptorMED ── */}
                <section>
                  <div className="flex items-baseline justify-between mb-3">
                    <label className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#4a5568] inline-flex items-center gap-2">
                      ③ Questões inéditas PreceptorMED
                      <span className="text-[9.5px] font-medium normal-case tracking-normal text-[#94a3b8]">
                        geradas por Claude
                      </span>
                    </label>
                  </div>
                  <button
                    onClick={() => startIaMode('ia_completo')}
                    className="w-full text-left p-5 rounded-xl border-2 border-[#005344] bg-gradient-to-br from-[#003D32] via-[#005344] to-[#006D5B] text-white relative overflow-hidden group hover:shadow-[0_8px_24px_-8px_rgba(0,109,91,0.45)] transition-all"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#C9A84C]/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
                    <div className="relative flex items-center gap-4">
                      <div className="w-11 h-11 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0">
                        <MI name="auto_awesome" fill className="text-[22px] text-[#C9A84C]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-['Manrope'] font-bold text-[15px]">Simulado PreceptorMED · 50 questões</h4>
                        <p className="text-[12px] text-white/70 mt-0.5">
                          Inéditas, padrão ENAMED/Revalida — diversidade real de cenários.
                        </p>
                      </div>
                      <MI name="arrow_forward" className="text-[20px] opacity-70 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>
                </section>

                {/* ── Por área ── */}
                <section>
                  <div className="flex items-baseline justify-between mb-3">
                    <label className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#4a5568] inline-flex items-center gap-2">
                      ④ Estudo por área
                      <span className="text-[9.5px] font-medium normal-case tracking-normal text-[#94a3b8]">
                        20 questões PreceptorMED na especialidade
                      </span>
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {AREA_OPTIONS.map(({ value, label, icon, iconBg, iconColor }) => (
                      <button
                        key={value}
                        onClick={() => startIaMode('ia_area', value)}
                        className="text-left p-3.5 rounded-xl border-2 border-slate-200 bg-white hover:border-[#005344] hover:bg-[#005344]/[0.02] transition-all flex items-center gap-3 group"
                      >
                        <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
                          <MI name={icon} fill className={`text-[18px] ${iconColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-['Manrope'] font-bold text-[13px] text-[#191C1D] truncate">{label}</p>
                          <p className="text-[10px] text-[#94a3b8] uppercase tracking-wider">20 q · PreceptorMED</p>
                        </div>
                        <MI name="chevron_right" className="text-[18px] text-[#94a3b8] group-hover:text-[#005344] group-hover:translate-x-0.5 transition-all" />
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            </div>
            </div>{/* fim coluna principal */}

            {/* ─── SIDEBAR ─── */}
            <aside className="xl:col-span-4 space-y-5">
              {/* Card desempenho */}
              <div className="relative bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-[#003D32] via-[#005344] to-[#C9A84C]" />
                <div className="px-5 py-5">
                  <div className="flex items-baseline justify-between mb-3">
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[#005344] inline-flex items-center gap-2">
                      <span className="w-5 h-px bg-[#C9A84C]" />
                      Seu desempenho
                    </p>
                    {userStats.simCount > 0 && (
                      <span className={`text-[10.5px] font-bold ${userStats.trend >= 0 ? 'text-[#005344]' : 'text-red-500'}`}>
                        {userStats.trend >= 0 ? '↑' : '↓'} {Math.abs(userStats.trend)}%
                      </span>
                    )}
                  </div>
                  {userStats.simCount > 0 ? (
                    <>
                      <p className="font-['Manrope'] text-[42px] font-black text-[#005344] tabular-nums leading-none">
                        {userStats.avg}<span className="text-[20px] text-[#94a3b8]">%</span>
                      </p>
                      <p className="text-[11px] text-[#94a3b8] mt-1.5">acerto médio · {userStats.simCount} simulado{userStats.simCount === 1 ? '' : 's'}</p>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-3">
                        <div className="h-full bg-gradient-to-r from-[#005344] to-[#C9A84C] rounded-full transition-all duration-700" style={{ width: `${userStats.avg}%` }} />
                      </div>
                    </>
                  ) : (
                    <p className="text-[12.5px] text-[#4a5568] leading-relaxed">
                      Faça seu primeiro simulado pra desbloquear estatísticas, evolução por área e recomendações.
                    </p>
                  )}
                </div>
              </div>

              {/* Card histórico recente */}
              <div className="relative bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-5">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[#005344] inline-flex items-center gap-2 mb-3">
                    <span className="w-5 h-px bg-[#C9A84C]" />
                    Últimos simulados
                  </p>
                  {recentAttempts.length === 0 ? (
                    <p className="text-[12px] text-[#94a3b8] leading-relaxed">
                      Nenhum simulado realizado ainda.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {recentAttempts.map((a, i) => {
                        const dt = new Date(a.created_at);
                        const dataFmt = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
                        const modoLabel = a.modo === 'completo' ? 'Completo' : a.modo === 'revisao' ? 'Revisão' : a.modo;
                        return (
                          <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50/60 transition-colors">
                            <div className="shrink-0 h-9 w-9 rounded-lg bg-gradient-to-br from-[#005344] to-[#006D5B] text-white flex items-center justify-center font-['Manrope'] font-bold text-[11px] tabular-nums">
                              {Math.round(a.percentage)}%
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12.5px] font-['Manrope'] font-bold text-[#191C1D] leading-tight">
                                {modoLabel}
                              </p>
                              <p className="text-[10.5px] text-[#94a3b8] mt-0.5">
                                {a.correct}/{a.total} · {dataFmt}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Card guia: como funciona */}
              <div className="relative rounded-2xl overflow-hidden border-2 border-[#005344]/15"
                   style={{ background: 'linear-gradient(135deg, rgba(0,109,91,0.04), rgba(201,168,76,0.04))' }}>
                <div className="px-5 py-5">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[#005344] inline-flex items-center gap-2 mb-3">
                    <span className="w-5 h-px bg-[#C9A84C]" />
                    Como estudar
                  </p>
                  <ol className="space-y-2.5 text-[12px] leading-relaxed text-[#3E4945]">
                    <li className="flex gap-2.5">
                      <span className="shrink-0 h-5 w-5 rounded-full bg-[#005344] text-white text-[10px] font-bold flex items-center justify-center">1</span>
                      <span><strong className="text-[#191C1D]">Revisão rápida</strong> de 20 questões pra aquecer e identificar gaps.</span>
                    </li>
                    <li className="flex gap-2.5">
                      <span className="shrink-0 h-5 w-5 rounded-full bg-[#005344] text-white text-[10px] font-bold flex items-center justify-center">2</span>
                      <span><strong className="text-[#191C1D]">Simulado completo</strong> 1x por semana, cronometrado, sem interrupção.</span>
                    </li>
                    <li className="flex gap-2.5">
                      <span className="shrink-0 h-5 w-5 rounded-full bg-[#005344] text-white text-[10px] font-bold flex items-center justify-center">3</span>
                      <span><strong className="text-[#191C1D]">Estudo por área</strong> nos temas com menor acerto pra fechar lacunas.</span>
                    </li>
                    <li className="flex gap-2.5">
                      <span className="shrink-0 h-5 w-5 rounded-full bg-[#C9A84C] text-white text-[10px] font-bold flex items-center justify-center">4</span>
                      <span><strong className="text-[#191C1D]">Inéditas PreceptorMED</strong> nos dias em que terminar o banco — o Claude gera novos cenários no padrão INEP.</span>
                    </li>
                  </ol>
                </div>
              </div>

              {/* Card info banca compacto */}
              <div className="relative bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#94a3b8] mb-2">
                    Banca avaliadora
                  </p>
                  <p className="text-[12.5px] text-[#3E4945] leading-relaxed">
                    <strong className="text-[#191C1D]">INEP / MEC</strong> elabora <strong className="text-[#005344]">ENAMED</strong> e <strong className="text-[#8a6f26]">Revalida</strong>. As provas seguem o mesmo padrão técnico — fontes oficiais brasileiras (SUS, SBC, SBP, FEBRASGO), competências da DCN Medicina.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* ═══════════════════════ AREA SELECTION ═══════════════════════ */}
        {mode === 'ia_area' && !generating && !resultado && (
          <div className="max-w-5xl mx-auto">
            <div className="relative bg-white rounded-3xl border border-slate-200 shadow-[0_1px_2px_rgba(25,28,29,0.04)] overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-[#003D32] via-[#005344] via-[#006D5B] to-[#C9A84C]" />

              <div className="px-5 sm:px-8 md:px-12 py-7 sm:py-9 md:py-12 space-y-9">
                <div className="flex items-center gap-3 -mb-4">
                  <button onClick={handleBackToMenu} className="flex items-center gap-1.5 text-[11px] font-semibold text-[#94a3b8] hover:text-[#005344] transition-colors active:scale-95">
                    <ArrowLeft className="h-3.5 w-3.5" /> ENAMED
                  </button>
                </div>

                <header>
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-[#005344] inline-flex items-center gap-2.5 mb-3">
                    <span className="w-6 h-px bg-[#C9A84C]" />
                    Simulado por área
                  </p>
                  <h1 className="font-['Manrope'] font-bold text-[28px] sm:text-[34px] tracking-[-0.025em] leading-[1.05] text-[#191C1D]">
                    Foque numa{' '}
                    <em className="not-italic font-medium text-[#8a6f26]">
                      especialidade
                    </em>
                    <br />de cada vez.
                  </h1>
                  <p className="text-sm text-[#4a5568] mt-3 max-w-[52ch] leading-relaxed">
                    20 questões inéditas geradas por PreceptorMED, calibradas para o padrão ENAMED da
                    área escolhida.
                  </p>
                </header>

                <section>
                  <div className="flex items-baseline justify-between mb-3">
                    <label className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#4a5568]">
                      ① Especialidade
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {AREA_OPTIONS.map(({ value, label, icon, desc, iconBg, iconColor }) => (
                      <button
                        key={value}
                        onClick={() => startIaMode('ia_area', value)}
                        className="text-left p-4 rounded-xl border-2 border-slate-200 bg-white hover:border-[#005344] hover:bg-[#005344]/[0.02] transition-all flex items-center gap-3 group"
                      >
                        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
                          <MI name={icon} fill className={`text-[20px] ${iconColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-['Manrope'] font-bold text-[14px] text-[#191C1D]">{label}</p>
                          <p className="text-[10.5px] text-[#94a3b8] uppercase tracking-wider mt-0.5">{desc}</p>
                        </div>
                        <MI name="arrow_forward" className="text-[18px] text-[#94a3b8] group-hover:text-[#005344] group-hover:translate-x-0.5 transition-all" />
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════ BANK SIMULATION ═══════════════════════ */}
        {isSimulationMode && (
          <>
            <div className="flex items-center gap-3 mb-4 animate-fade-up">
              <button onClick={handleBackToMenu} className="flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-[#006D5B] transition-colors active:scale-95">
                <ArrowLeft className="h-4 w-4" /> ENAMED
              </button>
              <div className="h-4 w-px bg-slate-200" />
              <span className="text-sm font-semibold text-[#191c1d]">
                {mode === 'completo' ? 'Simulado Completo' : 'Revisão Rápida'}
              </span>
            </div>
            <div className="flex flex-col lg:flex-row gap-4 min-h-[50vh] lg:h-[calc(100vh-10rem)]">
              <div className="flex-1 min-w-0 rounded-xl bg-white border border-slate-200/60 p-4 sm:p-8 flex flex-col overflow-hidden">
                <EnamedBankSimulation
                  questions={questions}
                  onFinish={handleFinishBank}
                  onExit={handleBackToMenu}
                  loading={bankLoading}
                />
              </div>
              {bankQuestionsContext && (
                <ContextChat
                  context={bankQuestionsContext}
                  contextLabel="simulado ENAMED"
                  suggestions={enamedChatSuggestions}
                />
              )}
            </div>
          </>
        )}

        {/* ═══════════════════════ PreceptorMED GENERATION MODE ═══════════════════════ */}
        {isIaMode && (generating || resultado || isComplete) && (
          <>
            <div className="flex items-center gap-3 mb-4 animate-fade-up">
              <button onClick={handleBackToMenu} className="flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-[#006D5B] transition-colors active:scale-95">
                <ArrowLeft className="h-4 w-4" /> ENAMED
              </button>
              <div className="h-4 w-px bg-slate-200" />
              <span className="text-sm font-semibold text-[#191c1d]">
                ENAMED PreceptorMED {selectedArea ? `— ${AREA_LABELS[selectedArea]}` : '— Simulado'}
              </span>
            </div>
            <div className="flex flex-col lg:flex-row gap-4 min-h-[50vh] lg:h-[calc(100vh-10rem)]">
              <div className="flex-1 min-w-0 rounded-xl bg-white border border-slate-200/60 p-4 sm:p-8 flex flex-col overflow-hidden">
                <SimulationView
                  resultado={resultado}
                  onExit={handleBackToMenu}
                  isGenerating={generating}
                  isComplete={isComplete}
                />
              </div>

              {resultado && (
                <ContextChat
                  context={resultado}
                  contextLabel="simulado ENAMED PreceptorMED"
                  suggestions={enamedChatSuggestions}
                />
              )}
            </div>
          </>
        )}

      </div>
    </DashboardLayout>
  );
};

export default Enamed;
