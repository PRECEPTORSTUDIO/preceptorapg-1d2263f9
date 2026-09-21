import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { Send, Bot, User, MessageCircle, X, Sparkles, Copy, Check, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ContextChatProps {
  context: string;
  contextLabel?: string;
  suggestions?: string[];
}

const DEFAULT_SUGGESTIONS = [
  'Resuma os pontos principais',
  'O que eu preciso memorizar?',
  'Explique o primeiro tópico com mais detalhes',
  'Quais são as aplicações clínicas?',
];

const ContextChat = ({ context, contextLabel = 'conteúdo gerado', suggestions = DEFAULT_SUGGESTIONS }: ContextChatProps) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Scroll only within the chat container, not the page
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    setMessages([]);
  }, [context]);

  // Allow opening programmatically via CustomEvent from anywhere in the page
  // (e.g., the "Dúvidas Clínicas?" card in Dashboard)
  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener('open-context-chat', handler);
    return () => window.removeEventListener('open-context-chat', handler);
  }, []);

  // Broadcast open/close state so other widgets (e.g., SupportWidget) can hide
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(isOpen ? 'context-chat-opened' : 'context-chat-closed'));
    return () => {
      if (isOpen) window.dispatchEvent(new CustomEvent('context-chat-closed'));
    };
  }, [isOpen]);

  const stripMarkdown = (md: string) =>
    md.replace(/#{1,6}\s?/g, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/`(.+?)`/g, '$1').replace(/---/g, '').replace(/- /g, '• ').trim();

  const handleCopy = useCallback(async (msg: ChatMessage) => {
    await navigator.clipboard.writeText(stripMarkdown(msg.content));
    setCopiedId(msg.id);
    toast({ title: 'Copiado!' });
    setTimeout(() => setCopiedId(null), 2000);
  }, [toast]);

  const streamChat = useCallback(async (userMessage: string) => {
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: userMessage };
    const assistantId = crypto.randomUUID();

    setMessages(prev => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }]);
    setIsStreaming(true);
    setInput('');

    // Prepend the context as a fake "first turn" (user message + assistant
    // acknowledgement). This gives the AI the reference content on EVERY
    // request while keeping strict user/model alternation — which the ai-chat
    // edge function expects.
    //
    // We don't send a 'system' role because the ai-chat edge function already
    // sends its own system prompt to the Claude API.
    const contextIntro = `Estou revisando o ${contextLabel} abaixo e vou te fazer perguntas sobre o tema. Use o resumo como CONTEXTO PRINCIPAL da conversa — ele mostra qual tópico estou estudando e qual o recorte dado. Mas NÃO se limite a só repetir o que está no resumo: como você é o PreceptorMED, pode e DEVE complementar com seu conhecimento médico completo quando eu perguntar sobre:

- Pontos que mais caem em prova/residência sobre o tema
- Correlações clínicas, pérolas, mnemônicos, dicas de raciocínio
- Detalhes que o resumo não cobriu mas são importantes
- Diagnósticos diferenciais, mecanismos moleculares, farmacologia
- Casos clínicos e aplicações práticas

Quando eu perguntar sobre um item numerado específico do resumo (ex: "item 2.2"), localize esse item e responda sobre ele citando o título/subtítulo. Nas outras perguntas, mantenha o tema do resumo como eixo central e expanda com profundidade acadêmica. Seja conciso, didático e técnico, com termos-chave em **negrito**.

--- RESUMO DE REFERÊNCIA ---
${context}
--- FIM DO RESUMO ---`;

    const allMessages = [
      { role: 'user' as const, content: contextIntro },
      { role: 'assistant' as const, content: 'Entendi. Vou usar o resumo como contexto principal e complementar com meu conhecimento médico completo para te ajudar com pontos de prova, pérolas clínicas, correlações e tudo mais que for útil para o seu estudo.' },
      ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: userMessage },
    ];

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada');

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ messages: allMessages }),
          signal: controller.signal,
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.meta?.finish_reason === 'ERROR' || parsed.meta?.finish_reason === 'SAFETY') {
              throw new Error(parsed.meta.message ?? 'Erro ao processar sua pergunta.');
            }
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev =>
                prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m)
              );
            }
          } catch { /* partial json */ }
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
      const message = e instanceof Error ? e.message : 'Erro ao processar sua pergunta.';
      setMessages(prev => [
        ...prev.filter(m => m.id !== assistantId),
        { id: assistantId, role: 'assistant', content: `⚠️ ${message}` },
      ]);
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [context, contextLabel, messages]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isStreaming) return;
    streamChat(input.trim());
  }, [input, isStreaming, streamChat]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const clearChat = useCallback(() => {
    if (isStreaming) abortRef.current?.abort();
    setMessages([]);
    setIsStreaming(false);
  }, [isStreaming]);

  // --- Closed state ---
  if (!isOpen) {
    return (
      <>
        {/* Mobile: floating button with pulse */}
        <motion.button
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          onClick={() => setIsOpen(true)}
          className="fixed right-4 bottom-4 z-[100] h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center lg:hidden"
          title="Tirar dúvidas"
        >
          <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-30" />
          <MessageCircle className="h-6 w-6 relative" />
        </motion.button>

        {/* Desktop: vertical tab fixed to the right edge of the viewport */}
        <motion.button
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3, type: 'spring', damping: 25 }}
          onClick={() => setIsOpen(true)}
          className="hidden lg:flex fixed right-0 top-1/2 -translate-y-1/2 z-[100] flex-col items-center justify-center gap-2 w-11 py-6 rounded-l-2xl border border-r-0 border-primary/30 bg-white shadow-xl shadow-primary/10 hover:bg-primary/5 hover:border-primary/50 hover:w-12 transition-all cursor-pointer group"
        >
          <div className="relative">
            <MessageCircle className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
          </div>
          <span className="text-[10px] font-semibold text-primary/80 group-hover:text-primary transition-colors" style={{ writingMode: 'vertical-rl' }}>
            Tire Dúvidas
          </span>
        </motion.button>
      </>
    );
  }

  const isEmpty = messages.length === 0;

  // --- Open state ---
  return (
    <>
      {/* Mobile: full-screen overlay */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-0 z-[100] bg-background flex flex-col lg:hidden"
      >
        <ChatContent
          isEmpty={isEmpty}
          messages={messages}
          isStreaming={isStreaming}
          copiedId={copiedId}
          input={input}
          setInput={setInput}
          contextLabel={contextLabel}
          scrollContainerRef={scrollContainerRef}
          messagesEndRef={messagesEndRef}
          onClose={() => setIsOpen(false)}
          onSend={handleSend}
          onKeyDown={handleKeyDown}
          onCopy={handleCopy}
          onClear={clearChat}
          onSuggestion={streamChat}
          suggestions={suggestions}
        />
      </motion.div>

      {/* Desktop: slide-in side panel fixed to the right edge of viewport */}
      <>
        {/* Subtle backdrop on desktop to focus attention on the chat */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => setIsOpen(false)}
          className="hidden lg:block fixed inset-0 z-[99] bg-black/40 backdrop-blur-[3px] cursor-pointer"
        />
        <motion.div
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 260 }}
          className="hidden lg:flex fixed right-0 top-0 bottom-0 z-[100] w-[420px] bg-white shadow-2xl shadow-black/20 border-l border-slate-200 flex-col overflow-hidden"
        >
          <ChatContent
            isEmpty={isEmpty}
            messages={messages}
            isStreaming={isStreaming}
            copiedId={copiedId}
            input={input}
            setInput={setInput}
            contextLabel={contextLabel}
            scrollContainerRef={scrollContainerRef}
            messagesEndRef={messagesEndRef}
            onClose={() => setIsOpen(false)}
            onSend={handleSend}
            onKeyDown={handleKeyDown}
            onCopy={handleCopy}
            onClear={clearChat}
            onSuggestion={streamChat}
            suggestions={suggestions}
          />
        </motion.div>
      </>
    </>
  );
};

