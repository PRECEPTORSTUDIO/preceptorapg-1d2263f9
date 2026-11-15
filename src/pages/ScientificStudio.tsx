import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useDemoLimit } from '@/hooks/useDemoLimit';
import { useScientificMentor } from '@/hooks/useScientificMentor';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageSkeleton from '@/components/PageSkeleton';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import UpgradePaywall from '@/components/UpgradePaywall';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Check, Trash2, Send, Plus, ChevronDown } from 'lucide-react';

const MI = ({ name, fill = false, className = '' }: { name: string; fill?: boolean; className?: string }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{ fontVariationSettings: fill ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : undefined }}
  >
    {name}
  </span>
);

type ProjectType = 'tcc' | 'artigo_original' | 'revisao' | 'relato_caso' | 'projeto_pesquisa' | 'resumo_expandido' | 'dissertacao';
type SectionType = 'titulo' | 'resumo' | 'introducao' | 'justificativa' | 'hipoteses' | 'objetivos' | 'metodologia' | 'resultados' | 'discussao' | 'conclusao' | 'referencias' | 'geral';

interface Section {
  id: string;
  name: string;
  type: SectionType;
  content: string;
  status: 'draft' | 'revision_needed' | 'stable' | 'approved';
}

interface Project {
  id: string;
  title: string;
  type: ProjectType;
  sections: Section[];
  createdAt: string;
  updatedAt: string;
}

const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: 'tcc', label: 'TCC' },
  { value: 'artigo_original', label: 'Artigo Original' },
  { value: 'revisao', label: 'Artigo de Revisão' },
  { value: 'relato_caso', label: 'Relato de Caso' },
  { value: 'projeto_pesquisa', label: 'Projeto de Pesquisa' },
  { value: 'resumo_expandido', label: 'Resumo Expandido' },
  { value: 'dissertacao', label: 'Dissertação / Tese' },
];

const SECTION_TEMPLATES: { type: SectionType; name: string }[] = [
  { type: 'titulo', name: 'Título' },
  { type: 'resumo', name: 'Resumo / Abstract' },
  { type: 'introducao', name: 'Introdução' },
  { type: 'justificativa', name: 'Justificativa' },
  { type: 'hipoteses', name: 'Hipóteses' },
  { type: 'objetivos', name: 'Objetivos' },
  { type: 'metodologia', name: 'Metodologia' },
  { type: 'resultados', name: 'Resultados' },
  { type: 'discussao', name: 'Discussão' },
  { type: 'conclusao', name: 'Conclusão' },
  { type: 'referencias', name: 'Referências' },
];

const STATUS_CONFIG: Record<Section['status'], { label: string; dot: string }> = {
  draft: { label: 'Rascunho', dot: 'bg-slate-300' },
  revision_needed: { label: 'Revisão', dot: 'bg-amber-400' },
  stable: { label: 'Estável', dot: 'bg-emerald-400' },
  approved: { label: 'Aprovado', dot: 'bg-blue-400' },
};

const STORAGE_KEY = 'preceptor_scientific_projects';

const loadProjects = (): Project[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
};

