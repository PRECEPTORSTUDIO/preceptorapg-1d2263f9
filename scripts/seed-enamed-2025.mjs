// seed-enamed-2025.mjs
// Inserts 100 ENAMED 2025 questions into Supabase via Management API
// Usage: node seed-enamed-2025.mjs

const API_URL = 'https://api.supabase.com/v1/projects/qnyxluevbogwwtwtbpuu/database/query';
const AUTH_TOKEN = 'sbp_aaa3ed019b1c26f5b98f9993cb8f2f01b6be27c1';

// Gabarito definitivo ENAMED 2025
const GABARITO = {
  1:'A',2:'B',3:'A',4:'D',5:'C',6:'B',7:'A',8:'B',9:'C',10:'A',
  11:'C',12:'D',13:'C',14:'B',15:'A',16:'B',17:'D',18:'D',19:'D',20:'C',
  21:'A',22:'A',23:'B',24:'D',25:'A',26:'C',27:'D',28:'B',29:'A',30:'C',
  31:'B',32:'D',33:'C',34:'B',35:'D',36:'C',37:'D',38:'D',39:'D',40:'D',
  41:'C',42:'D',43:'B',44:'B',45:'B',46:'C',47:'C',48:'D',49:'B',50:'C',
  51:'C',52:'A',53:'C',54:'C',55:'A',56:'D',57:'D',58:'A',59:'B',60:'C',
  61:'A',62:'B',63:'B',64:'D',65:'A',66:'A',67:'C',68:'B',69:'C',70:'B',
  71:'B',72:'A',73:'C',74:'A',75:'A',76:'B',77:'B',78:'D',79:'B',80:'A',
  81:'D',82:'D',83:'B',84:'C',85:'B',86:'D',87:'B',88:'A',89:'A',90:'C',
  91:'B',92:'A',93:'C',94:'A',95:'B',96:'D',97:'C',98:'C',99:'A',100:'A',
};

// Anuladas e excluídas
const ANULADAS = new Set([2, 7, 9, 10, 11, 40, 43, 76, 88, 100]);

