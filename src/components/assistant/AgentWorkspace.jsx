import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Bot, Send, Loader2, Square, Sparkles, Mic, Trash2, Plus,
  PanelLeft, Menu, ChevronDown, ChevronRight, User as UserIcon,
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { aiService } from '@/api/services/ai';
import useAgentChat from './useAgentChat';
import useVoiceInput from './useVoiceInput';
import AgentBlocks from './AgentBlocks';
import StepsPanel, { StepChips } from './StepsPanel';
import ApprovalCard from './ApprovalCard';
import AgentStudio from './AgentStudio';
import ThreadSidebar from './ThreadSidebar';
import { AGENT_ICONS } from './agentIcons';

// The agentic workspace — ONE assistant serving every shell:
//   <AgentWorkspace />              → full page (thread rail + hero/chat)
//   <AgentWorkspace compact />      → floating widget (chat only)
// There is NO agent picker: every request goes to the orchestrator (agent:'')
// which routes to module skills internally. Threads persist server-side via
// conversation_id, so widget chats show up in the page's thread rail too.

// Shown when the catalog hasn't loaded (or carries no quick actions) — the
// hero should never render an empty chip row.
const FALLBACK_SUGGESTIONS = [
  { text: "Bugungi moliyaviy holatni ko'rsat", icon: 'wallet' },
  { text: 'Kam qolgan mahsulotlarni tekshir', icon: 'package' },
  { text: "Oxirgi savdolar bo'yicha xulosa qil", icon: 'trending-up' },
];

// Collapsible per-message tool trace — replaces the old right-hand rail.
function ProcessDisclosure({ steps, lang, label }) {
  const [open, setOpen] = useState(false);
  if (!Array.isArray(steps) || !steps.length) return null;
  return (
    <div className="mt-1.5">
      <button onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 transition-colors">
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {label} ({steps.length})
      </button>
      {open && (
        <div className="mt-1 rounded-xl border border-slate-100 bg-slate-50/60 overflow-hidden">
          <StepsPanel steps={steps} lang={lang} />
        </div>
      )}
    </div>
  );
}

