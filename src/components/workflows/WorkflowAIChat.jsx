import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Bot } from "lucide-react";
import { useLanguage } from "@/components/contexts/LanguageContext";
import AIAgentChat from "@/components/ai/AIAgentChat";

// Floating "Workflow AI Assistant" for the Workflows page. It now uses the real
// ERP agent (tool-calling + confirm-before-write) instead of the old advisory
// chat, so it can actually list, create and activate/pause workflows. After any
// confirmed action it calls onWorkflowUpdate so the page refreshes its list.
export default function WorkflowAIChat({ onWorkflowUpdate }) {
  const [isOpen, setIsOpen] = useState(false);
  const { language } = useLanguage();
  const tr = (uz, ru, en) => (language === 'ru' ? ru : language === 'uz' ? uz : en);

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          className="h-14 w-14 rounded-full shadow-lg bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] hover:shadow-xl transition-all duration-300 hover:scale-110"
        >
          <Bot className="w-6 h-6 text-white" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)]">
      <AIAgentChat
        title={tr('Workflow AI', 'Workflow AI', 'Workflow AI')}
        onClose={() => setIsOpen(false)}
        onAction={() => onWorkflowUpdate?.()}
        className="h-[520px] shadow-2xl"
        emptyHint={tr(
          "Ish oqimlari (workflow) bo'yicha so'rang yoki buyuring — masalan: “faol workflowlar”, “sotuv uchun workflow yarat”.",
          'Спросите про воркфлоу — например: «активные воркфлоу», «создай воркфлоу для продаж».',
          'Ask about workflows — e.g. “active workflows”, “create a sales workflow”.'
        )}
      />
    </div>
  );
}
