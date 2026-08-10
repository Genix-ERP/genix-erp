import React from 'react';
import { X, Bot } from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import AgentWorkspace from '@/components/assistant/AgentWorkspace';

// Floating AI widget (topbar Bot button) — now a thin shell over the shared
// AgentWorkspace core, so the widget and the /aiassistant page are the SAME
// implementation (one core, N shells; audit C3/C4). Props kept compatible
// with Layout.jsx: isOpen, onClose, initialPrompt.
export default function AIChatBox({ isOpen, onClose, initialPrompt = null }) {
  const { language } = useLanguage();
  if (!isOpen) return null;

  const title = language === 'ru' ? 'ИИ-помощник' : language === 'en' ? 'AI Assistant' : 'AI Yordamchi';

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-[380px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-6rem)] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <span className="flex-1 text-sm font-bold text-slate-900">{title}</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <AgentWorkspace compact initialPrompt={initialPrompt} />
      </div>
    </div>
  );
}
