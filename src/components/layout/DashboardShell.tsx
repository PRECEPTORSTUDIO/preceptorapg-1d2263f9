import { useEffect, useState, useCallback, Suspense } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Menu, X, Loader2 } from 'lucide-react';
import SupportWidget from '@/components/support/SupportWidget';
import NpsModal from '@/components/support/NpsModal';
import { usePresenceTracking } from '@/hooks/usePresenceTracking';
import { FOCUS_MODE, isFocusPath } from '@/config/features';

/**
 * Shell persistente do app autenticado.
 *
 * Renderiza a sidebar + chrome (topbar mobile, banner de upgrade, modais) UMA
 * vez e mantém tudo montado entre navegações. Só o conteúdo (`<Outlet/>`) troca,
 * dentro de um Suspense de área de conteúdo com fundo da app (nunca branco) —
 * então trocar de aba não pisca a tela inteira.
 *
 * As páginas continuam renderizando `<DashboardLayout>` (agora só `<main>` +
 * footer), que cai dentro deste Outlet sem nenhuma mudança nelas.
 */

const MI = ({ name, fill = false, className = '' }: { name: string; fill?: boolean; className?: string }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{ fontVariationSettings: fill ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : undefined }}
  >
    {name}
  </span>
);

interface NavItem {
  icon: string;
  label: string;
  path: string;
  matchPaths?: string[];
  children?: { icon: string; label: string; path: string; matchPaths?: string[] }[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const allNavGroups: NavGroup[] = [
  {
    label: 'Estudo',
    items: [
      { icon: 'dashboard', label: 'Início', path: '/menu' },
      { icon: 'event_note', label: 'Cronograma', path: '/cronograma', matchPaths: ['/cronograma'] },
      { icon: 'medical_information', label: 'Casos clínicos', path: '/casos-clinicos', matchPaths: ['/casos-clinicos'] },
      { icon: 'auto_awesome', label: 'Estudo com PreceptorMED', path: '/dashboard' },
    ],
  },
  {
    label: 'Prática',
    items: [
      {
        icon: 'shutter_speed', label: 'Simulações', path: '/exam',
        matchPaths: ['/exam', '/enamed', '/flashcards', '/provas'],
        children: [
          { icon: 'assignment', label: 'Simulação Normal', path: '/exam' },
          { icon: 'history_edu', label: 'ENAMED', path: '/enamed' },
          { icon: 'target', label: 'Simulado por Área', path: '/enamed?area=true', matchPaths: ['/enamed?area'] },
          { icon: 'upload_file', label: 'Provas Importadas', path: '/provas', matchPaths: ['/provas'] },
          { icon: 'style', label: 'Flashcards', path: '/flashcards' },
        ],
      },
    ],
  },
  {
    label: 'Clínica',
    items: [
      { icon: 'menu_book', label: 'PreceptorBook', path: '/whitebook', matchPaths: ['/whitebook'] },
      { icon: 'mic', label: 'Scribe Clínico', path: '/scribe', matchPaths: ['/scribe'] },
    ],
  },
  {
    label: 'Seus dados',
    items: [
      { icon: 'library_books', label: 'Biblioteca', path: '/library' },
      { icon: 'science', label: 'Curadoria Científica', path: '/scientific-studio' },
    ],
  },
];

// Modo foco (Fase 2): mantém só os módulos com uso real — fechamentos
// (/dashboard) + simulados/ENAMED/flashcards + biblioteca. Filtra itens e
// filhos e descarta grupos que ficam vazios. Rotas seguem acessíveis por URL.
const sidebarNavGroups: NavGroup[] = FOCUS_MODE
  ? allNavGroups
      .map(g => ({
        ...g,
        items: g.items
          .map(it => (it.children ? { ...it, children: it.children.filter(c => isFocusPath(c.path)) } : it))
          .filter(it => isFocusPath(it.path) || (it.children?.length ?? 0) > 0),
      }))
      .filter(g => g.items.length > 0)
  : allNavGroups;

// Flat list for auto-expand submenu logic
const sidebarNavItems: NavItem[] = sidebarNavGroups.flatMap(g => g.items);

// Fallback do Suspense — área de conteúdo, fundo da app (NUNCA branco puro),
// para que carregar uma página nova não pisque a tela em branco.
const ContentFallback = () => (
  <div className="flex-1 flex items-center justify-center min-h-[60vh] bg-[#f8f9fa]">
    <Loader2 className="h-7 w-7 animate-spin text-[#006D5B]/70" />
  </div>
);

const DashboardShell = () => {
  // Liga rastreio de presenca pra contar usuarios online no CRM em tempo real.
  usePresenceTracking();
  const { user, signOut } = useAuth();
  const { hasAccess, loading: subLoading } = useSubscription();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [topBannerDismissed, setTopBannerDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return sessionStorage.getItem('pmed_upgrade_banner_dismissed') === '1'; } catch { return false; }
  });
  const dismissTopBanner = () => {
    try { sessionStorage.setItem('pmed_upgrade_banner_dismissed', '1'); } catch { /* storage indisponivel */ }
    setTopBannerDismissed(true);
  };