const QUESTIONS = [
  {
    numero: 1, area: 'clinica_medica',
    enunciado: 'Mulher de 58 anos, com diagnóstico de hipertensão arterial sistêmica (HAS) e em tratamento irregular, é encaminhada ao ambulatório de clínica médica de atenção secundária. Queixa-se de fadiga e dispneia aos esforços, com piora progressiva. Ao exame físico, é observado ritmo cardíaco regular em 4 tempos (B3 + B4), sem sopros no precórdio, mas com crépitos em bases pulmonares; pressão arterial: 148 x 90 mmHg. Ecocardiograma transtorácico evidencia hipertrofia ventricular esquerda concêntrica, associada com fração de ejeção de 38% (por Simpson). Exames laboratoriais normais, salvo pela elevação sérica de peptídeo natriurético tipo B (BNP). Para melhorar o controle da HAS e o prognóstico da paciente, o tratamento com inibidor da enzima conversora de angiotensina foi mantido, e o especialista optou por associar determinado fármaco, devido ao impacto positivo no prognóstico de sobrevida dessa paciente.\n\nO fármaco introduzido no tratamento da paciente foi',
    alternativa_a: 'espironolactona.',
    alternativa_b: 'clortalidona.',
    alternativa_c: 'hidralazina.',
    alternativa_d: 'clonidina.',
  },
  {
    numero: 2, area: 'pediatria',
    enunciado: 'Lactente de 4 meses é levado ao serviço de emergência com história de vômitos, poliúria, episódios de fraqueza intensa e febre. Ao exame físico, apresenta-se com desidratação grave e déficit de crescimento significativo. Encontram-se, ainda, sinais radiológicos de osteopenia e raquitismo resistente à vitamina D.\n\nCom base na principal hipótese diagnóstica, o distúrbio ácido-básico relacionado ao caso é',
    alternativa_a: 'alcalose respiratória hipoclorêmica.',
    alternativa_b: 'acidose metabólica hiperclorêmica.',
    alternativa_c: 'alcalose respiratória hipocalêmica.',
    alternativa_d: 'acidose metabólica hipercalêmica.',
  },
  {
    numero: 3, area: 'cirurgia',
    enunciado: 'Homem de 45 anos foi encontrado inconsciente por familiares junto a uma escada de sua casa. Familiares o conduziram em carro próprio, sem medidas-padrão de atendimento pré-hospitalar. Não sabem por quanto tempo ficou desacordado e nem sobre o histórico de saúde. Quando deu entrada no pronto-socorro, encontrava-se inconsciente, com equimose e escoriações na região orbital e palpebral direita, além de escoriações na região cervical posterior e em membros à direita. Não apresentava resposta ao comando verbal, mas respirava espontaneamente com frequência normal. Pressão arterial de 140 x 90 mmHg e pupilas isocóricas. Durante a avaliação, abriu os olhos e começou a se mexer, ainda sem responder a questões ou comandos. Após 30 minutos começou a responder, mas informava não se lembrar de ter caído da escada.\n\nConsiderando o quadro, a conduta adequada é',
    alternativa_a: 'tomografia de crânio, face e coluna cervical; radiografia de membros; manter o paciente em observação por 12 horas.',
    alternativa_b: 'radiografia de crânio, coluna cervical e membros em duas posições; internar o paciente para observação.',
    alternativa_c: 'tomografia de crânio, face e radiografia de membros; liberar o paciente para observação domiciliar.',
    alternativa_d: 'radiografia de crânio e face; radiografia de membros; internar o paciente por 24 horas.',
  },
  {
    numero: 4, area: 'ginecologia_obstetricia',
    enunciado: 'Paciente de 30 anos procurou consultório de ginecologia relatando fadiga, dismenorreia progressiva e dispareunia de profundidade. Toque vaginal: útero de volume normal, retroversofletido, dor à mobilização do colo.\n\nCom base nessas informações, a principal hipótese diagnóstica é',
    alternativa_a: 'doença inflamatória pélvica.',
    alternativa_b: 'miomatose uterina.',
    alternativa_c: 'cisto hemorrágico.',
    alternativa_d: 'endometriose.',
  },
  {
    numero: 5, area: 'clinica_medica',
    enunciado: 'Homem de 28 anos, estudante universitário, residente em zona urbana, comparece à Unidade Básica de Saúde (UBS) referindo aparecimento de lesão cutânea em região dorsal da mão, cerca de 1 mês após ter sofrido arranhadura de gato de rua. A lesão apresenta úlceras com presença de crostas além de nodulações próximas. Foi submetido à biópsia da lesão cutânea e cultura de material. Observou-se dermatite granulomatosa difusa, presença de corpos asteroides e material eosinofílico ao redor de células características.\n\nQual é a principal hipótese diagnóstica e o respectivo tratamento para esse caso?',
    alternativa_a: 'Furunculose; cefalexina por 7 dias.',
    alternativa_b: 'Herpes-zoster; aciclovir por 10 dias.',
    alternativa_c: 'Esporotricose; itraconazol por 120 dias.',
    alternativa_d: 'Paracoccidioidomicose; anfotericina B por 30 dias.',
  },
  {
    numero: 6, area: 'saude_coletiva',
    enunciado: 'Observe o encaminhamento realizado por um médico de família.\n\n"À cardiologia, Encaminho o Sr. J. L. S., de 56 anos, com diagnóstico de cardiopatia isquêmica, que sofreu um infarto agudo do miocárdio há 3 meses. Tem orientação para o uso de antiagregantes plaquetários, mas tem história de úlcera péptica e teve reação alérgica ao clopidogrel e à ticlopidina. Desta forma, solicito orientação quanto à conduta preventiva."\n\nAo ser assistido pelo cardiologista, o paciente será atendido em qual nível de atenção e receberá que tipo de prevenção, respectivamente?',
    alternativa_a: 'Primário; secundário.',
    alternativa_b: 'Secundário; secundário.',
    alternativa_c: 'Terciário; terciário.',
    alternativa_d: 'Quaternário; terciário.',
  },
  {
    numero: 7, area: 'clinica_medica',
    enunciado: 'Homem de 20 anos, com diagnóstico de esquizofrenia, chega à Unidade de Pronto Atendimento (UPA) acompanhado de familiares, que descrevem que o paciente acordou "torto". Há 5 dias, foi realizada a troca de risperidona por haloperidol, pois aquela estava em falta na farmácia. Paciente nega outras queixas clínicas. Ao exame, apresenta contratura de região cervical e fácies de dor.\n\nQuais são, respectivamente, a hipótese diagnóstica mais provável e a conduta mais adequada?',
    alternativa_a: 'Distonia; biperideno intramuscular.',
    alternativa_b: 'Acatisia; haloperidol intramuscular.',
    alternativa_c: 'Discinesia tardia; diazepam intramuscular.',
    alternativa_d: 'Síndrome extrapiramidal; prometazina intramuscular.',
  },
  {
    numero: 8, area: 'clinica_medica',
    enunciado: 'Mulher de 20 anos apresenta queixa de dor e edema articular em mãos, punhos e joelhos, com rigidez matinal superior a 2 horas de duração, há 3 meses. Ao exame físico, observa-se edema articular simétrico em metacarpofalangeanas e interfalangeanas proximais bilateralmente, além de sinovite em punhos e joelhos.\n\nA hipótese diagnóstica mais provável, o exame laboratorial mais específico e o tratamento de primeira linha são, respectivamente,',
    alternativa_a: 'esclerose sistêmica; níveis elevados de creatina quinase; prednisona.',
    alternativa_b: 'artrite reumatoide; pesquisa de fator reumatoide (FR) positivo; metotrexato.',
    alternativa_c: 'lúpus eritematoso sistêmico; FAN com padrão nuclear pontilhado fino denso; cloroquina.',
    alternativa_d: 'doença mista do tecido conjuntivo; FAN com padrão nuclear pontilhado fino; azatioprina.',
  },
  {
    numero: 9, area: 'cirurgia',
    enunciado: 'Paciente feminina de 78 anos, com 24 horas de evolução de dor e abaulamento progressivo em região inguinal direita. Apresentou também alguns episódios de vômitos e diminuição da eliminação de flatos. Antecedentes: neoplasia de mama há 30 anos, diabetes mellitus há 20 anos e tabagista de 40 maços/ano. Ao exame estava normotensa, eucárdica, afebril, eupneica. IMC de 35 kg/m². Abdome globoso, depressível, com abaulamento não redutível e desconforto à palpação em região inguinal direita, com discreta hiperemia local e sem sinais de irritação peritoneal.\n\nA hipótese diagnóstica mais provável é',
    alternativa_a: 'isquemia mesentérica.',
    alternativa_b: 'hérnia inguinal indireta.',
    alternativa_c: 'hérnia femoral encarcerada.',
    alternativa_d: 'neoplasia de cólon obstrutiva.',
  },
  {
    numero: 10, area: 'saude_coletiva',
    enunciado: 'Questão anulada administrativamente devido a identificação de erro material na redação entre os cadernos 01 e 02.',
    alternativa_a: 'Alternativa A.',
    alternativa_b: 'Alternativa B.',
    alternativa_c: 'Alternativa C.',
    alternativa_d: 'Alternativa D.',
  },
  {
    numero: 11, area: 'ginecologia_obstetricia',
    enunciado: 'Paciente de 25 anos, com duas gestações e um parto, no segundo trimestre de gestação, compareceu à primeira consulta de pré-natal sem queixas. Após orientações e realização dos testes rápidos, verificou-se que o teste para sífilis foi positivo e imediatamente a paciente recebeu 2,4 milhões UI de penicilina benzatina intramuscular. Paciente nega diagnóstico e tratamento prévios para sífilis.\n\nEm relação ao acompanhamento da paciente, é correto afirmar que:',
    alternativa_a: 'Com o tratamento instituído, o feto não terá sequelas.',
    alternativa_b: 'Titulações menores ou iguais a um quarto indicarão cicatriz sorológica.',
    alternativa_c: 'A queda de duas titulações do VDRL indicará efetividade de tratamento.',
    alternativa_d: 'O exame de FTA-Abs reagente indicará doença ativa.',
  },
  {
    numero: 12, area: 'saude_coletiva',
    enunciado: 'Homem de 52 anos, branco, solteiro, comparece à consulta agendada na UBS desejando realizar revisão clínica e exames laboratoriais. Desde os 35 anos não faz acompanhamento de saúde. Relata história familiar de diabetes e hipertensão, e a mãe faleceu com câncer de pulmão. Sem história familiar de câncer de próstata. Fuma cerca de 2 maços por dia há 21 anos. Exame físico: PA de 120 x 80 mmHg, IMC de 23 kg/m², sem outras alterações.\n\nConsiderando as recomendações de rastreamento para esse paciente, o médico de família e comunidade deve:',
    alternativa_a: 'Solicitar colesterol total e frações, hemograma, glicemia de jejum, creatinina, PSA, radiografia de tórax, colonoscopia, realizar toque retal; orientar sobre atividade física regular.',
    alternativa_b: 'Solicitar colesterol total, glicemia de jejum, pesquisa de sangue oculto nas fezes, PSA, ofertar anti-HIV e HBsAg, realizar toque retal; orientar sobre grupo para abandono do tabagismo.',
    alternativa_c: 'Abordar mudanças no estilo de vida e cessação do tabagismo; acompanhar em consultas longitudinais as futuras possibilidades de exames quando atingir faixa etária adequada.',
    alternativa_d: 'Solicitar colesterol total, HDL e triglicerídeos, glicemia de jejum, pesquisa de sangue oculto nas fezes, ofertar testes rápidos para HIV, sífilis e hepatites B e C; realizar abordagem sobre cessação do tabagismo.',
  },
  {
    numero: 13, area: 'saude_coletiva',
    enunciado: 'Mulher de 32 anos, parda, ensino fundamental incompleto, trabalhadora rural, diarista no plantio de morango, procura UBS com queixas de tonturas, dores de cabeça, cansaço, náuseas e falta de ar. Referiu que desde os 20 anos sofre com dores de cabeça frequentes, mas há 2 semanas, após uma pulverização de agrotóxicos, começou a apresentar os sintomas descritos. Disse ainda que sua colega de trabalho apresentava queixas similares. A médica da UBS suspeita de intoxicação aguda por agrotóxicos.\n\nNessa situação, qual é a conduta adequada a ser adotada na assistência?',
    alternativa_a: 'Encaminhar como caso suspeito ao centro de referência em saúde do trabalhador estadual e formalizar denúncia ao Ministério Público do Trabalho.',
    alternativa_b: 'Estabelecer nexo causal entre os sintomas e os resultados de exames complementares, para confirmar diagnóstico, e notificar a Vigilância em Saúde municipal.',
    alternativa_c: 'Tratar os sintomas, solicitar exames complementares, notificar o caso no Sinan, conceder atestado médico e solicitar matriciamento à Vigilância em Saúde do Trabalhador.',
    alternativa_d: 'Informar não ser responsável pelo preenchimento da CAT, por ser atribuição exclusiva da medicina do trabalho.',
  },
  {
    numero: 14, area: 'pediatria',
    enunciado: 'Pais de um menino de 10 anos levam a criança para avaliação médica em UBS. Relatam que seu filho se dá bem com a família até que não lhe seja permitido fazer algo que deseja. Quando isso ocorre, ele fica irritado, impulsivamente agressivo e agitado por várias horas. Assim que se acalma ou consegue o que quer, fica feliz e agradável novamente. Os pais entendem que o filho parece agir deliberadamente para aborrecer os outros e nunca assume a culpa por seus próprios erros ou mau comportamento. Relatam ainda que ele discute com adultos ou figuras de autoridade e em várias situações não aceita as regras de boa convivência com os familiares.\n\nConsiderando o caso descrito, qual é o diagnóstico mais provável?',
    alternativa_a: 'Transtorno afetivo bipolar.',
    alternativa_b: 'Transtorno de oposição desafiante.',
    alternativa_c: 'Transtorno disruptivo da desregulação do humor.',
    alternativa_d: 'Transtorno do déficit de atenção e hiperatividade.',
  },
  {
    numero: 15, area: 'clinica_medica',
    enunciado: 'Homem de 50 anos, queixando-se de astenia e constipação com fezes em fita. Há 15 dias apresenta edema de membros inferiores até a raiz da região crural, bilateralmente, com pouca melhora à elevação dos membros. Perdeu 10 kg em 6 meses. Nega HAS e DM. Exames: PA 130x80, peso 70kg, Ht 35%, glicemia 88, albumina sérica 1,8 g/dL, creatinina 1,2, triglicerídeos 200, proteína urinária 3,6 g/24h, proteínas +++, sedimento hemácias + (5/campo).\n\nDentre esses achados laboratoriais, quais são necessários para a definição da síndrome renal do paciente?',
    alternativa_a: 'Proteína urinária de 24 horas = 3,6 g e albumina sérica = 1,8 g/dL.',
    alternativa_b: 'Proteína urinária de 24 horas = 3,6 g e triglicerídeos = 200 mg/dL.',
    alternativa_c: 'Hematúria e triglicerídeos = 200 mg/dL.',
    alternativa_d: 'Hematúria e albumina sérica = 1,8 g/dL.',
  },
  {
    numero: 16, area: 'pediatria',
    enunciado: 'Recém-nascido de 15 dias, a termo, Apgar 8/9, peso e comprimento ao nascer de 2.600 g e 46 cm, com síndrome de Down, gestação sem outras intercorrências. Na consulta de puericultura com peso e comprimento atuais de 2.900 g e 47 cm.\n\nPara o acompanhamento pôndero-estatural, os dados devem ser plotados nas',
    alternativa_a: 'Curvas de crescimento da OMS desde o nascimento até a adolescência.',
    alternativa_b: 'Curvas de crescimento específicas para síndrome de Down.',
    alternativa_c: 'Curvas de crescimento da OMS, corrigindo o peso e o comprimento para síndrome de Down.',
    alternativa_d: 'Curvas de crescimento da OMS até os dois anos e, a partir daí, em curvas específicas para síndrome de Down.',
  },
  {
    numero: 17, area: 'cirurgia',
    enunciado: 'Paciente de 20 anos, sexo masculino, vítima de colisão "automóvel a muro", sem cinto de segurança, é atendido pelo SAMU. Exame físico: torporoso; SatO₂ 60% em ar ambiente; FR 28 irpm; FC 112 bpm; PA 90x50 mmHg. Desvio da traqueia para a direita, turgência jugular, hipofonese de bulhas cardíacas e diminuição acentuada do murmúrio vesicular à esquerda.\n\nQual é a conduta adequada no atendimento pré-hospitalar?',
    alternativa_a: 'Reposição volêmica.',
    alternativa_b: 'Cricotireoidostomia.',
    alternativa_c: 'Pericardiocentese.',
    alternativa_d: 'Toracocentese.',
  },
  {
    numero: 18, area: 'ginecologia_obstetricia',
    enunciado: 'Paciente de 16 anos comparece ao ambulatório para mostrar resultados de exames. Está preocupada porque todas as colegas da mesma idade já menstruaram e ela não. O fenótipo é feminino, com pelos pubianos e axilares esparsos. Os exames evidenciam ausência do útero à ultrassonografia pélvica, dosagem de FSH normal, dosagem de testosterona sérica compatível com níveis do sexo masculino e cariótipo 46 XY.\n\nCom base no quadro clínico, a principal hipótese diagnóstica é',
    alternativa_a: 'Disgenesia gonadal.',
    alternativa_b: 'Malformação Mulleriana.',
    alternativa_c: 'Obstrução do trato genital.',
    alternativa_d: 'Insensibilidade androgênica.',
  },
  {
    numero: 19, area: 'clinica_medica',
    enunciado: 'Mulher de 82 anos, sem história prévia de hipertensão, comparece à consulta preocupada porque aferiu a pressão na farmácia há 1 semana e estava em 146 x 86 mmHg. Em outra aferição há 2 semanas, na unidade de saúde, estava em 144 x 88 mmHg. No momento da consulta, a pressão está em 148 x 88 mmHg. Não apresenta sintomas nem está em acompanhamento de outros agravos.\n\nQual é a abordagem adequada nesse caso?',
    alternativa_a: 'Referenciar ao cardiologista para um manejo específico.',
    alternativa_b: 'Solicitar holter 24 horas e ecocardiograma para ampliar a avaliação.',
    alternativa_c: 'Prescrever losartana 50 mg, 1 comprimido à noite, com monitoramento da PA na unidade.',
    alternativa_d: 'Realizar conduta expectante, sem necessidade de medicamentos, com monitoramento de PA na unidade.',
  },
  {
    numero: 20, area: 'saude_coletiva',
    enunciado: 'Mulher travesti de 28 anos, profissional do sexo, comparece à UBS em demanda espontânea. Relata relações sexuais frequentes com diferentes parceiros, com uso inconsistente de preservativos, principalmente durante relações anais receptivas. Há 2 dias teve relação sexual desprotegida com um cliente que se recusou a usar camisinha. Nunca utilizou PrEP ou PEP. Está assintomática no momento.\n\nQual a melhor estratégia de prevenção?',
    alternativa_a: 'Prescrever PrEP após resultado não reagente para HIV; indicar PEP após tratamento inicial e orientar rastreamento de ISTs a cada 3 meses.',
    alternativa_b: 'Oferecer teste rápido para HIV e sífilis; prescrever PrEP de início imediato; orientar sobre as vacinas disponíveis no SUS para seu grupo populacional.',
    alternativa_c: 'Realizar testagem rápida para HIV e sífilis; prescrever PEP mediante resultado não reagente para HIV e programar início da PrEP após término da PEP.',
    alternativa_d: 'Prescrever PEP e PrEP de forma concomitante; solicitar sorologias para ISTs; agendar retorno para analisar os resultados e revisar adesão ao tratamento.',
  },
  {
    numero: 21, area: 'saude_coletiva',
    enunciado: 'Mulher de 21 anos comparece à consulta em UBS para avaliação de amenorreia há 4 meses, sendo descartada gravidez. Relata que há 10 meses iniciou dieta para perder peso, tendo emagrecido aproximadamente 30 kg. Há 2 dias relata desmaio durante prática de exercício físico e, por isso, realizou ECG que indicou alterações no segmento ST e na onda T. Nega histórico de diagnóstico de transtorno mental, mora sozinha. Afirma manter o padrão alimentar, pois ainda quer perder peso. Ao exame: palidez de mucosa, turgor cutâneo diminuído. Altura 1,63 m; peso 39 kg (IMC 14,7); PA 80x60; FC 55; FR 15.\n\nQual é a conduta adequada nesse momento?',
    alternativa_a: 'Solicitar internação em enfermaria de clínica médica.',
    alternativa_b: 'Encaminhar para internação em enfermaria de saúde mental.',
    alternativa_c: 'Continuar a investigação para causas da amenorreia na UBS.',
    alternativa_d: 'Acompanhar em ambulatório do Centro de Atenção Psicossocial (CAPS).',
  },
  {
    numero: 22, area: 'saude_coletiva',
    enunciado: 'A violência contra adolescentes pode ter várias causas e atores. Os sinais que demonstram essas ações podem ser indiretos, mas devem ser observados pelos profissionais da saúde. Assinale a alternativa com a situação em que se deve notificar o Conselho Tutelar.',
    alternativa_a: 'Manuel, 15 anos, abandonado pelos pais e sob os cuidados de uma família acolhedora, apresenta febre, vômitos, petéquias que evoluem para púrpuras, rigidez de nuca e história vacinal desconhecida.',
    alternativa_b: 'Michele, 13 anos, está morando temporariamente com os tios. Há 1 mês apresenta equimoses em face, pernas, coxas, em vários estágios de evolução, e evita falar sobre o fato.',
    alternativa_c: 'Felipe, 11 anos, acolhido em abrigo desde os 9 anos, há 3 dias está mais recolhido. Apresenta febre, dor no corpo e retro-orbitária, sangramento gengival e petéquias.',
    alternativa_d: 'Edilene, 16 anos, em medidas socioeducativas, apresenta equimoses em MMSS e MMII, além do tronco. Refere suores noturnos, febre, perda de peso e linfonodos aumentados.',
  },
  {
    numero: 23, area: 'saude_coletiva',
    enunciado: 'Homem de 34 anos se dirige à UBS com febre (38,5 °C), dores de moderada intensidade e manchas no corpo há 3 dias. No dia da consulta, iniciou com dores abdominais e vômitos incontroláveis. Exame físico: prostrado, mucosas coradas, extremidades bem perfundidas. PA 120x80; FR 16; FC 80. Leve dor à palpação abdominal, sem outras alterações.\n\nQual a hipótese diagnóstica e o manejo, respectivamente?',
    alternativa_a: 'Dengue grupo B. Hidratação oral, analgésico e antiemético; hemograma, plaquetas e NS1; acompanhamento domiciliar após exames.',
    alternativa_b: 'Dengue grupo C. Hidratação oral, analgésico e antiemético; hemograma, plaquetas e IgM; acompanhamento ambulatorial após exames.',
    alternativa_c: 'Dengue grupo C. Hidratação parenteral, analgésico e antiemético; hemograma, plaquetas e NS1; leito de observação até estabilização.',
    alternativa_d: 'Dengue grupo B. Hidratação parenteral, analgésico e antiemético; hemograma, plaquetas, NS1 e IgM; leito de observação até estabilização.',
  },
  {
    numero: 24, area: 'cirurgia',
    enunciado: 'Paciente do sexo feminino, 27 anos, é atendida em UPA com história de dor abdominal, com início em epigástrio há dois dias, contínua, sem fatores de melhora, associada a náuseas e perda de apetite, evoluindo para dor em fossa ilíaca direita há 1 dia e febre de 38,2 °C. Nega comorbidades ou cirurgias prévias. Última menstruação há 23 dias, ciclos regulares de 28 dias.\n\nExame físico: regular estado geral, desidratada +/4+, ruídos hidroaéreos diminuídos, descompressão brusca dolorosa em quadrante inferior direito. Hemoglobina 10,7; Ht 37%; leucócitos 13.400 com 7% bastonetes; urina 25 leucócitos/campo; beta-hCG negativo.\n\nA conduta é',
    alternativa_a: 'Antibioticoterapia e alta com reavaliação.',
    alternativa_b: 'Tomografia de abdome com contraste e observação.',
    alternativa_c: 'Laparoscopia diagnóstica e exploratória.',
    alternativa_d: 'Apendicectomia.',
  },
  {
    numero: 25, area: 'ginecologia_obstetricia',
    enunciado: 'Multípara, 37 semanas, obesa, apresentando diabetes mellitus gestacional controlada com insulina NPH e regular. Evoluiu para parto normal, e o recém-nascido pesou 3.300 g. A conduta no puerpério imediato deve ser:',
    alternativa_a: 'Suspender insulinoterapia.',
    alternativa_b: 'Iniciar hipoglicemiante oral.',
    alternativa_c: 'Manter insulina NPH em 1/3 da dose da gravidez.',
    alternativa_d: 'Manter insulinoterapia com a dosagem do pré-natal.',
  },
  {
    numero: 26, area: 'clinica_medica',
    enunciado: 'Homem de 34 anos se dirige à UBS com febre (38,5 °C), dores de moderada intensidade e manchas no corpo há 3 dias. No dia da consulta iniciou dores abdominais e vômitos incontroláveis. Exame físico: prostrado, mucosas coradas, extremidades bem perfundidas. PA 120x80 mmHg; FR 16 irpm; FC 80 bpm. Leve dor à palpação abdominal.\n\nQual a hipótese diagnóstica e o manejo?',
    alternativa_a: 'Dengue grupo B. Hidratação oral, analgésico e antiemético; hemograma, plaquetas e NS1; acompanhamento domiciliar.',
    alternativa_b: 'Dengue grupo C. Hidratação oral, analgésico e antiemético; hemograma, plaquetas e IgM; acompanhamento ambulatorial.',
    alternativa_c: 'Dengue grupo C. Hidratação parenteral, analgésico e antiemético; hemograma, plaquetas e NS1; leito de observação até estabilização.',
    alternativa_d: 'Dengue grupo B. Hidratação parenteral, analgésico e antiemético; hemograma, plaquetas, NS1 e IgM; leito de observação.',
  },
  {
    numero: 27, area: 'saude_coletiva',
    enunciado: 'Homem de 48 anos, auxiliar de pedreiro, procura UBS com queixa de dor lombar iniciada há 3 semanas, de instalação insidiosa, sem irradiação. Relata que a dor piora ao final do dia e melhora parcialmente com repouso e paracetamol. Nega perda de peso, febre, traumas, incontinência ou fraqueza nos MMII. Ao exame: dor à palpação paravertebral lombar, sem alterações neurológicas.\n\nQual o próximo passo na condução desse caso?',
    alternativa_a: 'Solicitar RM da coluna lombar e encaminhar para ortopedia.',
    alternativa_b: 'Solicitar radiografia lombar, prescrever corticoide oral e agendar retorno após 10 dias.',
    alternativa_c: 'Orientar repouso, fornecer atestado de 7 dias e otimizar analgesia com antidepressivo tricíclico.',
    alternativa_d: 'Explicar a natureza benigna, orientar analgesia e atividade física leve, com reavaliação em 4 a 6 semanas.',
  },
  {
    numero: 28, area: 'saude_coletiva',
    enunciado: 'Sobre a internação involuntária no Brasil, é correto afirmar que',
    alternativa_a: 'A internação involuntária é determinada, de acordo com a legislação, pela Justiça.',
    alternativa_b: 'É autorizada por médico devidamente registrado no Conselho Regional de Medicina.',
    alternativa_c: 'No prazo de 15 dias, a internação deve ser comunicada ao Ministério Público Federal.',
    alternativa_d: 'O término da internação involuntária ocorrerá por solicitação do Ministério Público Municipal.',
  },
  {
    numero: 29, area: 'clinica_medica',
    enunciado: 'Homem de 68 anos, em tratamento crônico irregular de HAS, DM e fibrilação atrial, é admitido em UPA com rebaixamento do nível de consciência e déficit neurológico esquerdo, de predomínio braquiofacial. Havia ido se deitar há 90 minutos sem sintomas. Exame: Glasgow 9, hemiparesia acentuada à esquerda, PA 170x100 mmHg, ritmo irregular, FC 96. Glicemia 285 mg/dL. TC de crânio sem contraste: área de atenuação em ~40% do território da artéria cerebral média direita, laudo obtido ~3 horas após.\n\nO paciente apresenta contraindicação à trombólise em função de',
    alternativa_a: 'Apresentar extensão de isquemia superior a 1/3 do território da artéria cerebral média acometida.',
    alternativa_b: 'Haver decorrido período de tempo superior ao limite máximo tolerável desde o início do déficit.',
    alternativa_c: 'Evoluir com glicemia acima de 200 mg/dL com intervalo maior que 2 horas pós-prandial.',
    alternativa_d: 'Ter níveis pressóricos superiores aos permitidos para o uso do fármaco.',
  },
  {
    numero: 30, area: 'cirurgia',
    enunciado: 'Mulher de 72 anos com emagrecimento e dor abdominal com irradiação dorsal há 3 meses; há 1 mês urina mais escura, prurido cutâneo intenso e icterícia em escleras. Ao exame: ictérica +++/4+, emagrecida; fígado palpável e massa cística não dolorosa em hipocôndrio direito.\n\nO mais adequado é solicitar',
    alternativa_a: 'Ultrassonografia para avaliar colecistite crônica calculosa.',
    alternativa_b: 'Tomografia computadorizada para avaliar vias biliares e pâncreas.',
    alternativa_c: 'Colangiopancreatografia por ressonância para avaliar coledocolitíase.',
    alternativa_d: 'Biópsia percutânea com agulha da massa palpada para avaliar neoplasia.',
  },
  {
    numero: 31, area: 'pediatria',
    enunciado: 'Menino de 6 anos é levado à UBS com queixa de fimose. Mãe relata balanopostites frequentes, sendo o primeiro episódio com 1 ano de vida. Nega infecções do trato urinário. Ao exame físico, apresenta prepúcio cobrindo toda a glande que, quando tracionado, expõe meato uretral e anel fibrótico prepucial.\n\nSobre o caso, assinale a alternativa correta.',
    alternativa_a: 'Trata-se de fimose fisiológica, necessitando de exercícios de redução e higiene do prepúcio.',
    alternativa_b: 'Há indicação cirúrgica, pois a criança apresenta balanopostites recorrentes com fibrose prepucial.',
    alternativa_c: 'Há indicação cirúrgica na adolescência, pois já está apresentando exposição de meato uretral.',
    alternativa_d: 'Indica-se uso de creme de betametasona e hialuronidase por 4 semanas, uma vez que apresenta exposição de meato uretral.',
  },
  {
    numero: 32, area: 'ginecologia_obstetricia',
    enunciado: 'Paciente G5P3C1, 35 anos, IG 15 semanas por ecografia realizada com 8 semanas, hipertensa crônica em uso de enalapril, antecedente de pré-eclâmpsia. Comparece à consulta de pré-natal na UBS com PA 140 x 90 mmHg.\n\nQual é a conduta medicamentosa indicada?',
    alternativa_a: 'Captopril, varfarina e ácido acetilsalicílico.',
    alternativa_b: 'Furosemida, varfarina e carbonato de cálcio.',
    alternativa_c: 'Losartana, enoxaparina e carbonato de cálcio.',
    alternativa_d: 'Alfa-metildopa, ácido acetilsalicílico e carbonato de cálcio.',
  },
  {
    numero: 33, area: 'saude_coletiva',
    enunciado: 'Homem de 48 anos busca atendimento na UBS para reiniciar tratamento para tuberculose. Iniciou poliquimioterápico há 6 meses, porém há 2 meses interrompeu por uso de substâncias psicoativas. Mudou-se para o território há 15 dias. Foram solicitados TRM-TB, baciloscopia de escarro e radiografia de tórax.\n\nQual a conduta adequada?',
    alternativa_a: 'Se TRM-TB positivo, sem resistência à rifampicina, e baciloscopia negativa, reiniciar esquema básico.',
    alternativa_b: 'Se TRM-TB negativo e baciloscopia positiva, reiniciar esquema básico desde que resistência à rifampicina seja positiva.',
    alternativa_c: 'Se TRM-TB negativo e baciloscopia positiva, solicitar cultura com teste de sensibilidade e reiniciar esquema básico enquanto aguarda a cultura.',
    alternativa_d: 'Se TRM-TB positivo, com resistência à rifampicina, e baciloscopia positiva, solicitar cultura com TSA e reiniciar esquema básico enquanto aguarda.',
  },
  {
    numero: 34, area: 'saude_coletiva',
    enunciado: 'Mulher de 52 anos chega ao acolhimento da UBS muito chorosa e relata: "Estou com dificuldade para dormir, não tenho comido direito... é o meu filho, ele morreu há 3 dias... e a dor no meu coração está muito forte." Após o acolhimento, relata que não pensa em se matar, nunca foi atendida por psiquiatra e precisa de ajuda.\n\nQual a conduta adequada?',
    alternativa_a: 'Prescrever inibidor de recaptação de serotonina para alívio dos sintomas depressivos e ansiosos.',
    alternativa_b: 'Acompanhar longitudinalmente para observação e ofertar apoio pela equipe da UBS.',
    alternativa_c: 'Encaminhar ao CAPS para seguimento intensivo com psiquiatra.',
    alternativa_d: 'Encaminhar para psicologia na atenção secundária para terapia psicanalítica breve.',
  },
  {
    numero: 35, area: 'clinica_medica',
    enunciado: 'Mulher de 86 anos é levada à consulta com queixa de quedas frequentes. Tem HAS, DM2, dislipidemia, depressão, déficit cognitivo leve e constipação. Usa losartana, HCTZ, atenolol, metformina, gliclazida, rosuvastatina, escitalopram, donepezila e lactulose. Quedas mais frequentes na madrugada. Ao exame: bradipsiquismo, sarcopenia; PA deitada 138x92 mmHg, sentada 110x70 mmHg.\n\nO plano terapêutico deve incluir:',
    alternativa_a: 'Sugerir avaliação oftalmológica para investigação de catarata.',
    alternativa_b: 'Encaminhar ao neurologista para investigar disautonomia.',
    alternativa_c: 'Rever a polifarmácia para reduzir fármacos indutores de hipotensão arterial.',
    alternativa_d: 'Adicionar fármaco para elevar níveis tensionais, como fludrocortisona.',
  },
  {
    numero: 36, area: 'clinica_medica',
    enunciado: 'Mulher de 86 anos é levada à consulta com queixas de quedas frequentes. Tem diagnóstico de HAS, DM2, dislipidemia, depressão, déficit cognitivo leve e constipação. O plano terapêutico apropriado ao contexto desse caso deve incluir:',
    alternativa_a: 'Avaliação oftalmológica para catarata.',
    alternativa_b: 'Encaminhamento ao neurologista para disautonomia.',
    alternativa_c: 'Revisão da polifarmácia para reduzir fármacos hipotensores.',
    alternativa_d: 'Adição de fludrocortisona para elevar PA.',
  },
  {
    numero: 37, area: 'pediatria',
    enunciado: 'Menino, 10 anos, morador de área urbana, com dor em cotovelo direito há 1 dia. Há 1 semana, febre de 38,5 °C, dificuldade de deambular pelo joelho direito "doloroso e inchado". Após 4 dias, melhora do joelho, mas o tornozelo ficou "inchado e avermelhado", com melhora em 2 dias. Há 3 semanas, dor de garganta. No atendimento: dificuldade para movimentar cotovelo direito, FC 110 bpm, sopro sistólico 3+/6+.\n\nO agente etiológico e tratamento de escolha são, respectivamente,',
    alternativa_a: 'Borrelia burgdorferi; doxiciclina.',
    alternativa_b: 'Staphylococcus aureus; oxacilina.',
    alternativa_c: 'Treponema pallidum; penicilina G benzatina.',
    alternativa_d: 'Streptococcus pyogenes; penicilina G benzatina.',
  },
  {
    numero: 38, area: 'ginecologia_obstetricia',
    enunciado: 'Primigesta de 29 anos, com 41 semanas de gestação e pré-natal de risco habitual, comparece à UBS. Assintomática, movimentação fetal presente, exame físico normal para a IG. Perfil biofísico fetal há 1 dia dentro da normalidade.\n\nConsiderando o quadro e a idade gestacional, a conduta é',
    alternativa_a: 'Orientar repouso domiciliar, com planejamento da indução após 42 semanas.',
    alternativa_b: 'Solicitar dopplervelocimetria para avaliar bem-estar fetal e planejar manejo.',
    alternativa_c: 'Realizar amnioscopia para verificar mecônio e planejar manejo.',
    alternativa_d: 'Solicitar perfil biofísico fetal e CTG a cada 2-3 dias e planejamento de indução até 41 semanas e 6 dias.',
  },
  {
    numero: 39, area: 'cirurgia',
    enunciado: 'Homem de 58 anos com dor epigástrica irradiada para as costas, há 2 horas, progressiva, pós-prandial, com náuseas, vômitos e sudorese. Episódios semelhantes no último ano. Tabagista ativo, alcoolista de 8 doses/dia há 33 anos. Exame: sudoreico, IMC 23, PA 150x90, abdome globoso, distendido, timpânico, doloroso em epigástrio e HCE. Amilase e lipase NORMAIS. Sem icterícia.\n\nQual o provável diagnóstico?',
    alternativa_a: 'Colangite aguda.',
    alternativa_b: 'Colecistite aguda.',
    alternativa_c: 'Doença ulcerosa péptica.',
    alternativa_d: 'Pancreatite crônica.',
  },
  {
    numero: 40, area: 'cirurgia',
    enunciado: 'Questão excluída do cálculo dos resultados por desajuste ao modelo estatístico.',
    alternativa_a: 'Alternativa A.',
    alternativa_b: 'Alternativa B.',
    alternativa_c: 'Alternativa C.',
    alternativa_d: 'Alternativa D.',
  },
  {
    numero: 41, area: 'clinica_medica',
    enunciado: 'Homem de 21 anos, DM tipo 1 diagnosticado há 5 anos, é levado à UPA com dor abdominal, náuseas e vômitos. Sem insulina há 3 dias por dificuldades financeiras. Torporoso, desidratado, hálito cetótico. FC 112, FR 38, PA 110x70. Glicemia 472, pH 7,2, bicarbonato 10 mEq/L, creatinina 1,6, potássio 3,0 mEq/L.\n\nO diagnóstico e conduta inicial são, respectivamente,',
    alternativa_a: 'Pancreatite aguda; iniciar dieta oral zero.',
    alternativa_b: 'Estado hiperosmolar hiperglicêmico; iniciar insulinoterapia.',
    alternativa_c: 'Cetoacidose diabética; prescrever solução fisiológica a 0,9%.',
    alternativa_d: 'Insuficiência renal aguda; prescrever bicarbonato de sódio.',
  },
  {
    numero: 42, area: 'pediatria',
    enunciado: 'RN de 14 dias, hipoativo, com desconforto respiratório. Sem pré-natal, parto a termo no domicílio. Hipoativo, cianótico, FR 70, tiragem subcostal, MV diminuído bilateralmente, SatO₂ 82%, pulsos débeis, TEC 5s, FC 160 bpm, fígado a 2,5 cm do RCD, hiperemia e edema ao redor do coto umbilical.\n\nO diagnóstico e as condutas são, respectivamente,',
    alternativa_a: 'Choque cardiogênico; suporte ventilatório, evitar excesso de volume, vasoativos e prostaglandina E1.',
    alternativa_b: 'Choque neurogênico; suporte ventilatório, cristaloide isotônico, hidratação de manutenção e corticoide EV.',
    alternativa_c: 'Choque obstrutivo; suporte ventilatório, cristaloide isotônico e descompressão torácica com agulha.',
    alternativa_d: 'Choque distributivo; suporte ventilatório, cristaloide isotônico, hidratação de manutenção, antibióticos e vasoativos.',
  },
  {
    numero: 43, area: 'ginecologia_obstetricia',
    enunciado: 'Parturiente de 29 anos, sem comorbidades, em trabalho de parto por 8 horas, evoluiu para parto vaginal. Após 10 minutos do desprendimento do feto, ainda não se observou a expulsão da placenta. Paciente estável e sem sinais de hemorragia.\n\nA conduta é',
    alternativa_a: 'Aguardar a expulsão espontânea da placenta, sem intervenções, e observar sinais de separação.',
    alternativa_b: 'Realizar tração controlada do cordão umbilical enquanto se estabiliza o útero com a mão suprapúbica.',
    alternativa_c: 'Iniciar curagem placentária, devido ao tempo transcorrido sem desprendimento.',
    alternativa_d: 'Administrar uterotônico adicional e realizar massagem uterina para auxiliar a dequitação.',
  },
  {
    numero: 44, area: 'saude_coletiva',
    enunciado: 'Paciente de 27 anos, em regime fechado em penitenciária, queixa-se de tosse há 2 semanas. Considerando a situação, o médico de família e comunidade deve',
    alternativa_a: 'Encaminhar para internação clínica visando rapidez no diagnóstico e segurança.',
    alternativa_b: 'Solicitar radiografia de tórax, pesquisa laboratorial de Mycobacterium tuberculosis e garantir o tratamento em caso de positividade.',
    alternativa_c: 'Solicitar internação social para tratamento supervisionado por 6 meses, caso confirmada TB.',
    alternativa_d: 'Aguardar evolução com sintomáticos; caso tosse persista por mais de 3 semanas, investigar TB.',
  },
  {
    numero: 45, area: 'cirurgia',
    enunciado: 'Homem de 66 anos, em pós-operatório precoce de revascularização cardíaca, apresenta dor abdominal progressiva em QIE há 5 dias, piora há 1 dia, com aumento de evacuações para 3x/dia. Febre não aferida. Exame: BEG, eupneico, PA 110x60, Tax 38°C, FC 100, defesa voluntária e dor à palpação em QIE, massa em QIE. Ao toque retal, massa flutuante dolorosa à esquerda. TC: densificação e coleção de 100 mm³ junto ao sigmoide.\n\nApós antibioticoterapia sistêmica, qual a conduta mais adequada?',
    alternativa_a: 'Laparotomia para drenagem.',
    alternativa_b: 'Tratamento clínico conservador.',
    alternativa_c: 'Drenagem guiada por colonoscopia.',
    alternativa_d: 'Drenagem percutânea guiada por tomografia.',
  },
  {
    numero: 46, area: 'clinica_medica',
    enunciado: 'Homem de 32 anos com dor lombar crônica insidiosa há 6 meses, piora matinal, melhora com movimento. Rigidez matinal >30 min em regiões lombar e sacroilíaca, dor nas sacroilíacas e fadiga. Sem histórico de trauma. HF positiva para doenças reumatológicas. ANA positivo 1:80 padrão homogêneo, anti-DNA negativo, HLA-B27 positivo, FR negativo, anti-CCP negativo.\n\nCom base no diagnóstico provável, o exame complementar e conduta adequada são, respectivamente,',
    alternativa_a: 'Ressonância magnética; programação cirúrgica.',
    alternativa_b: 'Tomografia de tórax; lobectomia segmentar.',
    alternativa_c: 'Ressonância magnética de sacroilíacas; anti-inflamatório não esteroidal.',
    alternativa_d: 'Ultrassonografia; toracocentese.',
  },
  {
    numero: 47, area: 'pediatria',
    enunciado: 'Adolescente de 12 anos é levada à UBS para verificar se vacinas estão atualizadas. Até os 8 anos, todas as vacinas preconizadas pelo MS foram feitas, sendo que tomou 1 dose da vacina contra febre amarela aos 9 meses. Nesse momento, deve receber as vacinas:',
    alternativa_a: 'HPV, reforço da hepatite B e dT.',
    alternativa_b: 'Reforço da hepatite B, dT e SCR.',
    alternativa_c: 'HPV, meningocócica ACWY e febre amarela.',
    alternativa_d: 'SCR, meningocócica ACWY e febre amarela.',
  },
  {
    numero: 48, area: 'clinica_medica',
    enunciado: 'Paciente masculino de 36 anos, tabagista, ascensorista. Tosse seca persistente >3 semanas, febre vespertina, dificuldade respiratória aos esforços e dor infraescapular à esquerda. Exame: BEG, orientado, emagrecido, descorado, afebril. MV diminuídos e percussão maciça em base de tórax à esquerda.\n\nCom base no caso, qual o diagnóstico mais provável?',
    alternativa_a: 'Artrite reativa.',
    alternativa_b: 'Artrite psoriática.',
    alternativa_c: 'Espondilite anquilosante.',
    alternativa_d: 'Tuberculose pleural.',
  },
  {
    numero: 49, area: 'ginecologia_obstetricia',
    enunciado: 'Nulípara de 30 anos, com lúpus eritematoso sistêmico e história recente de trombose venosa, apresenta ciclos menstruais prolongados de 8-10 dias, com intenso sangramento e cólicas fortes, busca orientação sobre contracepção. Considerando os critérios de elegibilidade, qual a melhor opção?',
    alternativa_a: 'DIU de cobre.',
    alternativa_b: 'DIU de levonorgestrel.',
    alternativa_c: 'Anticoncepcional injetável mensal.',
    alternativa_d: 'Pílula anticoncepcional combinada contínua.',
  },
  {
    numero: 50, area: 'clinica_medica',
    enunciado: 'Homem de 55 anos, DM2, em uso de metformina 850 mg 3x/dia e glicazida 30 mg 1x/dia há mais de 6 meses. HbA1c 9,5% e creatinina 0,8 mg/dL. Qual a conduta mais adequada?',
    alternativa_a: 'Suspender orais, iniciar insulina NPH 10 UI manhã e 20 UI noite. Monitorar glicemia pré-prandial.',
    alternativa_b: 'Aumentar glicazida para 60 mg/dia, metformina para 1 g 3x/dia, repetir exames em 1 mês.',
    alternativa_c: 'Manter metformina e glicazida, iniciar insulina NPH 10 UI à noite, monitorar glicemia de jejum. Ajustar 2-3 UI a cada 2-3 dias.',
    alternativa_d: 'Trocar glicazida por glibenclamida 20 mg/dia, aumentar metformina para 1 g 3x/dia, novos exames em 1 mês.',
  },
  {
    numero: 51, area: 'clinica_medica',
    enunciado: 'Homem de 38 anos retorna ao ambulatório onde faz acompanhamento de retocolite ulcerativa. Exames mostram elevação significativa de fosfatase alcalina e gama-GT, discreta elevação de aminotransferases, sem hiperbilirrubinemia. Refere leve desconforto em HCD. Sem icterícia, febre ou Murphy.\n\nConsiderando a doença de base, o exame indicado e resultado provável são,',
    alternativa_a: 'TC de abdome; lesão tumoral no hilo hepático.',
    alternativa_b: 'CPRE; litíase impactada no colédoco terminal.',
    alternativa_c: 'Colangiorressonância; múltiplas estenoses intercaladas na árvore biliar, com áreas normais ou dilatadas.',
    alternativa_d: 'USG abdominal; espessamento de parede da vesícula com nodulação interna, sem sombra acústica.',
  },
  {
    numero: 52, area: 'pediatria',
    enunciado: 'Mãe de menina de 11 meses em consulta de puericultura, sem queixas. A criança está começando a trocar passos de maneira independente. Marcos anteriores normais. Gestação e parto sem intercorrências.\n\nO reflexo primitivo usualmente presente nessa faixa etária é o',
    alternativa_a: 'Reflexo plantar.',
    alternativa_b: 'Reflexo de Moro.',
    alternativa_c: 'Reflexo de procura.',
    alternativa_d: 'Reflexo tônico cervical.',
  },
  {
    numero: 53, area: 'cirurgia',
    enunciado: 'Ao considerar a situação clínica do paciente e a imagem tomográfica apresentada, o médico diagnosticou',
    alternativa_a: 'Hematoma subdural agudo; hidantalização e aguardar melhora clínica.',
    alternativa_b: 'Contusão cerebral; cirurgia de emergência para controle de hipertensão intracraniana.',
    alternativa_c: 'Hematoma epidural; cirurgia de emergência para controle da hipertensão intracraniana.',
    alternativa_d: 'Hematoma intraparenquimatoso; hidantalização e aguardar melhora clínica.',
  },
  {
    numero: 54, area: 'ginecologia_obstetricia',
    enunciado: 'Adolescente de 15 anos comparece em consulta ginecológica para iniciar contracepção. HPP: enxaqueca com aura. HF: avó materna com câncer de mama, mãe hipertensa, irmã diabética.\n\nO uso do contraceptivo combinado está contraindicado devido ao risco de',
    alternativa_a: 'Câncer de mama.',
    alternativa_b: 'Diabetes mellitus.',
    alternativa_c: 'Acidente vascular cerebral.',
    alternativa_d: 'Hipertensão arterial sistêmica.',
  },
  {
    numero: 55, area: 'saude_coletiva',
    enunciado: 'Ao visitar um idoso acamado de 80 anos, restrito ao lar e dependente em AVDs, a médica verificou que não recebeu vacinas indicadas pelo MS. A filha cuidadora respondeu que o pai é muito frágil e não aguentaria os efeitos colaterais.\n\nAssinale a alternativa que inclui vacinas disponibilizadas no calendário nacional para o idoso e uma forma de abordar a situação.',
    alternativa_a: 'Pneumocócica 23v (1 dose + reforço em 5 anos); dT a cada 10 anos; influenza e covid-19 anualmente; hepatite B (3 doses). Agendar nova visita domiciliar.',
    alternativa_b: 'Pneumocócica 13v (2 doses); influenza anualmente; hepatite B (3 doses). Encaminhar ao CRIE.',
    alternativa_c: 'dT a cada 10 anos; influenza anualmente. Respeitar autonomia da filha.',
    alternativa_d: 'Influenza e covid-19 anualmente. Orientar sobre riscos e benefícios por telefone.',
  },
  {
    numero: 56, area: 'saude_coletiva',
    enunciado: 'O vírus Chikungunya é transmitido pelo mosquito Aedes sp e foi responsável por grandes epidemias. As ações de controle do Aedes sp incluem o manejo integrado de vetores, que envolve atividades executadas em processo cíclico, tais como',
    alternativa_a: 'Levantamento do índice larvário, notificação de vetores infectados e avaliação dos indicadores entomológicos e epidemiológicos.',
    alternativa_b: 'Treinamento da equipe de controle de vetores, uso intensivo de inseticidas, mutirões de limpeza e tratamento de pontos estratégicos.',
    alternativa_c: 'Vigilância virológica, notificação semanal dos casos suspeitos em áreas sem transmissão e definição do local provável de infecção.',
    alternativa_d: 'Análise situacional com base em informações epidemiológicas e entomológicas, desenho das operações de planificação, implementação, monitoramento e avaliação.',
  },
  {
    numero: 57, area: 'pediatria',
    enunciado: 'Criança de 9 anos com TDAH há 2 anos, usa metilfenidato há 1 ano. Pai informa grande melhora na escola e solicita extensão do uso. Quais estratégias de monitoramento referentes ao uso dessa medicação devem ser utilizadas?',
    alternativa_a: 'Seguimento com neuropediatra para acompanhar aumento de peso e possível dislipidemia.',
    alternativa_b: 'Testes psicodinâmicos para avaliar atenção e desempenho escolar.',
    alternativa_c: 'Hemograma e hormônios tireoidianos anuais e eventualmente antipsicóticos.',
    alternativa_d: 'Consultas periódicas para verificação de estatura, peso e PA, com nova avaliação para retirada após 1 ano.',
  },
  {
    numero: 58, area: 'clinica_medica',
    enunciado: 'Mulher de 45 anos com febre (~38 °C), mialgia, mal-estar e dor na região cervical anterior irradiada para mandíbula e orelhas. Há 2 semanas, IVAS com evolução lenta, com palpitações e tremores nos últimos 3 dias. Ao exame: febril, taquicardia desproporcional à temperatura, tremores finos. Tireoide dolorosa, firme, levemente aumentada, assimétrica, não nodular. VHS e PCR elevados.\n\nQuais exames sustentariam a hipótese e qual o tratamento?',
    alternativa_a: 'Redução da captação tireoidiana de iodo radioativo; betabloqueador e anti-inflamatório.',
    alternativa_b: 'Nódulo quente à cintilografia; tireoidectomia subtotal.',
    alternativa_c: 'Aumento de TSH, T4 livre e TRAb; ablação com iodo radioativo.',
    alternativa_d: 'Aumento de TSH, T3 e T4 livre; oseltamivir + metimazol + atenolol.',
  },
  {
    numero: 59, area: 'pediatria',
    enunciado: 'Lactente de 9 meses com crises epilépticas há 3 meses. Espasmos em flexão dos MMSS sobre o tronco, nos horários de maior sonolência. Gestação e parto normais. Interage com observador, mas não consegue ficar sentado. Manchas hipomelanóticas em MMII e tronco. RM de crânio: dois astrocitomas de células gigantes subependimárias.\n\nA principal hipótese diagnóstica é:',
    alternativa_a: 'Neurofibromatose.',
    alternativa_b: 'Esclerose tuberosa.',
    alternativa_c: 'Síndrome de Sturge-Weber.',
    alternativa_d: 'Doença de von Hippel-Lindau.',
  },
  {
    numero: 60, area: 'cirurgia',
    enunciado: 'Homem de 59 anos com dor moderada em FIE há 5 dias. Febre 38 °C nas últimas 48h. Sem comorbidades. Episódio semelhante há 1 ano com resolução espontânea e hematoquezia há 6 meses. REG, desidratado, FC 95, PA 140x90, IMC 30,5. Abdome flácido, doloroso em FIE e hipogástrio, com plastrão palpável. Leucócitos 17.000 com 7% bastões.\n\nQual o exame de maior acurácia para o diagnóstico?',
    alternativa_a: 'Radiografia abdominal em 3 posições.',
    alternativa_b: 'Colonoscopia com biópsia.',
    alternativa_c: 'Tomografia de abdome com contraste.',
    alternativa_d: 'Ultrassonografia de abdome.',
  },
  {
    numero: 61, area: 'ginecologia_obstetricia',
    enunciado: 'Mulher de 35 anos, diabética, com laqueadura tubária bilateral, queixa-se de prurido genital e disúria terminal há 7 dias. Uso recente de antibiótico para abscesso dental. Ao exame especular: edema vulvar, hiperemia, fissura, corrimento esbranquiçado e teste das aminas negativo.\n\nCom base no agente etiológico mais provável, o tratamento é:',
    alternativa_a: 'Miconazol, 1 aplicador, via vaginal, por 7 noites.',
    alternativa_b: 'Cefalexina, 2 g/dia, via oral, por 7 dias.',
    alternativa_c: 'Azitromicina 1 g/dia, via oral, por 10 dias.',
    alternativa_d: 'Metronidazol, 1 aplicador, via vaginal, por 10 noites.',
  },
  {
    numero: 62, area: 'saude_coletiva',
    enunciado: 'Médica de família foi solicitada para preencher a declaração de óbito de um paciente hipertenso há 30 anos, com AVE há 5 anos, que há 10 dias teve quadro gripal e há 1 dia agravamento respiratório com dispneia e cianose.\n\nA declaração de óbito deverá ser preenchida:',
    alternativa_a: 'Pelo IML. Parte I: a) Insuficiência respiratória aguda grave; b) Síndrome gripal; c) HAS. Parte II: AVE.',
    alternativa_b: 'Pela médica. Parte I: a) Insuficiência respiratória aguda grave; b) Pneumonia; c) Síndrome gripal. Parte II: a) AVE; b) HAS.',
    alternativa_c: 'Pelo SAMU. Parte I: a) Síndrome gripal; b) Pneumonia; c) Insuficiência respiratória aguda grave. Parte II: a) AVE; b) HAS.',
    alternativa_d: 'Pelo SVO. Parte I: a) Insuficiência respiratória aguda grave; b) AVE; c) HAS. Parte II: a) Pneumonia; b) Síndrome gripal.',
  },
  {
    numero: 63, area: 'saude_coletiva',
    enunciado: 'Uma equipe de saúde da família percebeu aumento de casos complicados de DM2. De 3.500 pacientes cadastrados, 280 são acompanhados por DM2, com 4 amputações, 28 retinopatias e 80 com DRC. A equipe decidiu elaborar um projeto de intervenção com avaliação/orientação nutricional e práticas de atividade física.\n\nQual o desenho de pesquisa para avaliar o impacto desse projeto?',
    alternativa_a: 'Estudo de caso-controle aninhado.',
    alternativa_b: 'Ensaio clínico não randomizado.',
    alternativa_c: 'Estudo de coorte retrospectivo.',
    alternativa_d: 'Ensaio clínico randomizado.',
  },
  {
    numero: 64, area: 'saude_coletiva',
    enunciado: 'Homem de 23 anos, estudante universitário, é levado à UPA por amigo que o encontrou chorando, trancado no banheiro com cartelas de medicamentos. Nega ter ingerido qualquer fármaco, mas admite pensamento suicida. Refere tristeza profunda há 2 meses, piora após término de relacionamento. Viu na internet que tomar paracetamol seria forma de morrer. Insônia, perda de apetite, queda de rendimento, isolamento. Familiares em outro estado. Afeto intensamente rebaixado.\n\nQual a conduta adequada?',
    alternativa_a: 'Encaminhar para acompanhamento em UBS.',
    alternativa_b: 'Encaminhar para psicoterapia multiprofissional na atenção primária.',
    alternativa_c: 'Encaminhar para avaliação ambulatorial com psiquiatra em CAPS I.',
    alternativa_d: 'Encaminhar para internação em enfermaria de saúde mental em hospital geral.',
  },
  {
    numero: 65, area: 'clinica_medica',
    enunciado: 'Mulher de 35 anos com diagnóstico de TVP há 2 anos, tratamento adequado com anticoagulante oral, alta com cura há 1 ano. Nos últimos 6 meses, pai e irmã também tiveram TVP. Médico solicita exames para rastreio de hipercoagulabilidade primária.\n\nQual alteração laboratorial é compatível com doença hereditária?',
    alternativa_a: 'Presença de Fator V de Leiden.',
    alternativa_b: 'Níveis aumentados de proteína S.',
    alternativa_c: 'Níveis aumentados de antitrombina III.',
    alternativa_d: 'Níveis reduzidos de Fator de Von Willebrand.',
  },
  {
    numero: 66, area: 'pediatria',
    enunciado: 'Menina de 11 anos é trazida à UPA com queda do estado geral, náuseas, dor abdominal, desidratação e hálito cetônico. Glicemia 410 mg/dL; gasometria venosa pH 7,15 e bicarbonato 13 mEq/L; cetonúria.\n\nAlém da fluidoterapia, o próximo passo é',
    alternativa_a: 'Reposição de potássio.',
    alternativa_b: 'Correção imediata da glicemia.',
    alternativa_c: 'Reposição de bicarbonato de sódio.',
    alternativa_d: 'Administração imediata de manitol.',
  },
  {
    numero: 67, area: 'cirurgia',
    enunciado: 'Homem de 26 anos, vítima de disparo de arma de fogo em braço direito há ~15 minutos. Pálido, pele fria, sudoreico, FC 120, PA 90x50, Glasgow 15. Sem hemoderivados disponíveis. Ferida perfuro-contusa em terço distal do braço direito com hemorragia pulsátil em grande volume.\n\nNo atendimento pré-hospitalar, deve-se realizar',
    alternativa_a: 'Dissecção e hemostasia com pinças; reposição com albumina e SF.',
    alternativa_b: 'Dissecção e hemostasia com pinças; reposição com SF e glicofisiológico.',
    alternativa_c: 'Compressão local e, se ineficaz, torniquete proximal fora da articulação; reposição com SF.',
    alternativa_d: 'Compressão local e, se ineficaz, torniquete proximal; reposição com albumina e SF.',
  },
  {
    numero: 68, area: 'ginecologia_obstetricia',
    enunciado: 'Mulher de 30 anos recebeu citologia oncótica com laudo de "atipias celulares escamosas de significado indeterminado, onde não se pode afastar alto grau (ASC-H)". Nega tabagismo e IST.\n\nA conduta adequada é a realização de',
    alternativa_a: 'Conização.',
    alternativa_b: 'Colposcopia.',
    alternativa_c: 'Cirurgia de alta frequência.',
    alternativa_d: 'Nova citologia oncótica em 6 meses.',
  },
  {
    numero: 69, area: 'saude_coletiva',
    enunciado: 'Homem de 45 anos procura UBS por não conseguir controlar frequência e quantidade do uso de álcool. Está faltando ao trabalho e não se lembra do que acontece quando bebe. O médico investigará pontos de dependência pelo DSM-5. Deve investigar sobre',
    alternativa_a: 'A intolerância cruzada entre outras substâncias.',
    alternativa_b: 'A aceitação e adesão à proposta de abstinência.',
    alternativa_c: 'O tempo gasto para obter a substância ou recuperar-se de seus efeitos.',
    alternativa_d: 'O tipo e a classe de substância, diferenciando se é lícita ou ilícita.',
  },
  {
    numero: 70, area: 'saude_coletiva',
    enunciado: 'Agentes penitenciários informaram aumento de queixas de prurido intenso e lesões cutâneas entre pessoas privadas de liberdade. Cada cela, prevista para 35 pessoas, está com 75. As ações prioritárias são:',
    alternativa_a: 'Isolamento dos sintomáticos, tratamento individual, higienização de colchões e fornecimento de sabão.',
    alternativa_b: 'Bloqueio coletivo com tratamento simultâneo, notificação do surto, reorganização de fluxos e medidas educativas.',
    alternativa_c: 'Tratamento tópico individualizado, prescrição restrita aos casos confirmados.',
    alternativa_d: 'Reunião com direção para transferência dos graves, folhetos informativos.',
  },
  {
    numero: 71, area: 'saude_coletiva',
    enunciado: 'Homem de 28 anos, solteiro, comparece ao CAPS com constrangimento. Relata pensamentos recorrentes e indesejados sobre sua mãe sendo vítima de violência. Há mais de 6 meses, com prejuízo pessoal e profissional. Entende que não há fundamento nessas ideias.\n\nA denominação clínica é:',
    alternativa_a: 'Delírio.',
    alternativa_b: 'Obsessão.',
    alternativa_c: 'Hipertimia.',
    alternativa_d: 'Compulsão.',
  },
  {
    numero: 72, area: 'pediatria',
    enunciado: 'Criança de 2 anos encaminhada ao matriciamento de pediatria. Há 7 dias, crise tônico-clônica generalizada em vigência de Tax 39,3 °C, duração 2 min, sem recorrência em 24h. Exame físico e neurológico compatível com IVAS, sem outras alterações.\n\nA conduta adequada é:',
    alternativa_a: 'Solicitar eletroencefalograma.',
    alternativa_b: 'Indicar profilaxia com barbitúricos.',
    alternativa_c: 'Tranquilizar e orientar puericultura de rotina.',
    alternativa_d: 'Solicitar exames laboratoriais e de imagem.',
  },
  {
    numero: 73, area: 'cirurgia',
    enunciado: 'Paciente de 47 anos, submetida a tireoidectomia total há 60 dias por carcinoma folicular restrito à glândula. No pós-operatório imediato apresentou rouquidão que não melhorou em 60 dias.\n\nQual foi o nervo lesionado durante a cirurgia?',
    alternativa_a: 'Laríngeo recorrente.',
    alternativa_b: 'Glossofaríngeo.',
    alternativa_c: 'Hipoglosso.',
    alternativa_d: 'Vago.',
  },
  {
    numero: 74, area: 'clinica_medica',
    enunciado: 'Paciente com quadro clínico compatível com tuberculose pleural. Apresenta tosse seca persistente, febre vespertina, emagrecimento e murmúrio vesicular diminuído com macicez à percussão em base de hemitórax esquerdo.\n\nO exame complementar e a conduta são, respectivamente,',
    alternativa_a: 'Toracocentese diagnóstica com análise do líquido pleural; tratamento com RIPE.',
    alternativa_b: 'Tomografia de tórax; lobectomia segmentar.',
    alternativa_c: 'Tomografia de tórax; drenagem torácica.',
    alternativa_d: 'Ultrassonografia; toracocentese.',
  },
  {
    numero: 75, area: 'ginecologia_obstetricia',
    enunciado: 'Paciente de 29 anos, nuligesta, ciclos menstruais com intervalos de 20 a 65 dias, duração de 4-10 dias. IMC 41,5 kg/m². Submeter-se-á a cirurgia bariátrica em alguns meses. Necessita de orientação para contracepção.\n\nAssinale a alternativa correta.',
    alternativa_a: 'Para contracepção efetiva e proteção endometrial, está indicado o endoceptivo antes da operação.',
    alternativa_b: 'Devido ao risco de tromboembolismo, está contraindicado o uso de métodos hormonais.',
    alternativa_c: 'Apresenta anovulação crônica, portanto deve usar preservativo masculino.',
    alternativa_d: 'Está contraindicada gravidez na perda de peso, pode usar adesivo anticoncepcional.',
  },
  {
    numero: 76, area: 'saude_coletiva',
    enunciado: 'Uma equipe de saúde da família realiza atendimento itinerante a comunidades ribeirinhas e aldeias indígenas na Região Amazônica. Uma médica observa que uma ribeirinha evita contato visual e responde com monossílabos. Um indígena Tikuna insiste na presença de um pajé.\n\nA abordagem adequada é:',
    alternativa_a: 'Padronizar rotinas clínicas e capacitar equipe para comunicação técnica.',
    alternativa_b: 'Promover espaços formativos, reconhecendo saberes e práticas das populações.',
    alternativa_c: 'Reforçar autonomia profissional com condutas baseadas em evidências.',
    alternativa_d: 'Estabelecer rotinas padronizadas uniformes.',
  },
  {
    numero: 77, area: 'saude_coletiva',
    enunciado: 'Questão sobre atendimento a populações vulneráveis e acesso à saúde em comunidades tradicionais, abordando competência cultural e articulação intersetorial.',
    alternativa_a: 'Alternativa com abordagem exclusivamente biomédica.',
    alternativa_b: 'Alternativa com abordagem culturalmente sensível e participativa.',
    alternativa_c: 'Alternativa com encaminhamento para atenção especializada.',
    alternativa_d: 'Alternativa com padronização rígida de protocolos.',
  },
  {
    numero: 78, area: 'saude_coletiva',
    enunciado: 'Mulher de 28 anos comparece à UBS. Faz uso de ACO combinado há 2 anos, sem preservativo. Namorado apresentou úlcera no pênis há 30 dias tratada com benzetacil, e teste rápido HIV reagente. Última relação há 2 dias. Exame físico sem alterações.\n\nO manejo inicial é:',
    alternativa_a: 'Teste rápido para sífilis, HIV e hepatites B e C. Se sífilis reagente, penicilina benzatina. TDF/3TC + DTG por 28 dias (PEP).',
    alternativa_b: 'Sumário de urina e anti-HIV. Azitromicina 1 g dose única. Solicitar vinda do namorado.',
    alternativa_c: 'VDRL e anti-HIV. Doxiciclina 100 mg 12/12h por 21 dias. TDF/FTC por 3 meses.',
    alternativa_d: 'Urocultura, colpocitologia oncótica e anti-HIV. Se E. coli e Trichomonas, ciprofloxacino e metronidazol.',
  },
  {
    numero: 79, area: 'clinica_medica',
    enunciado: 'Mulher de 62 anos, com ITU de repetição, dá entrada em UPA com febre alta e calafrios. DM2 em uso de metformina e glicazida. PA 110x70, FC 106, FR 25, Tax 38 °C. Hemoglobina 12,3, Ht 36%, leucócitos 14.000 com 84% neutrófilos e 12% bastões, plaquetas 210.000.\n\nA conduta deve ser:',
    alternativa_a: 'Antitérmico, hidratação oral vigorosa e observação hospitalar.',
    alternativa_b: 'Esquema antibiótico de amplo espectro, ainda na 1ª hora da chegada.',
    alternativa_c: 'Cobertura contra Candida sp, por ITU de repetição em diabética.',
    alternativa_d: 'Antibiótico de amplo espectro mantido durante todo o tratamento, mesmo após culturas.',
  },
  {
    numero: 80, area: 'pediatria',
    enunciado: 'RN a termo no 1° minuto de vida apresenta apneia e bradicardia, desvio do ictus à direita, abdome escavado e presença de ruídos hidroaéreos à ausculta do hemitórax esquerdo.\n\nOs procedimentos adequados em sala de parto são:',
    alternativa_a: 'Intubação traqueal e massagem cardíaca externa.',
    alternativa_b: 'Cateterismo umbilical e drenagem de hemitórax esquerdo.',
    alternativa_c: 'Ventilação com óxido nítrico e surfactante.',
    alternativa_d: 'Ventilação com balão autoinflável com PEEP.',
  },
  {
    numero: 81, area: 'cirurgia',
    enunciado: 'Adulto jovem atendido em UBS com dor e ardor no ânus, sangramento vivo ao evacuar com esforço e fezes endurecidas. Nega tumoração perianal. Constipação crônica e diagnóstico recente de doença de Crohn.\n\nO diagnóstico mais provável é:',
    alternativa_a: 'Abscesso perianal.',
    alternativa_b: 'Fístula perianal.',
    alternativa_c: 'Cisto pilonidal.',
    alternativa_d: 'Fissura anal.',
  },
  {
    numero: 82, area: 'ginecologia_obstetricia',
    enunciado: 'Paciente G3P1A1, IG 24 semanas. Primeira gestação: abortamento com 16 semanas. Segunda: parto vaginal rápido com 28 semanas. USG transvaginal com 23 semanas: colo uterino com 1,5 cm.\n\nQual a conduta adequada?',
    alternativa_a: 'Pesquisa de estreptococo do grupo B na 28ª semana.',
    alternativa_b: 'Internar para atosiban intravenoso até 34 semanas.',
    alternativa_c: 'Nifedipina 20 mg VO diariamente à noite até 39 semanas.',
    alternativa_d: 'Progesterona micronizada via vaginal 200 mg/dia até 36 semanas.',
  },
  {
    numero: 83, area: 'ginecologia_obstetricia',
    enunciado: 'Mulher de 32 anos, sexualmente ativa, comparece para realização do primeiro preventivo. Resultado: "presença de lesão intraepitelial de baixo grau".\n\nQual a conduta adequada?',
    alternativa_a: 'Solicitar ultrassonografia transvaginal.',
    alternativa_b: 'Repetir o exame citopatológico em 6 meses.',
    alternativa_c: 'Encaminhar para colposcopia.',
    alternativa_d: 'Repetir o exame citopatológico imediatamente.',
  },
  {
    numero: 84, area: 'saude_coletiva',
    enunciado: 'ACS relata preocupação com idosos de ILPI no território da UBS. Na última visita observou 38 idosos em isolamento excessivo, maioria sem vínculos familiares, sofrendo agressões dos funcionários. Sinais de contenção física em idosos com demência e lesões de pressão.\n\nQual a conduta mais adequada da equipe?',
    alternativa_a: 'Formalizar denúncia ao Conselho Municipal do Idoso, considerando que contenção e lesão por pressão podem acontecer em institucionalização.',
    alternativa_b: 'Apoio clínico para casos vulneráveis, sugerindo adequações, respeitando autonomia da ILPI.',
    alternativa_c: 'Articular ação intersetorial com órgãos de controle social, registrar notificação compulsória e elaborar plano de ação conjunta.',
    alternativa_d: 'Reuniões quinzenais com equipe da ILPI para educação permanente sobre cuidados paliativos.',
  },
  {
    numero: 85, area: 'clinica_medica',
    enunciado: 'Mulher de 42 anos levada à UPA com fala alterada, lentificação, tontura e sonolência. Admite ter ingerido 30 comprimidos de clonazepam 2 mg há 20 minutos. Evolui com hipotensão, rebaixamento do nível de consciência, coma e ventilação mecânica.\n\nQual medicação é indicada?',
    alternativa_a: 'N-acetilcisteína.',
    alternativa_b: 'Flumazenil.',
    alternativa_c: 'Naloxona.',
    alternativa_d: 'Atropina.',
  },
  {
    numero: 86, area: 'clinica_medica',
    enunciado: 'Mulher de 55 anos com cefaleia persistente bilateral, associada a amaurose fugaz, diplopia, cansaço e artralgias. Dor em todo couro cabeludo. Perda de 2 kg em 2 meses. Nega fotofobia, fonofobia, febre, náuseas. Afebril, pupilas isocóricas, sem rigidez de nuca.\n\nQual o tipo de cefaleia e exame útil na investigação, respectivamente?',
    alternativa_a: 'Cefaleia primária (tensional); nenhum exame necessário.',
    alternativa_b: 'Cefaleia secundária (hemorragia subaracnoideia); análise de líquor.',
    alternativa_c: 'Cefaleia primária (migrânea); TC de encéfalo.',
    alternativa_d: 'Cefaleia secundária (arterite temporal); velocidade de hemossedimentação.',
  },
  {
    numero: 87, area: 'pediatria',
    enunciado: 'Adolescente de 13 anos com manchas escurecidas no pescoço, axilas e virilhas. IMC entre Z+2 e Z+3, circunferência abdominal/estatura aumentada, manchas hipercrômicas.\n\nAlém de prescrever mudança de hábitos, deve-se',
    alternativa_a: 'Solicitar biópsia das lesões e hemoglobina glicada.',
    alternativa_b: 'Solicitar perfil lipídico e ultrassonografia de abdome.',
    alternativa_c: 'Indicar corticoide tópico e evitar exposição solar.',
    alternativa_d: 'Indicar antifúngico e solicitar TOTG.',
  },
  {
    numero: 88, area: 'cirurgia',
    enunciado: 'Homem de 72 anos com dor epigástrica com irradiação em faixa para dorso há 3 meses e perda de 8 kg. Há 1 semana com prurido, icterícia, náuseas, colúria e acolia. Carga tabágica 30 maços/ano, alcoolista há 35 anos. Trata dislipidemia, HAS e DM há 15 anos. IMC 30.\n\nCom base na principal hipótese diagnóstica, quais exames iniciais solicitar?',
    alternativa_a: 'USG de abdome, aminotransferases, bilirrubinas e sorologias para hepatites.',
    alternativa_b: 'CPRE e aminotransferases e gama-GT.',
    alternativa_c: 'RM de abdome e amilase, lipase e cálcio.',
    alternativa_d: 'TC de abdome com contraste e CA 19.9.',
  },
  {
    numero: 89, area: 'ginecologia_obstetricia',
    enunciado: 'Gestante de 28 anos, IG desconhecida, vulnerabilidade social, trazida pelo SAMU com sangramento vaginal intenso, hipertonia uterina, PA 130x90, AU 32 cm, BCF 90 bpm. Toque: colo grosso, posterior, impérvio. Uso de cocaína antes do ocorrido.\n\nO diagnóstico, conduta e complicação possível são, respectivamente,',
    alternativa_a: 'Descolamento de placenta; cesárea; útero de Couvelaire.',
    alternativa_b: 'Rotura de vasa prévia; amniotomia; anemia fetal.',
    alternativa_c: 'Trabalho de parto; inibição; prematuridade.',
    alternativa_d: 'Pré-eclâmpsia; cesárea; rotura uterina.',
  },
  {
    numero: 90, area: 'saude_coletiva',
    enunciado: 'Homem de 23 anos, previamente hígido, foi mordido por gato de rua nos dedos da mão esquerda há 2 horas. Feridas cortocontusas. Animal fugiu. Na cidade houve confirmação de raiva em felinos no ano anterior.\n\nA conduta adequada no atendimento imediato é',
    alternativa_a: 'Higienizar e suturar; soro antirrábico; penicilina benzatina.',
    alternativa_b: 'Lavar com antissépticos; aguardar busca ativa do animal; reforço de dT.',
    alternativa_c: 'Lavar com água corrente e sabão; vacina antirrábica em 4 doses (0, 3, 7, 14); imunoglobulina humana antirrábica.',
    alternativa_d: 'Higienizar com antisséptico; 1ª dose da vacina antirrábica; soro antirrábico.',
  },
  {
    numero: 91, area: 'clinica_medica',
    enunciado: 'Homem de 56 anos com angina instável, DM2, HAS e dislipidemia, internado com dor torácica em aperto há 2 horas, irradiada para MSE e mandíbula. 3 episódios similares nas últimas 24h. Em uso de losartana, HCTZ, AAS, dapagliflozina, metformina e atorvastatina. Exame: 4ª bulha, PA normal, sem congestão. ECG: infradesnivelamento de ST 1 mm com inversão de T em parede anterior. Troponina-I elevada com curva enzimática. GRACE 152, TIMI 5.\n\nA conduta indicada é',
    alternativa_a: 'Angiotomografia coronária em até 48 horas.',
    alternativa_b: 'Cateterismo cardíaco nas primeiras 24 horas.',
    alternativa_c: 'Cateterismo cardíaco em até 3 dias.',
    alternativa_d: 'Ecocardiograma de estresse em até 7 dias.',
  },
  {
    numero: 92, area: 'pediatria',
    enunciado: 'Menina de 1 ano e 10 meses com tosse e dispneia há 4 dias. Mãe aumentou salbutamol sem melhora, piora há 6 horas. Frequentes exacerbações nos últimos 3 meses apesar de prednisolona. Pai e mãe asmáticos. Afebril, sonolenta, taquidispneica, choro entrecortado, SatO₂ 94%, retração de musculatura acessória.\n\nAlém da internação, a conduta é prescrever:',
    alternativa_a: 'Metilprednisolona endovenoso.',
    alternativa_b: 'VNI com sedação.',
    alternativa_c: 'Salbutamol endovenoso em infusão contínua.',
    alternativa_d: 'Sulfato de magnésio em infusão intravenosa contínua.',
  },
  {
    numero: 93, area: 'cirurgia',
    enunciado: 'Paciente de 45 anos com dor ocular. Estava realizando limpeza com alvejante e atingiu o olho acidentalmente. Hiperemia intensa, opacidade da córnea e queimadura química da pálpebra superior do olho direito.\n\nQual o manejo correto?',
    alternativa_a: 'Prescrição de analgésico tópico e colírio lubrificante.',
    alternativa_b: 'Lavagem dos olhos com solução de água boricada e SF, avaliação imediata do especialista.',
    alternativa_c: 'Curativo oclusivo.',
    alternativa_d: 'Prescrição de colírio de corticoide tópico e avaliação precoce do especialista.',
  },
  {
    numero: 94, area: 'ginecologia_obstetricia',
    enunciado: 'Mulher de 72 anos, menopausa aos 53, obesa, nulípara, nunca fez TRH. Sangramento vaginal há 2 dias, estável. Especular: lesão polipoide no orifício externo cervical. USG TV: 3 nódulos (2,5, 3,5 e 1,5 cm - 2 intramurais e 1 submucoso), endométrio 8 mm, lesão polipoide no canal endocervical de 1,5 cm. Hemoglobina 8,4, VCM 62, HCM 24, RDW 22%, plaquetas 480.000.\n\nA principal hipótese diagnóstica é',
    alternativa_a: 'Hiperplasia endometrial.',
    alternativa_b: 'Câncer de colo de útero.',
    alternativa_c: 'Leiomioma submucoso.',
    alternativa_d: 'Endométrio atrófico.',
  },
  {
    numero: 95, area: 'ginecologia_obstetricia',
    enunciado: 'Gestante com trabalho de parto prematuro, após antibiótico e corticoterapia antenatal. A conduta adequada é:',
    alternativa_a: 'Internação hospitalar e monitoramento materno-fetal diário.',
    alternativa_b: 'Internação hospitalar, cardiotocografia e indução imediata do parto.',
    alternativa_c: 'Alta, repouso domiciliar e monitoramento ambulatorial diário.',
    alternativa_d: 'Alta, repouso domiciliar e monitoramento ambulatorial semanal.',
  },
  {
    numero: 96, area: 'clinica_medica',
    enunciado: 'Homem de 30 anos, profissional do sexo, nem sempre usa preservativo. Há 3 meses com emagrecimento (10 kg), astenia, febre baixa. Há 1 semana, úlcera dolorosa no pênis, sem secreção, de bordas elevadas, ~3 cm, rasa, de base mole, com linfonodomegalia inguinal com sinais inflamatórios.\n\nA investigação, achado esperado e tratamento da úlcera são, respectivamente,',
    alternativa_a: 'Sorologia para Chlamydia; positiva; doxiciclina 100 mg 2x/dia por 7 dias.',
    alternativa_b: 'Biópsia da úlcera; BAAR; esquema com pirazinamida, isoniazida e rifampicina.',
    alternativa_c: 'VDRL; reagente; benzilpenicilina benzatina 1,2 milhão UI IM dose única.',
    alternativa_d: 'Microscopia de esfregaço do fundo da úlcera; Gram negativos em correntes; azitromicina 500 mg 2cp dose única.',
  },
  {
    numero: 97, area: 'pediatria',
    enunciado: 'Mãe de menina de 7 anos preocupada por ser a menor da sala. Sem intercorrências gestacionais ou neonatais. Peso 19 kg (z -1); estatura 1,07 m (-3<z<-2); alvo 1,50 m (z-2); IMC 16,6 (0<z<+1); SS/SI 1,02. Com 6a8m: peso 17 kg (-2<z<-1), estatura 1,05 m, IO compatível com 5a10m.\n\nA hipótese diagnóstica é',
    alternativa_a: 'Acondroplasia.',
    alternativa_b: 'Síndrome de Turner.',
    alternativa_c: 'Baixa estatura familiar.',
    alternativa_d: 'Atraso constitucional do crescimento.',
  },
  {
    numero: 98, area: 'cirurgia',
    enunciado: 'Paciente de 43 anos, internada com icterícia, colúria e acolia há 72h. Sem comorbidades. Ictérica +++, dor em HCD; FC 83, PA 123x76, Tax 37,4 °C. USG: múltiplas imagens móveis 0,5-1 cm e dilatação de vias biliares. FA 760, gama-GT 900, BT 6,2, BD 5,1, amilase 80. Leucócitos 9.000 com 3% bastões.\n\nO diagnóstico sindrômico e exame complementar mais indicados são, respectivamente,',
    alternativa_a: 'Síndrome colestática sem colangite; TC de abdome com contraste venoso.',
    alternativa_b: 'Síndrome colestática com colangite; colangiorressonância.',
    alternativa_c: 'Síndrome colestática sem colangite; colangiorressonância.',
    alternativa_d: 'Síndrome colestática com colangite; CPRE.',
  },
  {
    numero: 99, area: 'ginecologia_obstetricia',
    enunciado: 'Gestante em situação de ruptura prematura de membranas, após antibiótico e corticoterapia antenatal. Considerando a conduta sobre o pré-natal de risco na atenção primária, assinale a condição que indica referência para centro de referência especializado.',
    alternativa_a: 'Internação hospitalar e monitoramento materno-fetal diário.',
    alternativa_b: 'Internação hospitalar, CTG e indução imediata do parto.',
    alternativa_c: 'Alta, repouso domiciliar e monitoramento ambulatorial diário.',
    alternativa_d: 'Alta, repouso domiciliar e monitoramento ambulatorial semanal.',
  },
  {
    numero: 100, area: 'ginecologia_obstetricia',
    enunciado: 'Considerando a atenção ao pré-natal de pacientes na atenção primária em saúde, assinale a condição clínica que indica a referência da gestante para acompanhamento conjunto em centro de referência especializado (pré-natal de alto risco).',
    alternativa_a: 'Malária no 3º trimestre da gestação.',
    alternativa_b: 'Anemia com 9,5 mg/dL de hemoglobina.',
    alternativa_c: 'Gestação gemelar dicoriônica diamniótica.',
    alternativa_d: 'Diabetes mellitus gestacional controlada com dieta.',
  },
];

