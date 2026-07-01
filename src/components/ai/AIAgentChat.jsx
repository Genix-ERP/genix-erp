import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, Loader2, Check, X, Wrench, User, ShieldAlert } from "lucide-react";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { aiService } from "@/api/services/ai";
import { toast } from 'sonner';

// Self-contained ERP-agent chat. Talks to POST /ai/agent (read tools run
// automatically; write tools come back as a confirmation card) and
// POST /ai/agent/execute (runs an approved write). Keeps its own message +
// backend-history state so it doesn't depend on the large AIContext.
export default function AIAgentChat() {
  const { language } = useLanguage();
  const tr = useCallback((uz, ru, en) => (language === 'ru' ? ru : language === 'uz' ? uz : en), [language]);

  const [messages, setMessages] = useState([]); // {role:'user'|'assistant'|'system', content, steps?}
  const [history, setHistory] = useState([]);    // backend conversation history for continuity
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(null);  // {tool, args, summary}
  const [approving, setApproving] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, pending]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setPending(null);
    setMessages(m => [...m, { role: 'user', content: text }]);
    setLoading(true);
    try {
      const res = await aiService.agentChat(text, history);
      if (res?.type === 'confirmation_required') {
        if (res.assistant_note) setMessages(m => [...m, { role: 'assistant', content: res.assistant_note, steps: res.steps }]);
        else if (res.steps?.length) setMessages(m => [...m, { role: 'assistant', content: '', steps: res.steps }]);
        setPending(res.pending_action);
      } else {
        setMessages(m => [...m, { role: 'assistant', content: res?.message || '', steps: res?.steps }]);
        if (Array.isArray(res?.history)) setHistory(res.history);
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || tr('Xatolik', 'Ошибка', 'Error'));
      setMessages(m => [...m, { role: 'system', content: tr("So'rov bajarilmadi", 'Запрос не выполнен', 'Request failed') }]);
    } finally {
      setLoading(false);
    }
  };

  const approve = async () => {
    if (!pending) return;
    setApproving(true);
    try {
      const res = await aiService.agentExecute(pending.tool, pending.args);
      setMessages(m => [...m, { role: 'system', content: `✅ ${res?.summary || pending.summary}` }]);
      setPending(null);
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || tr('Bajarilmadi', 'Не выполнено', 'Failed'));
    } finally {
      setApproving(false);
    }
  };

  const reject = () => {
    setMessages(m => [...m, { role: 'system', content: `✖ ${tr('Bekor qilindi', 'Отменено', 'Cancelled')}` }]);
    setPending(null);
  };

  return (
    <Card className="bg-white/90 backdrop-blur-sm border-slate-200/60 shadow-lg flex flex-col h-[560px]">
      <CardHeader className="border-b border-slate-100 py-3">
        <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Bot className="w-4.5 h-4.5 text-white" />
          </div>
          {tr('ERP Agent', 'ERP Агент', 'ERP Agent')}
          <Badge className="bg-amber-100 text-amber-800 text-[10px]">beta</Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !loading && (
          <div className="text-center text-slate-400 text-sm py-10">
            <Bot className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>{tr("Menga savol bering yoki ish buyuring — masalan: “eng kam qolgan mahsulotlar”, “Alisher uchun mijoz oching”.",
                   'Спросите меня — например: «товары с наименьшим остатком», «создай клиента Alisher».',
                   'Ask me — e.g. “which products are low on stock”, “open a customer named Alisher”.')}</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] ${m.role === 'user' ? 'order-2' : ''}`}>
              {m.role !== 'user' && m.steps?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1">
                  {m.steps.map((s, j) => (
                    <Badge key={j} className={`text-[10px] flex items-center gap-1 ${s.ok ? 'bg-slate-100 text-slate-600' : 'bg-red-100 text-red-700'}`}>
                      <Wrench className="w-2.5 h-2.5" />{s.tool}
                    </Badge>
                  ))}
                </div>
              )}
              {m.content && (
                <div className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  m.role === 'user' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                  : m.role === 'system' ? 'bg-slate-100 text-slate-600 text-xs'
                  : 'bg-slate-50 border border-slate-200 text-slate-800'}`}>
                  {m.content}
                </div>
              )}
            </div>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${m.role === 'user' ? 'order-1 mr-2 bg-blue-100' : 'ml-2 bg-purple-100'}`}>
              {m.role === 'user' ? <User className="w-4 h-4 text-blue-600" /> : <Bot className="w-4 h-4 text-purple-600" />}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> {tr('O\'ylayapman…', 'Думаю…', 'Thinking…')}
          </div>
        )}

        {/* Confirmation card for a proposed write */}
        {pending && (
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
            <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm mb-1">
              <ShieldAlert className="w-4 h-4" /> {tr('Tasdiqlash kerak', 'Требуется подтверждение', 'Confirmation required')}
            </div>
            <p className="text-sm text-slate-700">{pending.summary}</p>
            <pre className="text-[11px] text-slate-500 mt-1 bg-white/60 rounded p-2 overflow-x-auto">{JSON.stringify(pending.args, null, 2)}</pre>
            <div className="flex gap-2 mt-2">
              <Button size="sm" className="bg-green-600 hover:bg-green-700" disabled={approving} onClick={approve}>
                {approving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                {tr('Ha, bajar', 'Да, выполнить', 'Yes, do it')}
              </Button>
              <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" disabled={approving} onClick={reject}>
                <X className="w-4 h-4 mr-1" />{tr('Bekor', 'Отмена', 'Cancel')}
              </Button>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </CardContent>

      <div className="border-t border-slate-100 p-3 flex items-center gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={tr('Savol yoki buyruq…', 'Вопрос или команда…', 'Ask or command…')}
          disabled={loading}
        />
        <Button onClick={send} disabled={loading || !input.trim()} className="bg-gradient-to-r from-blue-600 to-purple-600 shrink-0">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}