export default function AgentWorkspace({ compact = false, initialPrompt = null, onAction }) {
  const { language } = useLanguage();
  const lang = language === 'ru' ? 'ru' : language === 'en' ? 'en' : 'uz';
  const tr = (uz, ru, en) => (lang === 'ru' ? ru : lang === 'en' ? en : uz);

  const [catalog, setCatalog] = useState([]);
  const [quotaInfo, setQuotaInfo] = useState(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const [input, setInput] = useState('');
  const [threadsVersion, setThreadsVersion] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try { return localStorage.getItem('genix_ai_sidebar') !== '0'; } catch { return true; }
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const endRef = useRef(null);
  const sentInitialRef = useRef(false);

  const chat = useAgentChat({
    agent: '', // single assistant — the backend orchestrator routes internally
    onExchange: () => setThreadsVersion((v) => v + 1),
  });
  const {
    messages, pending, loading, threadLoading, quota, conversationId,
    send, approve, reject, stop, loadConversation, newConversation,
  } = chat;

  const voice = useVoiceInput({ language: lang, onText: (text) => send(text) });

  // Catalog is loaded once per mount (guarded — no fetch loops).
  const loadCatalog = React.useCallback(async () => {
    try {
      const data = await aiService.listAgents();
      setCatalog(data?.agents || []);
      setQuotaInfo(data?.quota || null);
    } catch { /* catalog is enhancement; chat works without it */ }
  }, []);
  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  useEffect(() => {
    try { localStorage.setItem('genix_ai_sidebar', sidebarOpen ? '1' : '0'); } catch { /* ignore */ }
  }, [sidebarOpen]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, pending, loading]);
  useEffect(() => {
    if (initialPrompt && !sentInitialRef.current) {
      sentInitialRef.current = true;
      send(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  const orchestrator = useMemo(
    () => catalog.find((a) => a.key === 'orchestrator') || null,
    [catalog]
  );

  // Suggestion chips: quick actions merged round-robin across module agents
  // (skip the orchestrator itself), each tagged with its module's icon.
  const suggestions = useMemo(() => {
    const modules = catalog.filter((a) =>
      a.key !== 'orchestrator' && a.enabled !== false && Array.isArray(a.quick_actions_uz) && a.quick_actions_uz.length);
    const out = [];
    for (let round = 0; out.length < 9; round++) {
      let added = false;
      for (const a of modules) {
        if (out.length >= 9) break;
        const q = a.quick_actions_uz[round];
        if (q) { out.push({ text: q, icon: a.icon }); added = true; }
      }
      if (!added) break;
    }
    return out.length ? out : FALLBACK_SUGGESTIONS;
  }, [catalog]);

  const handleSend = (text = input) => {
    if (!text.trim() || loading || threadLoading) return;
    setInput('');
    send(text);
  };
  const handleApprove = async () => {
    const done = await approve();
    if (done) onAction?.(done.tool, done.args);
  };
  const handleSelectThread = (id) => {
    if (id !== conversationId) loadConversation(id);
    setMobileNavOpen(false);
  };
  const handleNew = () => {
    newConversation();
    setInput('');
    setMobileNavOpen(false);
  };

  const empty = messages.length === 0 && !loading && !threadLoading;

  // ---- Composer (shared between hero-centered and bottom-docked spots) ----
  const composer = (hero = false) => (
    <div className="relative">
      {voice.recording && (
        <div className={`absolute inset-0 z-10 bg-white flex items-center gap-3 px-3 border border-red-200 ${hero ? 'rounded-2xl' : 'rounded-xl'}`}>
          <button onClick={voice.cancel} className="text-slate-400 hover:text-red-500" title={tr('Bekor', 'Отмена', 'Cancel')}>
            <Trash2 className="w-4 h-4" />
          </button>
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
          <span className="font-mono text-xs text-slate-700 tabular-nums">
            {Math.floor(voice.seconds / 60)}:{String(voice.seconds % 60).padStart(2, '0')}
          </span>
          <span className="flex-1 text-[11px] text-slate-400 truncate">
            {tr('Yozilmoqda… tugagach yuboring', 'Запись…', 'Recording…')}
          </span>
          <Button onClick={voice.send} size="icon" className="h-8 w-8 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600">
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
      <Textarea value={input} onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        placeholder={tr("Biznesingiz bo'yicha istalgan savol…", 'Любой вопрос о вашем бизнесе…', 'Ask anything about your business…')}
        rows={1} disabled={loading || threadLoading} autoFocus={hero && !compact}
        className={hero
          ? 'min-h-[58px] max-h-[160px] resize-none pr-24 pl-4 py-4 rounded-2xl border-slate-200 shadow-lg shadow-slate-200/60 text-[15px] focus-visible:ring-2 focus-visible:ring-blue-500/30'
          : 'min-h-[44px] max-h-[120px] resize-none pr-20 rounded-xl border-slate-200 shadow-sm text-sm'}
        onInput={(e) => {
          e.target.style.height = 'auto';
          e.target.style.height = Math.min(e.target.scrollHeight, hero ? 160 : 120) + 'px';
        }} />
      {voice.supported && (
        <Button onClick={voice.start} disabled={loading || voice.transcribing} size="icon" variant="ghost"
          title={tr('Ovozli kiritish', 'Голосовой ввод', 'Voice input')}
          className={`absolute rounded-lg text-slate-400 hover:text-blue-600 ${hero ? 'right-12 bottom-2.5 h-9 w-9' : 'right-11 bottom-1.5 h-8 w-8'}`}>
          {voice.transcribing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
        </Button>
      )}
      <Button onClick={() => handleSend()} disabled={!input.trim() || loading} size="icon"
        className={`absolute rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 ${
          hero ? 'right-2 bottom-2.5 h-9 w-9 rounded-xl' : 'right-1.5 bottom-1.5 h-8 w-8'}`}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
      </Button>
    </div>
  );

  const suggestionChips = (items) => (
    <div className="flex flex-wrap justify-center gap-2">
      {items.map((s, i) => {
        const Icon = AGENT_ICONS[s.icon] || Bot;
        return (
          <button key={i} onClick={() => handleSend(s.text)}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-blue-300 hover:text-blue-700 hover:shadow transition-all">
            <Icon className="w-3.5 h-3.5 text-slate-400" />
            <span className="truncate max-w-[220px]">{s.text}</span>
          </button>
        );
      })}
    </div>
  );

  // ---- Empty state: centered hero (full) / mini hero (compact) ----
  const heroState = empty && !compact && (
    <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl flex flex-col items-center">
        <div className="w-14 h-14 mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-purple-200/60 flex items-center justify-center">
          <Sparkles className="w-7 h-7 text-white" />
        </div>
        <p className="text-sm text-slate-500 mb-7 text-center max-w-md">
          {tr("Biznesingiz bo'yicha istalgan savol — o'qiyman, tahlil qilaman, qoralama tayyorlayman; muhim amallarni siz tasdiqlaysiz.",
              'Любой вопрос о вашем бизнесе — прочитаю, проанализирую, подготовлю черновик; важные действия подтверждаете вы.',
              'Ask anything about your business — I read, analyse and draft; you approve the important actions.')}
        </p>
        <div className="w-full mb-6">
          {composer(true)}
          {voice.error && <p className="text-[10px] text-red-500 mt-1.5 px-1 text-center">{voice.error}</p>}
        </div>
        {suggestionChips(suggestions)}
      </div>
    </div>
  );

  const compactEmptyState = empty && compact && (
    <div className="text-center py-8 px-4">
      <div className="w-11 h-11 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md shadow-purple-200/60">
        <Sparkles className="w-5 h-5 text-white" />
      </div>
      <h3 className="text-sm font-semibold text-slate-800 mb-1">
        {tr('AI Yordamchi', 'ИИ-помощник', 'AI Assistant')}
      </h3>
      <p className="text-xs text-slate-400 mb-4 max-w-[240px] mx-auto">
        {tr("Istalgan savol — muhim amallarni siz tasdiqlaysiz.",
            'Любой вопрос — важные действия подтверждаете вы.',
            'Ask anything — you approve the important actions.')}
      </p>
      {suggestionChips(suggestions.slice(0, 3))}
    </div>
  );

  // ---- Chat state: centered messages column + docked composer ----
  const messageList = (
    <div className="flex-1 overflow-y-auto">
      {(messages.length > 0 || loading || threadLoading) && (
        <div className="sticky top-0 z-10 flex justify-end px-3 pt-2 pointer-events-none">
          <button onClick={handleNew}
            className="pointer-events-auto inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border border-slate-200 bg-white/90 backdrop-blur text-slate-500 shadow-sm hover:text-blue-700 hover:border-blue-300 transition-colors">
            <Plus className="w-3 h-3" /> {tr('Yangi suhbat', 'Новый чат', 'New chat')}
          </button>
        </div>
      )}
      <div className={`mx-auto w-full max-w-3xl px-3 pb-4 space-y-4 ${compact ? 'pt-1' : 'pt-2'}`}>
        {compactEmptyState}
        {threadLoading && (
          <div className="flex items-center justify-center gap-2 text-slate-400 text-xs py-10">
            <Loader2 className="w-4 h-4 animate-spin" />
            {tr('Suhbat yuklanmoqda…', 'Загрузка чата…', 'Loading chat…')}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role !== 'user' && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
            )}
            <div className={`max-w-[85%] min-w-0 ${m.role === 'user' ? '' : 'flex-1'}`}>
              {m.role !== 'user' && <StepChips steps={m.steps} lang={lang} />}
              {m.blocks?.length > 0 && <AgentBlocks blocks={m.blocks} />}
              {m.content && (
                <div className={`rounded-2xl px-3.5 py-2 text-sm ${
                  m.role === 'user' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white inline-block float-right'
                  : m.role === 'system' ? 'bg-slate-100 text-slate-500 text-xs inline-block'
                  : 'bg-slate-50 border border-slate-200 text-slate-800'}`}>
                  {m.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-p:my-1.5 prose-table:text-xs prose-th:border prose-th:border-slate-200 prose-th:p-1 prose-td:border prose-td:border-slate-200 prose-td:p-1">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  )}
                </div>
              )}
              {m.role !== 'user' && (
                <ProcessDisclosure steps={m.steps} lang={lang} label={tr('Jarayon', 'Процесс', 'Process')} />
              )}
            </div>
            {m.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center shrink-0 ml-2 mt-0.5">
                <UserIcon className="w-3.5 h-3.5 text-white" />
              </div>
            )}
          </div>
        ))}

        {pending && (
          <ApprovalCard pending={pending} approving={loading} onApprove={handleApprove} onReject={reject} lang={lang} />
        )}

        {loading && !pending && (
          <div className="flex items-center gap-2 text-slate-400 text-xs pl-9">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="animate-pulse">{tr('Ishlayapman…', 'Работаю…', 'Working…')}</span>
            <button onClick={stop} className="ml-2 inline-flex items-center gap-1 text-red-500 hover:text-red-700">
              <Square className="w-3 h-3" /> {tr("To'xtatish", 'Стоп', 'Stop')}
            </button>
          </div>
        )}

        {quota && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {tr(`AI kvota tugadi (${quota.used}/${quota.limit}). Tarifni yangilang yoki keyingi oyni kuting.`,
                `Квота ИИ исчерпана (${quota.used}/${quota.limit}).`,
                `AI quota exhausted (${quota.used}/${quota.limit}).`)}
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );

  const dockedComposer = (
    <div className="border-t border-slate-100 p-2.5">
      <div className="mx-auto w-full max-w-3xl">
        {composer(false)}
        {voice.error && <p className="text-[10px] text-red-500 mt-1 px-1">{voice.error}</p>}
      </div>
    </div>
  );

  // ---- Main column ----
  const mainColumn = (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      {!compact && (
        <div className="flex items-center gap-1 px-2 pt-2">
          <button onClick={() => setMobileNavOpen(true)}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
            title={tr('Suhbatlar', 'Чаты', 'Chats')}>
            <Menu className="w-4 h-4" />
          </button>
          <button onClick={() => setSidebarOpen((s) => !s)}
            className="hidden md:inline-flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
            title={tr('Suhbatlar paneli', 'Панель чатов', 'Thread panel')}>
            <PanelLeft className="w-4 h-4" />
          </button>
        </div>
      )}
      {heroState || (
        <>
          {messageList}
          {dockedComposer}
        </>
      )}
    </div>
  );

  return (
    <div className={`relative flex h-full min-h-0 bg-white ${compact ? '' : 'rounded-2xl border border-slate-200 shadow-sm overflow-hidden'}`}>
      {!compact && sidebarOpen && (
        <div className="hidden md:flex md:flex-col w-64 shrink-0 border-r border-slate-100">
          <ThreadSidebar lang={lang} activeId={conversationId} refreshToken={threadsVersion}
            quotaInfo={quotaInfo} onSelect={handleSelectThread} onNew={handleNew}
            onOpenStudio={orchestrator ? () => setStudioOpen(true) : null} />
        </div>
      )}

      {!compact && mobileNavOpen && (
        <div className="absolute inset-0 z-40 flex md:hidden">
          <div className="w-72 max-w-[85%] h-full bg-white border-r border-slate-200 shadow-xl">
            <ThreadSidebar lang={lang} activeId={conversationId} refreshToken={threadsVersion}
              quotaInfo={quotaInfo} onSelect={handleSelectThread} onNew={handleNew}
              onOpenStudio={orchestrator ? () => { setStudioOpen(true); setMobileNavOpen(false); } : null}
              onClose={() => setMobileNavOpen(false)} />
          </div>
          <div className="flex-1 bg-slate-900/30" onClick={() => setMobileNavOpen(false)} />
        </div>
      )}

      {mainColumn}

      {studioOpen && orchestrator && (
        <AgentStudio agent={orchestrator} catalog={catalog} lang={lang}
          onClose={() => setStudioOpen(false)} onSaved={loadCatalog} />
      )}
    </div>
  );
}