  const isFreeUser = !hasAccess && !isAdmin;
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Estudante';
  const userInitial = userName.charAt(0).toUpperCase();

  // Phone prompt for users without phone
  const [showPhonePrompt, setShowPhonePrompt] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneSaving, setPhoneSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Check localStorage to persist across browser sessions
    if (localStorage.getItem('preceptor_phone_ok') === user.id) return;
    // Also check user_metadata — if phone already exists there, skip
    if (user.user_metadata?.phone) {
      localStorage.setItem('preceptor_phone_ok', user.id);
      return;
    }

    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('phone')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data?.phone) {
        localStorage.setItem('preceptor_phone_ok', user.id);
      } else {
        setShowPhonePrompt(true);
      }
    })();
  }, [user]);

  const handlePhoneSubmit = useCallback(async () => {
    if (!phoneInput.trim() || !user) return;
    setPhoneSaving(true);
    await supabase.auth.updateUser({ data: { phone: phoneInput.trim() } });
    await supabase.from('profiles').update({ phone: phoneInput.trim() }).eq('user_id', user.id);
    localStorage.setItem('preceptor_phone_ok', user.id);
    setShowPhonePrompt(false);
    setPhoneSaving(false);
  }, [phoneInput, user]);

  // Auto-expand submenu if currently on a child route
  useEffect(() => {
    sidebarNavItems.forEach(item => {
      if (item.children && checkActive(item)) {
        setExpandedMenu(item.path);
      }
    });
  }, [location.pathname]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  const checkActive = (item: { path: string; matchPaths?: string[] }) => {
    if (item.matchPaths) {
      return item.matchPaths.some(p => location.pathname.startsWith(p));
    }
    return location.pathname === item.path;
  };

  const checkChildActive = (child: { path: string; matchPaths?: string[] }) => {
    const childUrl = new URL(child.path, 'http://x');
    const currentSearch = location.search;
    if (child.matchPaths) {
      return child.matchPaths.some(p => (location.pathname + location.search).includes(p));
    }
    if (childUrl.search) {
      return location.pathname === childUrl.pathname && currentSearch === childUrl.search;
    }
    return location.pathname === childUrl.pathname && !currentSearch;
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-6 mb-8">
        <button onClick={() => navigate('/menu')} className="group flex items-center gap-2.5">
          <img
            src="/favicon.png"
            alt="PreceptorMED"
            className="h-9 w-9 transition-opacity group-hover:opacity-80 brightness-0 invert"
          />
          <span className="font-['Manrope'] font-extrabold text-white text-lg tracking-tight transition-opacity group-hover:opacity-80">
            PreceptorMED
          </span>
        </button>
        {/* Gold accent line — assinatura visual */}
        <div className="mt-4 h-px w-12 bg-gradient-to-r from-brand-gold to-transparent" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 overflow-y-auto sidebar-scroll space-y-6">
        {sidebarNavGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            {/* Section label — editorial */}
            <div className="flex items-center gap-2 px-3 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-gold/70">
                {group.label}
              </span>
              <span className="flex-1 h-px bg-gradient-to-r from-brand-gold/20 to-transparent" />
            </div>

            {group.items.map((item) => {
              const active = checkActive(item);
              const hasChildren = !!item.children;
              const isExpanded = expandedMenu === item.path;

              return (
                <div key={item.path}>
                  <button
                    onClick={() => {
                      if (hasChildren) {
                        setExpandedMenu(isExpanded ? null : item.path);
                      } else {
                        navigate(item.path);
                      }
                    }}
                    className={`group/navitem relative w-full flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      active
                        ? 'text-white bg-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]'
                        : 'text-white/70 hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    {/* Indicador ativo — barra dourada à esquerda */}
                    {active && !hasChildren && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full"
                        style={{ background: 'linear-gradient(180deg, #E0C068 0%, #C9A84C 100%)' }}
                      />
                    )}
                    <MI
                      name={item.icon}
                      fill={active}
                      className={`text-[22px] transition-colors ${
                        active ? 'text-brand-gold' : 'text-white/80 group-hover/navitem:text-white'
                      }`}
                    />
                    <span className="flex-1 text-left">{item.label}</span>
                    {hasChildren && (
                      <MI
                        name="expand_more"
                        className={`text-[20px] text-white/40 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    )}
                  </button>

                  {/* Submenu */}
                  {hasChildren && (
                    <div
                      className="overflow-hidden transition-all duration-300 ease-out"
                      style={{
                        maxHeight: isExpanded ? `${(item.children!.length) * 42}px` : '0px',
                        opacity: isExpanded ? 1 : 0,
                      }}
                    >
                      <div className="ml-4 pl-4 border-l border-brand-gold/20 py-1 space-y-0.5 mt-1">
                        {item.children!.map((child) => {
                          const childActive = checkChildActive(child);
                          return (
                            <button
                              key={child.path}
                              onClick={() => navigate(child.path)}
                              className={`group/child w-full flex items-center gap-2.5 py-2 px-2.5 rounded-lg text-[13px] font-medium transition-all duration-200 ${
                                childActive
                                  ? 'text-white bg-white/10'
                                  : 'text-white/55 hover:text-white hover:bg-white/[0.05]'
                              }`}
                            >
                              <MI
                                name={child.icon}
                                fill={childActive}
                                className={`text-[18px] transition-colors ${
                                  childActive ? 'text-brand-gold' : 'text-white/70 group-hover/child:text-white'
                                }`}
                              />
                              <span>{child.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="mt-auto pt-6 border-t border-white/15 px-4">
        {/* PRO Plan card — free users only */}
        {isFreeUser && !subLoading && (
          <div className="relative overflow-hidden mb-5 px-4 py-4 rounded-xl bg-gradient-to-br from-brand-gold/25 via-brand-gold/10 to-transparent border border-brand-gold/30">
            <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-brand-gold/15 blur-2xl pointer-events-none" />
            <div className="absolute top-2 right-2 bg-[#C9A84C] text-[#003D32] px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider shadow-sm">
              -41%
            </div>
            <div className="relative">
              <p className="text-[10px] font-bold text-brand-gold uppercase tracking-wider mb-1">✦ Plano Anual</p>
              <p className="text-[18px] font-extrabold text-white leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                R$ 29,24<span className="text-[11px] font-medium text-white/70">/mês</span>
              </p>
              <p className="text-[10px] text-white/55 line-through mb-3">de R$ 49,90/mês</p>
              <button
                onClick={() => navigate('/pricing')}
                className="w-full text-xs font-semibold text-brand-primary-darker bg-brand-gold py-2 rounded-lg hover:bg-brand-gold/90 transition-colors"
              >
                Quero garantir 41% OFF
              </button>
            </div>
          </div>
        )}

        {/* User profile — clickable to /profile */}
        <button
          onClick={() => navigate('/profile')}
          className="w-full flex items-center gap-3 px-2 py-3 rounded-xl hover:bg-white/10 transition-all duration-200 group"
        >
          <div className="w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center font-bold text-sm shrink-0 group-hover:bg-white/30 transition-colors">
            {userInitial}
          </div>
          <div className="overflow-hidden text-left">
            <p className="text-sm font-bold text-white truncate">{userName}</p>
            <p className="text-[10px] text-white/50 truncate">{isFreeUser ? 'Plano Gratuito' : 'Plano PRO'}</p>
          </div>
          <MI name="chevron_right" className="text-[18px] text-white/40 ml-auto group-hover:text-white/70 group-hover:translate-x-0.5 transition-all" />
        </button>

        {/* Help & Logout */}
        <div className="mt-3 space-y-1 mb-2">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-support-widget'))}
            className="w-full text-white/60 text-xs font-medium flex items-center gap-2 py-2 px-3 rounded-lg hover:text-white hover:bg-white/10 transition-all duration-200 cursor-pointer text-left"
          >
            <MI name="help" className="text-[18px]" />
            <span>Suporte</span>
          </button>
          <button
            onClick={signOut}
            className="w-full text-white/60 text-xs font-medium flex items-center gap-2 py-2 px-3 rounded-lg hover:text-red-300 hover:bg-red-500/10 transition-all duration-200"
          >
            <MI name="logout" className="text-[18px]" />
            <span>Sair</span>
          </button>
        </div>

        {/* Signature footer — quiet, detailed */}
        <div className="mt-4 pt-4 border-t border-white/5 px-2 flex items-center justify-between">
          <span className="text-[10px] text-white/25 tracking-wide">
            v1.0
          </span>
          <span className="text-[10px] text-white/25 tracking-wide flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-brand-gold/60" />
            feito para PBL
          </span>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#191c1d] antialiased">

      {/* Sidebar — Desktop */}
      <aside className="hidden lg:flex flex-col h-screen w-64 fixed left-0 top-0 z-40 py-8 font-display" style={{ background: 'var(--pmed-gradient-sidebar)' }}>
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 shadow-2xl flex flex-col py-8 animate-slide-in-left font-display" style={{ background: 'var(--pmed-gradient-sidebar)' }}>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Content area (right of sidebar) */}
      <div className="lg:ml-64 flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-30 bg-white/80 backdrop-blur-xl shadow-[0_4px_20px_rgba(25,28,29,0.06)] flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 -ml-2 hover:bg-slate-50 rounded-lg transition-colors"
            >
              {mobileMenuOpen ? <X className="h-5 w-5 text-slate-600" /> : <Menu className="h-5 w-5 text-slate-600" />}
            </button>
            <img src="/logo-new.png" alt="PreceptorMED" className="h-8 w-auto" />
          </div>
          <button onClick={() => navigate('/profile')} className="w-8 h-8 rounded-full bg-[#006D5B] text-white flex items-center justify-center font-bold text-xs">
            {userInitial}
          </button>
        </header>

        {/* Upgrade banner — só para usuários free, dispensável por sessão.
            Oculto em /menu pois lá já aparece o UpsellOfferModal. */}
        {isFreeUser && !subLoading && !topBannerDismissed && location.pathname !== '/menu' && (
          <div
            className="sticky top-14 lg:top-0 z-30 text-white shadow-sm"
            style={{ background: 'linear-gradient(90deg, #003D32 0%, #005344 50%, #006D5B 100%)' }}
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-10 py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="hidden sm:inline-flex items-center bg-[#C9A84C] text-[#003D32] px-1.5 py-0.5 rounded text-[10px] font-extrabold tracking-wider shrink-0">
                  -41% OFF
                </span>
                <p className="text-xs sm:text-sm text-white/95 truncate">
                  <span className="font-semibold">Plano Anual a R$ 29,24/mês</span>
                  <span className="hidden md:inline text-white/70"> · economia de R$ 247,90/ano</span>
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => navigate('/pricing')}
                  className="text-[11px] sm:text-xs font-semibold bg-[#C9A84C] text-[#003D32] px-3 py-1.5 rounded-md hover:bg-[#d3b65a] transition-colors"
                >
                  Ver oferta
                </button>
                <button
                  onClick={dismissTopBanner}
                  aria-label="Dispensar"
                  className="p-1 text-white/60 hover:text-white transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Conteúdo da página (troca via Outlet). Suspense de área de conteúdo
            com fundo da app — sidebar e chrome permanecem, sem flash branco. */}
        <Suspense fallback={<ContentFallback />}>
          <Outlet />
        </Suspense>
      </div>

      {/* Phone prompt modal */}
      {showPhonePrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 space-y-5 animate-fade-up">
            <div className="text-center space-y-2">
              <div className="inline-flex rounded-full bg-[#006D5B]/10 p-3 mb-1">
                <MI name="phone_iphone" fill className="text-[28px] text-[#006D5B]" />
              </div>
              <h2 className="text-xl font-bold text-[#191c1d]">Atualize seu telefone</h2>
              <p className="text-sm text-[#3e4945]/70 leading-relaxed">
                Para melhorar sua experiência e suporte, precisamos do seu número de WhatsApp.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#191c1d]">Telefone (WhatsApp)</label>
              <input
                type="tel"
                placeholder="(11) 99999-9999"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-[#006D5B] focus:ring-1 focus:ring-[#006D5B]/20 transition-colors"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229 && phoneInput.trim()) handlePhoneSubmit(); }}
              />
            </div>
            <button
              onClick={handlePhoneSubmit}
              disabled={!phoneInput.trim() || phoneSaving}
              className="w-full h-11 rounded-xl bg-[#006D5B] text-white font-semibold text-sm hover:bg-[#005344] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {phoneSaving ? <><Loader2 className="h-4 w-4 animate-spin" />Salvando...</> : 'Continuar'}
            </button>
          </div>
        </div>
      )}

      {/* Support widget + NPS modal (self-controlled; only render for authenticated users) */}
      <SupportWidget />
      <NpsModal />
    </div>
  );
};

export default DashboardShell;
