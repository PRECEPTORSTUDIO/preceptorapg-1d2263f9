# Arquitetura: Gerador de Simulados a Partir de Qualquer Material + Modulo Professor
### PreceptorMED | Abril 2026

---

## FEATURE 1: Gerador de Simulados a Partir de PDF (Aluno)

### Problema que resolve
Estudante de medicina tem PDFs de provas antigas, resumos proprios, e slides de aula. Hoje ele estuda lendo esses materiais passivamente. Com essa feature, ele faz upload de QUALQUER PDF e ganha um simulado interativo automaticamente — com timer, feedback, e revisao no mesmo formato do Exam/ENAMED que ja existe.

### Tipos de material suportados
| Tipo | O que a IA faz |
|------|----------------|
| **Prova antiga** | Extrai questoes existentes (enunciado + alternativas + gabarito) |
| **Resumo / apostila** | Identifica conceitos-chave e GERA questoes novas sobre o conteudo |
| **Slides de aula** | Identifica topicos por slide e gera questoes contextualizadas |
| **Misto** | Detecta automaticamente o tipo e aplica a estrategia correta |

### Fluxo do Usuario

```
1. Aluno acessa "Minhas Provas" no menu principal
2. Clica "Enviar prova" → seleciona PDF
3. Upload acontece → barra de progresso
4. IA processa o PDF (10-30s):
   - Extrai texto via OCR/parsing
   - Identifica questoes (enunciado + alternativas + gabarito)
   - Estrutura em JSON
5. Tela de revisao: lista de questoes extraidas
   - Aluno pode editar/corrigir enunciado, alternativas, gabarito
   - Pode marcar "essa nao extraiu certo" para remover
   - Pode adicionar questoes manualmente
6. Aluno confirma → questoes salvas no banco dele
7. Pode iniciar simulado com aquelas questoes (reusa UI do Exam.tsx)
8. Pode compartilhar prova com colegas (opcional, v2)
```

### Wireframe Textual

```
┌──────────────────────────────────────────────┐
│  Minhas Provas                    [+ Enviar] │
├──────────────────────────────────────────────┤
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Anatomia │  │ Fisiolog │  │ Patologi │   │
│  │ P1 2025  │  │ P2 2025  │  │ P1 2026  │   │
│  │ 30 quest │  │ 25 quest │  │ 40 quest │   │
│  │ [Fazer]  │  │ [Fazer]  │  │ [Fazer]  │   │
│  └──────────┘  └──────────┘  └──────────┘   │
│                                              │
│  ── Envios recentes ──                       │
│  Bioquimica P2.pdf    Processando... 80%     │
│  Farmaco Final.pdf    Pronto - 35 questoes   │
└──────────────────────────────────────────────┘

Tela de Revisao pos-extracao:
┌──────────────────────────────────────────────┐
│  Revisao: Anatomia P1 2025         [Salvar]  │
│  28 questoes extraidas | 2 com duvida        │
├──────────────────────────────────────────────┤
│  Q1. O musculo que realiza a abduc... ✓      │
│  a) Deltoide ← gabarito                     │
│  b) Trapezio                                 │
│  c) Peitoral maior                           │
│  d) Infraespinhal                            │
│  [Editar] [Remover]                          │
│──────────────────────────────────────────────│
│  Q2. ⚠️ Extracao incerta                     │
│  Qual estrutura anatom...                    │
│  a) ???     b) ???     c) ???    d) ???       │
│  [Corrigir manualmente] [Remover]            │
└──────────────────────────────────────────────┘
```

### Schema do Banco

