import { useCallback, useRef, useState } from 'react';
import { aiService } from '@/api/services/ai';

// Core state machine for the agentic chat — ONE implementation shared by every
// shell (full page, floating widget, future mobile). Talks to POST /ai/agent:
// reads run inside the loop, writes come back as a confirmation card
// (tasdiqlash kartasi) and only execute after explicit approval.
//
// Threads live SERVER-SIDE (conversation_id): the first exchange returns an id,
// every later call echoes it, and GET /ai/conversations/:id restores a thread.
// No localStorage persistence anymore.
//
// Messages: { role: 'user'|'assistant'|'system', content, steps?, blocks? }
export function useAgentChat({ agent = '', onExchange } = {}) {
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [conversationId, setConversationId] = useState('');
  const [pending, setPending] = useState(null);          // {tool, args, summary}
  const [pendingHistory, setPendingHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false); // restoring an old thread
  const [quota, setQuota] = useState(null);              // {used, limit} when exceeded
  const [error, setError] = useState(null);
  const stoppedRef = useRef(false);

  // onExchange (e.g. "refresh the thread sidebar") is kept in a ref so callers
  // can pass inline closures without destabilising the callbacks below.
  const onExchangeRef = useRef(onExchange);
  onExchangeRef.current = onExchange;

  const applyResponse = useCallback((res, msgs) => {
    if (res?.conversation_id) setConversationId(res.conversation_id);
    if (res?.type === 'confirmation_required') {
      const next = [...msgs];
      if (res.assistant_note || res.steps?.length || res.blocks?.length) {
        next.push({ role: 'assistant', content: res.assistant_note || '', steps: res.steps, blocks: res.blocks });
      }
      setMessages(next);
      setPending(res.pending_action);
      setPendingHistory(Array.isArray(res.history) ? res.history : []);
      onExchangeRef.current?.();
      return;
    }
    const next = [...msgs, { role: 'assistant', content: res?.message || '', steps: res?.steps, blocks: res?.blocks }];
    setMessages(next);
    if (Array.isArray(res?.history)) setHistory(res.history);
    setPending(null);
    setPendingHistory([]);
    onExchangeRef.current?.();
  }, []);

  const handleError = useCallback((err, msgs) => {
    const data = err?.response?.data;
    if (err?.response?.status === 429 && data?.error?.code === 'quota_exceeded') {
      setQuota(data.quota || { used: 0, limit: 0 });
      setMessages([...msgs, { role: 'system', content: data.error.message || 'AI kvota tugadi' }]);
      return;
    }
    const msg = data?.error?.message || (typeof data?.error === 'string' ? data.error : null) || err?.message || 'Xatolik';
    setError(msg);
    setMessages([...msgs, { role: 'system', content: msg }]);
  }, []);

  const send = useCallback(async (text) => {
    const trimmed = (text || '').trim();
    if (!trimmed || loading) return;
    setError(null);
    setPending(null);
    stoppedRef.current = false;
    const msgs = [...messages, { role: 'user', content: trimmed }];
    setMessages(msgs);
    setLoading(true);
    try {
      const res = await aiService.agentChat(trimmed, history, null, agent, conversationId);
      if (!stoppedRef.current) applyResponse(res, msgs);
    } catch (err) {
      if (!stoppedRef.current) handleError(err, msgs);
    } finally {
      setLoading(false);
    }
  }, [messages, history, agent, conversationId, loading, applyResponse, handleError]);

  // Approve the proposed write → the agent executes it AND continues reasoning.
  const approve = useCallback(async () => {
    if (!pending || loading) return;
    const p = pending;
    const h = pendingHistory;
    setPending(null);
    setLoading(true);
    const msgs = [...messages, { role: 'system', content: `✅ ${p.summary}` }];
    setMessages(msgs);
    try {
      const res = await aiService.agentChat('', h, { tool: p.tool, args: p.args }, agent, conversationId);
      applyResponse(res, msgs);
      return { tool: p.tool, args: p.args };
    } catch (err) {
      handleError(err, msgs);
      setPending(p);
      setPendingHistory(h);
      return null;
    } finally {
      setLoading(false);
    }
  }, [pending, pendingHistory, messages, agent, conversationId, loading, applyResponse, handleError]);

  const reject = useCallback(() => {
    if (!pending) return;
    setMessages((m) => [...m, { role: 'system', content: '✖ Bekor qilindi' }]);
    setPending(null);
    setPendingHistory([]);
  }, [pending]);

  // Stop: drafts-only writes mean stopping never leaves half-written state —
  // we just ignore the in-flight response when it lands.
  const stop = useCallback(() => {
    stoppedRef.current = true;
    setLoading(false);
    setMessages((m) => [...m, { role: 'system', content: "⏹ To'xtatildi — davom etish uchun yangi ko'rsatma yozing." }]);
  }, []);

  // Restore a server-side thread. NOTE: the backend `history` array (model-
  // native turns incl. tool traces) is not stored per message and cannot be
  // reconstructed here — continuing an old thread deliberately starts a fresh
  // model context; the server still appends new messages to the same
  // conversation record, so the visible thread stays continuous.
  const loadConversation = useCallback(async (id) => {
    if (!id) return;
    setThreadLoading(true);
    setError(null);
    setPending(null);
    setPendingHistory([]);
    stoppedRef.current = false;
    try {
      const data = await aiService.getConversation(id);
      const msgs = (data?.messages || []).map((m) => ({
        role: m.role,
        content: m.content,
        steps: m.metadata?.steps,
        blocks: m.metadata?.blocks,
      }));
      setMessages(msgs);
      setHistory([]); // fresh model context — see note above
      setConversationId(data?.id || id);
    } catch (err) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Suhbatni ochib bo‘lmadi';
      setError(typeof msg === 'string' ? msg : 'Suhbatni ochib bo‘lmadi');
    } finally {
      setThreadLoading(false);
    }
  }, []);

  // Brand-new chat: empty thread, conversation_id '' → the next send mints one.
  const newConversation = useCallback(() => {
    setMessages([]);
    setHistory([]);
    setConversationId('');
    setPending(null);
    setPendingHistory([]);
    setError(null);
    stoppedRef.current = false;
  }, []);

  return {
    messages, pending, loading, threadLoading, quota, error, conversationId,
    send, approve, reject, stop, loadConversation, newConversation,
  };
}

export default useAgentChat;