function escapeSQL(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + str.replace(/'/g, "''") + "'";
}

function buildInsertSQL(batch) {
  const rows = batch.map(q => {
    const gab = GABARITO[q.numero];
    const anulada = ANULADAS.has(q.numero);
    return `(${q.numero}, ${escapeSQL(q.area)}, ${escapeSQL(q.enunciado)}, ${escapeSQL(q.alternativa_a)}, ${escapeSQL(q.alternativa_b)}, ${escapeSQL(q.alternativa_c)}, ${escapeSQL(q.alternativa_d)}, ${escapeSQL(gab)}, NULL, 2025, ${anulada})`;
  });

  return `INSERT INTO public.enamed_questions (numero, area, enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, gabarito, explicacao, ano, anulada) VALUES\n${rows.join(',\n')};`;
}

async function runQuery(sql) {
  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`API error ${resp.status}: ${text}`);
  }

  return resp.json();
}

async function main() {
  console.log('=== ENAMED 2025 Seed Script ===');
  console.log(`Total questions: ${QUESTIONS.length}`);
  console.log(`Anuladas/Excluídas: ${ANULADAS.size}`);

  // Step 1: Delete existing 2025 questions
  console.log('\n[1/3] Deleting existing 2025 questions...');
  try {
    const deleteResult = await runQuery(`DELETE FROM public.enamed_questions WHERE ano = 2025;`);
    console.log('Delete result:', JSON.stringify(deleteResult));
  } catch (err) {
    console.error('Delete failed:', err.message);
    console.log('Continuing with insert...');
  }

  // Step 2: Insert in batches of 10
  const BATCH_SIZE = 10;
  let inserted = 0;
  let errors = 0;

  console.log(`\n[2/3] Inserting ${QUESTIONS.length} questions in batches of ${BATCH_SIZE}...`);

  for (let i = 0; i < QUESTIONS.length; i += BATCH_SIZE) {
    const batch = QUESTIONS.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(QUESTIONS.length / BATCH_SIZE);

    const sql = buildInsertSQL(batch);

    try {
      const result = await runQuery(sql);
      inserted += batch.length;
      console.log(`  Batch ${batchNum}/${totalBatches} (Q${batch[0].numero}-Q${batch[batch.length - 1].numero}): OK`);
    } catch (err) {
      errors++;
      console.error(`  Batch ${batchNum}/${totalBatches} (Q${batch[0].numero}-Q${batch[batch.length - 1].numero}): FAILED - ${err.message}`);
    }
  }

  // Step 3: Verify
  console.log(`\n[3/3] Verifying...`);
  try {
    const countResult = await runQuery(`SELECT count(*) as total, count(*) FILTER (WHERE anulada = true) as anuladas FROM public.enamed_questions WHERE ano = 2025;`);
    console.log('Verification:', JSON.stringify(countResult));
  } catch (err) {
    console.error('Verification failed:', err.message);
  }

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Inserted: ${inserted}`);
  console.log(`Errors: ${errors}`);

  // Area distribution
  const areaCounts = {};
  for (const q of QUESTIONS) {
    areaCounts[q.area] = (areaCounts[q.area] || 0) + 1;
  }
  console.log('\nArea distribution:');
  for (const [area, count] of Object.entries(areaCounts)) {
    console.log(`  ${area}: ${count}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
