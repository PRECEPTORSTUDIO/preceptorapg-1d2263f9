import { useRef, useState } from 'react';
import GenerationProgress from '@/components/GenerationProgress';
import type { GenerationMode } from './ModeToggle';
import type { AttachedArticle } from '@/pages/Dashboard';
import { Loader2, Sparkles, ArrowRight, FileText, Paperclip, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface InputPanelProps {
  tema: string;
  setTema: (value: string) => void;
  objetivos: string;
  setObjetivos: (value: string) => void;
  modo: GenerationMode;
  setModo: (value: GenerationMode) => void;
  tamanho: 'completo' | 'reduzido';
  setTamanho: (value: 'completo' | 'reduzido') => void;
  secoes: Record<string, boolean>;
  setSecoes: (value: Record<string, boolean>) => void;
  artigos: AttachedArticle[];
  setArtigos: (value: AttachedArticle[]) => void;
  generating: boolean;
  hasStartedReceiving: boolean;
  isComplete: boolean;
  onGenerate: () => void;
  canGenerate?: boolean;
  cooldown?: boolean;
}

const MAX_ARTIGOS = 3;
const MAX_ARTIGO_SIZE_MB = 5;

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip "data:application/pdf;base64," prefix
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const MAX_TEMA_LENGTH = 500;
const MAX_OBJETIVOS_LENGTH = 2000;

const SECTION_GROUPS: {
  title: string;
  items: { key: string; label: string }[];
}[] = [
  {
    title: 'Bases morfofuncionais',
    items: [
      { key: 'anatomia', label: 'Anatomia' },
      { key: 'histologia', label: 'Histologia' },
      { key: 'fisiologia', label: 'Fisiologia' },
      { key: 'embriologia', label: 'Embriologia' },
      { key: 'revisao_geral', label: 'Revisão geral' },
    ],
  },
  {
    title: 'Conteúdo clínico',
    items: [
      { key: 'nosologia', label: 'Classificação' },
      { key: 'epidemiologia', label: 'Epidemiologia' },
      { key: 'etiologia', label: 'Etiologia' },
      { key: 'fisiopatologia', label: 'Fisiopatologia' },
      { key: 'manifestacoes', label: 'Manifestações' },
      { key: 'diagnostico_exames', label: 'Diagnóstico e exames' },
      { key: 'tratamento', label: 'Tratamento' },
      { key: 'prognostico', label: 'Prognóstico' },
      { key: 'prevencao', label: 'Prevenção' },
    ],
  },
];

const InputPanel = ({
  tema, setTema, objetivos, setObjetivos,
  modo, setModo, tamanho, setTamanho, secoes, setSecoes,
  artigos, setArtigos,
  generating, hasStartedReceiving,
  isComplete, onGenerate, canGenerate = true, cooldown = false,
}: InputPanelProps) => {
  if (modo !== 'fechamento') {
    setModo('fechamento');
  }

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const remaining = MAX_ARTIGOS - artigos.length;
    if (remaining <= 0) {
      toast({
        title: 'Limite atingido',
        description: `Máximo de ${MAX_ARTIGOS} artigos por geração.`,
        variant: 'destructive',
      });
      return;
    }
    const filesToProcess = Array.from(fileList).slice(0, remaining);
    setUploading(true);
    try {
      const novos: AttachedArticle[] = [];
      for (const file of filesToProcess) {
        if (file.type !== 'application/pdf') {
          toast({
            title: 'Tipo não suportado',
            description: `"${file.name}" não é PDF. Apenas arquivos .pdf são aceitos.`,
            variant: 'destructive',
          });
          continue;
        }
        if (file.size > MAX_ARTIGO_SIZE_MB * 1024 * 1024) {
          toast({
            title: 'Arquivo muito grande',
            description: `"${file.name}" passa de ${MAX_ARTIGO_SIZE_MB}MB.`,
            variant: 'destructive',
          });
          continue;
        }
        const data = await fileToBase64(file);
        novos.push({
          name: file.name,
          mimeType: file.type,
          data,
          sizeKB: Math.round(file.size / 1024),
        });
      }
      if (novos.length > 0) {
        setArtigos([...artigos, ...novos]);
      }
    } catch (e) {
      console.error('Erro ao ler arquivo:', e);
      toast({
        title: 'Erro ao processar arquivo',
        description: 'Tente novamente ou use um PDF diferente.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeArtigo = (idx: number) => {
    setArtigos(artigos.filter((_, i) => i !== idx));
  };

  const objetivosCount = objetivos
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean).length;

  const totalSecoes = SECTION_GROUPS.reduce((acc, g) => acc + g.items.length, 0);
  const secoesAtivas = SECTION_GROUPS.reduce((acc, g) => {
    return acc + g.items.filter(i => secoes[i.key]).length;
  }, 0);

  const toggleSecao = (key: string) => {
    setSecoes({ ...secoes, [key]: !secoes[key] });
  };

  const toggleGrupo = (groupItems: { key: string }[], ativar: boolean) => {
    const patch: Record<string, boolean> = {};
    groupItems.forEach(i => { patch[i.key] = ativar; });
    setSecoes({ ...secoes, ...patch });
  };

  const isReady = tema.trim().length >= 3 && secoesAtivas > 0;

  return (
    <div className="relative bg-white rounded-3xl border border-slate-200 shadow-[0_1px_2px_rgba(25,28,29,0.04)] overflow-hidden">
      {/* Top accent — verde + ouro */}
      <div className="h-1 bg-gradient-to-r from-[#003D32] via-[#005344] via-[#006D5B] to-[#C9A84C]" />

      <div className="px-5 sm:px-8 md:px-12 py-7 sm:py-9 md:py-12 space-y-9">
        {/* Header editorial */}
        <header>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-[#005344] inline-flex items-center gap-2.5 mb-3">
            <span className="w-6 h-px bg-[#C9A84C]" />
            Novo fechamento acadêmico
          </p>
          <h1 className="font-['Manrope'] font-bold text-[28px] sm:text-[34px] tracking-[-0.025em] leading-[1.05] text-[#191C1D]">
            Componha seu resumo<br />
            como um{' '}
            <em className="not-italic font-medium text-[#8a6f26]">
              artigo de revisão
            </em>
            .
          </h1>
          <p className="text-sm text-[#4a5568] mt-3 max-w-[52ch] leading-relaxed">
            Tema, objetivos opcionais e estrutura. O PreceptorMED escreve em ~20s, com
            referências indexadas e profundidade técnica.
          </p>
        </header>

        {/* ── ① TEMA ── */}
        <section data-tour="tema-input">
          <div className="flex items-baseline justify-between mb-2">
            <label className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#4a5568]">
              ① Tema
            </label>
            {tema.length > 0 && (
              <span className="font-mono text-[10.5px] text-[#94a3b8]">
                {tema.length}/{MAX_TEMA_LENGTH}
              </span>
            )}
          </div>
          <div
            className={`relative rounded-xl border-2 transition-all ${
              tema
                ? 'border-[#005344] bg-white shadow-[0_0_0_4px_rgba(0,109,91,0.06)]'
                : 'border-slate-200 bg-slate-50/60'
            }`}
          >
            <input
              type="text"
              placeholder="Insuficiência cardíaca, sepse pediátrica, AVC isquêmico…"
              value={tema}
              onChange={(e) => setTema(e.target.value.slice(0, MAX_TEMA_LENGTH))}
              disabled={generating}
              className="w-full px-4 py-3.5 bg-transparent border-none outline-none font-['Manrope'] text-[17px] font-semibold tracking-[-0.01em] text-[#191C1D] placeholder:text-[#94a3b8] disabled:opacity-50"
            />
          </div>
        </section>

        {/* ── ② OBJETIVOS ── */}
        <section data-tour="objetivos-input">
          <div className="flex items-baseline justify-between mb-2">
            <label className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#4a5568] inline-flex items-center gap-2">
              ② Objetivos
              <span className="text-[9.5px] font-medium normal-case tracking-normal text-[#94a3b8]">
                opcional · 1 por linha
              </span>
            </label>
            {objetivosCount > 0 && (
              <span className="text-[10.5px] font-bold text-[#005344] inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#005344]" />
                {objetivosCount} identificado{objetivosCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <textarea
            placeholder={
              'Atividade laboral em IC\nCritérios de Framingham\nFármacos de 1ª linha…'
            }
            value={objetivos}
            onChange={(e) => setObjetivos(e.target.value.slice(0, MAX_OBJETIVOS_LENGTH))}
            disabled={generating}
            rows={4}
            className="w-full px-4 py-3.5 bg-slate-50/60 border-2 border-slate-200 rounded-xl text-[#191C1D] placeholder:text-[#94a3b8] outline-none focus:border-[#005344] focus:ring-4 focus:ring-[#005344]/06 focus:bg-white transition-all text-[14px] leading-relaxed resize-y font-['DM_Sans'] disabled:opacity-50"
          />
          <p className="text-[11px] text-[#4a5568] mt-1.5 leading-relaxed">
            Cada linha vira uma seção própria com o{' '}
            <strong className="text-[#005344]">texto exato</strong> que você
            escreveu como cabeçalho.
          </p>
        </section>

        {/* ── ②.5 ARTIGOS DE REFERÊNCIA ── */}
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <label className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#4a5568] inline-flex items-center gap-2">
              ②.5 Artigos de referência
              <span className="text-[9.5px] font-medium normal-case tracking-normal text-[#94a3b8]">
                opcional · até {MAX_ARTIGOS} PDFs, {MAX_ARTIGO_SIZE_MB}MB cada
              </span>
            </label>
            {artigos.length > 0 && (
              <span className="text-[10.5px] font-bold text-[#005344] inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#005344]" />
                {artigos.length}/{MAX_ARTIGOS} anexado{artigos.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
            disabled={generating || uploading || artigos.length >= MAX_ARTIGOS}
          />

          {artigos.length === 0 ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={generating || uploading}
              className="w-full px-4 py-4 bg-slate-50/60 border-2 border-dashed border-slate-200 rounded-xl text-[#4a5568] hover:border-[#005344] hover:bg-white hover:text-[#005344] outline-none focus:border-[#005344] focus:ring-4 focus:ring-[#005344]/06 transition-all text-[13px] font-medium inline-flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processando…
                </>
              ) : (
                <>
                  <Paperclip className="w-4 h-4" />
                  Anexar artigo (PDF)
                </>
              )}
            </button>
          ) : (
            <div className="space-y-1.5">
              {artigos.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 px-3 py-2 bg-white border border-slate-200 rounded-lg"
                >
                  <FileText className="w-4 h-4 text-[#005344] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold text-[#191C1D] truncate">
                      {a.name}
                    </div>
                    <div className="text-[10.5px] text-[#94a3b8] font-mono">
                      {a.sizeKB < 1024 ? `${a.sizeKB} KB` : `${(a.sizeKB / 1024).toFixed(1)} MB`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeArtigo(i)}
                    disabled={generating}
                    className="p-1 rounded hover:bg-slate-100 text-[#94a3b8] hover:text-red-600 transition-colors disabled:opacity-40"
                    aria-label={`Remover ${a.name}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {artigos.length < MAX_ARTIGOS && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={generating || uploading}
                  className="w-full px-3 py-2 border border-dashed border-slate-200 rounded-lg text-[11.5px] font-semibold text-[#4a5568] hover:border-[#005344] hover:text-[#005344] inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {uploading ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processando…</>
                  ) : (
                    <><Paperclip className="w-3.5 h-3.5" /> Adicionar outro</>
                  )}
                </button>
              )}
            </div>
          )}
          <p className="text-[11px] text-[#4a5568] mt-1.5 leading-relaxed">
            Os PDFs viram <strong className="text-[#005344]">fonte preferencial</strong> do
            resumo. O modelo cita o nome do arquivo quando usar uma informação dele.
          </p>
        </section>

        {/* ── ③ SEÇÕES ── */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <label className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#4a5568] inline-flex items-center gap-2">
              ③ Seções
              <span className="text-[9.5px] font-medium normal-case tracking-normal text-[#94a3b8]">
                marque o que entra
              </span>
            </label>
            <span className="font-mono text-[10.5px] font-bold text-[#005344]">
              {secoesAtivas}/{totalSecoes}
            </span>
          </div>

          <div className="space-y-4">
            {SECTION_GROUPS.map((grupo) => {
              const todasAtivas = grupo.items.every((i) => secoes[i.key]);
              return (
                <div key={grupo.title}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#94a3b8]">
                      {grupo.title}
                    </h3>
                    <button
                      type="button"
                      onClick={() => toggleGrupo(grupo.items, !todasAtivas)}
                      disabled={generating}
                      className="text-[10px] font-semibold text-[#005344] hover:underline disabled:opacity-40"
                    >
                      {todasAtivas ? 'Desmarcar todas' : 'Marcar todas'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {grupo.items.map((item) => {
                      const ativa = secoes[item.key];
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => toggleSecao(item.key)}
                          disabled={generating}
                          className={`px-3 h-8 rounded-full text-[12px] font-semibold border transition-all disabled:opacity-40 ${
                            ativa
                              ? 'bg-[#005344] text-white border-[#005344] shadow-[0_2px_6px_-2px_rgba(0,83,68,0.4)]'
                              : 'bg-white text-[#4a5568] border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── ④ PROFUNDIDADE ── */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <label className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#4a5568] inline-flex items-center gap-2">
              ④ Profundidade
              <span className="text-[9.5px] font-medium normal-case tracking-normal text-[#94a3b8]">
                tamanho do resumo
              </span>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {([
              { v: 'completo', t: 'Completo', d: 'Máxima profundidade técnica' },
              { v: 'reduzido', t: 'Reduzido', d: 'Objetivo e enxuto · alto rendimento' },
            ] as const).map((opt) => {
              const active = tamanho === opt.v;
              return (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setTamanho(opt.v)}
                  disabled={generating}
                  className={`text-left rounded-xl border-2 px-4 py-3 transition-all disabled:opacity-40 ${
                    active
                      ? 'border-[#005344] bg-[#005344]/[0.04] shadow-[0_0_0_4px_rgba(0,109,91,0.06)]'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${active ? 'border-[#005344]' : 'border-slate-300'}`}>
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-[#005344]" />}
                    </span>
                    <span className={`text-[13.5px] font-bold ${active ? 'text-[#005344]' : 'text-[#191C1D]'}`}>{opt.t}</span>
                  </div>
                  <p className="text-[11px] text-[#4a5568] mt-1 leading-snug pl-[22px]">{opt.d}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Divisor decorativo */}
        <div className="flex items-center gap-3 pt-2">
          <div className="flex-1 h-px bg-slate-100" />
          <div className="w-1 h-1 rounded-full bg-[#C9A84C]" />
          <div className="flex-1 h-px bg-slate-100" />
        </div>

        {/* ── ④ CTA ── */}
        <section data-tour="generate-btn">
          <button
            onClick={onGenerate}
            disabled={!canGenerate || !isReady || generating}
            className="w-full h-[58px] rounded-xl font-['Manrope'] font-bold text-[15px] tracking-[-0.005em] text-white inline-flex items-center justify-center gap-2.5 transition-all disabled:cursor-not-allowed group relative overflow-hidden"
            style={{
              background:
                canGenerate && isReady && !generating
                  ? 'linear-gradient(135deg, #003D32 0%, #005344 50%, #006D5B 100%)'
                  : '#94a3b8',
              boxShadow:
                canGenerate && isReady && !generating
                  ? '0 8px 24px -8px rgba(0,109,91,0.45)'
                  : 'none',
            }}
          >
            {canGenerate && isReady && !generating && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#C9A84C]/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
            )}
            <div className="relative flex items-center gap-2.5">
              {generating ? (
                <>
                  <Loader2 className="h-[18px] w-[18px] animate-spin" />
                  Gerando…
                </>
              ) : cooldown ? (
                <>Aguarde…</>
              ) : !tema.trim() ? (
                <>Digite o tema acima</>
              ) : secoesAtivas === 0 ? (
                <>Selecione ao menos 1 seção</>
              ) : (
                <>
                  <Sparkles className="w-[18px] h-[18px] text-[#C9A84C]" />
                  Gerar fechamento
                  <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </div>
          </button>
          <p className="text-[11px] text-[#94a3b8] text-center mt-3">
            Tempo médio · ~30s · Claude + base PubMed
          </p>

          {generating && (
            <div className="mt-5 pt-5 border-t border-slate-100">
              <GenerationProgress
                isGenerating={generating}
                hasStartedReceiving={hasStartedReceiving}
                isComplete={isComplete}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default InputPanel;
