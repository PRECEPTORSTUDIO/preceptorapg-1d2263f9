import { Slider } from '@/components/ui/slider';
import GenerationProgress from '@/components/GenerationProgress';
import ContentSelector from './ContentSelector';
import type { ExamConfig, PracticeMode } from '@/hooks/useExamGenerator';
import { Loader2, Sparkles, ArrowRight, FileCheck2, Stethoscope, GraduationCap, Award } from 'lucide-react';

interface ExamConfigPanelProps {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  config: ExamConfig;
  onConfigChange: (config: ExamConfig) => void;
  generating: boolean;
  hasStartedReceiving: boolean;
  isComplete: boolean;
  onGenerate: () => void;
  lockedMode?: PracticeMode | null;
}

const ExamConfigPanel = ({
  selectedIds,
  onSelectionChange,
  config,
  onConfigChange,
  generating,
  hasStartedReceiving,
  isComplete,
  onGenerate,
  lockedMode,
}: ExamConfigPanelProps) => {
  const isProva = config.practiceMode === 'prova';
  const isCasoClin = config.practiceMode === 'caso_clinico';

  const isReady = selectedIds.length > 0;

  // numbering shifts when mode is locked
  let n = 0;
  const next = () => ++n;
  const stepTipo = !lockedMode ? next() : null;
  const stepConteudo = next();
  const stepQtd = isProva ? next() : null;
  const stepNivel = next();

  const eyebrowLabel = lockedMode === 'caso_clinico'
    ? 'Caso clínico com PreceptorMED'
    : lockedMode === 'prova'
      ? 'Simulado com PreceptorMED'
      : 'Nova simulação';

  const heroTitle = lockedMode === 'caso_clinico' ? (
    <>Treine raciocínio com<br />um <em className="not-italic font-medium text-[#8a6f26]">caso clínico real</em>.</>
  ) : lockedMode === 'prova' ? (
    <>Construa um simulado<br />à <em className="not-italic font-medium text-[#8a6f26]">altura da residência</em>.</>
  ) : (
    <>Treine como se fosse<br />a <em className="not-italic font-medium text-[#8a6f26]">prova de verdade</em>.</>
  );

  return (
    <div className="relative bg-white rounded-3xl border border-slate-200 shadow-[0_1px_2px_rgba(25,28,29,0.04)] overflow-hidden">
      {/* Top accent — verde + ouro */}
      <div className="h-1 bg-gradient-to-r from-[#003D32] via-[#005344] via-[#006D5B] to-[#C9A84C]" />

      <div className="px-5 sm:px-8 md:px-12 py-7 sm:py-9 md:py-12 space-y-9">
        {/* Header editorial */}
        <header>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-[#005344] inline-flex items-center gap-2.5 mb-3">
            <span className="w-6 h-px bg-[#C9A84C]" />
            {eyebrowLabel}
          </p>
          <h1 className="font-['Manrope'] font-bold text-[28px] sm:text-[34px] tracking-[-0.025em] leading-[1.05] text-[#191C1D]">
            {heroTitle}
          </h1>
          <p className="text-sm text-[#4a5568] mt-3 max-w-[52ch] leading-relaxed">
            Selecione resumos da sua biblioteca, defina o nível e o PreceptorMED monta um
            simulado personalizado em segundos — com gabarito comentado.
          </p>
        </header>

        {/* ── Tipo de prática (somente se não locked) ── */}
        {!lockedMode && stepTipo && (
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <label className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#4a5568]">
                {`${'①②③④'[stepTipo - 1]}`} Modalidade
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onConfigChange({ ...config, practiceMode: 'prova' })}
                disabled={generating}
                className={`text-left p-4 rounded-xl border-2 transition-all disabled:opacity-50 ${
                  isProva
                    ? 'border-[#005344] bg-[#005344]/[0.03] shadow-[0_0_0_4px_rgba(0,109,91,0.06)]'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    isProva ? 'bg-[#005344] text-white' : 'bg-slate-100 text-[#4a5568]'
                  }`}>
                    <FileCheck2 className="w-[18px] h-[18px]" />
                  </div>
                  <div>
                    <h4 className="font-['Manrope'] font-bold text-[14px] text-[#191C1D] mb-0.5">Prova</h4>
                    <p className="text-[12px] leading-relaxed text-[#4a5568]">
                      Múltipla escolha estilo residência, com gabarito comentado.
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onConfigChange({ ...config, practiceMode: 'caso_clinico' })}
                disabled={generating}
                className={`text-left p-4 rounded-xl border-2 transition-all disabled:opacity-50 ${
                  isCasoClin
                    ? 'border-[#005344] bg-[#005344]/[0.03] shadow-[0_0_0_4px_rgba(0,109,91,0.06)]'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    isCasoClin ? 'bg-[#005344] text-white' : 'bg-slate-100 text-[#4a5568]'
                  }`}>
                    <Stethoscope className="w-[18px] h-[18px]" />
                  </div>
                  <div>
                    <h4 className="font-['Manrope'] font-bold text-[14px] text-[#191C1D] mb-0.5">Caso clínico</h4>
                    <p className="text-[12px] leading-relaxed text-[#4a5568]">
                      Cenário narrativo com diagnóstico, conduta e raciocínio.
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </section>
        )}

        {/* ── Conteúdo ── */}
        <section data-tour="content-selector">
          <div className="flex items-baseline justify-between mb-3">
            <label className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#4a5568] inline-flex items-center gap-2">
              {`${'①②③④'[stepConteudo - 1]}`} Conteúdo
              <span className="text-[9.5px] font-medium normal-case tracking-normal text-[#94a3b8]">
                resumos da biblioteca
              </span>
            </label>
            {selectedIds.length > 0 && (
              <span className="text-[10.5px] font-bold text-[#005344] inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#005344]" />
                {selectedIds.length} selecionado{selectedIds.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <ContentSelector
            selectedIds={selectedIds}
            onSelectionChange={onSelectionChange}
            disabled={generating}
          />
        </section>

        {/* ── Quantidade (só prova) ── */}
        {isProva && stepQtd && (
          <section data-tour="exam-config">
            <div className="flex items-baseline justify-between mb-3">
              <label className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#4a5568]">
                {`${'①②③④'[stepQtd - 1]}`} Quantidade
              </label>
              <span className="font-mono text-[10.5px] font-bold text-[#005344]">
                {config.quantidade} questões
              </span>
            </div>
            <div className="bg-slate-50/60 border-2 border-slate-200 rounded-xl px-4 py-5">
              <div className="flex justify-between items-end mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">5</span>
                <span className="font-['Manrope'] text-[40px] font-black text-[#005344] tabular-nums leading-none">
                  {config.quantidade}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">60</span>
              </div>
              <Slider
                value={[config.quantidade]}
                onValueChange={([v]) => onConfigChange({ ...config, quantidade: v })}
                min={5}
                max={60}
                step={5}
                disabled={generating}
              />
            </div>
          </section>
        )}

        {/* ── Nível ── */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <label className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#4a5568]">
              {`${'①②③④'[stepNivel - 1]}`} Nível
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'basico' as const, label: 'Residente', sub: 'graduação avançada', Icon: GraduationCap },
              { value: 'residencia' as const, label: 'Especialista', sub: 'estilo prova de residência', Icon: Award },
            ].map(({ value, label, sub, Icon }) => {
              const ativo = config.nivel === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onConfigChange({ ...config, nivel: value })}
                  disabled={generating}
                  className={`text-left p-4 rounded-xl border-2 transition-all disabled:opacity-50 ${
                    ativo
                      ? 'border-[#005344] bg-[#005344]/[0.03] shadow-[0_0_0_4px_rgba(0,109,91,0.06)]'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      ativo ? 'bg-[#005344] text-white' : 'bg-slate-100 text-[#4a5568]'
                    }`}>
                      <Icon className="w-[18px] h-[18px]" />
                    </div>
                    <div>
                      <h4 className="font-['Manrope'] font-bold text-[14px] text-[#191C1D] leading-tight">{label}</h4>
                      <p className="text-[11px] text-[#94a3b8] mt-0.5">{sub}</p>
                    </div>
                  </div>
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

        {/* ── CTA ── */}
        <section data-tour="generate-exam-btn">
          <button
            onClick={onGenerate}
            disabled={!isReady || generating}
            className="w-full h-[58px] rounded-xl font-['Manrope'] font-bold text-[15px] tracking-[-0.005em] text-white inline-flex items-center justify-center gap-2.5 transition-all disabled:cursor-not-allowed group relative overflow-hidden"
            style={{
              background:
                isReady && !generating
                  ? 'linear-gradient(135deg, #003D32 0%, #005344 50%, #006D5B 100%)'
                  : '#94a3b8',
              boxShadow:
                isReady && !generating
                  ? '0 8px 24px -8px rgba(0,109,91,0.45)'
                  : 'none',
            }}
          >
            {isReady && !generating && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#C9A84C]/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
            )}
            <div className="relative flex items-center gap-2.5">
              {generating ? (
                <>
                  <Loader2 className="h-[18px] w-[18px] animate-spin" />
                  {isProva ? 'Gerando prova…' : 'Gerando caso…'}
                </>
              ) : selectedIds.length === 0 ? (
                <>Selecione ao menos 1 conteúdo</>
              ) : (
                <>
                  <Sparkles className="w-[18px] h-[18px] text-[#C9A84C]" />
                  {isProva ? 'Gerar simulado' : 'Gerar caso clínico'}
                  <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </div>
          </button>
          <p className="text-[11px] text-[#94a3b8] text-center mt-3">
            {generating
              ? 'O PreceptorMED está elaborando — aguarde…'
              : isProva
                ? `Tempo médio · ~${Math.max(10, Math.round(config.quantidade * 0.6))}s · Claude`
                : 'Tempo médio · ~20s · Claude'}
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

export default ExamConfigPanel;
