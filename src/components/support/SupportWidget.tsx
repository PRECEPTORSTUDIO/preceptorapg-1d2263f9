import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MessageCircle, X, Send, Loader2, Star, Lightbulb, Mail, CheckCircle2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Tab = 'chat' | 'feedback';
type ChatMessage = { role: 'user' | 'assistant'; content: string };

const SUPPORT_EMAIL = 'matheus@ospreceptores.com';

const WELCOME_MESSAGE =
  'Olá! Sou o assistente de suporte do **PreceptorMED**. Como posso te ajudar hoje? Posso tirar dúvidas sobre planos, pagamentos, flashcards, fechamentos de PBL e uso da plataforma.';

const FEEDBACK_CATEGORIES: { value: string; label: string; icon: string }[] = [
  { value: 'improvement', label: 'Melhoria', icon: '✨' },
  { value: 'feature_request', label: 'Nova funcionalidade', icon: '🚀' },
  { value: 'bug', label: 'Bug', icon: '🐛' },
  { value: 'ui_ux', label: 'Interface', icon: '🎨' },
  { value: 'content', label: 'Conteúdo', icon: '📚' },
  { value: 'performance', label: 'Performance', icon: '⚡' },
  { value: 'other', label: 'Outro', icon: '💬' },
];

export default function SupportWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: WELCOME_MESSAGE },
  ]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCsat, setShowCsat] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Feedback form state
  const [fbCategory, setFbCategory] = useState<string>('improvement');
  const [fbTitle, setFbTitle] = useState('');
  const [fbContent, setFbContent] = useState('');
  const [fbSending, setFbSending] = useState(false);
  const [fbSent, setFbSent] = useState(false);

  // CSAT state
  const [csatRating, setCsatRating] = useState<number>(0);
  const [csatComment, setCsatComment] = useState('');
  const [csatResolved, setCsatResolved] = useState<boolean | null>(null);
  const [csatSending, setCsatSending] = useState(false);

  // Auto-scroll on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  // Listen for programmatic open events (e.g., from sidebar button)
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-support-widget', handler);
    return () => window.removeEventListener('open-support-widget', handler);
  }, []);

  // Hide FAB when a contextual chat (ContextChat) is open, to avoid overlapping widgets
  const [contextChatOpen, setContextChatOpen] = useState(false);
  useEffect(() => {
    const onOpen = () => setContextChatOpen(true);
    const onClose = () => setContextChatOpen(false);
    window.addEventListener('context-chat-opened', onOpen);
    window.addEventListener('context-chat-closed', onClose);
    return () => {
      window.removeEventListener('context-chat-opened', onOpen);
      window.removeEventListener('context-chat-closed', onClose);
    };
  }, []);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || sending || !user) return;

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(newMessages);
    setInput('');
    setSending(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('support-chat', {
        body: {
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          conversationId,
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      const reply: string = data?.reply ?? '';
      const convId: string | null = data?.conversationId ?? null;
      if (convId && !conversationId) setConversationId(convId);

      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : `Tivemos um problema. Escreva para ${SUPPORT_EMAIL}`;
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Desculpe, tive um problema técnico. Por favor, escreva direto para **${SUPPORT_EMAIL}** e retornamos em até 24h úteis.`,
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, sending, user, messages, conversationId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      sendMessage();
    }
  };

  const submitFeedback = useCallback(async () => {
    if (!user || !fbContent.trim() || fbSending) return;
    setFbSending(true);
    try {
      const { error: insertError } = await (supabase.from('support_feedback' as any) as any).insert({
        user_id: user.id,
        category: fbCategory,
        title: fbTitle.trim() || null,
        content: fbContent.trim(),
        page_url: window.location.pathname,
      });
      if (insertError) throw insertError;
      setFbSent(true);
      setFbTitle('');
      setFbContent('');
      setTimeout(() => setFbSent(false), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao enviar feedback');
    } finally {
      setFbSending(false);
    }
  }, [user, fbCategory, fbTitle, fbContent, fbSending]);

  const submitCsat = useCallback(async () => {
    if (!user || csatRating === 0 || csatSending) return;
    setCsatSending(true);
    try {
      await (supabase.from('csat_responses' as any) as any).insert({
        user_id: user.id,
        conversation_id: conversationId,
        rating: csatRating,
        comment: csatComment.trim() || null,
        resolved: csatResolved,
      });
      // Close conversation
      if (conversationId) {
        await (supabase
          .from('support_conversations' as any) as any)
          .update({ status: csatResolved ? 'resolved' : 'escalated', closed_at: new Date().toISOString() })
          .eq('id', conversationId);
      }
      setShowCsat(false);
      setOpen(false);
      // Reset for next session
      setTimeout(() => {
        setMessages([{ role: 'assistant', content: WELCOME_MESSAGE }]);
        setConversationId(null);
        setCsatRating(0);
        setCsatComment('');
        setCsatResolved(null);
      }, 300);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao enviar avaliação');
    } finally {
      setCsatSending(false);
    }
  }, [user, csatRating, csatComment, csatResolved, conversationId, csatSending]);

  const handleClose = () => {
    // If there was an actual conversation (more than just welcome), ask CSAT
    const hasConversation = messages.length > 1 && conversationId;
    if (hasConversation && !showCsat) {
      setShowCsat(true);
    } else {
      setOpen(false);
    }
  };

  // Don't render if user not authenticated
  if (!user) return null;

  return (
    <>
      {/* Floating button */}
      {!open && !contextChatOpen && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[90] h-14 w-14 rounded-full bg-[#006D5B] text-white shadow-2xl shadow-[#006D5B]/30 flex items-center justify-center hover:bg-[#005344] hover:scale-105 active:scale-95 transition-all duration-200 group"
          aria-label="Abrir suporte"
        >
          <MessageCircle className="h-6 w-6 group-hover:rotate-[-8deg] transition-transform" />
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#C9A84C] ring-2 ring-white animate-pulse" />
        </button>
      )}

      {/* Widget panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-[90] w-[min(calc(100vw-2.5rem),400px)] h-[min(calc(100vh-2.5rem),640px)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-fade-up">
          {/* Header */}
          <div className="bg-gradient-to-br from-[#006D5B] to-[#005344] text-white px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-[#C9A84C]" />
              </div>
              <div>
                <p className="font-bold text-sm font-['Manrope']">Suporte PreceptorMED</p>
                <p className="text-[11px] text-white/70 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400 inline-block" />
                  Assistente PreceptorMED online
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="h-8 w-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b border-slate-100 flex">
            <button
              onClick={() => setTab('chat')}
              className={`flex-1 py-3 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                tab === 'chat'
                  ? 'text-[#006D5B] border-b-2 border-[#006D5B]'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Chat
            </button>
            <button
              onClick={() => setTab('feedback')}
              className={`flex-1 py-3 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                tab === 'feedback'
                  ? 'text-[#006D5B] border-b-2 border-[#006D5B]'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Lightbulb className="h-3.5 w-3.5" />
              Feedback
            </button>
          </div>

          {/* Content */}
          {tab === 'chat' && !showCsat && (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                        m.role === 'user'
                          ? 'bg-[#006D5B] text-white rounded-br-md'
                          : 'bg-white text-slate-800 rounded-bl-md shadow-sm border border-slate-100'
                      }`}
                    >
                      {m.role === 'assistant' ? (
                        <div className="prose prose-sm max-w-none prose-headings:font-['Manrope'] prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-strong:text-[#005344]">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <div className="bg-white rounded-2xl rounded-bl-md px-3.5 py-2.5 shadow-sm border border-slate-100 flex items-center gap-1">
                      <span className="h-2 w-2 bg-[#006D5B]/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="h-2 w-2 bg-[#006D5B]/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="h-2 w-2 bg-[#006D5B]/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="border-t border-slate-100 p-3 bg-white">
                {error && (
                  <div className="mb-2 text-[11px] text-red-600 bg-red-50 rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}
                <div className="flex gap-2 items-end">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Digite sua mensagem..."
                    rows={1}
                    className="flex-1 resize-none text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#006D5B] focus:ring-1 focus:ring-[#006D5B]/20 outline-none px-3.5 py-2.5 max-h-24"
                    disabled={sending}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || sending}
                    className="h-10 w-10 rounded-xl bg-[#006D5B] text-white flex items-center justify-center hover:bg-[#005344] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-[#006D5B] transition-colors"
                >
                  <Mail className="h-3 w-3" />
                  Não resolveu? Fale direto com a equipe: {SUPPORT_EMAIL}
                </a>
              </div>
            </>
          )}

          {/* CSAT form */}
          {tab === 'chat' && showCsat && (
            <div className="flex-1 overflow-y-auto p-5 bg-slate-50 space-y-4">
              <div className="text-center space-y-1">
                <div className="inline-flex rounded-full bg-[#006D5B]/10 p-3 mb-1">
                  <Star className="h-6 w-6 text-[#006D5B] fill-[#006D5B]" />
                </div>
                <h3 className="text-base font-bold text-slate-900 font-['Manrope']">
                  Como foi seu atendimento?
                </h3>
                <p className="text-xs text-slate-500">Sua avaliação nos ajuda a melhorar.</p>
              </div>

              {/* Rating */}
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((r) => (
                  <button
                    key={r}
                    onClick={() => setCsatRating(r)}
                    className={`h-11 w-11 rounded-xl border-2 transition-all ${
                      csatRating >= r
                        ? 'bg-[#C9A84C] border-[#C9A84C] text-white scale-110'
                        : 'bg-white border-slate-200 text-slate-300 hover:border-slate-300'
                    }`}
                    aria-label={`${r} estrelas`}
                  >
                    <Star className={`h-5 w-5 mx-auto ${csatRating >= r ? 'fill-white' : ''}`} />
                  </button>
                ))}
              </div>

              {/* Resolved */}
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2 text-center">
                  Seu problema foi resolvido?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setCsatResolved(true)}
                    className={`py-2.5 text-xs font-semibold rounded-xl border-2 transition-all ${
                      csatResolved === true
                        ? 'bg-green-50 border-green-500 text-green-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    ✅ Sim, resolvido
                  </button>
                  <button
                    onClick={() => setCsatResolved(false)}
                    className={`py-2.5 text-xs font-semibold rounded-xl border-2 transition-all ${
                      csatResolved === false
                        ? 'bg-orange-50 border-orange-500 text-orange-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    ❌ Ainda não
                  </button>
                </div>
              </div>

              <textarea
                value={csatComment}
                onChange={(e) => setCsatComment(e.target.value)}
                placeholder="Comentário (opcional)..."
                rows={3}
                className="w-full text-sm rounded-xl border border-slate-200 bg-white focus:border-[#006D5B] focus:ring-1 focus:ring-[#006D5B]/20 outline-none px-3.5 py-2.5 resize-none"
              />

              {csatResolved === false && (
                <div className="text-[11px] text-slate-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Vamos encaminhar para nossa equipe. Retornaremos em até 24h úteis no email cadastrado.
                  Você também pode escrever direto para <strong>{SUPPORT_EMAIL}</strong>.
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowCsat(false)}
                  className="flex-1 py-2.5 text-xs font-semibold text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  Voltar ao chat
                </button>
                <button
                  onClick={submitCsat}
                  disabled={csatRating === 0 || csatSending}
                  className="flex-1 py-2.5 text-xs font-semibold text-white bg-[#006D5B] rounded-xl hover:bg-[#005344] disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5"
                >
                  {csatSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Enviar avaliação'}
                </button>
              </div>
            </div>
          )}

          {/* Feedback tab */}
          {tab === 'feedback' && (
            <div className="flex-1 overflow-y-auto p-5 bg-slate-50 space-y-4">
              {fbSent ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-10">
                  <div className="h-14 w-14 rounded-full bg-green-50 flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 font-['Manrope']">Obrigado pelo feedback!</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Sua sugestão será analisada pela equipe. 💚
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Lightbulb className="h-4 w-4 text-[#C9A84C]" />
                      <p className="text-sm font-bold text-slate-900 font-['Manrope']">
                        Sugira uma melhoria
                      </p>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      O que você gostaria que fosse diferente no PreceptorMED? Sua opinião direciona
                      nossa próxima atualização.
                    </p>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider block mb-2">
                      Categoria
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {FEEDBACK_CATEGORIES.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => setFbCategory(c.value)}
                          className={`text-xs px-2.5 py-2 rounded-lg border transition-all text-left ${
                            fbCategory === c.value
                              ? 'border-[#006D5B] bg-[#006D5B]/5 text-[#005344] font-semibold'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <span className="mr-1.5">{c.icon}</span>
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider block mb-1.5">
                      Título (opcional)
                    </label>
                    <input
                      type="text"
                      value={fbTitle}
                      onChange={(e) => setFbTitle(e.target.value)}
                      placeholder="Ex: Adicionar modo escuro"
                      className="w-full text-sm rounded-xl border border-slate-200 bg-white focus:border-[#006D5B] focus:ring-1 focus:ring-[#006D5B]/20 outline-none px-3.5 py-2.5"
                      maxLength={120}
                    />
                  </div>

                  {/* Content */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider block mb-1.5">
                      Descrição
                    </label>
                    <textarea
                      value={fbContent}
                      onChange={(e) => setFbContent(e.target.value)}
                      placeholder="Conte com detalhes o que você gostaria de ver..."
                      rows={5}
                      className="w-full text-sm rounded-xl border border-slate-200 bg-white focus:border-[#006D5B] focus:ring-1 focus:ring-[#006D5B]/20 outline-none px-3.5 py-2.5 resize-none"
                      maxLength={2000}
                    />
                    <p className="text-[10px] text-slate-400 mt-1 text-right">
                      {fbContent.length}/2000
                    </p>
                  </div>

                  <button
                    onClick={submitFeedback}
                    disabled={!fbContent.trim() || fbSending}
                    className="w-full py-3 text-sm font-semibold text-white bg-[#006D5B] rounded-xl hover:bg-[#005344] disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                  >
                    {fbSending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Enviar feedback
                      </>
                    )}
                  </button>

                  {error && (
                    <div className="text-[11px] text-red-600 bg-red-50 rounded-lg px-3 py-2">
                      {error}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
