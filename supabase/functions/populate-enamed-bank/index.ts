import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { claudeJson, toClaudeError } from "../_shared/claude.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AREAS = [
  "Clínica Médica",
  "Cirurgia",
  "Ginecologia e Obstetrícia",
  "Pediatria",
  "Saúde Coletiva",
];

const TEMAS_POR_AREA: Record<string, string[]> = {
  "Clínica Médica": [
    "IAM sem supradesnível de ST com complicação mecânica",
    "Cetoacidose diabética em paciente com IRC",
    "Pneumonia nosocomial em imunossuprimido",
    "Lúpus eritematoso sistêmico com nefrite classe IV",
    "AVC isquêmico com janela para trombólise",
    "Insuficiência cardíaca descompensada classe IV",
    "Sepse de foco urinário com choque refratário",
    "DPOC exacerbado com necessidade de VNI",
    "Cirrose hepática com PBE",
    "Tromboembolismo pulmonar maciço",
    "Fibrilação atrial com instabilidade hemodinâmica",
    "Hipotireoidismo subclínico na gestante",
    "Doença de Crohn com fístula perianal",
    "Meningite bacteriana no adulto",
    "Tuberculose multirresistente",
    "Dengue com sinais de alarme",
    "Endocardite infecciosa em valva protética",
    "Crise hipertensiva com encefalopatia",
    "Anemia falciforme com síndrome torácica aguda",
    "Intoxicação por organofosforado",
    "Hipercalemia grave com alteração eletrocardiográfica",
    "Hiponatremia grave sintomática",
    "Pancreatite aguda grave necrotizante",
    "DM tipo 2 com doença renal avançada",
    "Artrite reumatoide com doença pulmonar intersticial",
    "Mieloma múltiplo com insuficiência renal",
    "Hepatite autoimune com overlap",
    "Derrame pleural exsudativo a esclarecer",
    "Glomerulonefrite rapidamente progressiva",
    "Síndrome nefrótica no adulto",
    "Linfoma de Hodgkin com síndrome de veia cava superior",
    "HIV com infecção oportunista neurológica",
    "Asma grave refratária ao tratamento",
    "Doença celíaca com anemia refratária",
    "DRGE complicada com esôfago de Barrett",
    "Esclerose sistêmica com crise renal",
    "Febre de origem indeterminada",
    "Porfiria aguda intermitente",
    "Distúrbio ácido-básico misto",
    "Poliarterite nodosa com envolvimento renal",
    "Púrpura trombocitopênica trombótica",
    "Lesão renal aguda por contraste",
    "Tireotoxicose com tempestade tireoidiana",
    "Amiloidose com envolvimento cardíaco",
    "Hemocromatose com cirrose",
    "Doença de Addison com crise adrenal",
    "Síndrome de Guillain-Barré",
    "Miastenia gravis com crise miastênica",
    "Vasculite ANCA-positiva com hemorragia alveolar",
    "Leishmaniose visceral em imunossuprimido",
  ],
  "Cirurgia": [
    "Trauma abdominal fechado com lesão esplênica grau IV",
    "Abdome agudo obstrutivo por brida",
    "Apendicite complicada com abscesso",
    "Colecistite aguda alitiásica em paciente crítico",
    "Hénia inguinal encarcerada com isquemia",
    "Trauma torácico com hemotórax maciço",
    "Queimadura de 2o/3o grau em criança",
    "Pancreatite aguda biliar com colangite",
    "Diverticulite complicada Hinchey III",
    "Úlcera péptica perfurada",
    "Isquemia mesentérica aguda",
    "Trauma cranioencefálico grave com HSD",
    "Fratura de pelve com instabilidade hemodinâmica",
    "Trauma cervical penetrante zona II",
    "Obstrução intestinal neonatal por atresia",
    "Estenose hipertrófica de piloro",
    "Invaginação intestinal em lactente",
    "Cálculo ureteral obstrutivo com pionefroses",
    "Torção testicular em adolescente",
    "Tumor de Wilms com extensão para veia cava",
    "Ca colorretal obstrutivo",
    "Transplante renal — complicação vascular precoce",
    "Trauma de face com fratura Le Fort III",
    "Empiema pleural com encarceramento",
    "Politrauma com choque hemorrágico classe IV",
    "Ferimento por arma de fogo abdominal",
    "Complicação pós-bariátrica — fístula",
    "Síndrome compartimental abdominal",
    "Trombose venosa mesentérica",
    "Abscesso hepático amebiano",
    "Ca gástrico com linfonodo de Virchow",
    "Megacólon tóxico",
    "Perfuração esofágica (sínd. Boerhaave)",
    "Trauma renal grau IV com extravasamento",
    "Vólvulo de sigmoide",
    "Hérnia diafragmática traumática",
    "Fasciíte necrotizante de parede abdominal",
    "Coledocolitíase com colangite aguda",
    "Fístula enterocutânea de alto débito",
    "Cisto de colédoco em criança",
    "Trauma vascular periférico com sínd. compartimental",
    "Neoplasia de pâncreas com icterícia obstrutiva",
    "Abscesso anorretal complexo",
    "Complicação pós-colecistectomia — lesão de via biliar",
    "Pé diabético com osteomielite",
    "Hemorragia digestiva alta varicosa refratária",
    "Escroto agudo — diagnóstico diferencial",
    "Atendimento inicial ao politraumatizado (ABCDE)",
    "Pneumotórax hipertensivo",
    "Tamponamento cardíaco traumático",
  ],
  "Ginecologia e Obstetrícia": [
    "Pré-eclâmpsia grave com síndrome HELLP",
    "Eclâmpsia com conduta no sulfato de magnésio",
    "Placenta prévia com hemorragia ativa",
    "Descolamento prematuro de placenta",
    "Diabetes gestacional com macrossomia fetal",
    "Sífilis na gestação com tratamento inadequado",
    "Ruptura prematura de membranas pré-termo",
    "Trabalho de parto prematuro com tocolíse",
    "Gestação ectópica rota",
    "Doença trofoblástica gestacional",
    "Restrição de crescimento intrauterino",
    "Isoimunização Rh — conduta",
    "Hemorragia pós-parto por atonia uterina",
    "Corioamnionite com conduta",
    "Pré-natal de alto risco com múltiplas comorbidades",
    "Síndrome antifosfolípide obstétrica",
    "Polidrâmnio com investigação etiológica",
    "Oligodrâmnio grave no 2o trimestre",
    "Inserção velamentosa de cordão com vasa prévia",
    "Embolia amniótica",
    "Ca de colo uterino — rastreamento e conduta",
    "Ca de mama — estadiamento e conduta",
    "Sangramento uterino anormal na perimenopausa",
    "Endometriose profunda com acometimento intestinal",
    "Síndrome dos ovários policísticos",
    "Vulvovaginites de repetição — diagnóstico diferencial",
    "Doença inflamatória pélvica complicada",
    "Miomatose uterina com indicação cirúrgica",
    "Incontinência urinária de esforço",
    "Prolapso genital avançado",
    "Violência sexual — protocolo de atendimento",
    "Contracepção em pacientes com comorbidades",
    "DIU e complicações",
    "Amenorreia primária — investigação",
    "Amenorreia secundária — investigação",
    "Infertilidade conjugal — abordagem inicial",
    "Climatério com indicação de TRH",
    "Abortamento de repetição — investigação",
    "Gravidez molar com evolução para NTG",
    "Cardiotocografia — interpretação",
    "Ultrassom obstétrico — marcadores de aneuploidia",
    "Partograma — interpretação e conduta",
    "Distocia de ombro — manobras",
    "Cesariana — indicações absolutas",
    "Parto instrumentado — fórcipe e vácuo",
    "Tromboembolismo na gestação",
    "Infecção urinária na gestação",
    "Toxoplasmose na gestação",
    "Citomegalovírus congênito",
    "Hepatite B na gestação e profilaxia neonatal",
  ],
  "Pediatria": [
    "Icterícia neonatal com indicação de exsanguineotransfusão",
    "Sepse neonatal precoce em prematuro",
    "Enterocolite necrosante neonatal",
    "Doença da membrana hialina",
    "Persistência do canal arterial em RNPT",
    "Asfixia perinatal com encefalopatia",
    "Aleitamento materno — contraindicações e manejo de dificuldades",
    "Crescimento e desenvolvimento — marcos e desvios",
    "Calendário vacinal — situações especiais",
    "Reação adversa grave a vacina",
    "Bronquiolite viral aguda grave",
    "Asma na infância — crise grave",
    "Pneumonia comunitária complicada em criança",
    "Coqueluche em lactente jovem",
    "Tuberculose pulmonar na infância",
    "Meningite bacteriana em lactente",
    "Febre sem sinais de localização no lactente",
    "Convulsão febril complexa",
    "Epilepsia na infância — escolha de anticonvulsivante",
    "Desidratação grave com choque hipovolêmico",
    "Diarreia aguda com distúrbio eletrolítico",
    "Doença celíaca na infância",
    "Alergia à proteína do leite de vaca",
    "Refluxo gastroesofágico no lactente",
    "Infecção do trato urinário febril no lactente",
    "Glomerulonefrite pós-estreptocócica",
    "Síndrome nefrótica na infância",
    "Cardiopatia congênita cianótica (T4F)",
    "Cardiopatia congênita acianótica (CIV ampla)",
    "Febre reumática — diagnóstico e profilaxia",
    "Kawasaki — diagnóstico e complicações",
    "Púrpura de Henoch-Schönlein",
    "PTI na infância — conduta",
    "Anemia falciforme — crise vaso-oclusiva na criança",
    "Leucemia linfoblástica aguda — apresentação",
    "Diabetes tipo 1 — debut com CAD",
    "Hipotireoidismo congênito — triagem neonatal",
    "Hiperplasia adrenal congênita",
    "Obesidade infantil com síndrome metabólica",
    "Maus-tratos infantis — identificação e notificação",
    "Intoxicação exógena na criança",
    "Corpo estranho em via aérea",
    "Estridor no lactente — diagnóstico diferencial",
    "Displasia broncopulmonar",
    "Retinopatia da prematuridade",
    "Distúrbio do espectro autista — suspeita diagnóstica",
    "TDAH — diagnóstico e manejo",
    "Puberdade precoce — investigação",
    "Baixa estatura — investigação",
    "Parasitoses intestinais com complicações",
  ],
  "Saúde Coletiva": [
    "Cálculo e interpretação de indicadores epidemiológicos",
    "Tipos de estudo epidemiológico — vantagens e vieses",
    "Risco relativo vs razão de chances",
    "Sensibilidade e especificidade — aplicação clínica",
    "Valores preditivos e prevalência",
    "Curva ROC e ponto de corte",
    "Vieses em estudos epidemiológicos",
    "Ensaio clínico randomizado — ética e análise",
    "Revisão sistemática e metanálise",
    "Vigilância epidemiológica — doenças de notificação",
    "Surto de doença infecciosa — investigação",
    "Programa Nacional de Imunizações — calendário e rede de frio",
    "Princípios do SUS — universalidade, equidade, integralidade",
    "Organização do SUS — níveis de atenção",
    "Financiamento do SUS",
    "Controle social e participação popular",
    "Atenção Primária — atributos essenciais",
    "Estratégia Saúde da Família",
    "NASF e equipe multiprofissional",
    "Territorialização e diagnóstico comunitário",
    "Planejamento em saúde — PDCA e PES",
    "Indicadores de saúde — TMI, TMM, esperança de vida",
    "Transição epidemiológica e demográfica no Brasil",
    "Determinantes sociais de saúde",
    "Promoção da saúde — Carta de Ottawa",
    "Prevenção quaternária",
    "Rastreamento populacional — critérios de Wilson",
    "Ética médica — sigilo, autonomia, consentimento",
    "Código de Ética Médica — situações práticas",
    "Atestado de óbito — preenchimento correto",
    "Declaração de nascido vivo",
    "Notificação compulsória — fluxo e prazos",
    "Saúde do trabalhador — CAT e doenças ocupacionais",
    "Acidentes de trabalho — nexo causal",
    "Saúde mental na APS — matriciamento",
    "CAPS e RAPS — organização",
    "Política Nacional de Humanização",
    "Saúde do idoso — avaliação geriátrica ampla",
    "Saúde da mulher — PAISM",
    "Saúde da criança — AIDPI",
    "Saúde do adolescente",
    "Saúde indígena — DSEI",
    "Saúde da população em situação de rua",
    "Política de redução de danos",
    "Programa de controle da hanseníase",
    "Programa de controle da tuberculose",
    "Programa de controle da dengue",
    "Medicina baseada em evidências — NNT e NNH",
    "Gestão de qualidade em saúde — acreditação",
    "Segurança do paciente — cultura e indicadores",
  ],
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { area, batch_start = 0, batch_size = 10 } = await req.json();

    if (!area || !AREAS.includes(area)) {
      return new Response(JSON.stringify({ error: "Área inválida", areas: AREAS }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const temas = TEMAS_POR_AREA[area];
    const batchTemas = temas.slice(batch_start, batch_start + batch_size);

    if (batchTemas.length === 0) {
      return new Response(JSON.stringify({ message: "Todos os temas desta área já foram processados", area }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Você é um elaborador SÊNIOR de questões para o ENAMED/Revalida (INEP).

Gere EXATAMENTE ${batchTemas.length} questões de ALTA DIFICULDADE para a área "${area}".

Cada questão DEVE ter:
- Vinheta clínica EXTENSA (mínimo 10 linhas) com dados laboratoriais, sinais vitais, história detalhada
- 4 alternativas (A, B, C, D) — apenas UMA correta
- Distratores altamente plausíveis
- Raciocínio em múltiplas etapas
- Baseada em diretrizes médicas atualizadas

TEMAS (uma questão por tema, NA ORDEM):
${batchTemas.map((t, i) => `${i + 1}. ${t}`).join("\n")}

RESPONDA EXCLUSIVAMENTE em JSON válido, sem markdown, sem texto antes ou depois.
O formato EXATO deve ser:
[
  {
    "enunciado": "texto completo da vinheta clínica e pergunta",
    "alternativa_a": "texto da alternativa A",
    "alternativa_b": "texto da alternativa B",
    "alternativa_c": "texto da alternativa C",
    "alternativa_d": "texto da alternativa D",
    "gabarito": "A" ou "B" ou "C" ou "D",
    "explicacao": "explicação detalhada do porquê a resposta correta está certa e as outras erradas"
  }
]`;

    let questions: unknown;
    try {
      questions = await claudeJson({
        messages: [{ role: "user", content: prompt }],
        jsonOnly: true,
        maxTokens: 30000,
        effort: "medium",
      });
    } catch (e) {
      const ce = toClaudeError(e);
      throw new Error(`Claude API error: ${ce.status} - ${ce.message}`);
    }
    if (!Array.isArray(questions)) throw new Error("Response is not an array");

    // Get current max numero for this area
    const { data: existing } = await supabase
      .from("enamed_questions")
      .select("numero")
      .eq("area", area)
      .order("numero", { ascending: false })
      .limit(1);

    let nextNumero = (existing?.[0]?.numero ?? 0) + 1;

    const rows = questions.map((q: any) => ({
      area,
      ano: 2025,
      numero: nextNumero++,
      enunciado: q.enunciado,
      alternativa_a: q.alternativa_a,
      alternativa_b: q.alternativa_b,
      alternativa_c: q.alternativa_c,
      alternativa_d: q.alternativa_d,
      gabarito: q.gabarito,
      explicacao: q.explicacao || null,
      anulada: false,
    }));

    const { error: insertError } = await supabase.from("enamed_questions").insert(rows);
    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({
        success: true,
        area,
        inserted: rows.length,
        batch_start,
        next_batch_start: batch_start + batch_size,
        remaining: Math.max(0, temas.length - (batch_start + batch_size)),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
