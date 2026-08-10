import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Settings2, MessageSquare, X } from 'lucide-react';
import { aiService } from '@/api/services/ai';

// Thread rail — server-side conversations (GET/DELETE /ai/conversations).
// Grouped by recency buckets; delete is optimistic. The parent bumps
// `refreshToken` after each completed exchange so titles/order stay fresh.

const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };

export default function ThreadSidebar({
  lang = 'uz', activeId = '', refreshToken = 0, quotaInfo = null,
  onSelect, onNew, onOpenStudio, onClose,
}) {
  const tr = (uz, ru, en) => (lang === 'ru' ? ru : lang === 'en' ? en : uz);
  const [threads, setThreads] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await aiService.listConversations();
        if (alive) setThreads(Array.isArray(data) ? data : []);
      } catch { /* rail is enhancement; chat works without it */ }
      if (alive) setLoaded(true);
    })();
    return () => { alive = false; };
  }, [refreshToken]);

  const groups = useMemo(() => {
    const today = dayStart(new Date());
    const oneDay = 86400000;
    const buckets = [
      { key: 'today', label: tr('Bugun', 'Сегодня', 'Today'), items: [] },
      { key: 'yesterday', label: tr('Kecha', 'Вчера', 'Yesterday'), items: [] },
      { key: 'week', label: tr('Oldingi 7 kun', 'Последние 7 дней', 'Previous 7 days'), items: [] },
      { key: 'older', label: tr('Eskiroq', 'Ранее', 'Older'), items: [] },
    ];
    for (const t of threads) {
      const ts = dayStart(t.updated_at || t.created_at || Date.now());
      if (ts >= today) buckets[0].items.push(t);
      else if (ts >= today - oneDay) buckets[1].items.push(t);
      else if (ts >= today - 7 * oneDay) buckets[2].items.push(t);
      else buckets[3].items.push(t);
    }
    return buckets.filter((b) => b.items.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads, lang]);

  const remove = async (e, id) => {
    e.stopPropagation();
    setThreads((list) => list.filter((t) => t.id !== id)); // optimistic
    if (id === activeId) onNew?.();
    try { await aiService.deleteConversation(id); } catch { /* already gone from UI */ }
  };

  const quotaPct = quotaInfo?.limit > 0
    ? Math.min(100, Math.round((quotaInfo.used / quotaInfo.limit) * 100)) : 0;

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-50/60">
      <div className="p-2.5 flex items-center gap-1.5">
        <button onClick={onNew}
          className="flex-1 rounded-xl p-[1.5px] bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transition-colors shadow-sm">
          <span className="flex items-center justify-center gap-1.5 rounded-[10px] bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors">
            <Plus className="w-3.5 h-3.5 text-blue-600" />
            {tr('Yangi suhbat', 'Новый чат', 'New chat')}
          </span>
        </button>
        {onClose && (
          <button onClick={onClose} className="md:hidden text-slate-400 hover:text-slate-700 p-1.5"
            title={tr('Yopish', 'Закрыть', 'Close')}>
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loaded && threads.length === 0 && (
          <div className="text-center pt-8 px-3">
            <MessageSquare className="w-5 h-5 mx-auto text-slate-300 mb-2" />
            <p className="text-[11px] text-slate-400">
              {tr('Suhbatlar shu yerda saqlanadi', 'Чаты сохраняются здесь', 'Chats are kept here')}
            </p>
          </div>
        )}
        {groups.map((g) => (
          <div key={g.key} className="mb-2">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 px-2 pt-2 pb-1">
              {g.label}
            </p>
            <div className="space-y-0.5">
              {g.items.map((t) => {
                const active = t.id === activeId;
                return (
                  <div key={t.id} onClick={() => onSelect?.(t.id)}
                    className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${
                      active ? 'bg-white shadow-sm border border-slate-200' : 'border border-transparent hover:bg-white/80'}`}>
                    <span className={`flex-1 text-xs truncate ${active ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
                      {t.title?.trim() || tr('Suhbat', 'Чат', 'Chat')}
                    </span>
                    <button onClick={(e) => remove(e, t.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-opacity shrink-0"
                      title={tr("O'chirish", 'Удалить', 'Delete')}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100 px-3 py-2.5 space-y-2">
        {quotaInfo && quotaInfo.limit > 0 && (
          <div>
            <div className="flex justify-between text-[10px] text-slate-500 mb-1">
              <span>{tr('AI kvota', 'Квота ИИ', 'AI quota')}</span>
              <span className="tabular-nums">{quotaInfo.used}/{quotaInfo.limit}</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${quotaPct > 90 ? 'bg-red-500' : 'bg-gradient-to-r from-blue-500 to-purple-500'}`}
                style={{ width: `${quotaPct}%` }} />
            </div>
          </div>
        )}
        {onOpenStudio && (
          <button onClick={onOpenStudio}
            className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-white/80 transition-colors">
            <Settings2 className="w-3.5 h-3.5" />
            {tr('Sozlamalar', 'Настройки', 'Settings')}
          </button>
        )}
      </div>
    </div>
  );
}
