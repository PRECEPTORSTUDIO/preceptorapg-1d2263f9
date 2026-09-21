import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type DifficultyLevel = 'basico' | 'residencia';
export type PracticeMode = 'prova' | 'caso_clinico';

export interface ExamConfig {
  quantidade: number;
  nivel: DifficultyLevel;
  simulationMode: boolean;
  practiceMode: PracticeMode;
}

export interface ExamPdf {
  name: string;
  mimeType: string;
  data: string; // base64
  sizeKB: number;
}

export interface ExamGenerateOptions {
  /** Materias/temas livres (modo "topicos") — alternativa a conteudo da biblioteca */
  materias?: string[];
  /** PDFs anexados como fonte primaria */
  pdfs?: ExamPdf[];
}

export const useExamGenerator = () => {
  const { toast } = useToast();
  const [resultado, setResultado] = useState('');
  const [generating, setGenerating] = useState(false);
  const [hasStartedReceiving, setHasStartedReceiving] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<ExamConfig | null>(null);

  const generate = useCallback(async (conteudo: string, config: ExamConfig, opts: ExamGenerateOptions = {}) => {
    const hasMaterias = (opts.materias?.length ?? 0) > 0;
    const hasPdfs = (opts.pdfs?.length ?? 0) > 0;
    if (!conteudo.trim() && !hasMaterias && !hasPdfs) {
      toast({
        title: 'Conteúdo obrigatório',
        description: 'Selecione um resumo da biblioteca, ou digite matérias/anexe um PDF.',
        variant: 'destructive',
      });
      return;
    }

    setGenerating(true);
    setResultado('');
    setHasStartedReceiving(false);
    setIsComplete(false);
    setCurrentConfig(config);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-exam`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            conteudo,
            quantidade: config.quantidade,
            nivel: config.nivel,
            modo: config.practiceMode,
            materias: opts.materias,
            pdfs: opts.pdfs?.map(p => ({ name: p.name, mimeType: p.mimeType, data: p.data })),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao gerar conteúdo');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let started = false;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6).trim();
              if (jsonStr === '[DONE]') continue;

              try {
                const parsed = JSON.parse(jsonStr);
                if (parsed.meta?.finish_reason === 'ERROR' || parsed.meta?.finish_reason === 'SAFETY') {
                  throw new Error(parsed.meta.message ?? 'Erro ao gerar a prova.');
                }
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  if (!started) {
                    started = true;
                    setHasStartedReceiving(true);
                  }
                  fullText += content;
                  setResultado(fullText);
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      }

      setIsComplete(true);

      // Auto-save na biblioteca. Gera tema a partir do contexto se user
      // nao especificou (primeiras 60 chars do conteudo resumidas).
      if (fullText && session) {
        try {
          const autoTema = config.practiceMode === 'prova'
            ? `Simulado ${config.quantidade}q (${config.nivel})`
            : `Caso clinico (${config.nivel})`;
          await supabase.from('fechamentos').insert({
            user_id: session.user.id,
            tema: autoTema,
            resultado: fullText,
            tipo: config.practiceMode,
            exam_config: {
              quantidade: config.quantidade,
              nivel: config.nivel,
              simulationMode: config.simulationMode,
            },
          });
          toast({
            title: 'Salvo na biblioteca',
            description: `${config.practiceMode === 'prova' ? 'Simulado' : 'Caso clinico'} salvo automaticamente.`,
          });
        } catch (saveErr) {
          console.warn('auto-save falhou:', saveErr);
        }
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível gerar o conteúdo.',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  }, [toast]);

  const saveToLibrary = useCallback(async (tema: string) => {
    if (!resultado || !currentConfig) {
      toast({
        title: 'Erro',
        description: 'Não há conteúdo para salvar.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const { error } = await supabase.from('fechamentos').insert({
        user_id: session.user.id,
        tema,
        resultado,
        tipo: currentConfig.practiceMode,
        exam_config: {
          quantidade: currentConfig.quantidade,
          nivel: currentConfig.nivel,
          simulationMode: currentConfig.simulationMode,
        },
      });

      if (error) throw error;

      toast({
        title: 'Salvo na biblioteca!',
        description: `${currentConfig.practiceMode === 'prova' ? 'Prova' : 'Caso clínico'} salvo com sucesso.`,
      });
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: error instanceof Error ? error.message : 'Não foi possível salvar na biblioteca.',
        variant: 'destructive',
      });
    }
  }, [resultado, currentConfig, toast]);

  const reset = useCallback(() => {
    setResultado('');
    setGenerating(false);
    setHasStartedReceiving(false);
    setIsComplete(false);
    setCurrentConfig(null);
  }, []);

  return {
    resultado,
    generating,
    hasStartedReceiving,
    isComplete,
    currentConfig,
    generate,
    saveToLibrary,
    reset,
  };
};
