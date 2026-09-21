import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useEnamedGenerator = () => {
  const { toast } = useToast();
  const [resultado, setResultado] = useState('');
  const [generating, setGenerating] = useState(false);
  const [hasStartedReceiving, setHasStartedReceiving] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fullTextRef = useRef('');
  const lastUpdateRef = useRef(Date.now());

  // Monitor for stream stalls: if no new content for 10s after receiving data, mark complete
  useEffect(() => {
    if (!generating || !hasStartedReceiving || isComplete) return;

    const checkInterval = setInterval(() => {
      const elapsed = Date.now() - lastUpdateRef.current;
      if (elapsed > 10000 && fullTextRef.current.length > 200) {
        console.log('[ENAMED] No new data for 10s, marking complete. Content:', fullTextRef.current.length, 'chars');
        setIsComplete(true);
        setGenerating(false);
        if (abortRef.current) abortRef.current.abort();
      }
    }, 2000);

    return () => clearInterval(checkInterval);
  }, [generating, hasStartedReceiving, isComplete]);

  const generate = useCallback(async (opts: {
    quantidade: number;
    area?: string;
    conteudo_extra?: string;
  }) => {
    setGenerating(true);
    setResultado('');
    setHasStartedReceiving(false);
    setIsComplete(false);
    fullTextRef.current = '';
    lastUpdateRef.current = Date.now();

    abortRef.current = new AbortController();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada.');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-enamed`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            quantidade: opts.quantidade,
            area: opts.area || null,
            conteudo_extra: opts.conteudo_extra || null,
          }),
          signal: abortRef.current.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao gerar questões ENAMED');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setIsComplete(true);
        setGenerating(false);
        return;
      }

      const decoder = new TextDecoder();
      let started = false;
      let buffer = '';
      let streamDone = false;

      try {
        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) {
            console.log('[ENAMED] reader.read() done=true');
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const jsonStr = trimmed.slice(6).trim();

            if (jsonStr === '[DONE]') {
              console.log('[ENAMED] [DONE] received');
              streamDone = true;
              break;
            }
            if (!jsonStr) continue;

            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.meta?.finish_reason === 'ERROR' || parsed.meta?.finish_reason === 'SAFETY') {
                throw new Error(parsed.meta.message ?? 'Erro ao gerar as questões.');
              }
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                if (!started) {
                  started = true;
                  setHasStartedReceiving(true);
                  console.log('[ENAMED] First chunk received');
                }
                fullTextRef.current += content;
                lastUpdateRef.current = Date.now();
                setResultado(fullTextRef.current);
              }
            } catch { /* ignore */ }
          }
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.warn('[ENAMED] Stream error:', err);
          // Erro sinalizado pela IA no meio do stream: propaga pro toast.
          if (err instanceof Error && !fullTextRef.current) throw err;
        }
      } finally {
        try { reader.cancel(); } catch { /* ignore */ }
      }

      console.log('[ENAMED] Stream loop exited. Content:', fullTextRef.current.length, 'chars');
      if (fullTextRef.current) setResultado(fullTextRef.current);
      setIsComplete(true);
      setGenerating(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível gerar.',
        variant: 'destructive',
      });
      if (fullTextRef.current) setResultado(fullTextRef.current);
      setIsComplete(true);
      setGenerating(false);
    }
  }, [toast]);

  const reset = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    fullTextRef.current = '';
    setResultado('');
    setGenerating(false);
    setHasStartedReceiving(false);
    setIsComplete(false);
  }, []);

  return { resultado, generating, hasStartedReceiving, isComplete, generate, reset };
};
