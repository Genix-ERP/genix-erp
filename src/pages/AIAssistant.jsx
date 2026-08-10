import React from 'react';
import AgentWorkspace from '@/components/assistant/AgentWorkspace';

// AI Yordamchi — the single-assistant workspace (redesigned 2026-08-10).
// No page header: the workspace hero carries identity. The page is a thin
// padded shell; the same core powers the floating topbar widget — one core,
// N shells. Server-side threads live in the workspace's own left rail.
export default function AIAssistant() {
  return (
    <div className="h-full flex flex-col p-3 md:p-5 bg-slate-50/50">
      <div className="max-w-6xl w-full mx-auto flex-1 min-h-0">
        <AgentWorkspace />
      </div>
    </div>
  );
}
