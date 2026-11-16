import { useState, useEffect } from 'react';
import { Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import logoPreceptor from '@/assets/logo-preceptor.png';
import { getEasyflowLink } from '@/utils/easyflow';

const Auth = () => {
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [redirectingToCheckout, setRedirectingToCheckout] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>(
    searchParams.get('tab') === 'signup' ? 'signup' : 'login'
  );

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [migrationWarning, setMigrationWarning] = useState(false);
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');

  const planType = searchParams.get('plan') as 'monthly' | 'annual' | null;

  useEffect(() => {
    if (user && planType && !redirectingToCheckout) {
      (async () => {
        const link = await getEasyflowLink(planType, user.email ?? undefined, user.id, 'auth');
        if (link) {
          setRedirectingToCheckout(true);
          window.location.href = link;
        }
      })();
    }
  }, [user, planType, redirectingToCheckout, navigate]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
      </div>
    );
  }

  if (user) return <Navigate to="/menu" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMigrationWarning(false);
    const { error } = await signIn(loginEmail, loginPassword);
    if (error) {
      if (error.message === 'Invalid login credentials') {
        setMigrationWarning(true);
      }
      toast({ title: 'Erro ao entrar', description: error.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupPassword !== signupConfirmPassword) {
      toast({ title: 'Erro', description: 'As senhas não coincidem', variant: 'destructive' });
      return;
    }
    if (signupPassword.length < 6) {
      toast({ title: 'Erro', description: 'A senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await signUp(
      signupEmail,
      signupPassword,
      signupName,
      '',
      planType ? 'paid_signup' : 'organic',
    );
    if (error) {
      toast({ title: 'Erro ao criar conta', description: error.message, variant: 'destructive' });
      setLoading(false);
    } else {
      toast({ title: 'Conta criada', description: 'Seu teste de 3 dias começou agora.' });
      if (!planType) {
        navigate('/inscricao', { replace: true });
      }
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Email enviado', description: 'Verifique sua caixa de entrada para redefinir a senha.' });
      setShowForgotPassword(false);
    }
    setForgotLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/menu',
      },
    });
    if (error) {
      toast({ title: 'Erro ao entrar com Google', description: error.message, variant: 'destructive' });
      setLoading(false);
    }
  };

  // SVG noise texture inline (subtle grain)
  const noiseTexture = `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="1"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.18 0"/></filter><rect width="100%" height="100%" filter="url(%23n)" opacity="0.5"/></svg>`
  )}`;

  return (
    <div className="min-h-screen bg-white">
      <main className="flex w-full flex-col px-5 sm:px-8 py-8 sm:py-10 bg-white relative min-h-screen max-w-md sm:max-w-lg mx-auto">
        {/* Top bar — back button */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost" size="sm"
            onClick={() => navigate('/')}
            className="text-slate-500 hover:text-brand-ink gap-1.5 text-xs -ml-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </Button>
        </div>

        {/* Mobile branding */}
        <div className="mt-6 mb-4 flex items-center gap-3 justify-center">
          <img src={logoPreceptor} alt="PreceptorMED" className="h-10 w-10" />
          <div>
            <p className="font-bold text-brand-ink tracking-tight leading-none" style={{ fontFamily: 'var(--font-display)' }}>
              PreceptorMED
            </p>
            <p className="text-[10px] text-brand-gold font-semibold uppercase tracking-[0.15em] mt-1">
              Curadoria acadêmica
            </p>
          </div>
        </div>

        {/* Form container — centered vertically on desktop */}
        <div className="flex-1 flex items-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="w-full max-w-[420px] mx-auto"
          >
            {/* Header with large display title */}
            <div className="mb-8">
              <p className="text-[11px] font-semibold text-brand-primary uppercase tracking-[0.2em] mb-3">
                {activeTab === 'login' ? 'Entrar na conta' : 'Criar conta gratuita'}
              </p>
              <h2
                className="text-3xl font-bold text-brand-ink tracking-tight leading-[1.1]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {activeTab === 'login' ? 'Continue seus estudos.' : 'Comece em 30 segundos.'}
              </h2>
              <p className="text-sm text-brand-ink-2 mt-3 leading-relaxed">
                {activeTab === 'login'
                  ? 'Sua biblioteca, anotações e flashcards estão esperando.'
                  : '3 dias de acesso total. Sem cartão. Cancele quando quiser.'}
              </p>
            </div>

            {/* Tab toggle — pill style, different from template underline */}
            <div className="inline-flex bg-slate-100 p-1 rounded-lg mb-8">
              {(['login', 'signup'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`relative px-5 py-1.5 text-[13px] font-semibold rounded-md transition-colors ${
                    activeTab === tab
                      ? 'text-brand-ink'
                      : 'text-slate-500 hover:text-brand-ink-2'
                  }`}
                >
                  {activeTab === tab && (
                    <motion.div
                      layoutId="auth-tab-pill"
                      className="absolute inset-0 bg-white rounded-md shadow-sm"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative">{tab === 'login' ? 'Entrar' : 'Criar conta'}</span>
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {activeTab === 'login' ? (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-5"
                >
                  {migrationWarning && (
                    <div className="pmed-alert pmed-alert--danger">
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                      <div>
                        <strong>Senha não reconhecida</strong>
                        <span className="block text-xs leading-relaxed mb-2">
                          Recentemente migramos a plataforma para uma nova infraestrutura. Se você já tinha conta, sua senha anterior não foi transferida. Clique em <strong>"Esqueci minha senha"</strong> para criar uma nova.
                        </span>
                        <button
                          type="button"
                          onClick={() => { setShowForgotPassword(true); setForgotEmail(loginEmail); }}
                          className="text-xs font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity"
                        >
                          Redefinir minha senha agora
                        </button>
                      </div>
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 text-sm font-medium border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                  >
                    <svg className="mr-2.5 h-4 w-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continuar com Google
                  </Button>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400 uppercase tracking-wider">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="font-semibold">ou</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>

                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="login-email" className="text-xs font-semibold text-brand-ink-2">Email</Label>
                      <Input
                        id="login-email"
                        type="email"
                        autoComplete="username"
                        placeholder="seu@email.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                        disabled={loading}
                        className="h-11 bg-slate-50 border-slate-200 focus-visible:border-brand-primary focus-visible:ring-brand-primary/15"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="login-password" className="text-xs font-semibold text-brand-ink-2">Senha</Label>
                        <button
                          type="button"
                          onClick={() => setShowForgotPassword(true)}
                          className="text-[11px] font-semibold text-brand-primary hover:text-brand-primary-dark transition-colors"
                        >
                          Esqueci minha senha
                        </button>
                      </div>
                      <Input
                        id="login-password"
                        type="password"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        disabled={loading}
                        className="h-11 bg-slate-50 border-slate-200 focus-visible:border-brand-primary focus-visible:ring-brand-primary/15"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full h-11 font-semibold bg-brand-primary-dark hover:bg-brand-primary-darker"
                      disabled={loading}
                    >
                      {loading ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Entrando...</>
                      ) : (
                        'Entrar'
                      )}
                    </Button>
                  </form>

                  <AnimatePresence>
                    {showForgotPassword && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                          <div>
                            <p className="text-sm font-semibold text-brand-ink">Recuperar senha</p>
                            <p className="text-xs text-brand-ink-2 mt-0.5">Enviaremos um link para redefinir.</p>
                          </div>
                          <form onSubmit={handleForgotPassword} className="space-y-3">
                            <Input
                              type="email"
                              placeholder="seu@email.com"
                              value={forgotEmail}
                              onChange={(e) => setForgotEmail(e.target.value)}
                              required
                              disabled={forgotLoading}
                              className="h-9 bg-white"
                            />
                            <div className="flex gap-2 justify-end">
                              <Button type="button" variant="ghost" size="sm" onClick={() => setShowForgotPassword(false)}>
                                Cancelar
                              </Button>
                              <Button
                                type="submit"
                                size="sm"
                                disabled={forgotLoading}
                                className="bg-brand-primary-dark hover:bg-brand-primary-darker"
                              >
                                {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar link'}
                              </Button>
                            </div>
                          </form>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ) : (
                <motion.div
                  key="signup"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-5"
                >
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 text-sm font-medium border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                  >
                    <svg className="mr-2.5 h-4 w-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Criar conta com Google
                  </Button>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400 uppercase tracking-wider">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="font-semibold">ou</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>

                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-name" className="text-xs font-semibold text-brand-ink-2">Nome completo</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        autoComplete="name"
                        placeholder="Como seus preceptores te chamam"
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        required
                        disabled={loading}
                        className="h-11 bg-slate-50 border-slate-200 focus-visible:border-brand-primary focus-visible:ring-brand-primary/15"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-email" className="text-xs font-semibold text-brand-ink-2">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        autoComplete="username"
                        placeholder="seu@email.com"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        required
                        disabled={loading}
                        className="h-11 bg-slate-50 border-slate-200 focus-visible:border-brand-primary focus-visible:ring-brand-primary/15"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="signup-password" className="text-xs font-semibold text-brand-ink-2">Senha</Label>
                        <Input
                          id="signup-password"
                          type="password"
                          autoComplete="new-password"
                          placeholder="6+ caracteres"
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          required
                          disabled={loading}
                          className="h-11 bg-slate-50 border-slate-200 focus-visible:border-brand-primary focus-visible:ring-brand-primary/15"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="signup-confirm" className="text-xs font-semibold text-brand-ink-2">Confirmar</Label>
                        <Input
                          id="signup-confirm"
                          type="password"
                          autoComplete="new-password"
                          placeholder="Repita"
                          value={signupConfirmPassword}
                          onChange={(e) => setSignupConfirmPassword(e.target.value)}
                          required
                          disabled={loading}
                          className="h-11 bg-slate-50 border-slate-200 focus-visible:border-brand-primary focus-visible:ring-brand-primary/15"
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="w-full h-11 font-semibold bg-brand-primary-dark hover:bg-brand-primary-darker"
                      disabled={loading}
                    >
                      {loading ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando conta...</>
                      ) : (
                        'Criar conta e começar'
                      )}
                    </Button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            <p className="text-center text-[11px] text-slate-400 mt-8 leading-relaxed">
              Ao continuar, você concorda com nossos{' '}
              <a href="/termos" className="text-slate-500 hover:text-brand-primary underline underline-offset-2">termos de uso</a>
              {' '}e{' '}
              <a href="/privacidade" className="text-slate-500 hover:text-brand-primary underline underline-offset-2">política de privacidade</a>.
            </p>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default Auth;
