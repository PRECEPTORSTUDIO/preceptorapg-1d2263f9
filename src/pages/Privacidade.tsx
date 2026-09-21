import LegalLayout from '@/components/legal/LegalLayout';

const Privacidade = () => {
  return (
    <LegalLayout title="Política de Privacidade" lastUpdated="27 de abril de 2026">
      <p>
        A PreceptorMED ("nós") respeita a privacidade de todos os usuários ("você", "Usuário") e
        está comprometida com a proteção dos seus dados pessoais, em conformidade com a{' '}
        <strong>Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD)</strong>. Esta
        Política descreve, de forma transparente, quais dados coletamos, como os utilizamos,
        compartilhamos e protegemos, bem como os direitos que você pode exercer sobre eles.
      </p>

      <h2>1. Quem é o Controlador dos Dados</h2>
      <p>
        A PreceptorMED é a controladora dos dados pessoais coletados na Plataforma. Para tratar
        questões relacionadas à proteção de dados, contate nosso Encarregado de Proteção de Dados
        (DPO) pelo e-mail{' '}
        <a href="mailto:dpo@thepreceptor.com.br">dpo@thepreceptor.com.br</a>.
      </p>

      <h2>2. Quais Dados Coletamos</h2>

      <h3>2.1. Dados fornecidos diretamente por você</h3>
      <ul>
        <li>
          <strong>Cadastro:</strong> nome completo, e-mail, senha (armazenada de forma criptografada
          via hash), instituição de ensino e período do curso (opcional);
        </li>
        <li>
          <strong>Pagamento:</strong> dados de cobrança e identificação fiscal são processados
          diretamente pelos provedores EasyFlow e Stripe — <strong>não armazenamos números completos
          de cartão de crédito</strong>;
        </li>
        <li>
          <strong>Conteúdo gerado:</strong> perguntas enviadas ao chat, temas estudados, flashcards
          criados, resultados de simulados e fechamentos de PBL.
        </li>
      </ul>

      <h3>2.2. Dados coletados automaticamente</h3>
      <ul>
        <li>
          <strong>Dados de uso:</strong> páginas visitadas, funcionalidades utilizadas, frequência
          de acesso, tempo de sessão;
        </li>
        <li>
          <strong>Dados técnicos:</strong> endereço IP, tipo de dispositivo, navegador, sistema
          operacional, identificador anônimo;
        </li>
        <li>
          <strong>Cookies e analytics:</strong> Google Analytics e Meta Pixel para mensurar
          desempenho e otimizar campanhas (consulte a seção 7).
        </li>
      </ul>

      <h2>3. Bases Legais e Finalidades do Tratamento</h2>
      <p>Tratamos seus dados com base nas seguintes hipóteses legais previstas na LGPD:</p>
      <ul>
        <li>
          <strong>Execução de contrato (art. 7º, V):</strong> para criar e manter sua conta,
          processar pagamentos, fornecer as funcionalidades contratadas e prestar suporte;
        </li>
        <li>
          <strong>Cumprimento de obrigação legal (art. 7º, II):</strong> para emitir notas fiscais e
          atender requisições de autoridades competentes;
        </li>
        <li>
          <strong>Legítimo interesse (art. 7º, IX):</strong> para melhorar a Plataforma, prevenir
          fraudes, garantir segurança e analisar métricas de uso agregadas;
        </li>
        <li>
          <strong>Consentimento (art. 7º, I):</strong> para envio de comunicações de marketing,
          newsletters e ofertas — você pode revogar a qualquer momento.
        </li>
      </ul>

      <h2>4. Conteúdo Enviado a Modelos de IA</h2>
      <p>
        Para gerar respostas no chat, simulados e fechamentos, enviamos seu conteúdo (perguntas,
        temas, casos clínicos hipotéticos) à API do Claude (Anthropic) e a serviços relacionados.{' '}
        <strong>
          Recomendamos fortemente que você não insira dados sensíveis de pacientes reais
          identificáveis na Plataforma.
        </strong>{' '}
        Os provedores de IA atuam como operadores de dados e seguem suas próprias políticas de
        privacidade — em geral, dados enviados via API não são utilizados para treinar modelos.
      </p>

      <h2>5. Com Quem Compartilhamos Seus Dados</h2>
      <p>
        Compartilhamos dados pessoais apenas com operadores estritamente necessários para a operação
        do serviço, todos sob obrigação contratual de confidencialidade:
      </p>
      <ul>
        <li>
          <strong>Supabase:</strong> hospedagem do banco de dados e autenticação;
        </li>
        <li>
          <strong>Vercel:</strong> hospedagem da aplicação web;
        </li>
        <li>
          <strong>Anthropic (Claude API):</strong> processamento das requisições de IA;
        </li>
        <li>
          <strong>EasyFlow / Stripe:</strong> processamento de pagamentos;
        </li>
        <li>
          <strong>Resend:</strong> envio de e-mails transacionais e de marketing;
        </li>
        <li>
          <strong>Google Analytics / Meta Pixel:</strong> métricas de uso e anúncios
          (dados anonimizados ou pseudonimizados).
        </li>
      </ul>
      <p>
        <strong>Nunca vendemos</strong> seus dados pessoais a terceiros.
      </p>

      <h2>6. Transferência Internacional de Dados</h2>
      <p>
        Alguns dos operadores acima estão sediados nos Estados Unidos e podem armazenar dados em
        servidores fora do território brasileiro. Essas transferências ocorrem com base em garantias
        contratuais que asseguram nível de proteção compatível com a LGPD, conforme art. 33 da Lei.
      </p>

      <h2>7. Cookies e Tecnologias Similares</h2>
      <p>Utilizamos cookies para:</p>
      <ul>
        <li>
          <strong>Cookies essenciais:</strong> manter você autenticado e preservar preferências (não
          podem ser desabilitados);
        </li>
        <li>
          <strong>Cookies analíticos:</strong> entender como a Plataforma é utilizada
          (Google Analytics);
        </li>
        <li>
          <strong>Cookies de marketing:</strong> mensurar conversões e otimizar campanhas (Meta
          Pixel) — você pode desabilitar nas configurações do navegador.
        </li>
      </ul>

      <h2>8. Por Quanto Tempo Armazenamos Seus Dados</h2>
      <ul>
        <li>
          <strong>Conta ativa:</strong> enquanto sua conta existir;
        </li>
        <li>
          <strong>Conta cancelada:</strong> dados pessoais são excluídos ou anonimizados em até 90
          dias após a solicitação ou o cancelamento, exceto quando houver obrigação legal de
          retenção (ex: registros fiscais por 5 anos, conforme art. 27 do CDC);
        </li>
        <li>
          <strong>Logs de segurança:</strong> mantidos por até 6 meses, conforme art. 15 do Marco
          Civil da Internet.
        </li>
      </ul>

      <h2>9. Seus Direitos como Titular dos Dados</h2>
      <p>
        Conforme a LGPD (art. 18), você pode exercer os seguintes direitos a qualquer momento,
        gratuitamente, escrevendo para{' '}
        <a href="mailto:dpo@thepreceptor.com.br">dpo@thepreceptor.com.br</a>:
      </p>
      <ul>
        <li>Confirmação da existência de tratamento;</li>
        <li>Acesso aos seus dados;</li>
        <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
        <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desacordo com a LGPD;</li>
        <li>Portabilidade dos dados a outro fornecedor de serviço;</li>
        <li>Eliminação dos dados tratados com base em consentimento;</li>
        <li>Informação sobre as entidades com quem compartilhamos seus dados;</li>
        <li>Revogação de consentimento;</li>
        <li>
          Oposição a tratamento realizado com fundamento em hipótese de dispensa de consentimento.
        </li>
      </ul>
      <p>
        Atenderemos sua solicitação em até 15 (quinze) dias, ressalvadas hipóteses em que a
        eliminação seja inviável por obrigação legal.
      </p>

      <h2>10. Segurança dos Dados</h2>
      <p>
        Adotamos medidas técnicas e organizacionais adequadas para proteger seus dados, incluindo:
      </p>
      <ul>
        <li>Criptografia em trânsito (TLS 1.3) e em repouso para dados sensíveis;</li>
        <li>Hash de senhas com algoritmos modernos (bcrypt/argon2);</li>
        <li>Controle de acesso baseado em papéis (Row-Level Security no banco);</li>
        <li>Monitoramento contínuo de segurança e logs de auditoria;</li>
        <li>Treinamento da equipe em práticas de proteção de dados.</li>
      </ul>
      <p>
        Apesar dos esforços, nenhum sistema é 100% imune a incidentes. Em caso de violação que
        possa acarretar risco aos titulares, comunicaremos a Autoridade Nacional de Proteção de
        Dados (ANPD) e os titulares afetados, conforme art. 48 da LGPD.
      </p>

      <h2>11. Privacidade de Menores</h2>
      <p>
        A Plataforma é destinada a maiores de 18 anos, predominantemente estudantes universitários
        de medicina. Não coletamos intencionalmente dados de menores de 18 anos. Caso identifiquemos
        cadastro de menor sem consentimento parental, a conta será excluída.
      </p>

      <h2>12. Alterações nesta Política</h2>
      <p>
        Esta Política pode ser atualizada para refletir mudanças legais, operacionais ou de
        tecnologia. Alterações relevantes serão comunicadas por e-mail e/ou aviso na Plataforma com
        antecedência mínima de 15 (quinze) dias. A versão mais recente estará sempre disponível em{' '}
        <a href="/privacidade">thepreceptor.com.br/privacidade</a>.
      </p>

      <h2>13. Contato</h2>
      <p>
        Para qualquer dúvida, requisição ou reclamação relacionada a esta Política ou ao tratamento
        dos seus dados pessoais, escreva para{' '}
        <a href="mailto:dpo@thepreceptor.com.br">dpo@thepreceptor.com.br</a>. Você também pode
        registrar reclamações junto à{' '}
        <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer">
          Autoridade Nacional de Proteção de Dados (ANPD)
        </a>
        .
      </p>
    </LegalLayout>
  );
};

export default Privacidade;