// --- Extracted inner content to avoid duplication ---
interface ChatContentProps {
  isEmpty: boolean;
  messages: ChatMessage[];
  isStreaming: boolean;
  copiedId: string | null;
  input: string;
  setInput: (v: string) => void;
  contextLabel: string;
  suggestions: string[];
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onClose: () => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onCopy: (msg: ChatMessage) => void;
  onClear: () => void;
  onSuggestion: (s: string) => void;
}

const ChatContent = ({
  isEmpty, messages, isStreaming, copiedId, input, setInput,
  contextLabel, suggestions, scrollContainerRef, messagesEndRef,
  onClose, onSend, onKeyDown, onCopy, onClear, onSuggestion,
}: ChatContentProps) => (
  <>
    {/* Header */}
    <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/20">
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div>
          <span className="text-sm font-semibold">Tire Dúvidas</span>
          <p className="text-[10px] text-muted-foreground leading-none">sobre o {contextLabel}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {!isEmpty && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onClear} title="Limpar chat">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>

    {/* Messages — own scroll container, isolated from page */}
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto overscroll-contain min-h-0"
    >
      <div className="px-4 py-4 space-y-4">
        {isEmpty ? (
          <div className="text-center py-10 px-4">
            <Sparkles className="h-10 w-10 text-primary/30 mx-auto mb-4" />
            <p className="text-base font-medium text-foreground/80 mb-2">
              Dúvidas sobre o conteúdo?
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Pergunte e o PreceptorMED responde com base no {contextLabel}.
            </p>
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => onSuggestion(s)}
                  style={{ animationDelay: `${i * 0.06}s` }}
                  className="w-full text-left p-3 rounded-xl border border-slate-100 bg-white hover:bg-emerald-50 hover:border-emerald-200 transition-all duration-200 active:scale-[0.98] text-sm text-slate-500 hover:text-emerald-800 shadow-sm animate-fade-up"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map(m => (
              <div
                key={m.id}
                className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'assistant' && (
                  <div className="shrink-0 h-7 w-7 rounded-lg bg-primary/20 flex items-center justify-center mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div className={`max-w-[88%] group/msg ${
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5'
                    : 'bg-secondary/30 border border-border/30 rounded-2xl rounded-bl-md px-4 py-2.5'
                }`}>
                  {m.role === 'assistant' ? (
                    <>
                      {!m.content && isStreaming && m.id === messages[messages.length - 1]?.id && (
                        <div className="flex items-center gap-2 py-2">
                          <span className="h-2 w-2 rounded-full bg-primary animate-[wave_1.2s_ease-in-out_infinite]" />
                          <span className="h-2 w-2 rounded-full bg-primary animate-[wave_1.2s_ease-in-out_0.2s_infinite]" />
                          <span className="h-2 w-2 rounded-full bg-primary animate-[wave_1.2s_ease-in-out_0.4s_infinite]" />
                        </div>
                      )}
                      {m.content && (
                        <div className="prose prose-sm max-w-none text-sm">
                          <MarkdownRenderer content={m.content} isTyping={isStreaming && m.id === messages[messages.length - 1]?.id} />
                        </div>
                      )}
                      {m.content && !(isStreaming && m.id === messages[messages.length - 1]?.id) && (
                        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/10 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] gap-1" onClick={() => onCopy(m)}>
                            {copiedId === m.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            {copiedId === m.id ? 'Copiado' : 'Copiar'}
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
                {m.role === 'user' && (
                  <div className="shrink-0 h-7 w-7 rounded-lg bg-muted flex items-center justify-center mt-0.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
    </div>

    {/* Input */}
    <div className="shrink-0 border-t border-border/20 p-3">
      <div className="flex gap-2 items-end">
        <Textarea
          placeholder="Pergunte sobre o conteúdo..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          className="flex-1 min-h-[40px] max-h-[100px] resize-none text-sm"
          rows={1}
          disabled={isStreaming}
        />
        <button
          onClick={onSend}
          disabled={!input.trim() || isStreaming}
          className="shrink-0 h-10 w-10 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90 disabled:opacity-40 hover:brightness-110"
          style={{ background: 'linear-gradient(135deg, #126b62, #005e56)' }}
        >
          <Send className="h-4 w-4 text-[#e2fff9]" />
        </button>
      </div>
    </div>
  </>
);

export default ContextChat;
