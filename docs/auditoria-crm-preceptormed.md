# AUDITORIA CRM - PreceptorMED
### Bugs, UI/UX e Ideias de Features | Abril 2026

---

## 1. Bugs e Problemas Encontrados

Auditoria completa do CRM Marketing + CRM Admin, classificados por severidade.

### CRITICOS (3)

**json() indefinido na crm-admin-actions**
A edge function `crm-admin-actions` chama `json()` em 12 lugares mas nunca define a funcao. Todas as acoes de admin (grant_access, revoke_access, update_plan, get_subscriptions) crasham com "json is not defined".
Arquivo: `supabase/functions/crm-admin-actions/index.ts`

**Token sem verificacao HMAC**
A funcao `verifyCrmToken()` em crm-admin-actions verifica expiracao mas NAO valida a assinatura HMAC. Tokens forjados passam a validacao. Brecha de seguranca.
Arquivo: `supabase/functions/crm-admin-actions/index.ts:15-26`

**.single() sem fallback no Dashboard**
`useAdminDashboard` usa `.single()` na tabela `admin_fluxo_caixa`. Se a tabela estiver vazia, a query lanca excecao e crasha o dashboard inteiro.
Arquivo: `src/hooks/useAdminDashboard.ts:98`

### ALTOS (4)

**MRR baseline hardcoded em 2 lugares**
A data "2026-04-07" esta duplicada em `queries.ts:49` e `useAdminDashboard.ts:58`. Se uma muda e a outra nao, os KPIs ficam inconsistentes entre o CRM Marketing e o Admin.

**Auth silenciosa no CRM**
Se a re-autenticacao do service account falha em `CrmAuthContext`, o erro e logado mas a execucao continua. Queries subsequentes dao "permission denied" sem feedback ao usuario.
Arquivo: `src/contexts/CrmAuthContext.tsx:91-95`

**Push/WhatsApp fazem skip silencioso**
Automacoes configuradas para push ou WhatsApp simplesmente incrementam `results.skipped++` sem erro. O admin acha que enviou mas nada aconteceu.
Arquivo: `supabase/functions/crm-automations/index.ts:374-381`

**Fallback secret inseguro**
Se `CRM_TOKEN_SECRET` nao esta setada como env var, o codigo usa "fallback-insecure" como secret. Qualquer pessoa pode forjar tokens.
Arquivo: `supabase/functions/crm-auth/index.ts:58`

### MEDIOS (4)

**Precos de planos duplicados em 3 arquivos** - `queries.ts`, `useAdminDashboard.ts`, `useReceitas.ts`. Se o preco muda, facil esquecer um.

**Template de email so substitui {{nome}}** - Variaveis como {{codigo_desconto}}, {{empresa}} ficam cruas no email enviado ao cliente.

**Form limpa antes de confirmar** - `AdminReceita` faz `setForm(empty)` antes do `mutateAsync` completar. Se a request falha, dados perdidos.

**CORS aceita qualquer origin** - Todas as edge functions tem `Access-Control-Allow-Origin: *`. Qualquer site pode fazer requests autenticados.

### BAIXOS (3)

**Sem error states em nenhuma pagina** - Se uma query falha, o loading spinner fica infinito. Nao tem UI de erro.

**Analytics carrega ate 100k rows** - Safety cap em CrmAnalytics permite carregar 100k rows em memoria. Freeze em datasets grandes.

**Sem empty states** - CrmLeads, CrmHealth, CrmChurn nao tem fallback visual quando sem dados.

---

## 2. Melhorias de UI/UX

### Pontos Fortes Atuais
- Dark theme consistente e profissional em todas as paginas
- Codigo de cores inteligente (verde/vermelho/dourado)
- MetricCards com hierarquia visual clara
- Editor de email com split-view e preview ao vivo
- Tabelas organizadas com colunas logicas

### Problemas de Layout
- Tabelas extrapolam viewport em mobile (sem scroll indicator)
- Grid de 4-5 cards nao se adapta a tablets
- Sidebar nao vira hamburger em mobile
- DRE com 12+ colunas sem indicacao de scroll horizontal