const saveProjects = (projects: Project[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
};

const createDefaultProject = (): Project => ({
  id: crypto.randomUUID(),
  title: '',
  type: 'tcc',
  sections: SECTION_TEMPLATES.map(t => ({
    id: crypto.randomUUID(),
    name: t.name,
    type: t.type,
    content: '',
    status: 'draft' as const,
  })),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const ScientificStudio = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSubscriber, remainingPrompts, hasReachedLimit, dailyLimit, incrementUsage, loading: demoLoading } = useDemoLimit();
  const { messages, isStreaming, sendMessage, clearMessages } = useScientificMentor();

  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectType, setNewProjectType] = useState<ProjectType>('tcc');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<'editor' | 'mentor'>('editor');
  const [showAbstractGen, setShowAbstractGen] = useState(false);
  const [abstractWordLimit, setAbstractWordLimit] = useState(250);
  const [abstractSections, setAbstractSections] = useState<string[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeProject = projects.find(p => p.id === activeProjectId) ?? null;
  const activeSection = activeProject?.sections.find(s => s.id === activeSectionId) ?? null;

  useEffect(() => {
    if (projects.length > 0 && !activeProjectId) {
      setActiveProjectId(projects[0].id);
      setActiveSectionId(projects[0].sections[0]?.id ?? null);
    } else if (projects.length === 0) {
      setShowNewProject(true);
    }
  }, []);

  useEffect(() => { saveProjects(projects); }, [projects]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ── CRUD ──
  const createProject = () => {
    const project = createDefaultProject();
    project.type = newProjectType;
    setProjects(prev => [project, ...prev]);
    setActiveProjectId(project.id);
    setActiveSectionId(project.sections[0]?.id ?? null);
    setShowNewProject(false);
    clearMessages();
  };

  const deleteProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    if (activeProjectId === id) {
      const remaining = projects.filter(p => p.id !== id);
      if (remaining.length > 0) {
        setActiveProjectId(remaining[0].id);
        setActiveSectionId(remaining[0].sections[0]?.id ?? null);
      } else {
        setActiveProjectId(null);
        setActiveSectionId(null);
        setShowNewProject(true);
      }
    }
  };

  const updateProjectTitle = (title: string) => {
    if (!activeProjectId) return;
    setProjects(prev => prev.map(p =>
      p.id === activeProjectId ? { ...p, title, updatedAt: new Date().toISOString() } : p
    ));
  };

  const updateSectionContent = (sectionId: string, content: string) => {
    if (!activeProjectId) return;
    setProjects(prev => prev.map(p =>
      p.id === activeProjectId
        ? { ...p, updatedAt: new Date().toISOString(), sections: p.sections.map(s => s.id === sectionId ? { ...s, content } : s) }
        : p
    ));
  };

  const updateSectionStatus = (sectionId: string, status: Section['status']) => {
    if (!activeProjectId) return;
    setProjects(prev => prev.map(p =>
      p.id === activeProjectId
        ? { ...p, sections: p.sections.map(s => s.id === sectionId ? { ...s, status } : s) }
        : p
    ));
  };

  const addSection = () => {
    if (!activeProjectId) return;
    const newSection: Section = { id: crypto.randomUUID(), name: 'Nova Seção', type: 'geral', content: '', status: 'draft' };
    setProjects(prev => prev.map(p =>
      p.id === activeProjectId ? { ...p, sections: [...p.sections, newSection] } : p
    ));
    setActiveSectionId(newSection.id);
  };

  // ── AI Actions ──
  const handleAnalyzeSection = () => {
    if (!activeSection || !activeSection.content.trim()) {
      toast({ title: 'Seção vazia', description: 'Escreva algo na seção antes de solicitar análise.', variant: 'destructive' });
      return;
    }
    if (!isSubscriber && hasReachedLimit) return;
    if (!isSubscriber) incrementUsage();
    const prompt = `Analise a seguinte seção "${activeSection.name}" do meu ${PROJECT_TYPES.find(p => p.value === activeProject?.type)?.label ?? 'trabalho acadêmico'}:\n\n${activeSection.content}`;
    sendMessage(prompt, activeProject?.type, activeSection.type);
    setMobilePanel('mentor');
  };

  const handleAnalyzeAll = () => {
    if (!activeProject) return;
    const allContent = activeProject.sections.filter(s => s.content.trim()).map(s => `## ${s.name}\n${s.content}`).join('\n\n');
    if (!allContent.trim()) {
      toast({ title: 'Projeto vazio', description: 'Escreva em pelo menos uma seção.', variant: 'destructive' });
      return;
    }
    if (!isSubscriber && hasReachedLimit) return;
    if (!isSubscriber) incrementUsage();
    const prompt = `Faça uma análise completa do meu ${PROJECT_TYPES.find(p => p.value === activeProject.type)?.label ?? 'trabalho acadêmico'} intitulado "${activeProject.title || 'Sem título'}":\n\n${allContent}`;
    sendMessage(prompt, activeProject.type);
    setMobilePanel('mentor');
  };

  const handleGenerateAbstract = () => {
    if (!activeProject) return;
    const selectedContent = activeProject.sections
      .filter(s => abstractSections.includes(s.id) && s.content.trim())
      .map(s => `## ${s.name}\n${s.content}`)
      .join('\n\n');
    if (!selectedContent.trim()) {
      toast({ title: 'Seções vazias', description: 'As seções selecionadas precisam ter conteúdo.', variant: 'destructive' });
      return;
    }
    if (!isSubscriber && hasReachedLimit) return;
    if (!isSubscriber) incrementUsage();
    const prompt = `Gere um ABSTRACT/RESUMO para o meu ${PROJECT_TYPES.find(p => p.value === activeProject.type)?.label ?? 'trabalho acadêmico'} intitulado "${activeProject.title || 'Sem título'}".\n\n**Limite máximo: ${abstractWordLimit} palavras.**\n\nBaseie-se EXCLUSIVAMENTE nestas seções:\n\n${selectedContent}`;
    sendMessage(prompt, activeProject.type, 'resumo');
    setMobilePanel('mentor');
    setShowAbstractGen(false);
  };

  const handleChatSend = () => {
    if (!chatInput.trim() || isStreaming) return;
    if (!isSubscriber && hasReachedLimit) return;
    if (!isSubscriber) incrementUsage();
    sendMessage(chatInput.trim(), activeProject?.type, activeSection?.type);
    setChatInput('');
  };

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) { e.preventDefault(); handleChatSend(); }
  };

  const handleCopy = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    toast({ title: 'Copiado!' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (authLoading || demoLoading) return <PageSkeleton variant="menu" />;
  if (!user) return <Navigate to="/auth" replace />;

  // ── New project screen ──
  if (showNewProject && !activeProject) {
    return (
      <DashboardLayout mainClassName="p-4 sm:p-6 lg:p-10 max-w-3xl mx-auto">
        <div className="py-16 sm:py-24">
          <div className="text-center mb-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#005344] to-[#006d5b] flex items-center justify-center mx-auto mb-5">
              <MI name="science" className="text-white text-2xl" />
            </div>
            <h1 className="font-['Manrope'] font-extrabold text-2xl sm:text-3xl text-[#191c1d] mb-2">
              Curadoria Científica
            </h1>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              Orientação do PreceptorMED para seus trabalhos acadêmicos. Escolha o tipo de documento.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-w-lg mx-auto mb-8">
            {PROJECT_TYPES.map(pt => (
              <button
                key={pt.value}
                onClick={() => setNewProjectType(pt.value)}
                className={`px-4 py-3 rounded-xl border-2 text-center transition-all text-sm font-semibold ${
                  newProjectType === pt.value
                    ? 'border-[#006d5b] bg-[#006d5b]/5 text-[#005344]'
                    : 'border-slate-100 hover:border-slate-200 bg-white text-slate-600'
                }`}
              >
                {pt.label}
              </button>
            ))}
          </div>

          <div className="text-center">
            <Button
              onClick={createProject}
              className="bg-gradient-to-r from-[#005344] to-[#006d5b] text-white px-8 py-3 rounded-xl font-bold"
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar Projeto
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const projectTypeLabel = PROJECT_TYPES.find(p => p.value === activeProject?.type)?.label ?? '';
  const filledSections = activeProject?.sections.filter(s => s.content.trim()).length ?? 0;
  const totalSections = activeProject?.sections.length ?? 0;

  return (
    <DashboardLayout mainClassName="h-[calc(100vh-3.5rem)] lg:h-screen flex flex-col overflow-hidden" hideFooter>
      {/* ── Compact Toolbar ── */}
      <div className="shrink-0 flex items-center justify-between px-3 sm:px-4 py-2 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 bg-[#005344] rounded-md shrink-0">
            <MI name="science" className="text-white text-base" />
          </div>
          <div className="min-w-0 hidden sm:block">
            <p className="font-['Manrope'] font-bold text-[#005344] text-xs leading-none truncate">Curadoria Científica</p>
            <p className="text-[10px] text-slate-400 truncate">{projectTypeLabel} · {filledSections}/{totalSections} seções</p>
          </div>

          {/* Mobile panel toggle */}
          <div className="flex lg:hidden bg-slate-100 rounded-md p-0.5 ml-1">
            <button
              onClick={() => setMobilePanel('editor')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${mobilePanel === 'editor' ? 'bg-white text-[#005344] shadow-sm' : 'text-slate-400'}`}
            >
              Editor
            </button>
            <button
              onClick={() => setMobilePanel('mentor')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${mobilePanel === 'mentor' ? 'bg-white text-[#005344] shadow-sm' : 'text-slate-400'}`}
            >
              Mentor
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Project picker */}
          <div className="relative">
            <button
              onClick={() => setShowProjectPicker(!showProjectPicker)}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-slate-50 text-xs text-slate-400 transition-colors"
              title="Trocar projeto"
            >
              <MI name="folder_open" className="text-base" />
              <ChevronDown className="h-3 w-3" />
            </button>
            {showProjectPicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProjectPicker(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-xl border border-slate-100 w-56 py-1.5 max-h-72 overflow-y-auto">
                  <button
                    onClick={() => { setShowNewProject(true); setActiveProjectId(null); setShowProjectPicker(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-[#005344] hover:bg-slate-50 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Novo Projeto
                  </button>
                  <div className="border-t border-slate-100 my-1" />
                  {projects.map(p => (
                    <div key={p.id} className="flex items-center gap-1 px-1.5">
                      <button
                        onClick={() => {
                          setActiveProjectId(p.id);
                          setActiveSectionId(p.sections[0]?.id ?? null);
                          setShowProjectPicker(false);
                          clearMessages();
                        }}
                        className={`flex-1 text-left px-2 py-1.5 rounded-lg text-xs transition-colors truncate ${
                          p.id === activeProjectId ? 'bg-[#006d5b]/8 text-[#005344] font-bold' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {p.title || 'Sem título'}
                        <span className="block text-[10px] text-slate-400">{PROJECT_TYPES.find(pt => pt.value === p.type)?.label}</span>
                      </button>
                      <button
                        onClick={() => deleteProject(p.id)}
                        className="shrink-0 p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Demo banner */}
      {!isSubscriber && !hasReachedLimit && (
        <UpgradePaywall variant="banner" remainingPrompts={remainingPrompts} dailyLimit={dailyLimit} />
      )}

      {/* ── Main Split ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Section sidebar + Editor */}
        <div className={`${mobilePanel === 'editor' ? 'flex' : 'hidden'} lg:flex flex-1 overflow-hidden`}>

          {/* Section sidebar — vertical list */}
          <div className="hidden sm:flex flex-col w-48 shrink-0 border-r border-slate-100 bg-[#fafbfb] overflow-y-auto">
            <div className="px-3 pt-3 pb-2">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em]">Seções</p>
            </div>
            <div className="flex-1 px-2 space-y-0.5">
              {activeProject?.sections.map(s => {
                const sc = STATUS_CONFIG[s.status];
                const isActive = s.id === activeSectionId;
                const hasContent = !!s.content.trim();
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveSectionId(s.id)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-all group flex items-center gap-2 ${
                      isActive
                        ? 'bg-white text-[#005344] font-semibold shadow-sm'
                        : 'text-slate-500 hover:bg-white/70 hover:text-slate-700'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasContent ? sc.dot : 'bg-slate-200'}`} />
                    <span className="truncate">{s.name}</span>
                  </button>
                );
              })}
              <button
                onClick={addSection}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-slate-400 hover:text-[#005344] hover:bg-white/70 transition-colors"
              >
                <Plus className="h-3 w-3" />
                <span>Adicionar</span>
              </button>
            </div>

            {/* Quick actions at bottom of sidebar */}
            <div className="px-2 py-3 mt-auto border-t border-slate-100 space-y-1">
              <button
                onClick={() => {
                  if (!activeProject) return;
                  setAbstractSections(activeProject.sections.filter(s => s.type !== 'titulo' && s.type !== 'resumo' && s.type !== 'referencias').map(s => s.id));
                  setShowAbstractGen(true);
                }}
                disabled={isStreaming}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors disabled:opacity-50"
              >
                <MI name="description" className="text-sm" />
                Gerar Abstract
              </button>
              <button
                onClick={handleAnalyzeAll}
                disabled={isStreaming}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-[#005344] bg-[#006d5b]/8 hover:bg-[#006d5b]/15 transition-colors disabled:opacity-50"
              >
                <MI name="auto_awesome" className="text-sm" />
                Analisar Tudo
              </button>
            </div>
          </div>

          {/* Mobile horizontal section tabs */}
          <div className="flex sm:hidden flex-col flex-1 overflow-hidden">
            <div className="shrink-0 flex items-center gap-1 px-3 py-2 overflow-x-auto border-b border-slate-50 bg-[#fafbfb] no-scrollbar">
              {activeProject?.sections.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSectionId(s.id)}
                  className={`shrink-0 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all whitespace-nowrap ${
                    s.id === activeSectionId
                      ? 'bg-white text-[#005344] font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {s.name}
                </button>
              ))}
              <button onClick={addSection} className="shrink-0 px-1.5 py-1.5 text-slate-300 hover:text-[#005344]">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Editor area (mobile) */}
            {renderEditor()}
          </div>

          {/* Editor area (desktop) */}
          <div className="hidden sm:flex flex-col flex-1 overflow-hidden">
            {renderEditor()}
          </div>
        </div>

        {/* RIGHT: AI Mentor Panel */}
        <div className={`${mobilePanel === 'mentor' ? 'flex' : 'hidden'} lg:flex flex-col w-full lg:w-[380px] xl:w-[400px] bg-[#fafbfb] shrink-0 border-l border-slate-100`}>
          {/* Mentor header — simplified */}
          <div className="shrink-0 bg-gradient-to-r from-[#005344] to-[#006d5b] px-4 py-3.5 flex items-center gap-3">
            <div className="p-1.5 bg-white/15 rounded-lg">
              <MI name="auto_awesome" className="text-white text-lg" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-['Manrope'] font-bold text-white text-sm leading-none">Mentor Científico</h2>
              <p className="text-[10px] text-white/60 mt-0.5">
                {isStreaming ? 'Analisando...' : `${filledSections}/${totalSections} seções preenchidas`}
              </p>
            </div>
            <button
              onClick={clearMessages}
              className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              title="Limpar conversa"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {hasReachedLimit && !isSubscriber ? (
              <div className="h-full flex items-center justify-center p-4">
                <UpgradePaywall variant="chat-limit" remainingPrompts={remainingPrompts} dailyLimit={dailyLimit} />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8 px-4">
                <MI name="psychology" className="text-3xl text-slate-200 mb-3" />
                <p className="text-xs text-slate-400 mb-5 leading-relaxed max-w-[240px] mx-auto">
                  Escreva na seção ao lado e clique em "Analisar" para receber feedback, ou pergunte abaixo.
                </p>
                <div className="space-y-1.5">
                  {[
                    'Minha metodologia está adequada?',
                    'Como melhorar esta introdução?',
                    'Normas ABNT para referências',
                  ].map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => setChatInput(suggestion)}
                      className="w-full text-left px-3 py-2 rounded-lg border border-slate-100 bg-white text-[11px] text-slate-500 hover:border-[#006d5b]/20 hover:text-slate-700 transition-all"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map(m => (
                <div key={m.id} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className="shrink-0 w-6 h-6 rounded-md bg-[#005344] flex items-center justify-center mt-0.5">
                      <MI name="auto_awesome" className="text-white text-xs" />
                    </div>
                  )}
                  <div className={`max-w-[88%] group/msg ${
                    m.role === 'user'
                      ? 'px-3 py-2 rounded-xl rounded-br-sm text-white text-xs bg-[#005344]'
                      : 'bg-white border border-slate-100 rounded-xl rounded-bl-sm px-3 py-2 shadow-sm'
                  }`}>
                    {m.role === 'assistant' ? (
                      <>
                        {!m.content && isStreaming && (
                          <div className="flex items-center gap-1.5 py-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#006d5b] animate-pulse" />
                            <span className="h-1.5 w-1.5 rounded-full bg-[#006d5b] animate-pulse" style={{ animationDelay: '0.2s' }} />
                            <span className="h-1.5 w-1.5 rounded-full bg-[#006d5b] animate-pulse" style={{ animationDelay: '0.4s' }} />
                          </div>
                        )}
                        {m.content && (
                          <div className="prose prose-xs max-w-none text-xs prose-headings:text-[#005344] prose-headings:text-sm prose-headings:mb-1 prose-p:mb-1.5 prose-li:mb-0.5">
                            <MarkdownRenderer content={m.content} isTyping={isStreaming && m.id === messages[messages.length - 1]?.id} />
                          </div>
                        )}
                        {m.content && !(isStreaming && m.id === messages[messages.length - 1]?.id) && (
                          <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-slate-50 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleCopy(m.content, m.id)}
                              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              {copiedId === m.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              {copiedId === m.id ? 'Copiado' : 'Copiar'}
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-xs whitespace-pre-wrap leading-relaxed">{m.content.length > 300 ? m.content.slice(0, 300) + '...' : m.content}</p>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div className="shrink-0 border-t border-slate-100 bg-white p-2.5">
            <div className="flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                placeholder={hasReachedLimit && !isSubscriber ? 'Limite diário atingido' : 'Pergunte ao mentor...'}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={handleChatKeyDown}
                className="flex-1 min-h-[36px] max-h-[100px] resize-none text-xs border-slate-200 rounded-lg"
                rows={1}
                disabled={isStreaming || (hasReachedLimit && !isSubscriber)}
              />
              <Button
                onClick={handleChatSend}
                disabled={!chatInput.trim() || isStreaming || (hasReachedLimit && !isSubscriber)}
                size="icon"
                className="shrink-0 h-9 w-9 rounded-lg"
                style={{ background: '#005344' }}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Abstract Generator Modal ── */}
      {showAbstractGen && activeProject && (
        <>
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" onClick={() => setShowAbstractGen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="px-5 pt-5 pb-4">
                <h3 className="font-['Manrope'] font-bold text-lg text-[#191c1d] mb-1">Gerar Abstract</h3>
                <p className="text-xs text-slate-400">Selecione as seções e defina o limite de palavras.</p>
              </div>

              <div className="px-5 pb-4 space-y-4">
                {/* Word limit */}
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <MI name="straighten" className="text-slate-400 text-lg" />
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Máximo de palavras</p>
                  </div>
                  <input
                    type="number"
                    value={abstractWordLimit}
                    onChange={e => setAbstractWordLimit(Math.max(50, Math.min(1000, Number(e.target.value))))}
                    min={50}
                    max={1000}
                    className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 text-sm font-bold text-center focus:border-[#006d5b] focus:ring-1 focus:ring-[#006d5b] outline-none bg-white"
                  />
                </div>

                {/* Section selection */}
                <div className="space-y-1">
                  {activeProject.sections
                    .filter(s => s.type !== 'titulo' && s.type !== 'resumo')
                    .map(s => {
                      const isSelected = abstractSections.includes(s.id);
                      const hasContent = !!s.content.trim();
                      return (
                        <button
                          key={s.id}
                          onClick={() => {
                            setAbstractSections(prev =>
                              isSelected ? prev.filter(id => id !== s.id) : [...prev, s.id]
                            );
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                            isSelected
                              ? 'bg-[#006d5b]/8 ring-1 ring-[#006d5b]/20'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isSelected ? 'border-[#006d5b] bg-[#006d5b]' : 'border-slate-300'
                          }`}>
                            {isSelected && <MI name="check" className="text-white text-[10px]" />}
                          </div>
                          <span className="text-xs font-medium text-slate-700 flex-1 truncate">{s.name}</span>
                          {!hasContent && (
                            <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">vazia</span>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="px-5 pb-5 flex gap-2">
                <button
                  onClick={() => setShowAbstractGen(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGenerateAbstract}
                  disabled={abstractSections.length === 0 || isStreaming}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#005344] text-white text-xs font-bold disabled:opacity-40 transition-all hover:bg-[#004338] active:scale-[0.98]"
                >
                  Gerar
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );

  // ── Editor area (shared between mobile and desktop) ──
  function renderEditor() {
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Title */}
          <input
            type="text"
            value={activeProject?.title ?? ''}
            onChange={e => updateProjectTitle(e.target.value)}
            placeholder="Título do trabalho..."
            className="w-full text-lg sm:text-xl font-['Manrope'] font-extrabold text-[#191c1d] bg-transparent border-none outline-none placeholder:text-slate-300"
          />

          {/* Active section editor */}
          {activeSection && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Section header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-50">
                <input
                  type="text"
                  value={activeSection.name}
                  onChange={e => {
                    if (!activeProjectId) return;
                    setProjects(prev => prev.map(p =>
                      p.id === activeProjectId
                        ? { ...p, sections: p.sections.map(s => s.id === activeSectionId ? { ...s, name: e.target.value } : s) }
                        : p
                    ));
                  }}
                  className="font-['Manrope'] font-bold text-sm text-[#191c1d] bg-transparent border-none outline-none flex-1"
                />
                <select
                  value={activeSection.status}
                  onChange={e => updateSectionStatus(activeSectionId!, e.target.value as Section['status'])}
                  className="text-[10px] font-semibold px-2 py-1 rounded-md border border-slate-200 bg-slate-50 text-slate-600 cursor-pointer outline-none"
                >
                  <option value="draft">Rascunho</option>
                  <option value="revision_needed">Revisão</option>
                  <option value="stable">Estável</option>
                  <option value="approved">Aprovado</option>
                </select>
              </div>

              {/* Text area */}
              <textarea
                value={activeSection.content}
                onChange={e => updateSectionContent(activeSectionId!, e.target.value)}
                placeholder={`Cole ou escreva o conteúdo de "${activeSection.name}" aqui...`}
                className="w-full min-h-[280px] sm:min-h-[360px] px-4 py-4 text-sm leading-relaxed text-[#191c1d] bg-transparent border-none outline-none resize-y placeholder:text-slate-300"
              />

              {/* Footer actions */}
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-50 bg-[#fafbfb]">
                <span className="text-[10px] text-slate-400">
                  {activeSection.content.length.toLocaleString()} caracteres
                </span>
                <div className="flex items-center gap-2">
                  {/* Mobile-only abstract button */}
                  <button
                    onClick={() => {
                      if (!activeProject) return;
                      setAbstractSections(activeProject.sections.filter(s => s.type !== 'titulo' && s.type !== 'resumo' && s.type !== 'referencias').map(s => s.id));
                      setShowAbstractGen(true);
                    }}
                    disabled={isStreaming}
                    className="sm:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors disabled:opacity-50"
                  >
                    <MI name="description" className="text-xs" />
                    Abstract
                  </button>
                  <button
                    onClick={handleAnalyzeSection}
                    disabled={isStreaming || !activeSection.content.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#005344] text-white text-[11px] font-bold disabled:opacity-40 transition-all hover:bg-[#004338] active:scale-[0.98]"
                  >
                    <MI name="auto_awesome" className="text-xs" />
                    Analisar Seção
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
};

export default ScientificStudio;