```sql
-- Provas enviadas pelo aluno
CREATE TABLE user_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,                    -- "Anatomia P1 2025"
  subject TEXT,                           -- "Anatomia"
  institution TEXT,                       -- "UFMG" (opcional)
  semester TEXT,                          -- "2025.1" (opcional)
  pdf_path TEXT,                          -- storage path do PDF original
  status TEXT NOT NULL DEFAULT 'processing', -- processing | review | ready | error
  total_questions INT DEFAULT 0,
  extraction_confidence FLOAT,            -- 0-1, media de confianca da IA
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Questoes extraidas
CREATE TABLE user_exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES user_exams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_number INT NOT NULL,
  enunciado TEXT NOT NULL,
  alternativa_a TEXT,
  alternativa_b TEXT,
  alternativa_c TEXT,
  alternativa_d TEXT,
  alternativa_e TEXT,                     -- algumas provas tem 5 alternativas
  gabarito TEXT,                          -- "a", "b", "c", "d", "e", ou NULL se desconhecido
  explicacao TEXT,                        -- gerada pela IA (opcional)
  confidence FLOAT,                       -- 0-1, confianca da extracao
  manually_edited BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tentativas de simulado
CREATE TABLE user_exam_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES user_exams(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  score INT,                              -- % de acerto
  total_questions INT,
  correct_answers INT,
  time_spent_seconds INT,
  answers JSONB,                          -- { "q1": "a", "q2": "c", ... }
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: usuario so ve os proprios dados
ALTER TABLE user_exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own exams" ON user_exams
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE user_exam_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own questions" ON user_exam_questions
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE user_exam_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own attempts" ON user_exam_attempts
  FOR ALL USING (auth.uid() = user_id);
```

### Arquitetura Tecnica

```
Frontend (React)                    Backend (Supabase)
─────────────────                   ──────────────────
                                    
Upload PDF ──────────────────────→ Supabase Storage (bucket: exam-pdfs)
                                    
POST /extract-exam-pdf ──────────→ Edge Function:
  { examId, pdfPath }               1. Baixa PDF do Storage
                                     2. Extrai texto (pdf-parse ou poppler)
                                     3. Envia texto para Gemini 2.5 Flash:
                                        systemInstruction: "Voce e um extrator
                                        de questoes de provas medicas..."
                                        Prompt: texto do PDF
                                        Temperature: 0.3 (extracao precisa)
                                     4. Gemini retorna JSON estruturado
                                     5. Salva questoes em user_exam_questions
                                     6. Atualiza user_exams.status = 'review'
                                    
GET questoes ←─────────────────── Supabase query direto (RLS)
                                    
Revisao + edits ─────────────────→ UPDATE user_exam_questions (RLS)
Confirmar ───────────────────────→ UPDATE user_exams.status = 'ready'
                                    
Iniciar simulado ────────────────→ Reusa componentes Exam.tsx existentes
                                     (InteractiveQuestion, SimulationView,
                                      ExamResultPanel, PostSimulationFeedback)
```

### Prompts do Gemini (1 por tipo de material)

**Prompt 0 — Detector de tipo (roda primeiro):**
```
systemInstruction: Voce classifica documentos academicos de medicina.
Dado os primeiros 800 caracteres de um PDF, classifique o tipo.

Retorne SOMENTE o JSON:
{ "type": "exam" | "summary" | "slides" | "mixed",
  "confidence": 0.0-1.0,
  "subject_detected": "Anatomia" | null,
  "language": "pt-BR" }
```

**Prompt 1 — Extracao de prova (type=exam):**
```
systemInstruction: Voce e um extrator preciso de questoes de provas
academicas de medicina. Extraia TODAS as questoes do texto.
- Inclua caso clinico no enunciado se houver
- Se gabarito nao estiver no documento, retorne gabarito: null
- Se alternativa estiver ilegivel, inclua o que conseguir e marque
  confidence baixa
- Mantenha nomes cientificos e abreviacoes medicas
- NAO invente conteudo — extraia APENAS o que esta no texto
- Liste problemas encontrados em extraction_issues

Temperature: 0.3

Retorne SOMENTE o JSON:
{
  "questions": [{ "number": 1, "enunciado": "...",
    "alternativa_a": "...", "alternativa_b": "...",
    "alternativa_c": "...", "alternativa_d": "...",
    "alternativa_e": null, "gabarito": "a", "confidence": 0.95 }],
  "metadata": { "total_extracted": 30, "subject_detected": "Anatomia",
    "has_gabarito": true },
  "extraction_issues": ["Questao 5: texto cortado apos alternativa C"]
}
```