### Problemas de Feedback Visual
- Refresh automatico (60s) e invisivel — usuario nao sabe quando dados atualizaram
- Loading states usam spinner generico em vez de skeleton loaders
- Graficos vazios mostram area branca sem placeholder informativo
- Sem transicoes/animacoes ao navegar entre paginas

### Sugestoes de Modernizacao
- **Skeleton loaders** em cards e tabelas durante carregamento
- **Tooltips nos MetricCards** explicando cada KPI ao passar o mouse
- **Sparklines inline** nos cards (mini-graficos mostrando tendencia)
- **Badges com micro-animacao** para mudancas de status
- **Filtros como chips/tags** em vez de dropdowns
- **Gradientes sutis** nos headers de secao
- **Row hover expressivo** com acao rapida via tooltip
- **Comparativo vs periodo anterior** em cada MetricCard (seta verde/vermelha com %)

---

## 3. Ideias de Novas Features

### 3.1 Alto Impacto

**Dashboard em Tempo Real com WebSockets**
Substituir polling de 60s por Supabase Realtime. Dashboard atualiza instantaneamente quando lead converte, assinante cancela ou paga. Notificacoes toast para eventos criticos.
Impacto: Latencia de 60s para <1s. Experiencia de painel de controle real.

**Automacao de WhatsApp (Evolution API)**
Integrar com Evolution API para envio automatico de WhatsApp. Mensagens de boas-vindas, cobranca, reengajamento. Templates pre-aprovados pelo Meta.
Impacto: WhatsApp tem 98% de abertura vs 20% email. Recuperacao de inadimplentes 3-5x mais eficaz.

**Cohort Analysis e Retention Curves**
Pagina dedicada a analise de coortes: agrupar usuarios por mes de cadastro e visualizar retencao ao longo do tempo. Curvas de sobrevivencia por plano.
Impacto: Identifica em qual semana/mes usuarios churnam mais. Intervencao cirurgica no momento certo.

**Revenue Intelligence com AI**
Usar Gemini para analisar padroes de receita, prever MRR dos proximos 3 meses, identificar quais planos performam melhor por segmento.
Impacto: Forecasting automatizado. Decisoes de pricing baseadas em dados preditivos.

### 3.2 Medio Impacto

**CRM Kanban para Pipeline de Leads**
Board visual estilo Trello/Pipedrive: colunas Visitante > Trial > Engajado > Pagante > Churned. Drag-and-drop + automacao.
Impacto: Visualizacao intuitiva do funil. Facilita trabalho de sales/success.

**Modulo de NPS Automatizado**
Envio automatico de pesquisa NPS no D+7, D+30, D+90. Dashboard com score historico e trigger de acao para detratores.
Impacto: Feedback sistematico. Detratores viram alvo de retencao proativa.

**Audit Log / Activity Feed**
Timeline de todas as acoes no CRM: quem alterou assinatura, enviou email, acessou salarios. Feed real-time + filtros.
Impacto: Compliance, rastreabilidade, debugging.

**Relatorio PDF Automatico para Investidores**
Gerar PDF mensal com MRR, ARR, churn, runway, cohort. Formatado profissionalmente, agendado via cron.
Impacto: Economia de 2-3h/mes. Consistencia na comunicacao com investidores.

### 3.3 Quick Wins

**Notificacoes In-App** - Badge no sino do sidebar para novo assinante, inadimplente, churn, feedback negativo. 5min de visibilidade.

**Export CSV/Excel em Todas as Tabelas** - Ja tem no DRE, falta nas demais. 5min por tabela, valor enorme para analises externas.

**Comparativo Periodo a Periodo** - Em cada MetricCard, seta com variacao vs mes anterior (+12%, -5%). Contexto instantaneo.

**Modo Foco/Drill-down** - Click num card de MRR abre tela cheia com grafico detalhado + historico. Experiencia de BI moderna.
