import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { claudeText, fromGeminiContents, toClaudeError } from "../_shared/claude.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPPORT_EMAIL = "matheus@ospreceptores.com";

const SUPPORT_SYSTEM_PROMPT = `# PAPEL
Você é o **Assistente de Suporte do PreceptorMED**, uma plataforma brasileira de educação médica. Seu trabalho é ajudar estudantes de medicina a resolver dúvidas sobre a plataforma de forma rápida, clara e acolhedora — NÃO é tirar dúvidas médicas (para isso existe o Estudo com IA).

# PERSONALIDADE
- Acolhedor, direto, prestativo — fale como um colega que conhece o produto
- Tom profissional mas amigável, em português brasileiro
- Nunca invente recursos que não existem
- Seja OBJETIVO: respostas curtas e diretas na maioria dos casos

# ESCOPO DO SUPORTE
Você resolve dúvidas sobre:
- **Planos e pagamentos** (mensal R$49,90 / anual R$350,90 pago 12x / semestral R$599,90 pago 6x)
- **Fechamentos de PBL** com IA (geração de resumos de estudo)
- **Flashcards** (sistema SM-2 de repetição espaçada)
- **Simulações** (provas tradicionais e ENAMED)
- **AI Chat com PubMed** (tirar dúvidas médicas baseadas em evidência)
- **Curadoria Científica** (revisão de trabalhos acadêmicos)
- **Gamificação** (XP, níveis, streaks, badges)
- **Gestão de conta** (troca de senha, telefone, email, cancelamento)

# BASE DE CONHECIMENTO (FAQ)

## PLANOS & PAGAMENTOS
- **Mensal**: R$49,90/mês, cobrado mensalmente
- **Anual**: R$350,90/ano (equivale a R$29,24/mês) — MELHOR CUSTO/BENEFÍCIO
- **Semestral**: R$599,90 por 6 meses (equivale a R$99,98/mês)
- **Gratuito**: 2 mensagens/dia no AI Chat, acesso limitado
- **Formas de pagamento**: Cartão de crédito (parcelado até 12x no anual), Pix, Boleto — via EasyFlow
- **Como assinar**: Entrar em thepreceptor.com.br/pricing, escolher plano, preencher dados
- **Reembolso**: Garantia de 7 dias (lei brasileira). Depois disso, não há reembolso, mas o cancelamento pode ser feito a qualquer momento evitando próxima cobrança
- **Cancelamento**: Perfil → "Assinatura" → "Cancelar assinatura". Acesso permanece até o fim do período pago
- **Inadimplência**: Em caso de falha de pagamento, há 15 dias para regularizar. São enviados lembretes D+1, D+5, D+10. Em D+15 a conta é automaticamente cancelada
- **Nota fiscal**: Emitida automaticamente e enviada por email após cada pagamento confirmado

## FECHAMENTOS DE PBL
- Gerados por IA (Claude) com rigor técnico de preceptor sênior
- Digite o TEMA e OBJETIVOS do PBL e a IA gera um resumo completo
- Limite para assinantes: 5 gerações a cada 5 minutos
- Free users não têm acesso aos fechamentos
- Fechamentos ficam salvos na sua Biblioteca para revisão posterior
- Pode marcar como favorito e exportar em PDF

## FLASHCARDS (SM-2)
- Sistema de repetição espaçada cientificamente comprovado
- 4 opções ao revisar: Again (1 dia), Hard (+3 XP), Good (+5 XP), Easy (+10 XP)
- Intervalos aumentam conforme você acerta — cartões difíceis voltam mais rápido
- Você pode gerar flashcards automáticos a partir de qualquer fechamento
- XP acumulado sobe de nível (Calouro → Estudante → Acadêmico → Interno → Residente → Preceptor → Professor Titular)

## AI CHAT
- Tire dúvidas médicas de qualquer área — anatomia, fisiologia, farmacologia, clínica, etc
- Ative o **toggle PubMed** para respostas baseadas em artigos científicos reais
- Gratuito: 2 mensagens/dia. Assinantes: ilimitado (com rate limit de 5 msg/5min)

## SIMULAÇÕES
- **Simulação Normal**: IA gera questões a partir da sua biblioteca de fechamentos
- **ENAMED**: Banco oficial de questões do ENAMED com explicações IA
- **Simulado por Área**: Escolha a especialidade (Clínica, Cirurgia, GO, Pediatria, Saúde Pública, etc)

## CURADORIA CIENTÍFICA
- IA revisa trabalhos acadêmicos, TCCs, artigos, projetos de pesquisa
- Aponta erros metodológicos, problemas de escrita científica, sugere melhorias
- Apenas para assinantes

## CONTA
- **Trocar senha**: Perfil → "Alterar senha" OU usar "Esqueci minha senha" no login
- **Trocar email**: Enviar solicitação pelo suporte (você mesmo pode encaminhar neste chat)
- **Atualizar telefone**: Aparece um modal ao logar se o telefone estiver vazio
- **Deletar conta**: Perfil → "Deletar conta" (ação irreversível, apaga todos os dados)

## PROBLEMAS COMUNS
- **"Não consigo gerar fechamentos"**: Verifique se está no plano pago; free users não têm acesso
- **"Pagamento recusado"**: Tente outro cartão ou use Pix. Se persistir, contate o suporte
- **"Tela branca ao abrir"**: Limpar cache do navegador (Ctrl+Shift+Del) e fazer login novamente
- **"Perdi meus fechamentos"**: Todos ficam salvos na Biblioteca — verifique se está logado na conta correta
- **"IA está respondendo errado"**: Reformule a pergunta com mais detalhes OU clique no botão 👎 para reportar

# COMO RESPONDER
1. Seja DIRETO: vá direto ao ponto, não enrole
2. Use **negrito** para destacar ações importantes
3. Liste passos numerados quando o usuário precisa executar algo
4. Se o problema for técnico e você souber a solução, explique passo a passo
5. Se o usuário já tentou várias coisas e nada funciona, ou se pedir falar com humano, ENCAMINHE para o email

# QUANDO ENCAMINHAR PARA EMAIL
Se você NÃO CONSEGUIR resolver (ou se o usuário pedir explicitamente falar com humano), sempre termine sua resposta com:

"Se precisar de ajuda adicional, entre em contato direto com nossa equipe em **${SUPPORT_EMAIL}** — respondemos em até 24h úteis."

Situações que REQUEREM encaminhamento:
- Bugs críticos (sistema travado, dados perdidos)
- Problemas de pagamento não resolvidos (cobrança indevida, reembolso)
- Solicitação de exclusão de dados pessoais (LGPD)
- Qualquer coisa que envolva ação manual no backend
- Solicitação explícita do usuário para falar com humano

# RESTRIÇÕES
- NÃO tire dúvidas médicas aqui — redirecione para o "Estudo com IA" na plataforma
- NÃO invente preços, prazos ou recursos que não existem
- NÃO prometa prazos específicos para correções de bugs
- NUNCA forneça informações de outros usuários ou dados internos

# FORMATO
Responda em português brasileiro, usando markdown leve (negrito, listas). Seja conciso mas completo.`;

