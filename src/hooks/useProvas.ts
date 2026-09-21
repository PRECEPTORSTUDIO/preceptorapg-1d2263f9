import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { extractTextByPage } from "@/lib/pdfMeta";

export type ProvaStatus =
  | "uploading"
  | "extracting"
  | "reviewing"
  | "ready"
  | "failed"
  | "archived";

export type QuestaoStatus = "pending" | "approved" | "rejected" | "edited";
export type JustificativaOrigem = "pdf" | "ia" | "none";

export interface Prova {
  id: string;
  user_id: string;
  titulo: string;
  num_alternativas: 4 | 5;
  gerar_justificativa_ia: boolean;
  pdf_storage_path: string | null;
  pdf_size_bytes: number | null;
  num_paginas: number | null;
  status: ProvaStatus;
  status_message: string | null;
  num_questoes: number;
  num_questoes_aprovadas: number;
  num_questoes_rejeitadas: number;
  extraction_started_at: string | null;
  extraction_completed_at: string | null;
  extraction_cost_usd: number | null;
  best_percentage: number | null;
  attempts_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProvaQuestao {
  id: string;
  prova_id: string;
  user_id: string;
  numero: number;
  enunciado: string;
  alternativas: string[];
  gabarito: string;
  justificativa: string | null;
  justificativa_origem: JustificativaOrigem;
  status: QuestaoStatus;
  edited_by_user: boolean;
  pagina_origem: number | null;
  raw_extraction: unknown;
  created_at: string;
  updated_at: string;
}

const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export function useProvas() {
  const { user } = useAuth();
  const [provas, setProvas] = useState<Prova[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("provas_importadas")
      .select("*")
      .order("created_at", { ascending: false });
    setProvas((data ?? []) as Prova[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Realtime: refresca quando uma prova muda status (extracting -> reviewing)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("provas-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "provas_importadas",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  return { provas, loading, refresh };
}

export interface UploadProvaParams {
  titulo: string;
  numAlternativas: 4 | 5;
  gerarJustificativaIa: boolean;
  /** Modo expresso: questoes ja sao auto-aprovadas e o user pode iniciar
   * o simulado live enquanto o PreceptorMED termina os chunks restantes. */
  modoExpresso?: boolean;
  pdfFile: File;
  numPaginas: number;
  onProgress?: (
    stage: "extracting_text" | "uploading" | "ingesting",
    info?: {
      pct?: number;
      chunksDone?: number;
      chunksTotal?: number;
      questoesAteAgora?: number;
    },
  ) => void;
  /** Notifica quando o primeiro chunk de questoes foi inserido — em modo
   * expresso, eh quando ja da pra navegar pra simulado live. */
  onFirstChunkReady?: (provaId: string, count: number) => void;
}

const PAGES_PER_CHUNK = 20;

export async function uploadAndIngestProva(
  userId: string,
  params: UploadProvaParams,
): Promise<{ provaId: string; questoesExtraidas: number }> {
  const {
    titulo,
    numAlternativas,
    gerarJustificativaIa,
    modoExpresso,
    pdfFile,
    numPaginas,
    onProgress,
    onFirstChunkReady,
  } = params;

  // 1) Cria registro em provas_importadas (status='uploading')
  const { data: prova, error: insError } = await supabase
    .from("provas_importadas")
    .insert({
      user_id: userId,
      titulo: titulo.trim().slice(0, 200),
      num_alternativas: numAlternativas,
      gerar_justificativa_ia: gerarJustificativaIa,
      num_paginas: numPaginas,
      pdf_size_bytes: pdfFile.size,
      status: "uploading",
    })
    .select("id")
    .single();
  if (insError || !prova) {
    throw new Error(insError?.message ?? "Falha ao criar registro da prova");
  }
  const provaId = prova.id as string;

  // 2) Extrai texto do PDF pagina-a-pagina no proprio browser.
  //    Pra PDFs digitais (>99% das provas modernas) isso eh muito mais
  //    rapido que mandar o PDF pra IA e processar 100+
  //    paginas no servidor — risco de timeout (HTTP 546 WORKER_LIMIT).
  onProgress?.("extracting_text");
  const pages = await extractTextByPage(pdfFile);
  const totalChars = pages.reduce((s, p) => s + p.text.length, 0);
  if (totalChars < 200) {
    await supabase.from("provas_importadas").delete().eq("id", provaId);
    throw new Error(
      "Este PDF parece ser escaneado/sem texto reconhecivel. Use um OCR online (Adobe Acrobat, ilovepdf, smallpdf) e tente novamente com o PDF processado.",
    );
  }

  // 3) Upload PDF original (pra referencia/visualizacao na revisao)
  const path = `${userId}/${provaId}/original.pdf`;
  onProgress?.("uploading", 0);
  const { error: upError } = await supabase.storage
    .from("provas-pdfs")
    .upload(path, pdfFile, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (upError) {
    await supabase.from("provas_importadas").delete().eq("id", provaId);
    throw new Error(`Upload do PDF falhou: ${upError.message}`);
  }
  await supabase
    .from("provas_importadas")
    .update({ pdf_storage_path: path })
    .eq("id", provaId);

  onProgress?.("uploading", { pct: 100 });

  // 4) Chunked extraction — divide as paginas em lotes de PAGES_PER_CHUNK
  //    e chama ingest-prova sequencialmente. Cada chunk volta com novas
  //    questoes; o user em modo expresso ja pode iniciar o simulado apos
  //    o primeiro chunk responder.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Sessao expirada");

  // Filtra paginas vazias pra nao gastar tokens a toa
  const nonEmptyPages = pages.filter((p) => p.text && p.text.trim().length > 30);
  const chunks: typeof nonEmptyPages[] = [];
  for (let i = 0; i < nonEmptyPages.length; i += PAGES_PER_CHUNK) {
    chunks.push(nonEmptyPages.slice(i, i + PAGES_PER_CHUNK));
  }
  if (chunks.length === 0) {
    await supabase.from("provas_importadas").delete().eq("id", provaId);
    throw new Error("Nenhuma pagina com texto extraivel.");
  }

  onProgress?.("ingesting", {
    chunksDone: 0,
    chunksTotal: chunks.length,
    questoesAteAgora: 0,
  });

  let totalQuestoes = 0;
  for (let i = 0; i < chunks.length; i++) {
    const isFirst = i === 0;
    const isLast = i === chunks.length - 1;
    const res = await fetch(`${API_URL}/ingest-prova`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        prova_id: provaId,
        mode: "text",
        pages: chunks[i],
        chunk_index: i,
        total_chunks: chunks.length,
        is_first: isFirst,
        is_last: isLast,
        auto_approve: modoExpresso,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Marca prova como failed e propaga erro
      await supabase
        .from("provas_importadas")
        .update({
          status: "failed",
          status_message:
            (json.error as string)?.slice(0, 500) ??
            `Erro ${res.status} no chunk ${i + 1}/${chunks.length}`,
        })
        .eq("id", provaId);
      throw new Error(json.error ?? `Erro ${res.status} ao processar prova`);
    }
    const extraidas = (json.questoes_extraidas as number) ?? 0;
    totalQuestoes += extraidas;
    onProgress?.("ingesting", {
      chunksDone: i + 1,
      chunksTotal: chunks.length,
      questoesAteAgora: totalQuestoes,
    });
    if (isFirst && onFirstChunkReady) {
      onFirstChunkReady(provaId, extraidas);
    }
  }

  return { provaId, questoesExtraidas: totalQuestoes };
}

export async function fetchProvaQuestoes(provaId: string): Promise<ProvaQuestao[]> {
  const { data, error } = await supabase
    .from("prova_questoes_importadas")
    .select("*")
    .eq("prova_id", provaId)
    .order("numero", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProvaQuestao[];
}

export async function updateQuestao(
  questaoId: string,
  patch: Partial<
    Pick<
      ProvaQuestao,
      "enunciado" | "alternativas" | "gabarito" | "justificativa" | "status"
    >
  >,
): Promise<void> {
  const { error } = await supabase
    .from("prova_questoes_importadas")
    .update({ ...patch, edited_by_user: true })
    .eq("id", questaoId);
  if (error) throw new Error(error.message);
}

export async function deleteProva(provaId: string): Promise<void> {
  // Tambem limpa storage
  const { data: prova } = await supabase
    .from("provas_importadas")
    .select("pdf_storage_path")
    .eq("id", provaId)
    .single();
  if (prova?.pdf_storage_path) {
    await supabase.storage.from("provas-pdfs").remove([prova.pdf_storage_path]);
  }
  await supabase.from("provas_importadas").delete().eq("id", provaId);
}

export async function approveAllPending(provaId: string): Promise<number> {
  const { data, error } = await supabase
    .from("prova_questoes_importadas")
    .update({ status: "approved" })
    .eq("prova_id", provaId)
    .eq("status", "pending")
    .select("id");
  if (error) throw new Error(error.message);
  // Atualiza prova pra ready se nao tem mais pendentes
  const { count: pendingCount } = await supabase
    .from("prova_questoes_importadas")
    .select("id", { count: "exact", head: true })
    .eq("prova_id", provaId)
    .eq("status", "pending");
  if ((pendingCount ?? 0) === 0) {
    await supabase
      .from("provas_importadas")
      .update({ status: "ready" })
      .eq("id", provaId);
  }
  return (data ?? []).length;
}

export async function markProvaReady(provaId: string): Promise<void> {
  await supabase
    .from("provas_importadas")
    .update({ status: "ready" })
    .eq("id", provaId);
}

export async function getProvaPdfUrl(
  storagePath: string,
): Promise<string> {
  const { data } = await supabase.storage
    .from("provas-pdfs")
    .createSignedUrl(storagePath, 3600);
  return data?.signedUrl ?? "";
}

export async function explainQuestionWithAi(
  questaoId: string,
  forceRegenerate = false,
): Promise<{ justificativa: string; cached: boolean }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Sessao expirada");
  const res = await fetch(`${API_URL}/explain-question`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      questao_id: questaoId,
      force_regenerate: forceRegenerate,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`);
  return {
    justificativa: json.justificativa ?? "",
    cached: !!json.cached,
  };
}