**Prompt 2 — Geracao a partir de resumo/slides (type=summary|slides):**
```
systemInstruction: Voce e um professor de medicina criando questoes
objetivas para seus alunos. Dado o conteudo de um resumo ou slide,
primeiro identifique os TOPICOS principais, depois gere questoes
de multipla escolha sobre cada topico.

Regras:
- Gere questoes que TESTEM compreensao, nao apenas memoria
- Cada questao deve ter 4-5 alternativas plausíveis
- Distratores devem ser erros comuns de estudantes de medicina
- Varie a dificuldade: 30% facil, 50% medio, 20% dificil
- Base TODAS as questoes no conteudo fornecido — nao invente fatos
- Inclua explicacao curta para cada questao

Temperature: 0.5

Retorne SOMENTE o JSON:
{
  "topics_detected": ["Sistema cardiovascular", "Ciclo cardiaco", ...],
  "questions": [{ "number": 1, "topic": "Sistema cardiovascular",
    "enunciado": "...", "alternativa_a": "...", "alternativa_b": "...",
    "alternativa_c": "...", "alternativa_d": "...",
    "gabarito": "b", "explicacao": "...",
    "difficulty": "medium", "confidence": 0.9 }],
  "metadata": { "total_generated": 15, "subject_detected": "Fisiologia" }
}
```

### Mitigacao de Erros de Scan/Extracao (4 camadas)

#### Camada 1: Input (antes da IA)
- **OCR duplo**: tenta extrair texto nativo do PDF (pdf-parse). Se texto < 200 caracteres, assume scan e roda OCR (Gemini Vision direto no PDF como imagem).
- **Rejeicao precoce**: PDF corrompido, vazio, ou com < 100 palavras extraidas → erro imediato com mensagem clara ao aluno ("PDF parece estar vazio ou ilegivel").
- **Deteccao de tipo automatica**: antes de extrair, a IA recebe os primeiros 500 caracteres e classifica: "prova" (tem numeracao, alternativas), "resumo" (texto corrido, topicos), "slides" (frases curtas, titulos). Isso determina o prompt usado.

#### Camada 2: IA (durante o processamento)
- **Confianca por questao**: Gemini retorna `confidence: 0.0 a 1.0` para cada questao.
  - >= 0.8: extracao confiavel (check verde)
  - 0.6 a 0.8: possivel problema (alerta amarelo)
  - < 0.6: provavelmente errado (alerta vermelho, aparece no topo da revisao)
- **extraction_issues**: Gemini retorna lista de problemas encontrados (texto cortado, imagem nao processada, alternativa ilegivel).
- **Para resumos/slides**: IA primeiro lista topicos identificados, DEPOIS gera questoes. O aluno ve os topicos e pode desmarcar os irrelevantes antes da geracao.
- **Temperature 0.3 para extracao** (precisao maxima), **0.5 para geracao de questoes** (precisa de criatividade controlada).

#### Camada 3: Usuario (revisao obrigatoria)
- **NUNCA salvar automaticamente**. O aluno SEMPRE passa pela tela de revisao.
- Questoes com confidence < 0.7 aparecem no topo com destaque visual (borda amarela/vermelha).
- Cada questao tem botoes: [Aprovar] [Editar] [Remover] [Regenerar]
- "Regenerar" pede ao Gemini uma nova versao daquela questao especifica.
- Contador no topo: "23 questoes prontas · 4 precisam de revisao · 2 removidas"

