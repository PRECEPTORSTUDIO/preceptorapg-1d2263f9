import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useVisitorTracking } from '@/hooks/useVisitorTracking';
import { useLandingFunnel } from '@/hooks/useLandingFunnel';
import { Menu, X as XIcon, ChevronDown } from 'lucide-react';
import { getEasyflowLink } from '@/utils/easyflow';
import ProfileDropdown from '@/components/ProfileDropdown';
import PixPaymentModal from '@/components/PixPaymentModal';
import logoIcon from '@/assets/logo-icon.png';
import { Loader2 } from 'lucide-react';
import Reveal from '@/components/landing/Reveal';
import ScrollProgress from '@/components/landing/ScrollProgress';
import Parallax from '@/components/landing/Parallax';
import DemoFechamento from '@/components/landing/DemoFechamento';
import SectionCTA from '@/components/landing/SectionCTA';
import MobileStickyCTA from '@/components/landing/MobileStickyCTA';
import PlatformShowcase from '@/components/landing/PlatformShowcase';
import { useInView } from '@/hooks/useInView';

const MI = ({ name, fill = false, className = '' }: { name: string; fill?: boolean; className?: string }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{ fontVariationSettings: fill ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : undefined }}
  >
    {name}
  </span>
);

const Landing = () => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const { toast } = useToast();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [pixModal, setPixModal] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  // CRM: Track visitor + capture UTM params
  useVisitorTracking();

  // Funnel analytics: onde o visitante para, onde converte
  const { trackConversion } = useLandingFunnel();

  // Hero em viewport — controla o CTA fixo mobile, o scroll-cue e a condensação
  // do header. Trata como "no hero" até a 1ª detecção real do observer (evita
  // flash do CTA fixo no load, quando o hero já está visível).
  const [heroRef, heroVisible] = useInView<HTMLElement>({ triggerOnce: false, threshold: 0, rootMargin: '0px' });
  const [heroSeen, setHeroSeen] = useState(false);
  useEffect(() => { if (heroVisible) setHeroSeen(true); }, [heroVisible]);
  const heroInView = !heroSeen || heroVisible;

  // Navegação suave entre seções (scroll-margin-top no CSS compensa o header).
  const scrollToId = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Redirect logged-in users to menu
  if (!loading && user) {
    navigate('/menu', { replace: true });
    return null;
  }

  const handleSubscribe = async (planType: 'monthly' | 'annual' | 'biannual') => {
    trackConversion(`subscribe-${planType}`);
    if (!user) {
      // Not logged in — send to signup first, then checkout opens after
      navigate(`/auth?tab=signup&plan=${planType}`);
      return;
    }
    const link = await getEasyflowLink(planType, user.email ?? undefined, user.id, 'landing');
    if (link) {
      window.open(link, '_blank');
    } else {
      toast({ title: 'Em breve', description: 'Plano bianual estará disponível em breve.' });
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col texture-grain" style={{ fontFamily: 'var(--font-body)' }}>

      {/* ─── Header ───────────────────────────────────── */}
      <header className={'sticky top-0 z-50 bg-white/95 backdrop-blur border-b transition-all duration-300 ' + (heroInView ? 'border-slate-200/60' : 'border-slate-200 shadow-[0_4px_20px_-6px_rgba(0,109,91,0.12)]')}>
        {/* Accent line — gold assinatura (mesma linguagem do sidebar + auth) */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-brand-gold/30 to-transparent" />

        <nav className={'flex justify-between items-center w-full px-4 sm:px-6 md:px-10 max-w-7xl mx-auto transition-all duration-300 ' + (heroInView ? 'py-3 sm:py-4' : 'py-2 sm:py-2.5')}>
          {/* Logo + eyebrow */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-3 group"
          >
            <img
              src={logoIcon}
              alt="PreceptorMED"
              className="h-8 w-8 sm:h-9 sm:w-9 transition-transform group-hover:scale-105"
            />
            <div className="flex flex-col leading-none">
              <span
                className="text-base sm:text-lg font-bold text-brand-ink tracking-tight"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                PreceptorMED
              </span>
              <span className="hidden sm:inline-block text-[9px] font-semibold text-brand-gold/80 uppercase tracking-[0.16em] mt-1">
                Curadoria acadêmica
              </span>
            </div>
          </button>

          {/* Nav links — compact, gap separators */}
          <div className="hidden md:flex items-center divide-x divide-slate-200/60">
            {[
              { href: '#como-funciona', label: 'Como funciona' },
              { href: '#recursos',      label: 'Recursos' },
              { href: '#depoimentos',   label: 'Depoimentos' },
              { href: '#precos',        label: 'Planos' },
            ].map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={(e) => { e.preventDefault(); scrollToId(l.href.slice(1)); }}
                className="px-5 text-[13px] font-medium text-brand-ink-2 hover:text-brand-primary-dark transition-colors"
              >
                {l.label}
              </a>
            ))}
          </div>

          {/* Right cluster */}
          {!loading && user ? (
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => navigate('/menu')}
                className="px-3 sm:px-4 py-2 text-sm font-semibold text-brand-ink-2 hover:text-brand-primary-dark transition-colors"
              >
                Meu painel
              </button>
              <ProfileDropdown userEmail={user.email || ''} onLogout={signOut} />
            </div>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                data-cta="header-login"
                onClick={() => navigate('/auth')}
                className="hidden sm:block px-3 py-2 text-[13px] font-semibold text-brand-ink-2 hover:text-brand-primary-dark transition-colors"
              >
                Entrar
              </button>
              <button
                data-cta="header-signup"
                onClick={() => { trackConversion('header-signup'); navigate('/auth?tab=signup'); }}
                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 bg-brand-primary-dark text-white text-[13px] font-semibold rounded-md hover:bg-brand-primary-darker transition-all shadow-[0_4px_12px_-2px_rgba(0,109,91,0.35)] hover:shadow-[0_6px_16px_-2px_rgba(0,109,91,0.45)]"
              >
                Testar grátis
                <span className="text-brand-gold">→</span>
              </button>
              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileMenu(!mobileMenu)}
                className="md:hidden p-2 text-brand-ink-2 hover:text-brand-primary-dark transition-colors -mr-2"
                aria-label={mobileMenu ? 'Fechar menu' : 'Abrir menu'}
                aria-expanded={mobileMenu}
                aria-controls="mobile-nav"
              >
                <span className="relative block w-5 h-5">
                  <Menu className={'absolute inset-0 w-5 h-5 transition-all duration-200 ' + (mobileMenu ? 'opacity-0 rotate-90 scale-75' : 'opacity-100 rotate-0')} />
                  <XIcon className={'absolute inset-0 w-5 h-5 transition-all duration-200 ' + (mobileMenu ? 'opacity-100 rotate-0' : 'opacity-0 -rotate-90 scale-75')} />
                </span>
              </button>
            </div>
          )}
        </nav>

        {/* Mobile menu dropdown */}
        {mobileMenu && !user && (
          <div id="mobile-nav" className="md:hidden border-t border-slate-200/60 bg-white px-4 py-4 space-y-1 animate-fade-in">
            {[
              { href: '#como-funciona', label: 'Como funciona' },
              { href: '#recursos',      label: 'Recursos' },
              { href: '#depoimentos',   label: 'Depoimentos' },
              { href: '#precos',        label: 'Planos' },
            ].map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={(e) => { e.preventDefault(); setMobileMenu(false); scrollToId(l.href.slice(1)); }}
                className="block py-2.5 text-sm font-medium text-brand-ink-2 hover:text-brand-primary-dark"
              >
                {l.label}
              </a>
            ))}
            <div className="pt-3 mt-2 border-t border-slate-200/60 flex gap-2">
              <button
                data-cta="mobile-menu-login"
                onClick={() => navigate('/auth')}
                className="flex-1 py-2.5 text-sm font-semibold text-brand-primary-dark hover:bg-brand-primary/5 rounded-md transition-colors"
              >
                Entrar
              </button>
              <button
                data-cta="mobile-menu-signup"
                onClick={() => { trackConversion('mobile-menu-signup'); navigate('/auth?tab=signup'); }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-white bg-brand-primary-dark hover:bg-brand-primary-darker rounded-md transition-colors"
              >
                Testar grátis
                <span className="text-brand-gold">→</span>
              </button>
            </div>
          </div>
        )}
      </header>

      <ScrollProgress />

      <main className="flex-1">

        {/* ─── Hero ─────────────────────────────────────── */}
        <section ref={heroRef} data-section="hero" className="relative flex items-center min-h-[calc(100vh-65px)] py-10 sm:py-14 px-4 sm:px-6 lg:px-10 overflow-hidden">
          {/* Dot grid decorativo no canto superior direito */}
          <div className="absolute -top-10 right-0 w-[28rem] h-[28rem] pointer-events-none texture-dots-subtle" style={{ maskImage: 'radial-gradient(ellipse at top right, black 20%, transparent 75%)', WebkitMaskImage: 'radial-gradient(ellipse at top right, black 20%, transparent 75%)' }} />
          {/* Glow gold no canto inferior esquerdo */}
          <div className="absolute -bottom-32 -left-32 w-[32rem] h-[32rem] rounded-full bg-brand-gold/[0.08] blur-3xl pointer-events-none" />
          {/* Glow primary no topo direito */}
          <div className="absolute -top-20 -right-20 w-[28rem] h-[28rem] rounded-full bg-brand-primary/[0.05] blur-3xl pointer-events-none" />
          {/* Gold divider no final da seção (separa de 'Recursos' verde) */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-gold/50 to-transparent" />

          <div className="relative max-w-[1400px] mx-auto w-full flex flex-col lg:flex-row items-center gap-10 lg:gap-14 xl:gap-20">
            <div className="lg:w-1/2 animate-fade-up">
              <p className="mb-5 sm:mb-7">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand-gold/10 text-brand-primary-dark rounded-full text-[11px] sm:text-xs font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
                  +1.200 estudantes de medicina
                </span>
              </p>
              <h1
                className="text-[2rem] sm:text-5xl md:text-6xl lg:text-[3.75rem] xl:text-[4.25rem] font-bold leading-[1.07] mb-4 sm:mb-6 tracking-[-0.02em] text-brand-ink"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                Domine PBL, ENAMED e Revalida em <span className="text-brand-primary">1/3 do tempo</span>.
              </h1>
              <p className="text-[15px] sm:text-lg lg:text-xl text-slate-600 leading-[1.55] mb-6 sm:mb-8 max-w-xl">
                Fechamentos completos em <strong className="font-semibold text-brand-ink">20 segundos</strong>, simulados no padrão INEP e respostas com <strong className="font-semibold text-brand-ink">PubMed citado</strong>. A IA médica que <span className="text-brand-primary font-semibold">não inventa referência</span>.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  data-cta="hero-signup"
                  onClick={() => { trackConversion('hero-signup'); navigate('/auth?tab=signup'); }}
                  className="group inline-flex items-center justify-center gap-2 px-7 lg:px-9 py-4 lg:py-[18px] bg-brand-primary-dark text-white text-[15px] lg:text-base font-bold rounded-xl hover:bg-brand-primary-darker active:scale-[0.98] transition-all shadow-[0_10px_30px_-8px_rgba(0,109,91,0.5),0_2px_4px_-1px_rgba(0,109,91,0.20)]"
                >
                  Começar 3 dias grátis
                  <span className="text-brand-gold group-hover:translate-x-0.5 transition-transform">→</span>
                </button>
                <button
                  data-cta="hero-how"
                  onClick={() => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' })}
                  className="px-6 py-4 text-brand-ink text-[15px] font-semibold hover:text-brand-primary-dark transition-colors text-center"
                >
                  Ver como funciona
                </button>
              </div>

              {/* Microcopy — risk reversal enxuto */}
              <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-slate-500">
                <span className="inline-flex items-center gap-1.5"><span className="text-brand-primary">✓</span> Grátis, sem cartão</span>
                <span className="inline-flex items-center gap-1.5"><span className="text-brand-primary">✓</span> Cancele quando quiser</span>
              </p>
            </div>

            <Reveal as="div" direction="left" distance={32} delay={120} className="lg:w-1/2 relative w-full">
              <Parallax speed={typeof window !== 'undefined' && window.innerWidth >= 768 ? 0.06 : 0}>
                {/* Preview do produto — CSS puro (antes era um vídeo de 41MB que
                    matava o load no mobile). Mostra um fechamento real em 20s. */}
                <div className="relative z-10 rounded-xl overflow-hidden border border-slate-200 bg-white shadow-[0_24px_60px_-20px_rgba(0,109,91,0.35),0_8px_20px_-8px_rgba(0,109,91,0.20),0_1px_3px_0_rgba(25,28,29,0.08)]">
                  <div className="flex items-center gap-1.5 px-4 py-3 border-b border-slate-100 bg-slate-50/80">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
                    <span className="ml-3 text-[11px] font-semibold text-slate-500 truncate">Fechamento · Insuficiência Cardíaca</span>
                    <span className="ml-auto text-[10px] font-extrabold text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded-full shrink-0">20s</span>
                  </div>
                  <div className="relative px-5 sm:px-6 py-5 text-left max-h-[360px] sm:max-h-[430px] overflow-hidden">
                    <h4 className="flex items-center gap-2 text-[15px] font-bold text-brand-ink mb-1.5" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      <span className="material-symbols-outlined text-brand-primary text-[18px]">cardiology</span>
                      Fisiopatologia
                    </h4>
                    <p className="text-[12.5px] text-slate-600 leading-relaxed mb-3">
                      A queda do <strong className="font-semibold text-brand-ink">débito cardíaco</strong> ativa o <strong className="font-semibold text-brand-ink">SRAA</strong> e o tônus simpático, gerando:
                    </p>
                    <ul className="space-y-1.5 mb-5">
                      {[
                        'Retenção de Na⁺ e água → congestão pulmonar',
                        'Vasoconstrição → aumento da pós-carga',
                        'Remodelamento ventricular → piora progressiva',
                      ].map((t) => (
                        <li key={t} className="flex items-start gap-2 text-[12.5px] text-slate-600 leading-snug">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-primary mt-1.5 shrink-0" />
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                    <h4 className="flex items-center gap-2 text-[15px] font-bold text-brand-ink mb-1.5" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      <span className="material-symbols-outlined text-brand-primary text-[18px]">medication</span>
                      Tratamento de 1ª linha
                    </h4>
                    <p className="text-[12.5px] text-slate-600 leading-relaxed">
                      <strong className="font-semibold text-brand-ink">IECA/BRA + betabloqueador + antagonista da aldosterona</strong> reduzem mortalidade na ICFEr
                      <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] font-semibold text-brand-primary bg-brand-primary/[0.08] px-1.5 py-0.5 rounded align-middle"><span className="material-symbols-outlined text-[11px]">open_in_new</span>PubMed</span>.
                    </p>
                    {/* fade — sugere que há mais conteúdo no fechamento completo */}
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                  </div>
                </div>
              </Parallax>
              {/* Decoração sutil — blur verde atrás do video */}
              <div className="absolute -bottom-8 -right-8 w-64 h-64 rounded-full bg-brand-primary/10 blur-3xl pointer-events-none -z-0" />
              <div className="absolute -top-8 -left-8 w-48 h-48 rounded-full bg-brand-gold/10 blur-3xl pointer-events-none -z-0" />
            </Reveal>
          </div>

          {/* Scroll-cue — convida o mobile a rolar; some quando o hero sai da viewport */}
          <div
            className={'absolute bottom-3 left-1/2 -translate-x-1/2 md:hidden pointer-events-none transition-opacity duration-500 ' + (heroInView ? 'opacity-100' : 'opacity-0')}
            aria-hidden
          >
            <ChevronDown className="w-6 h-6 text-brand-gold motion-safe:animate-bounce" />
          </div>
        </section>

        {/* ─── Experimente sem cadastro — prova de valor instantânea ─── */}
        <DemoFechamento onSignup={() => { trackConversion('demo-signup'); navigate('/auth?tab=signup'); }} />

        {/* ─── Recursos — dark block verde ──────────────────── */}
        <section
          id="recursos"
          data-section="recursos"
          className="relative py-16 sm:py-28 overflow-hidden"
          style={{ background: 'var(--pmed-gradient-primary)' }}
        >
          {/* Decorações sutis — gold glow + noise */}
          <div className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-brand-gold/10 blur-[120px] pointer-events-none" />
          <div className="absolute -bottom-32 -left-16 w-[360px] h-[360px] rounded-full bg-brand-primary/30 blur-[100px] pointer-events-none" />
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
              backgroundSize: '28px 28px',
            }}
          />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
            <Reveal as="div" className="mb-12 sm:mb-16 max-w-2xl">
              <p className="text-[11px] font-semibold text-brand-gold uppercase tracking-[0.2em] mb-4">
                O que você recebe
              </p>
              <h2
                className="text-2xl sm:text-4xl font-bold leading-tight text-white"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                Ferramentas construídas para a<br className="hidden sm:block" />
                {' '}prática médica <span className="text-brand-gold/90">brasileira</span>.
              </h2>
              <div className="mt-5 h-px w-16 bg-gradient-to-r from-brand-gold to-transparent" />
            </Reveal>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-white/10 border border-white/10 rounded-lg overflow-hidden">
              {[
                {
                  icon: 'auto_awesome',
                  title: 'Fechamentos de PBL',
                  desc: 'Resumos com correlação clínico-básica obrigatória: fisiopatologia em cascata, mecanismos moleculares e anatomia aplicada ao caso.',
                  meta: 'Gerado em ~20 segundos',
                },
                {
                  icon: 'history_edu',
                  title: 'Simulados ENAMED · REVALIDA',
                  desc: 'Questões no padrão INEP com vinhetas clínicas extensas, laboratórios numéricos e distratores plausíveis. 5 áreas cobertas.',
                  meta: 'Padrão INEP 2011–2025',
                },
                {
                  icon: 'forum',
                  title: 'Chat com PubMed integrado',
                  desc: 'PreceptorMED busca artigos na PubMed, resume em português e cita fontes inline. Não é busca cega. É síntese com evidência.',
                  meta: 'Claude + E-utilities',
                },
                {
                  icon: 'style',
                  title: 'Flashcards com SM-2',
                  desc: 'Repetição espaçada real (SuperMemo 2). Intervalos ajustam pela sua performance, sem fake streaks.',
                  meta: 'Algoritmo real, não gamificado',
                },
                {
                  icon: 'science',
                  title: 'Mentor Científico',
                  desc: 'Revisão de TCC e artigos com validação ABNT e coerência metodológica. Cada seção avaliada independentemente.',
                  meta: 'Estruturado em 7 seções',
                },
                {
                  icon: 'library_books',
                  title: 'Biblioteca pessoal',
                  desc: 'Todos os resumos, questões e flashcards ficam salvos e pesquisáveis. Exporte em PDF com formatação preservada.',
                  meta: 'Exportação PDF nativa',
                },
              ].map((feature, i) => (
                <Reveal
                  key={i}
                  delay={i * 80}
                  direction="up"
                  distance={20}
                  as="div"
                  className="relative bg-brand-primary-darker/80 hover:bg-brand-primary-dark/80 transition-colors p-6 sm:p-8 group shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
                >
                  {/* Numbering sutil */}
                  <span className="absolute top-5 right-6 text-[11px] font-bold text-white/20 tabular-nums">
                    0{i + 1}
                  </span>
                  <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-brand-gold/10 border border-brand-gold/20 mb-4 text-brand-gold group-hover:bg-brand-gold/15 transition-colors">
                    <span className="material-symbols-outlined text-[22px]">{feature.icon}</span>
                  </span>
                  <h3
                    className="text-lg font-bold mb-2 text-white tracking-tight"
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                  >
                    {feature.title}
                  </h3>
                  <p className="text-sm text-white/70 leading-relaxed mb-4">{feature.desc}</p>
                  <p className="text-xs text-brand-gold font-semibold flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-brand-gold/60" />
                    {feature.meta}
                  </p>
                </Reveal>
              ))}
            </div>

            <SectionCTA
              variant="dark"
              ctaId="recursos-signup"
              label="Testar todas as ferramentas — 3 dias grátis"
              sub="Sem cartão • acesso imediato"
              onClick={() => { trackConversion('recursos-signup'); navigate('/auth?tab=signup'); }}
            />
          </div>
        </section>

        {/* ─── A plataforma por dentro — mockups SVG on-brand ─── */}
        <PlatformShowcase onSignup={() => { trackConversion('plataforma-signup'); navigate('/auth?tab=signup'); }} />

        {/* ─── Como funciona — Exemplo real ──────────────── */}
        <section id="como-funciona" data-section="como-funciona" className="relative py-16 sm:py-28 bg-white overflow-hidden">
          {/* Gold accent no topo */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-gold/50 to-transparent" />
          {/* Green wash decorativo canto */}
          <div className="absolute -top-24 -right-24 w-[32rem] h-[32rem] rounded-full bg-brand-primary/[0.07] blur-3xl pointer-events-none" />
          {/* ECG — personalidade medica */}
          <div className="absolute inset-x-0 top-8 h-24 texture-ecg pointer-events-none" />
          <div className="absolute inset-x-0 bottom-8 h-24 texture-ecg pointer-events-none" />
          {/* Blur dourado canto inferior */}
          <div className="absolute -bottom-20 -left-20 w-[28rem] h-[28rem] rounded-full bg-brand-gold/[0.06] blur-3xl pointer-events-none" />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
            <Reveal as="div" className="mb-12 sm:mb-16 max-w-2xl">
              <p className="text-[11px] font-semibold text-brand-primary-dark uppercase tracking-[0.2em] mb-4">
                Exemplo real da plataforma
              </p>
              <h2
                className="text-2xl sm:text-4xl font-bold leading-tight text-brand-ink"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                Questões ENAMED no padrão INEP,<br className="hidden sm:block" />
                {' '}geradas <span className="text-brand-primary">sob demanda</span>.
              </h2>
              <p className="text-base text-slate-600 leading-relaxed mt-4">
                Vinhetas clínicas extensas, laboratórios com valores numéricos e distratores plausíveis, calibrados na distribuição histórica INEP 2011–2025.
              </p>
            </Reveal>

            <div className="grid grid-cols-12 gap-6 lg:gap-10">
              {/* Questão real */}
              <Reveal as="div" direction="up" delay={100} className="col-span-12 lg:col-span-7">
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-[0_8px_32px_-12px_rgba(0,109,91,0.15),0_1px_3px_0_rgba(25,28,29,0.04)]">
                  <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
                    <span className="text-xs font-semibold text-slate-600">Clínica Médica · Nefrologia</span>
                    <span className="text-[10px] px-2 py-0.5 bg-[#005344] text-white font-semibold rounded">Alta dificuldade</span>
                  </div>
                  <div className="p-5 sm:p-7">
                    <p className="text-sm sm:text-[15px] text-slate-700 leading-relaxed mb-5">
                      Mulher de 58 anos, hipertensa e diabética há 12 anos, em uso irregular de losartana e metformina, comparece ao ambulatório com queixa de edema progressivo em membros inferiores há 3 semanas. Ao exame: PA 168/102 mmHg, edema ++/4+ simétrico até joelhos. Exames: creatinina 2,1 mg/dL (prévia 1,3 há 8 meses), ureia 78 mg/dL, albumina 2,8 g/dL, proteinúria de 24h 4,2 g, sedimento urinário com cilindros hialinos e granulosos, sem hematúria dismórfica.
                    </p>
                    <p className="text-sm font-semibold text-[#191c1d] mb-3">Qual a conduta mais apropriada?</p>
                    <div className="space-y-2 text-sm">
                      {[
                        { l: 'A', t: 'Iniciar corticoterapia em dose imunossupressora e solicitar biópsia renal de urgência.' },
                        { l: 'B', t: 'Suspender losartana, iniciar furosemida e manter controle pressórico com anlodipino.' },
                        { l: 'C', t: 'Otimizar bloqueio do SRAA, adicionar iSGLT2 e intensificar controle glicêmico e pressórico.', correct: true },
                        { l: 'D', t: 'Encaminhar para hemodiálise de início programado pelo estágio de doença renal crônica.' },
                      ].map(({ l, t, correct }) => (
                        <div
                          key={l}
                          className={`flex gap-3 p-3 rounded border ${
                            correct ? 'border-[#006D5B] bg-[#006D5B]/5' : 'border-slate-150 bg-white'
                          }`}
                        >
                          <span className={`flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                            correct ? 'bg-[#006D5B] text-white' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {l}
                          </span>
                          <span className={correct ? 'text-[#005344] font-medium' : 'text-slate-600'}>{t}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-3 italic">
                  Uma de milhares de questões no padrão ENAMED/REVALIDA disponíveis na plataforma.
                </p>
              </Reveal>

              {/* Pilares */}
              <Reveal as="div" direction="up" delay={200} className="col-span-12 lg:col-span-5 space-y-5">
                {[
                  { icon: 'auto_awesome', title: 'Resumos de PBL', desc: 'Fechamentos acadêmicos com correlação clínico-básica: fisiopatologia em cascata, mecanismos moleculares e anatomia aplicada.' },
                  { icon: 'forum', title: 'Chat com PubMed', desc: 'PreceptorMED busca, resume e cita artigos do PubMed em português. Respostas baseadas em evidência, não em achismo.' },
                  { icon: 'style', title: 'Flashcards com SM-2', desc: 'Repetição espaçada real, baseada no algoritmo SuperMemo. Questões e cards voltam quando você está prestes a esquecer.' },
                  { icon: 'science', title: 'Mentor Científico', desc: 'Revisão estruturada de TCC e artigos: valida metodologia, ABNT e coerência de cada seção independentemente.' },
                ].map((p) => (
                  <div key={p.title} className="flex gap-4">
                    <span className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-brand-primary/[0.07] border border-brand-primary/15 text-brand-primary">
                      <span className="material-symbols-outlined text-[20px]">{p.icon}</span>
                    </span>
                    <div>
                      <h4 className="text-base font-bold mb-1 text-[#191c1d]" style={{ fontFamily: "'Manrope', sans-serif" }}>{p.title}</h4>
                      <p className="text-sm text-slate-600 leading-relaxed">{p.desc}</p>
                    </div>
                  </div>
                ))}
              </Reveal>
            </div>

            <SectionCTA
              variant="light"
              ctaId="como-funciona-signup"
              label="Gerar questões ENAMED do meu jeito"
              sub="Vinhetas no padrão INEP, ilimitadas"
              onClick={() => { trackConversion('como-funciona-signup'); navigate('/auth?tab=signup'); }}
            />
          </div>
        </section>

        {/* ─── Exemplo real — Resumo de PBL ──────────────── */}
        <section data-section="exemplo-pbl" className="py-16 sm:py-28 bg-[#fafbfa] border-t border-slate-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="mb-12 sm:mb-16 max-w-2xl">
              <p className="text-sm text-[#006D5B] font-semibold mb-3">Exemplo real da plataforma</p>
              <h2
                className="text-2xl sm:text-4xl font-bold leading-tight text-[#191c1d]"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                Resumos de PBL com correlação clínico-básica, gerados em segundos.
              </h2>
              <p className="text-base text-slate-600 leading-relaxed mt-4">
                Não é "resumo de slides". Fisiopatologia em cascata, mecanismos moleculares e anatomia aplicada ao caso, no padrão do fechamento acadêmico que o PBL exige.
              </p>
            </div>

            <div className="grid grid-cols-12 gap-6 lg:gap-10">
              {/* Resumo real */}
              <div className="col-span-12 lg:col-span-8">
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-[0_8px_32px_-12px_rgba(0,109,91,0.15),0_1px_3px_0_rgba(25,28,29,0.04)]">
                  <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
                    <span className="text-xs font-semibold text-slate-600">Endocrinologia · Emergência</span>
                    <span className="text-[10px] px-2 py-0.5 bg-[#005344] text-white font-semibold rounded">Gerado em 18s</span>
                  </div>
                  <div className="p-5 sm:p-7 space-y-5">
                    <div>
                      <h3
                        className="text-lg sm:text-xl font-bold text-[#191c1d] mb-1"
                        style={{ fontFamily: "'Manrope', sans-serif" }}
                      >
                        Cetoacidose Diabética (CAD)
                      </h3>
                      <p className="text-xs text-slate-500">Objetivo de aprendizagem · Fisiopatologia, diagnóstico e manejo inicial</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-[#005344] mb-2 uppercase tracking-wide">Fisiopatologia em cascata</h4>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        A deficiência absoluta ou relativa de <span className="font-semibold">insulina</span>, somada ao excesso de hormônios contrarreguladores (<span className="font-semibold">glucagon, cortisol, catecolaminas, GH</span>), desencadeia três vias simultâneas: (1) glicogenólise e gliconeogênese hepática → hiperglicemia; (2) lipólise em tecido adiposo → liberação de ácidos graxos livres → β-oxidação hepática → produção de corpos cetônicos (β-hidroxibutirato, acetoacetato); (3) proteólise muscular. A cetogênese é mediada pela ativação da <span className="font-semibold">CPT-1</span> (carnitina-palmitoil-transferase 1), normalmente inibida por malonil-CoA — que cai na ausência de insulina.
                      </p>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-[#005344] mb-2 uppercase tracking-wide">Correlação clínico-básica</h4>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        A <span className="font-semibold">respiração de Kussmaul</span> (taquipneia profunda) é compensação respiratória à acidose metabólica — o centro bulbar responde à queda do pH arterial estimulando os quimiorreceptores periféricos. A <span className="font-semibold">dor abdominal</span> em CAD correlaciona com grau de acidose (pH &lt; 7,10 em 80% dos casos com dor), por irritação do plexo celíaco pelos cetoácidos circulantes. O <span className="font-semibold">hálito cetônico</span> reflete eliminação pulmonar de acetona volátil.
                      </p>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-[#005344] mb-2 uppercase tracking-wide">Critérios diagnósticos (ADA 2024)</h4>
                      <ul className="text-sm text-slate-700 leading-relaxed space-y-1 list-disc list-inside">
                        <li>Glicemia &gt; 250 mg/dL (pode ser normal em <em>CAD euglicêmica</em> — uso de iSGLT2)</li>
                        <li>pH arterial &lt; 7,30 <span className="text-slate-500">ou</span> HCO₃⁻ &lt; 18 mEq/L</li>
                        <li>Cetonemia / cetonúria positiva (β-hidroxibutirato &gt; 3 mmol/L)</li>
                        <li>Anion gap &gt; 10–12 mEq/L</li>
                      </ul>
                    </div>

                    <div className="relative">
                      <h4 className="text-sm font-bold text-[#005344] mb-2 uppercase tracking-wide">Manejo inicial — primeiras 4 horas</h4>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        Prioridade em ordem: (1) <span className="font-semibold">reposição volêmica</span> com SF 0,9% 15–20 mL/kg na 1ª hora, reavaliando perfusão; (2) <span className="font-semibold">potássio</span> antes da insulina se K⁺ &lt; 3,3 mEq/L (insulina causa shift intracelular, risco de arritmia); (3) <span className="font-semibold">insulina regular</span> 0,1 U/kg/h em infusão contínua, meta de redução de glicemia 50–75 mg/dL/h;
                      </p>
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-transparent" />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-3 italic">
                  Resumo com estrutura completa inclui ainda diagnóstico diferencial, complicações e referências Harrison/Goldman-Cecil.
                </p>
              </div>

              {/* O que difere */}
              <div className="col-span-12 lg:col-span-4 space-y-7">
                <div>
                  <p className="text-sm text-[#006D5B] font-semibold mb-4">O que faz diferente</p>
                </div>

                <div className="border-l-2 border-[#006D5B] pl-5">
                  <h4
                    className="text-base font-bold mb-1.5 text-[#191c1d]"
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                  >
                    Mecanismos moleculares
                  </h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Receptores, cascatas de sinalização e enzimas com nome — não só "aumenta insulina".
                  </p>
                </div>

                <div className="border-l-2 border-[#006D5B] pl-5">
                  <h4
                    className="text-base font-bold mb-1.5 text-[#191c1d]"
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                  >
                    Cada sintoma explicado
                  </h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Kussmaul, hálito cetônico, dor abdominal — cada sinal ligado ao mecanismo que o produz.
                  </p>
                </div>

                <div className="border-l-2 border-[#006D5B] pl-5">
                  <h4
                    className="text-base font-bold mb-1.5 text-[#191c1d]"
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                  >
                    Valores numéricos reais
                  </h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Cut-offs, doses, metas. ADA 2024, não "nível elevado". Pronto para prova e enfermaria.
                  </p>
                </div>

                <div className="border-l-2 border-[#006D5B] pl-5">
                  <h4
                    className="text-base font-bold mb-1.5 text-[#191c1d]"
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                  >
                    Terminologia técnica
                  </h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Dispneia, cetogênese, anion gap — linguagem de médico, não leiga.
                  </p>
                </div>
              </div>
            </div>

            <SectionCTA
              variant="light"
              ctaId="exemplo-pbl-signup"
              label="Gerar um resumo assim do meu tema"
              sub="Do tema ao fechamento completo em segundos"
              onClick={() => { trackConversion('exemplo-pbl-signup'); navigate('/auth?tab=signup'); }}
            />
          </div>
        </section>

        {/* ─── Depoimentos — dark green ─────────────────── */}
        <section
          id="depoimentos"
          data-section="depoimentos"
          className="relative py-16 sm:py-28 overflow-hidden"
          style={{ background: 'var(--pmed-gradient-primary)' }}
        >
          {/* Decorações sutis */}
          <div className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-brand-gold/10 blur-[120px] pointer-events-none" />
          <div className="absolute -bottom-32 -left-16 w-[360px] h-[360px] rounded-full bg-brand-primary/30 blur-[100px] pointer-events-none" />
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
              backgroundSize: '28px 28px',
            }}
          />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
            {/* Stats bar — prova social numérica */}
            <Reveal as="div" className="mb-12 sm:mb-16 grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/10 rounded-lg overflow-hidden border border-white/10">
              {[
                { value: '+1.200', label: 'Estudantes ativos' },
                { value: '24.8k', label: 'Resumos gerados' },
                { value: '4.9/5', label: 'Avaliação média' },
                { value: '94%', label: 'Recomendam a colegas' },
              ].map((stat, i) => (
                <div key={i} className="bg-brand-primary-darker/80 px-4 py-6 sm:py-8 text-center">
                  <p className="text-2xl sm:text-3xl font-extrabold text-brand-gold tabular-nums" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    {stat.value}
                  </p>
                  <p className="text-[11px] sm:text-xs text-white/70 uppercase tracking-[0.12em] font-semibold mt-1.5">
                    {stat.label}
                  </p>
                </div>
              ))}
            </Reveal>

            <Reveal as="div" className="mb-12 sm:mb-16 max-w-2xl">
              <p className="text-[11px] font-semibold text-brand-gold uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <span className="w-8 h-px bg-brand-gold" />
                Depoimentos
              </p>
              <h2
                className="text-2xl sm:text-4xl font-bold leading-tight text-white"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                Estudantes que já usam<br className="hidden sm:block" />
                {' '}<span className="text-brand-gold/90">no dia a dia</span>.
              </h2>
              <div className="mt-5 h-px w-16 bg-gradient-to-r from-brand-gold to-transparent" />
            </Reveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-10 divide-y divide-white/10 md:divide-y-0 [&>article]:pt-10 md:[&>article]:pt-0 first:[&>article]:pt-0">
              {/* Depoimento 1 — Alicia */}
              <Reveal as="article" delay={0} className="flex flex-col">
                <p className="text-[15px] text-white/85 leading-relaxed mb-6">
                  A plataforma PreceptorMED é uma ferramenta fantástica para o auxílio nos estudos. Os resumos são bem estruturados e direcionados para os objetivos de aprendizagem do tema, além de que as fontes utilizadas são sempre relevantes. Particularmente, minha função preferida é a de geração de questões com base nos conteúdos, o que ajuda a reforçar os conhecimentos.
                </p>
                <div className="flex items-center gap-3 mt-auto pt-6 border-t border-white/10">
                  <img
                    src="/alicia-cosendey.jpg"
                    alt="Alicia Cosendey"
                    width={40}
                    height={40}
                    loading="lazy"
                    decoding="async"
                    className="w-10 h-10 rounded-full object-cover"
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      target.style.display = 'none';
                      const fallback = target.nextElementSibling as HTMLElement | null;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                  <div
                    className="w-10 h-10 rounded-full bg-brand-gold/20 border border-brand-gold/30 items-center justify-center text-brand-gold font-semibold text-xs"
                    style={{ display: 'none' }}
                  >
                    AC
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      Alicia Cosendey
                    </p>
                    <p className="text-xs text-white/55">Estudante de Medicina</p>
                  </div>
                </div>
              </Reveal>

              {/* Depoimento 2 — João */}
              <Reveal as="article" delay={120} className="flex flex-col">
                <p className="text-[15px] text-white/85 leading-relaxed mb-6">
                  Eu não tenho dúvidas que o PreceptorMED é o futuro da medicina. As respostas oferecidas pelo PreceptorMED são de longe as mais detalhadas. Não somente isso, a plataforma sempre utiliza referências nas quais eu confio. Me surpreende também a constante expansão das ferramentas, que além de me ajudar nos estudos, também me auxilia na realização de trabalhos científicos.
                  <br /><br />
                  <span className="font-semibold text-brand-gold">Se você tiver a oportunidade de assinar, assine.</span>
                </p>
                <div className="flex items-center gap-3 mt-auto pt-6 border-t border-white/10">
                  <div className="w-10 h-10 rounded-full bg-brand-gold/20 border border-brand-gold/30 flex items-center justify-center text-brand-gold font-semibold text-xs">
                    JM
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      João Miyake
                    </p>
                    <p className="text-xs text-white/55">Estudante de Medicina</p>
                  </div>
                </div>
              </Reveal>

              {/* Depoimento 3 — Matheus Milani */}
              <Reveal as="article" delay={240} className="flex flex-col">
                <p className="text-[15px] text-white/85 leading-relaxed mb-6">
                  Minha experiência com a plataforma tem sido extremamente positiva. Os conteúdos são organizados, objetivos e atualizados, com linguagem acessível e foco prático — ajudam tanto na revisão teórica quanto na preparação para provas e atendimentos clínicos.
                  <br /><br />
                  <span className="font-semibold text-brand-gold">O PreceptorMED se tornou uma ferramenta valiosa para minha formação médica.</span>
                </p>
                <div className="flex items-center gap-3 mt-auto pt-6 border-t border-white/10">
                  <img
                    src="/matheus-milani.jpg"
                    alt="Matheus Milani"
                    width={40}
                    height={40}
                    loading="lazy"
                    decoding="async"
                    className="w-10 h-10 rounded-full object-cover"
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      target.style.display = 'none';
                      const fallback = target.nextElementSibling as HTMLElement | null;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                  <div
                    className="w-10 h-10 rounded-full bg-brand-gold/20 border border-brand-gold/30 items-center justify-center text-brand-gold font-semibold text-xs"
                    style={{ display: 'none' }}
                  >
                    MM
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      Matheus Milani
                    </p>
                    <p className="text-xs text-white/55">Estudante de Medicina</p>
                  </div>
                </div>
              </Reveal>
            </div>

            <SectionCTA
              variant="dark"
              ctaId="depoimentos-signup"
              label="Entrar pra +1.200 estudantes"
              sub="3 dias grátis • cancela quando quiser"
              onClick={() => { trackConversion('depoimentos-signup'); navigate('/auth?tab=signup'); }}
            />
          </div>
        </section>

        {/* ─── Pricing ──────────────────────────────────── */}
        <section id="precos" data-section="precos" className="relative py-14 sm:py-24 bg-white overflow-hidden">
          {/* Gold line no topo da seção (assinatura) */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-gold/30 to-transparent" />
          {/* Green wash decorativo */}
          <div className="absolute -bottom-20 -left-20 w-96 h-96 rounded-full bg-brand-primary/[0.04] blur-3xl pointer-events-none" />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
            <div className="mb-10 sm:mb-14 max-w-2xl">
              <p className="text-[11px] font-semibold text-brand-primary-dark uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <span className="w-8 h-px bg-brand-gold" />
                Planos
              </p>
              <h2
                className="text-2xl sm:text-4xl font-bold leading-tight text-brand-ink"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                Acesso completo a partir de <span className="text-brand-primary">R$ 24,99/mês</span>.
              </h2>
              <p className="text-base text-slate-600 leading-relaxed mt-4">
                Plataforma inteira liberada desde o primeiro login. Cancele quando quiser, em 1 clique.
              </p>

              {/* Urgência — banner promocional */}
              <div className="mt-6 inline-flex items-center gap-2.5 px-4 py-2.5 bg-gradient-to-r from-brand-gold/20 to-brand-gold/5 border border-brand-gold/40 rounded-lg shadow-[0_2px_12px_-4px_rgba(201,168,76,0.4)]">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-gold opacity-60" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-gold" />
                </span>
                <span className="text-xs sm:text-sm font-bold text-brand-primary-dark">
                  Oferta de lançamento: até <span className="text-[#8a6f26]">50% OFF</span> por tempo limitado
                </span>
              </div>
            </div>

            <div className="flex flex-col md:flex-row justify-center gap-4 sm:gap-8 max-w-5xl mx-auto">
              {/* Mensal */}
              <div className="flex-1 bg-white p-6 sm:p-10 rounded-2xl shadow-[0_4px_24px_-8px_rgba(0,109,91,0.08),0_1px_2px_0_rgba(25,28,29,0.04)] border border-slate-200/40 hover:shadow-[0_12px_40px_-12px_rgba(0,109,91,0.15),0_2px_4px_0_rgba(25,28,29,0.04)] transition-shadow duration-300">
                <h3 className="text-lg sm:text-xl font-bold mb-2 text-[#191c1d]" style={{ fontFamily: "'Manrope', sans-serif" }}>Plano Mensal</h3>
                <div className="mb-1.5">
                  <span className="text-4xl sm:text-5xl font-extrabold text-[#005344] tracking-tight">R$ 49,90</span>
                  <span className="text-slate-500">/mês</span>
                </div>
                <p className="text-xs text-slate-500 mb-4 sm:mb-6">
                  Sem fidelidade · <span className="font-semibold text-brand-primary-dark">economize até 50%</span> nos planos anual e bianual
                </p>
                <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-10 text-sm text-[#191c1d]">
                  <li className="flex items-center gap-3">
                    <MI name="check_circle" fill className="text-[#006D5B] text-lg" />
                    Acesso completo à plataforma
                  </li>
                  <li className="flex items-center gap-3">
                    <MI name="check_circle" fill className="text-[#006D5B] text-lg" />
                    Resumos e simulados ilimitados
                  </li>
                  <li className="flex items-center gap-3">
                    <MI name="check_circle" fill className="text-[#006D5B] text-lg" />
                    Cancelamento a qualquer momento
                  </li>
                </ul>
                <button
                  data-cta="plan-monthly"
                  onClick={() => handleSubscribe('monthly')}
                  disabled={loadingPlan !== null}
                  className="w-full py-3 sm:py-4 border border-slate-300 text-[#191c1d] text-sm font-semibold rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
                >
                  {loadingPlan === 'monthly' && <Loader2 className="inline mr-2 h-4 w-4 animate-spin" />}
                  Começar mensal
                </button>
              </div>

              {/* Anual — highlighted */}
              <div className="flex-1 bg-white p-6 sm:p-10 rounded-2xl shadow-[0_16px_48px_-12px_rgba(0,109,91,0.25),0_4px_12px_-4px_rgba(0,109,91,0.10)] border-2 border-brand-primary relative overflow-hidden hover:shadow-[0_24px_56px_-12px_rgba(0,109,91,0.35),0_6px_16px_-4px_rgba(0,109,91,0.15)] transition-shadow duration-300">
                {/* Badge de desconto — destaque máximo */}
                <div className="absolute top-0 left-0 bg-brand-gold text-brand-primary-darker px-3 py-1.5 text-sm font-extrabold tracking-tight rounded-br-xl shadow-[0_4px_12px_-2px_rgba(201,168,76,0.5)]">
                  −41% OFF
                </div>
                <div className="absolute top-0 right-0 bg-brand-primary-dark text-white px-3 sm:px-4 py-1 text-[10px] font-bold uppercase tracking-wider rounded-bl-lg">
                  ★ Mais Popular
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-3 mt-4 text-[#191c1d]" style={{ fontFamily: "'Manrope', sans-serif" }}>Plano Anual</h3>
                {/* parcelamento — 12x pequeno + valor grande */}
                <div className="flex items-baseline gap-1.5">
                  <span className="text-base sm:text-lg font-semibold text-slate-500">12x de</span>
                  <span className="text-4xl sm:text-5xl font-extrabold text-[#005344] tracking-tight">R$ 29,24</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 mb-3">
                  <span className="text-sm text-slate-400 line-through">R$ 49,90/mês</span>
                  <span className="text-[11px] font-semibold text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded">ou R$ 350,90 à vista</span>
                </div>
                {/* Economia em destaque — 41% */}
                <div className="inline-flex items-center gap-2 bg-brand-gold/20 border border-brand-gold/50 rounded-lg px-3.5 py-2 mb-6 shadow-[0_2px_10px_-3px_rgba(201,168,76,0.45)]">
                  <MI name="savings" fill className="text-[#8a6f26] text-lg" />
                  <span className="text-sm font-extrabold tracking-wide text-brand-primary-darker uppercase">Economia de 41%</span>
                </div>
                <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-10 text-sm text-[#191c1d]">
                  <li className="flex items-center gap-3 font-semibold">
                    <MI name="check_circle" fill className="text-[#006D5B] text-lg" />
                    Tudo do plano mensal
                  </li>
                  <li className="flex items-center gap-3">
                    <MI name="check_circle" fill className="text-[#006D5B] text-lg" />
                    Faça parte do grupo VIP
                  </li>
                  <li className="flex items-center gap-3">
                    <MI name="check_circle" fill className="text-[#006D5B] text-lg" />
                    Suporte prioritário
                  </li>
                  <li className="flex items-center gap-3">
                    <MI name="check_circle" fill className="text-[#006D5B] text-lg" />
                    Receba atualizações em primeira mão
                  </li>
                  <li className="flex items-center gap-3">
                    <MI name="check_circle" fill className="text-[#006D5B] text-lg" />
                    Oportunidade de se tornar embaixador
                  </li>
                </ul>
                <button
                  data-cta="plan-annual"
                  onClick={() => handleSubscribe('annual')}
                  disabled={loadingPlan !== null}
                  className="btn-shimmer relative overflow-hidden w-full py-3 sm:py-4 bg-[#005344] text-white text-sm font-semibold rounded-lg shadow-lg hover:bg-[#003d32] transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
                >
                  {loadingPlan === 'annual' && <Loader2 className="inline mr-2 h-4 w-4 animate-spin" />}
                  Começar anual
                </button>
              </div>

              {/* Bianual */}
              <div className="flex-1 bg-white p-6 sm:p-10 rounded-2xl shadow-[0_4px_24px_-8px_rgba(201,168,76,0.12),0_1px_2px_0_rgba(25,28,29,0.04)] border border-slate-200/40 hover:shadow-[0_12px_40px_-12px_rgba(201,168,76,0.22),0_2px_4px_0_rgba(25,28,29,0.04)] transition-shadow duration-300 relative overflow-hidden">
                {/* Badge de desconto — máximo */}
                <div className="absolute top-0 left-0 bg-brand-gold text-brand-primary-darker px-3 py-1.5 text-sm font-extrabold tracking-tight rounded-br-xl shadow-[0_4px_12px_-2px_rgba(201,168,76,0.5)]">
                  −50% OFF
                </div>
                <div className="absolute top-0 right-0 bg-brand-primary-dark text-white px-3 sm:px-4 py-1 text-[10px] font-bold uppercase tracking-wider rounded-bl-lg">
                  Maior economia
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-3 mt-4 text-[#191c1d]" style={{ fontFamily: "'Manrope', sans-serif" }}>Plano Bianual</h3>
                {/* parcelamento — 24x pequeno + valor grande */}
                <div className="flex items-baseline gap-1.5">
                  <span className="text-base sm:text-lg font-semibold text-slate-500">24x de</span>
                  <span className="text-4xl sm:text-5xl font-extrabold text-[#005344] tracking-tight">R$ 24,99</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 mb-3">
                  <span className="text-sm text-slate-400 line-through">R$ 49,90/mês</span>
                  <span className="text-[11px] font-semibold text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded">ou R$ 599,90 à vista</span>
                </div>
                {/* Economia em destaque — 50% */}
                <div className="inline-flex items-center gap-2 bg-brand-gold/20 border border-brand-gold/50 rounded-lg px-3.5 py-2 mb-6 shadow-[0_2px_10px_-3px_rgba(201,168,76,0.45)]">
                  <MI name="savings" fill className="text-[#8a6f26] text-lg" />
                  <span className="text-sm font-extrabold tracking-wide text-brand-primary-darker uppercase">Economia de 50%</span>
                </div>
                <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-10 text-sm text-[#191c1d]">
                  <li className="flex items-center gap-3 font-semibold">
                    <MI name="check_circle" fill className="text-[#006D5B] text-lg" />
                    Tudo do plano anual
                  </li>
                  <li className="flex items-center gap-3">
                    <MI name="check_circle" fill className="text-[#006D5B] text-lg" />
                    Maior economia possível
                  </li>
                  <li className="flex items-center gap-3">
                    <MI name="check_circle" fill className="text-[#006D5B] text-lg" />
                    Suporte prioritário VIP
                  </li>
                  <li className="flex items-center gap-3">
                    <MI name="check_circle" fill className="text-[#006D5B] text-lg" />
                    Acesso antecipado a novos recursos
                  </li>
                  <li className="flex items-center gap-3">
                    <MI name="check_circle" fill className="text-[#006D5B] text-lg" />
                    Seja embaixador PreceptorMED
                  </li>
                </ul>
                <button
                  data-cta="plan-biannual"
                  onClick={() => handleSubscribe('biannual')}
                  disabled={loadingPlan !== null}
                  className="w-full py-3 sm:py-4 border-2 border-[#005344] text-[#005344] text-sm font-semibold rounded-lg hover:bg-[#005344] hover:text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
                >
                  {loadingPlan === 'biannual' && <Loader2 className="inline mr-2 h-4 w-4 animate-spin" />}
                  Começar bianual
                </button>
              </div>
            </div>

          </div>
        </section>

        {/* ─── FAQ ──────────────────────────────────────── */}
        <section data-section="faq" className="relative py-16 sm:py-24 bg-[#fafbfa] border-t border-slate-100 overflow-hidden">
          <div className="absolute -top-20 -left-20 w-[24rem] h-[24rem] rounded-full bg-brand-primary/[0.04] blur-3xl pointer-events-none" />
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6">
            <Reveal as="div" className="mb-10 sm:mb-14 text-center max-w-2xl mx-auto">
              <p className="text-[11px] font-semibold text-brand-primary-dark uppercase tracking-[0.2em] mb-4 inline-flex items-center gap-2">
                <span className="w-8 h-px bg-brand-gold" />
                Perguntas frequentes
                <span className="w-8 h-px bg-brand-gold" />
              </p>
              <h2
                className="text-2xl sm:text-4xl font-bold leading-tight text-brand-ink"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                Antes de assinar, você quer saber:
              </h2>
            </Reveal>

            <div className="space-y-3">
              {[
                {
                  q: 'Posso cancelar a qualquer momento?',
                  a: 'Sim. Cancela direto pelo painel em 1 clique, sem multa nem perguntas. Continua com acesso até o fim do período pago.',
                },
                {
                  q: 'Como sei que o conteúdo está correto e atualizado?',
                  a: 'Os fechamentos saem com referências PubMed citadas inline e seguem diretrizes brasileiras (SBC, SBP, Ministério da Saúde) e internacionais (Harrison, Goldman-Cecil). Tudo passa por validação de terminologia médica antes de chegar pra você.',
                },
                {
                  q: 'Funciona pra qual ano de medicina?',
                  a: 'Do 1º ao 6º ano. Estudantes do ciclo básico usam para PBL e correlação clínico-básica. Internato e residência usam para revisão ENAMED, REVALIDA e casos clínicos.',
                },
                {
                  q: 'É melhor que ChatGPT pra estudar medicina?',
                  a: 'O ChatGPT inventa referências, mistura faixas etárias e dose, e não tem acesso direto ao PubMed. Aqui você tem prompt calibrado pra padrão brasileiro de PBL/ENAMED, citações verificadas e estrutura editorial pronta pra estudar e exportar em PDF.',
                },
                {
                  q: 'Tem app pra celular?',
                  a: 'A plataforma é totalmente responsiva: funciona no navegador do celular sem precisar instalar nada. App nativo iOS/Android está no roadmap pra 2026.',
                },
                {
                  q: 'Como funcionam os 3 dias de garantia?',
                  a: 'Assina, usa a plataforma sem limite por 3 dias. Se não gostar, manda e-mail e devolvemos 100% do valor pago. Sem precisar justificar nem negociar.',
                },
                {
                  q: 'Posso testar antes de assinar?',
                  a: 'Sim. Cria conta grátis e gera seus primeiros resumos sem precisar inserir cartão. Quando perceber que economiza horas por semana, escolhe um plano.',
                },
              ].map((item, i) => (
                <Reveal key={i} delay={i * 50} as="details" className="group bg-white rounded-xl border border-slate-200/70 hover:border-brand-primary/30 hover:shadow-[0_4px_16px_-8px_rgba(0,109,91,0.15)] transition-all overflow-hidden [&[open]>summary>span:last-child]:rotate-45 [&[open]]:border-brand-primary/30 [&[open]]:shadow-[0_4px_16px_-8px_rgba(0,109,91,0.15)]">
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-4 px-5 sm:px-6 py-4 sm:py-5 select-none">
                    <span className="text-sm sm:text-base font-semibold text-brand-ink leading-snug" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      {item.q}
                    </span>
                    <span className="flex-shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand-gold/10 text-brand-primary-dark font-bold text-lg leading-none transition-transform duration-200">
                      +
                    </span>
                  </summary>
                  <div className="px-5 sm:px-6 pb-5 sm:pb-6 -mt-1 text-sm text-slate-600 leading-relaxed">
                    {item.a}
                  </div>
                </Reveal>
              ))}
            </div>

            <p className="text-center text-sm text-slate-600 mt-10">
              Mais alguma dúvida?{' '}
              <a href="mailto:preceptormed@gmail.com" className="font-semibold text-brand-primary-dark underline underline-offset-2 hover:text-brand-primary">
                preceptormed@gmail.com
              </a>
            </p>

            <SectionCTA
              variant="light"
              ctaId="faq-signup"
              label="Tirei minhas dúvidas — quero testar"
              sub="3 dias grátis • sem compromisso"
              onClick={() => { trackConversion('faq-signup'); navigate('/auth?tab=signup'); }}
            />
          </div>
        </section>

        {/* ─── Final CTA ────────────────────────────────── */}
        <section
          data-section="cta-final"
          className="relative py-16 sm:py-24 overflow-hidden"
          style={{ background: 'var(--pmed-gradient-primary)' }}
        >
          {/* Decorações sutis — mesma linguagem de Recursos e Depoimentos */}
          <div className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-brand-gold/10 blur-[120px] pointer-events-none" />
          <div className="absolute -bottom-32 -left-16 w-[360px] h-[360px] rounded-full bg-brand-primary/30 blur-[100px] pointer-events-none" />
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
              backgroundSize: '28px 28px',
            }}
          />

          <Reveal as="div" className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <p className="text-[11px] font-semibold text-brand-gold uppercase tracking-[0.2em] mb-5 inline-flex items-center gap-2">
              <span className="w-8 h-px bg-brand-gold" />
              Última chance: comece agora
              <span className="w-8 h-px bg-brand-gold" />
            </p>
            <h2
              className="text-2xl sm:text-4xl md:text-5xl font-bold mb-5 tracking-tight text-white leading-[1.1]"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              Em 20 segundos você tem seu primeiro<br className="hidden sm:block" />
              {' '}fechamento de PBL <span className="text-brand-gold/90">na tela</span>.
            </h2>
            <p className="text-base sm:text-lg text-white/75 mb-8 sm:mb-10 leading-relaxed max-w-xl mx-auto">
              3 dias grátis, sem cartão. Gere seus primeiros fechamentos e veja a diferença antes de pagar qualquer coisa.
            </p>
            <button
              data-cta="final-cta-signup"
              onClick={() => { trackConversion('final-cta-signup'); navigate('/auth?tab=signup'); }}
              className="inline-flex items-center gap-2 px-8 sm:px-10 py-4 sm:py-5 bg-white text-brand-primary-dark rounded-lg text-base sm:text-lg font-bold hover:bg-slate-50 active:scale-[0.98] transition-colors shadow-[0_8px_24px_-8px_rgba(0,0,0,0.3)]"
            >
              Começar 3 dias grátis
              <span className="text-brand-gold">→</span>
            </button>

            {/* Trust strip */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/70">
              <span className="inline-flex items-center gap-1.5">
                <span className="text-brand-gold text-base leading-none">✓</span>
                Grátis por 3 dias
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-brand-gold text-base leading-none">✓</span>
                Sem cartão
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-brand-gold text-base leading-none">✓</span>
                Cancele quando quiser
              </span>
            </div>
          </Reveal>
        </section>
      </main>

      {/* ─── Footer ───────────────────────────────────── */}
      <footer className="bg-slate-50 border-t border-slate-200/50 py-8 sm:py-12 px-4 sm:px-6 md:px-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:flex lg:justify-between items-start w-full max-w-7xl mx-auto gap-12">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <img src={logoIcon} alt="PreceptorMED" className="h-6 w-6" />
              <span className="text-xl font-bold text-slate-900" style={{ fontFamily: "'Manrope', sans-serif" }}>PreceptorMED</span>
            </div>
            <p className="max-w-xs text-sm text-slate-500">
              © {new Date().getFullYear()} PreceptorMED. Plataforma de estudo médico com PreceptorMED.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
            <div className="space-y-4">
              <h5 className="font-bold text-xs uppercase tracking-widest text-slate-900">Legal</h5>
              <ul className="space-y-2">
                <li><a className="text-sm text-slate-500 hover:text-slate-800 hover:translate-x-1 transition-all duration-200 block" href="/termos">Termos de Uso</a></li>
                <li><a className="text-sm text-slate-500 hover:text-slate-800 hover:translate-x-1 transition-all duration-200 block" href="/privacidade">Privacidade</a></li>
              </ul>
            </div>
            <div className="space-y-4">
              <h5 className="font-bold text-xs uppercase tracking-widest text-slate-900">Empresa</h5>
              <ul className="space-y-2">
                <li><a className="text-sm text-slate-500 hover:text-slate-800 hover:translate-x-1 transition-all duration-200 block" href="https://instagram.com/preceptor.med" target="_blank" rel="noopener noreferrer">Instagram</a></li>
                <li><a className="text-sm text-slate-500 hover:text-slate-800 hover:translate-x-1 transition-all duration-200 block" href="mailto:preceptormed@gmail.com">Contato</a></li>
              </ul>
            </div>
            <div className="space-y-4">
              <h5 className="font-bold text-xs uppercase tracking-widest text-slate-900">Ajuda</h5>
              <ul className="space-y-2">
                <li><a className="text-sm text-slate-500 hover:text-slate-800 hover:translate-x-1 transition-all duration-200 block" href="mailto:preceptormed@gmail.com">Suporte</a></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>

      {/* Espaçador para a barra fixa mobile não cobrir o rodapé */}
      <div className="h-20 md:hidden" aria-hidden />

      {/* CTA fixo mobile — gatilho de cadastro persistente p/ quem rola além do hero */}
      <MobileStickyCTA
        show={!heroInView}
        onClick={() => { trackConversion('mobile-sticky-signup'); navigate('/auth?tab=signup'); }}
      />

      <PixPaymentModal
        open={pixModal}
        onClose={() => setPixModal(false)}
        planLabel="Plano Mensal"
        planPrice="R$ 49,90"
      />
    </div>
  );
};

export default Landing;