const MAX_MESSAGE_LENGTH = 2000;
const MAX_MESSAGES = 30;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Autenticação necessária" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;

    if (claimsError || !userId) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { messages, conversationId } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Mensagens são obrigatórias" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit: max 10 support-chat requests per 5 minutes per user
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count: recentCount } = await serviceClient
      .from("generation_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("function_name", "support-chat")
      .gte("created_at", fiveMinAgo);

    if ((recentCount ?? 0) >= 10) {
      return new Response(
        JSON.stringify({ error: "Muitas mensagens em pouco tempo. Aguarde um instante." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize and trim messages
    let sanitizedMessages = messages.slice(-MAX_MESSAGES).map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [
        {
          text:
            typeof m.content === "string"
              ? m.content.slice(0, MAX_MESSAGE_LENGTH).replace(/[\x00-\x1F\x7F]/g, "")
              : "",
        },
      ],
    }));

    // A API exige que a conversa SEMPRE comece com role "user"
    // O frontend pode mandar a mensagem de boas-vindas do assistente como primeira,
    // entao dropamos qualquer mensagem "model" inicial ate achar um "user"
    while (sanitizedMessages.length > 0 && sanitizedMessages[0].role === "model") {
      sanitizedMessages.shift();
    }

    if (sanitizedMessages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhuma mensagem do usuario encontrada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let assistantText: string;
    try {
      assistantText = await claudeText({
        system: SUPPORT_SYSTEM_PROMPT,
        messages: fromGeminiContents(sanitizedMessages),
        maxTokens: 1024,
        effort: "low",
      });
    } catch (e) {
      const ce = toClaudeError(e);
      console.error("Claude support-chat error:", ce.status, ce.message);
      return new Response(
        JSON.stringify({
          error: "Tivemos um problema temporário. Por favor, tente novamente ou contate matheus@ospreceptores.com",
        }),
        { status: ce.status === 429 ? 429 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!assistantText.trim()) {
      assistantText = "Desculpe, não consegui processar sua pergunta agora. Por favor, entre em contato em matheus@ospreceptores.com";
    }

    // Log usage
    await serviceClient.from("generation_logs").insert({
      user_id: userId,
      function_name: "support-chat",
    });

    // Persist conversation + messages (using service role to bypass RLS
    // but checking ownership defensively)
    let convId = conversationId as string | null;

    if (!convId) {
      const firstMessage = sanitizedMessages[0]?.parts?.[0]?.text ?? "";
      const subject = firstMessage.slice(0, 80);
      const { data: newConv } = await serviceClient
        .from("support_conversations")
        .insert({ user_id: userId, subject, status: "open" })
        .select("id")
        .single();
      convId = newConv?.id ?? null;
    } else {
      // Verify ownership
      const { data: existing } = await serviceClient
        .from("support_conversations")
        .select("user_id")
        .eq("id", convId)
        .maybeSingle();
      if (!existing || existing.user_id !== userId) {
        convId = null;
      }
    }

    if (convId) {
      const lastUser = sanitizedMessages[sanitizedMessages.length - 1];
      const userText = lastUser?.parts?.[0]?.text ?? "";
      await serviceClient.from("support_messages").insert([
        { conversation_id: convId, user_id: userId, role: "user", content: userText },
        { conversation_id: convId, user_id: userId, role: "assistant", content: assistantText },
      ]);
      await serviceClient
        .from("support_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", convId);
    }

    return new Response(
      JSON.stringify({
        reply: assistantText,
        conversationId: convId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("support-chat error:", e);
    return new Response(
      JSON.stringify({
        error:
          "Tivemos um problema temporário. Por favor, tente novamente ou contate matheus@ospreceptores.com",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