#### Camada 4: Validacao pos-revisao
- Antes de salvar definitivamente, roda checagem automatica:
  - Alternativas duplicadas na mesma questao?
  - Gabarito contradiz o enunciado?
  - Questao muito curta (< 20 caracteres no enunciado)?
  - Menos de 3 alternativas?
- Opcional (v2): segunda chamada ao Gemini como "revisor": "Essas questoes medicas fazem sentido? Alguma tem inconsistencia?"

### Fluxo Atualizado (unificado para qualquer tipo de PDF)

```
1. Aluno acessa "Meus Simulados" no menu principal
2. Clica "Enviar material" → seleciona PDF
3. Sistema detecta tipo: prova / resumo / slides
4. IA processa:
   - Prova: EXTRAI questoes existentes
   - Resumo/Slides: GERA questoes novas sobre o conteudo
5. Tela de revisao (obrigatoria):
   - Para provas: mostra questoes extraidas com confidence
   - Para resumos: mostra topicos detectados + questoes geradas
   - Aluno edita/remove/regenera
6. Aluno confirma → salva no banco
7. Pode iniciar simulado imediatamente
```

### Estimativa de Esforco

| Tarefa |
|--------|
| Migration + tabelas + storage |
| Edge function process-pdf (extracao + geracao) |
| Deteccao automatica de tipo de material |
| Pagina "Meus Simulados" (listagem + upload) |
| Tela de revisao com confianca + edicao |
| Validacao pos-revisao |
| Integracao com Exam.tsx para simulado |
| Testes com PDFs reais (provas + resumos + slides) |

---

## FEATURE 2: Modulo Professor (Banco de Questoes)

### Problema que resolve
Professor de medicina quer criar questoes para seus alunos mas nao tem ferramenta dedicada. Hoje usa Word/Google Docs. Com esse modulo, ele cria questoes estruturadas, a IA ajuda a gerar alternativas distratoras, e ele pode compartilhar provas com alunos via link.

### Proposta de Valor (o que a IA agrega)
- Professor escreve enunciado + resposta correta → IA gera 3-4 distratores plausíveis
- Professor cola um texto de referencia → IA sugere 5-10 questoes a partir dele
- Sistema classifica cada questao por taxonomia de Bloom e nivel de dificuldade
- Professor ve analytics: quais questoes seus alunos mais erram

### Fluxo do Usuario

```
1. Professor acessa /professor (rota separada do CRM)
2. Login com credenciais proprias (pode ser o mesmo auth do Supabase)
3. Dashboard: lista de bancos de questoes dele
4. Cria novo banco: "Fisiologia Cardiovascular"
5. Dentro do banco, pode:
   a) Criar questao manualmente (form completo)
   b) Criar com ajuda da IA:
      - Modo 1: escreve enunciado + resposta → IA gera distratores
      - Modo 2: cola texto de referencia → IA gera questoes
   c) Importar de PDF (reusa a mesma engine do extrator!)
6. Organiza questoes por tags/temas
7. Monta prova: seleciona questoes do banco → gera PDF ou link
8. Compartilha link com alunos → alunos fazem online
9. Ve resultados: % acerto por questao, por aluno, por tema
```

### Wireframe Textual

