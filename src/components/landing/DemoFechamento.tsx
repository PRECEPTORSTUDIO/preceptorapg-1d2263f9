/**
 * "Experimente sem cadastro" — widget interativo da landing.
 *
 * Tráfego frio (IG/FB, mobile) não cria conta numa visita de 3s. Aqui a pessoa
 * digita um tema e vê um fechamento REAL gerado na hora (edge function pública
 * demo-fechamento, rate-limited). Depois do "wow", o CTA pede o cadastro.
 */

import { useState } from "react";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { Loader2, Sparkles, ArrowRight, Lock } from "lucide-react";

const URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/demo-fechamento`;
const API_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const EXEMPLOS = ["Insuficiência cardíaca", "Cetoacidose diabética", "Sepse", "AVC isquêmico", "Pneumonia (PAC)"];

export default function DemoFechamento({ onSignup }: { onSignup: () => void }) {
  const [tema, setTema] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [resultTema, setResultTema] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const gerar = async (t?: string) => {
    const tema_ = (t ?? tema).trim();
    if (tema_.length < 3) { setErro("Digite um tema — ex: Insuficiência cardíaca."); return; }
    setLoading(true); setErro(null); setResult(null);
    try {
      const res = await fetch(URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: API_KEY, Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify({ tema: tema_ }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErro(data.message || "Não consegui gerar agora. Tente de novo em instantes.");
      } else {
        setResult(data.markdown);
        setResultTema(data.tema || tema_);
        try { (window as { fbq?: (...a: unknown[]) => void }).fbq?.("track", "Lead", { content_name: "demo_fechamento" }); } catch { /* sem pixel */ }
      }
    } catch {
      setErro("Erro de conexão. Tente de novo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section data-section="demo" id="experimente" className="relative py-14 sm:py-24 bg-white border-t border-slate-100 overflow-hidden">
      <div className="absolute -top-24 -right-24 w-[26rem] h-[26rem] rounded-full bg-brand-primary/[0.05] blur-3xl pointer-events-none" />
      <div className="relative max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-7 sm:mb-9">
          <p className="text-[11px] font-semibold text-brand-primary-dark uppercase tracking-[0.2em] mb-3 inline-flex items-center gap-2">
            <span className="w-8 h-px bg-brand-gold" />
            Veja funcionando · sem cadastro
            <span className="w-8 h-px bg-brand-gold" />
          </p>
          <h2 className="text-2xl sm:text-4xl font-bold leading-tight text-brand-ink" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Digite um tema. Veja um fechamento <span className="text-brand-primary">real em segundos</span>.
          </h2>
          <p className="text-sm sm:text-base text-slate-600 mt-3 max-w-xl mx-auto">
            Sem criar conta, sem cartão. É só pra você sentir a profundidade antes de decidir.
          </p>
        </div>

        {/* Input */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={tema}
            onChange={(e) => setTema(e.target.value.slice(0, 120))}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229 && !loading) gerar(); }}
            disabled={loading}
            placeholder="Ex: Insuficiência cardíaca, cetoacidose diabética…"
            className="flex-1 px-4 py-3.5 rounded-xl border-2 border-slate-200 bg-slate-50/60 text-[15px] text-brand-ink placeholder:text-slate-400 outline-none focus:border-brand-primary focus:bg-white focus:ring-4 focus:ring-brand-primary/10 transition-all disabled:opacity-60"
          />
          <button
            onClick={() => gerar()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-brand-primary-dark text-white text-[15px] font-bold rounded-xl hover:bg-brand-primary-darker active:scale-[0.98] transition-all shadow-[0_8px_24px_-8px_rgba(0,109,91,0.45)] disabled:opacity-70 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando…</> : <><Sparkles className="w-4 h-4 text-brand-gold" /> Gerar grátis</>}
          </button>
        </div>

        {/* Chips de exemplo */}
        {!result && !loading && (
          <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
            <span className="text-[12px] text-slate-400 mr-1 self-center">Ou tente:</span>
            {EXEMPLOS.map((ex) => (
              <button key={ex} onClick={() => { setTema(ex); gerar(ex); }}
                className="px-2.5 py-1 rounded-full border border-slate-200 text-[12px] font-medium text-slate-600 hover:border-brand-primary hover:text-brand-primary-dark transition-colors">
                {ex}
              </button>
            ))}
          </div>
        )}

        {erro && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13.5px] text-amber-800 flex items-center justify-between gap-3 flex-wrap">
            <span>{erro}</span>
            <button onClick={onSignup} className="font-semibold text-brand-primary-dark hover:underline whitespace-nowrap">Criar conta grátis →</button>
          </div>
        )}

        {loading && (
          <div className="mt-6 rounded-2xl border border-slate-200 p-6 sm:p-8">
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-4"><Loader2 className="w-4 h-4 animate-spin text-brand-primary" /> Escrevendo seu fechamento…</div>
            <div className="space-y-2.5 animate-pulse">
              {[92, 80, 88, 70, 84, 60].map((w, i) => <div key={i} className="h-3 rounded bg-slate-100" style={{ width: `${w}%` }} />)}
            </div>
          </div>
        )}

        {/* Resultado */}
        {result && !loading && (
          <div className="mt-6 animate-fade-up">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_-12px_rgba(0,109,91,0.18)] overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50/70">
                <span className="text-[12.5px] font-semibold text-slate-500 truncate">Fechamento · {resultTema}</span>
                <span className="text-[10px] font-extrabold text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded-full shrink-0">amostra grátis</span>
              </div>
              <div className="px-5 sm:px-7 py-5 max-h-[460px] overflow-y-auto">
                <MarkdownRenderer content={result} variant="rich" />
              </div>
            </div>

            {/* CTA pós-wow */}
            <div className="mt-4 rounded-2xl bg-gradient-to-br from-brand-primary-dark to-brand-primary p-5 sm:p-6 text-center text-white">
              <p className="text-[15px] sm:text-base font-semibold mb-1" style={{ fontFamily: "'Manrope', sans-serif" }}>
                Esse foi um exemplo reduzido. Imagina o completo.
              </p>
              <p className="text-[13px] text-white/80 mb-4 max-w-md mx-auto">
                Crie sua conta grátis e gere fechamentos completos (com cascata e PubMed), simulados e flashcards — <strong className="text-white">3 dias grátis, sem cartão</strong>.
              </p>
              <button onClick={onSignup}
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-white text-brand-primary-dark rounded-xl text-[15px] font-bold hover:bg-slate-50 active:scale-[0.98] transition-all shadow-lg">
                Começar 3 dias grátis <ArrowRight className="w-4 h-4 text-brand-gold" />
              </button>
              <p className="mt-3 text-[11.5px] text-white/60 inline-flex items-center gap-1.5 justify-center"><Lock className="w-3 h-3" /> Leva 30 segundos · cancele quando quiser</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
