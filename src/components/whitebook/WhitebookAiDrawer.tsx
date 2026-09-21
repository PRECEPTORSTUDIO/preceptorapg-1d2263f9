import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wand2, X, Send, Loader2, Sparkles, AlertTriangle } from "lucide-react";

const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wb-ask-ai`;

export type Scope =
  | { type: "drug"; id: string; label: string }
  | { type: "protocol"; id: string; label: string }
  | { type: "calculator"; id: string; label: string }
  | { type: "icd"; id: string; label: string }
  | null;

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  scope: Scope;
  open: boolean;
  onClose: () => void;
}

const SUGGESTIONS_BY_TYPE: Record<string, string[]> = {
  drug: [
    "Qual a dose pediátrica?",
    "Posso usar na gestação?",
    "Quais interações relevantes?",
    "Tem ajuste renal?",
  ],
  protocol: [
    "Qual o primeiro passo?",
    "Quais red flags devo observar?",
    "Quais exames pedir?",
    "Quando escalonar?",
  ],
  calculator: [
    "Como interpretar o resultado?",
    "Quando usar este escore?",
    "Existe limitação conhecida?",
    "Diferença para escores similares?",
  ],
  icd: [
    "Quais sintomas típicos?",
    "Quais exames investigar?",
    "Conduta inicial?",
    "Diagnóstico diferencial?",
  ],
};

const WhitebookAiDrawer = ({ scope, open, onClose }: Props) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reseta mensagens ao trocar de scope ou ao fechar
  useEffect(() => {
    if (!open) return;
    setMessages([]);
    setInput("");
    setError(null);
  }, [scope?.type, scope?.id, open]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || streaming) return;
    setError(null);
    const userMsg: Message = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages([...newMessages, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Sessão expirada");

      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: text.trim(),
          scope_type: scope?.type,
          scope_id: scope?.id,
          history: messages,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error ?? `Erro ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let leftover = "";
      let accumulated = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const txt = leftover + decoder.decode(value, { stream: true });
          const lines = txt.split("\n");
          leftover = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const jsonStr = trimmed.slice(6).trim();
            if (!jsonStr || jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.meta?.finish_reason === "ERROR" || parsed.meta?.finish_reason === "SAFETY") {
                throw new Error(parsed.meta.message ?? "Erro ao consultar a IA.");
              }
              const c = parsed.choices?.[0]?.delta?.content;
              if (c) {
                accumulated += c;
                setMessages((prev) => {
                  const copy = [...prev];
                  copy[copy.length - 1] = { role: "assistant", content: accumulated };
                  return copy;
                });
              }
            } catch {
              /* partial */
            }
          }
        }
      }
    } catch (e) {
      setError((e as Error).message);
      setMessages((prev) => prev.slice(0, -1)); // remove placeholder
    } finally {
      setStreaming(false);
    }
  };

  if (!open) return null;

  const suggestions = scope ? SUGGESTIONS_BY_TYPE[scope.type] ?? [] : [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed top-0 right-0 z-50 h-full w-full sm:w-[460px] bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-start gap-3 shrink-0">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-[#005344]/15 to-[#C9A84C]/15 flex items-center justify-center">
            <Wand2 className="w-5 h-5 text-[#005344]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#8a6f26]">
              Pergunte ao PreceptorMED
            </p>
            <h3 className="font-['Manrope'] font-bold text-base text-[#191C1D] truncate">
              {scope?.label ?? "PreceptorBook"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-[#4a5568] hover:bg-slate-100 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {messages.length === 0 ? (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#005344]/4 to-[#C9A84C]/4 border-l-3 border-[#C9A84C]">
                <p className="text-xs text-[#191C1D] leading-relaxed">
                  Faço perguntas em linguagem natural sobre {scope ? "este item" : "o conteúdo do PreceptorBook"}.
                  Respondo apenas com base em fontes públicas que estão na base.
                </p>
              </div>
              {suggestions.length > 0 && (
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#94a3b8] mb-2">
                    Sugestões
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="px-3 h-8 rounded-full text-xs font-semibold bg-slate-100 text-[#4a5568] hover:bg-slate-200 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={`${m.role === "user" ? "flex justify-end" : ""}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-[#005344] text-white"
                      : "bg-slate-50 border border-slate-100 text-[#191C1D] whitespace-pre-wrap"
                  }`}
                >
                  {m.content || (
                    streaming && i === messages.length - 1 ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#005344]" />
                    ) : null
                  )}
                </div>
              </div>
            ))
          )}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
              <p className="text-xs text-red-900">{error}</p>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-100 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              disabled={streaming}
              rows={1}
              placeholder="Pergunte algo…"
              className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#005344] focus:ring-2 focus:ring-[#005344]/15 resize-none max-h-32"
              style={{ minHeight: "42px" }}
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-[#003D32] via-[#005344] to-[#006D5B] text-white inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {streaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
          <p className="text-[10px] text-[#94a3b8] mt-2 inline-flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            PreceptorMED pode errar. Sempre confirme com a bula/diretriz.
          </p>
        </div>
      </div>
    </>
  );
};

export default WhitebookAiDrawer;