```
┌──────────────────────────────────────────────┐
│  Prof. Dr. Silva          [Novo Banco]       │
│  Seus Bancos de Questoes                     │
├──────────────────────────────────────────────┤
│                                              │
│  ┌───────────────────────────────────────┐   │
│  │ Fisiologia Cardiovascular             │   │
│  │ 45 questoes · 3 provas · Atualizado   │   │
│  │ Facil: 12  Medio: 20  Dificil: 13    │   │
│  │ [Abrir] [Montar Prova] [Analytics]    │   │
│  └───────────────────────────────────────┘   │
│                                              │
│  ┌───────────────────────────────────────┐   │
│  │ Neuroanatomia                         │   │
│  │ 28 questoes · 1 prova · Ha 3 dias     │   │
│  │ [Abrir] [Montar Prova]               │   │
│  └───────────────────────────────────────┘   │
└──────────────────────────────────────────────┘

Tela de criacao com IA:
┌──────────────────────────────────────────────┐
│  Nova Questao          [Manual] [Com IA] ←   │
├──────────────────────────────────────────────┤
│  Cole um texto de referencia:                │
│  ┌──────────────────────────────────────┐    │
│  │ O sistema renina-angiotensina-       │    │
│  │ aldosterona (SRAA) e um sistema      │    │
│  │ hormonal que regula a pressao...     │    │
│  └──────────────────────────────────────┘    │
│  [Gerar Questoes a Partir do Texto]          │
│                                              │
│  ── Questoes Sugeridas pela IA ──            │
│  ✓ Q1: Qual o principal efeito da angio...  │
│  ✓ Q2: A aldosterona atua principal...      │
│  ○ Q3: O bloqueio da ECA resulta em...      │
│  [Adicionar selecionadas ao banco]           │
└──────────────────────────────────────────────┘
```

### Schema do Banco

```sql
-- Perfil de professor (extensao do profiles existente)
CREATE TABLE professor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  institution TEXT,
  specialties TEXT[],                     -- ["Cardiologia", "Fisiologia"]
  is_verified BOOLEAN DEFAULT false,      -- verificado por admin
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bancos de questoes
CREATE TABLE question_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id UUID NOT NULL REFERENCES professor_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,                    -- "Fisiologia Cardiovascular"
  description TEXT,
  subject TEXT,
  tags TEXT[],
  is_public BOOLEAN DEFAULT false,        -- visivel para alunos
  total_questions INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Questoes do professor
CREATE TABLE professor_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
  professor_id UUID NOT NULL REFERENCES professor_profiles(id),
  enunciado TEXT NOT NULL,
  texto_referencia TEXT,                  -- texto base que originou a questao
  alternativa_a TEXT NOT NULL,
  alternativa_b TEXT NOT NULL,
  alternativa_c TEXT NOT NULL,
  alternativa_d TEXT NOT NULL,
  alternativa_e TEXT,
  gabarito TEXT NOT NULL,                 -- "a" | "b" | "c" | "d" | "e"
  explicacao TEXT,
  difficulty TEXT DEFAULT 'medium',       -- easy | medium | hard
  bloom_level TEXT,                       -- remember | understand | apply | analyze | evaluate | create
  tags TEXT[],
  ai_generated BOOLEAN DEFAULT false,     -- se foi gerada pela IA
  times_used INT DEFAULT 0,              -- quantas vezes apareceu em provas
  correct_rate FLOAT,                    -- % de acerto quando usada
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Provas montadas pelo professor
CREATE TABLE professor_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id UUID NOT NULL REFERENCES professor_profiles(id),
  title TEXT NOT NULL,                    -- "P1 Fisiologia 2026.1"
  description TEXT,
  question_ids UUID[] NOT NULL,           -- IDs das questoes selecionadas
  share_code TEXT UNIQUE,                 -- codigo unico para compartilhar
  is_active BOOLEAN DEFAULT true,
  time_limit_minutes INT,                -- tempo maximo (opcional)
  show_answers_after BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Respostas dos alunos
CREATE TABLE professor_exam_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES professor_exams(id),
  student_user_id UUID REFERENCES auth.users(id),
  student_name TEXT,                      -- para alunos sem conta
  answers JSONB NOT NULL,                 -- { "q_uuid": "a", ... }
  score INT,
  total_questions INT,
  correct_answers INT,
  time_spent_seconds INT,
  completed_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE professor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE professor_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE professor_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE professor_exam_responses ENABLE ROW LEVEL SECURITY;

-- Professor ve so os proprios dados
CREATE POLICY "Professor owns profile" ON professor_profiles
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Professor owns banks" ON question_banks
  FOR ALL USING (professor_id IN (SELECT id FROM professor_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Professor owns questions" ON professor_questions
  FOR ALL USING (professor_id IN (SELECT id FROM professor_profiles WHERE user_id = auth.uid()));
-- Alunos podem ver provas publicas/ativas
CREATE POLICY "Students see active exams" ON professor_exams
  FOR SELECT USING (is_active = true);
```

### Arquitetura Tecnica

```
Edge Functions novas:
─────────────────────

1. generate-distractors/
   Input: { enunciado, resposta_correta, subject }
   Gemini: gera 3-4 alternativas distratoras plausiveis
   Output: { alternativas: ["...", "...", "..."], explicacao: "..." }

2. generate-questions-from-text/
   Input: { texto_referencia, subject, count: 5, difficulty: "medium" }
   Gemini: gera N questoes a partir do texto
   Output: { questions: [{ enunciado, alternativas, gabarito, bloom }] }

3. classify-question/
   Input: { enunciado, alternativas }
   Gemini: classifica dificuldade e taxonomia de Bloom
   Output: { difficulty: "hard", bloom: "analyze" }

Reuso de componentes:
─────────────────────
- InteractiveQuestion.tsx → renderizar questoes no simulado do aluno
- SimulationView.tsx → timer + navegacao entre questoes
- ExamResultPanel.tsx → resultado do simulado
- MarkdownRenderer.tsx → renderizar explicacoes

Rotas novas:
─────────────
/professor → Dashboard do professor
/professor/banco/:id → Banco de questoes
/professor/banco/:id/nova → Criar questao (manual ou IA)
/professor/prova/:id → Montar prova
/prova/:shareCode → Aluno acessa prova compartilhada (publica)
```

### Tarefas

| Tarefa |
|--------|
| Migration + tabelas + RLS |
| professor_profiles + auth flow |
| Dashboard do professor |
| CRUD de banco de questoes |
| Form de criacao de questao (manual) |
| Edge function generate-distractors |
| Edge function generate-questions-from-text |
| Montagem de prova (selecao + link) |
| Tela publica do aluno (simulado via link) |
| Analytics por questao |
| Testes e polish |

---

## PRIORIDADE E ORDEM SUGERIDA

### Fase 1: Extrator de Provas (2-3 semanas)
Razao: impacto direto no aluno que ja paga, usa feature existente (Exam), e cria lock-in com conteudo personalizado. Nenhum concorrente faz isso bem.

### Fase 2: Modulo Professor (4-5 semanas)
Razao: abre novo segmento de mercado (B2B com faculdades), mas depende de validacao com professores reais primeiro. Sugestao: antes de construir tudo, fazer MVP com 1-2 professores piloto usando apenas a feature de "gerar distratores" para validar demanda.

### Sinergias entre as features
- O extrator de PDF e o mesmo engine para ambas (aluno importa prova, professor importa material)
- As questoes do professor podem alimentar o banco de questoes dos alunos (se o professor marcar como publico)
- O simulado do aluno e do professor reusam os mesmos componentes (InteractiveQuestion, SimulationView)
- O analytics de questoes do professor alimenta o health score do aluno no CRM

---

## RISCOS E MITIGACOES

| Risco | Mitigacao |
|-------|-----------|
| PDF mal formatado / escaneado | Usar OCR como fallback (Tesseract.js no Edge Function) + marcar confidence baixa |
| Gemini extrair questoes erradas | Tela de revisao obrigatoria antes de salvar. Nunca salvar automaticamente. |
| Professor nao adotar | Validar com 2-3 professores antes de construir analytics/sharing |
| Custo de Gemini por extracao | Rate limit: 5 PDFs/dia para free, ilimitado para pagos. Cache de extracoes. |
| Questoes com imagens no PDF | v1: extrair só texto. v2: suporte a imagens com Gemini Vision. |
| Aluno fazer upload de conteudo protegido | ToS: responsabilidade do usuario. Nao armazenar PDF apos extracao (deletar do storage apos processar). |
