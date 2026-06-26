import React, { useState, useRef, useEffect } from "react";
import { useAI } from "@/components/contexts/AIContext";
import { useAuth } from "@/components/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  Bot, Send, Sparkles, Loader2, Search, Zap, TrendingUp,
  Users, Package, DollarSign, ArrowRight, Copy, Check,
  Mic, MicOff, Volume2, VolumeX, Square, Trash2
} from "lucide-react";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { aiService } from "@/api/services/ai";
import ReactMarkdown from 'react-markdown';

const TOOL_LABELS = {
  analyze_sales_data: { en: 'Sales analysis', uz: 'Savdo tahlili', ru: 'Анализ продаж' },
  analyze_inventory: { en: 'Inventory analysis', uz: 'Ombor tahlili', ru: 'Анализ инвентаря' },
  analyze_financials: { en: 'Financial analysis', uz: 'Moliyaviy tahlil', ru: 'Финансовый анализ' },
  analyze_customers: { en: 'Customer analysis', uz: 'Mijozlar tahlili', ru: 'Анализ клиентов' },
  analyze_hr: { en: 'HR analysis', uz: 'HR tahlili', ru: 'HR-анализ' },
  analyze_assets: { en: 'Asset analysis', uz: 'Aktivlar tahlili', ru: 'Анализ активов' },
  analyze_projects: { en: 'Project analysis', uz: 'Loyihalar tahlili', ru: 'Анализ проектов' },
  analyze_contracts: { en: 'Contract analysis', uz: 'Shartnomalar tahlili', ru: 'Анализ контрактов' },
  create_company: { en: 'Create company', uz: 'Kompaniya yaratish', ru: 'Создание компании' },
  create_inventory_item: { en: 'Create item', uz: 'Mahsulot yaratish', ru: 'Создание товара' },
  adjust_stock: { en: 'Adjust stock', uz: 'Zaxirani o\'zgartirish', ru: 'Корректировка запаса' },
  create_customer: { en: 'Create customer', uz: 'Mijoz yaratish', ru: 'Создание клиента' },
  create_sales_order: { en: 'Create sales order', uz: 'Savdo buyurtmasi yaratish', ru: 'Создание заказа' },
  create_purchase_order: { en: 'Create purchase order', uz: 'Xarid buyurtmasi yaratish', ru: 'Создание закупки' },
  create_employee: { en: 'Create employee', uz: 'Xodim yaratish', ru: 'Создание сотрудника' },
  create_expense: { en: 'Create expense', uz: 'Xarajat yaratish', ru: 'Создание расхода' },
  create_invoice: { en: 'Create invoice', uz: 'Hisob-faktura yaratish', ru: 'Создание счёта' },
  create_project: { en: 'Create project', uz: 'Loyiha yaratish', ru: 'Создание проекта' },
  create_contract: { en: 'Create contract', uz: 'Shartnoma yaratish', ru: 'Создание контракта' },
  create_vendor: { en: 'Create vendor', uz: 'Yetkazib beruvchi yaratish', ru: 'Создание поставщика' },
};

const getToolLabel = (name, lang) => {
  if (!name) return lang === 'uz' ? 'Amal' : lang === 'ru' ? 'Действие' : 'Action';
  const key = name.split('.').pop();
  const entry = TOOL_LABELS[key];
  if (entry) return entry[lang] || entry.en;
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

export default function AIAssistant() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { user } = useAuth();
  const {
    messages,
    isLoading,
    sendMessage,
    createConversation,
    activeConversation,
    isConnected,
    aiUsage,
    aiLimitReached
  } = useAI();

  const suggestedQueries = [
    { icon: TrendingUp, text: t('show_top_customers') || 'Show me top customers by revenue', color: 'text-green-600' },
    { icon: Package, text: t('inventory_restocking') || 'What inventory needs restocking?', color: 'text-orange-600' },
    { icon: DollarSign, text: t('revenue_trend_query') || 'Analyze our revenue trend', color: 'text-blue-600' },
    { icon: Sparkles, text: t('cashflow_suggestions') || 'Give me cash flow suggestions', color: 'text-purple-600' },
  ];

  const [input, setInput] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const textareaRef = useRef(null);
  const copyTimeoutRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Start a conversation only when none is active AND there's no restored
  // history. This keeps the page and the floating widget on the same thread
  // (both read `messages` from the shared AI context) instead of resetting it.
  useEffect(() => {
    if (!activeConversation && messages.length === 0) {
      createConversation({
        name: "Business AI Copilot Session",
        description: "Intelligent assistant for business operations"
      });
    }
  }, [activeConversation, messages.length]);

  const getUserInitials = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase();
    }
    if (user?.full_name) {
      const parts = user.full_name.split(' ');
      return parts.map(p => p.charAt(0)).slice(0, 2).join('').toUpperCase();
    }
    return 'U';
  };

  const formatMessageTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  useEffect(() => {
    return () => { if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current); };
  }, []);

  const handleCopyMessage = async (messageId, content) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSendMessage = async (messageText = input) => {
    if (!messageText.trim() || isLoading) return;
    setInput("");
    setShowChat(true);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await sendMessage(messageText);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ===== Voice: record audio → transcribe (Whisper) → send; + spoken replies (TTS) =====
  const speechLang = language === 'uz' ? 'uz-UZ' : language === 'ru' ? 'ru-RU' : 'en-US';
  const langHint = language === 'uz' ? 'uz' : language === 'ru' ? 'ru' : 'en';
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const recordingSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
    && typeof window !== 'undefined' && !!window.MediaRecorder;
  const sttSupported = recordingSupported; // controls mic button visibility

  const mediaRecorderRef = useRef(null);
  const mediaChunksRef = useRef([]);
  const mediaStreamRef = useRef(null);
  const cancelRecRef = useRef(false);
  const recordTimerRef = useRef(null);
  const [isListening, setIsListening] = useState(false);     // recording
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [speakingId, setSpeakingId] = useState(null);
  const lastSpokenRef = useRef(null);
  const [ttsEnabled, setTtsEnabled] = useState(() => {
    // Off by default; key bumped to _v2 so previously-enabled users reset to off.
    try { return localStorage.getItem('ai_tts_enabled_v2') === '1'; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem('ai_tts_enabled_v2', ttsEnabled ? '1' : '0'); } catch { /* ignore */ } }, [ttsEnabled]);

  // Visible voice status / errors (so failures aren't silent).
  const [voiceMsg, setVoiceMsg] = useState(null); // { text, type: 'info' | 'error' } | null
  const voiceMsgTimer = useRef(null);
  const showVoiceMsg = (text, type = 'info', autoHideMs = 0) => {
    if (voiceMsgTimer.current) clearTimeout(voiceMsgTimer.current);
    setVoiceMsg(text ? { text, type } : null);
    if (text && autoHideMs) voiceMsgTimer.current = setTimeout(() => setVoiceMsg(null), autoHideMs);
  };
  const VT = {
    transcribing: language === 'ru' ? 'Распознавание речи…' : language === 'en' ? 'Transcribing…' : 'Nutq matnga o‘girilmoqda…',
    permission: language === 'ru' ? 'Нет доступа к микрофону. Разрешите доступ в настройках браузера.' : language === 'en' ? 'Microphone access denied. Allow it in your browser.' : 'Mikrofonga ruxsat berilmadi. Brauzerda ruxsat bering.',
    noAudio: language === 'ru' ? 'Звук не записан, попробуйте ещё раз.' : language === 'en' ? 'No audio captured, try again.' : 'Ovoz yozilmadi, qayta urinib ko‘ring.',
    fail: language === 'ru' ? 'Распознавание недоступно. Убедитесь, что сервер обновлён.' : language === 'en' ? 'Transcription unavailable. Make sure the backend is rebuilt.' : 'Transkripsiya ishlamadi. Server yangilanganini tekshiring.',
    slideHint: language === 'ru' ? 'Запись… нажмите ↑ чтобы отправить' : language === 'en' ? 'Recording… tap send when done' : 'Yozilmoqda… tugagach yuboring',
  };

  const stopMicTracks = () => {
    try { mediaStreamRef.current?.getTracks().forEach(t => t.stop()); } catch { /* ignore */ }
    mediaStreamRef.current = null;
  };
  const clearRecordTimer = () => {
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
  };
  const fmtRecTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const startListening = async () => {
    if (!recordingSupported || isTranscribing || isListening) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const rec = new MediaRecorder(stream);
      mediaChunksRef.current = [];
      cancelRecRef.current = false;
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) mediaChunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stopMicTracks();
        clearRecordTimer();
        const blob = new Blob(mediaChunksRef.current, { type: rec.mimeType || 'audio/webm' });
        mediaChunksRef.current = [];
        setIsListening(false);
        setRecordSeconds(0);
        if (cancelRecRef.current) { showVoiceMsg(null); return; } // discarded
        if (!blob.size) { showVoiceMsg(VT.noAudio, 'error', 5000); return; }
        setIsTranscribing(true);
        showVoiceMsg(VT.transcribing, 'info');
        try {
          const res = await aiService.transcribe(blob, langHint);
          const text = (res?.text || '').trim();
          showVoiceMsg(null);
          if (text) { setInput(text); handleSendMessage(text); }
          else showVoiceMsg(VT.noAudio, 'error', 5000);
        } catch (err) {
          console.error('Transcription failed', err);
          const detail = err?.response?.data?.error?.message || err?.response?.data?.message || '';
          showVoiceMsg(detail ? `${VT.fail} (${detail})` : VT.fail, 'error', 9000);
        } finally {
          setIsTranscribing(false);
        }
      };
      mediaRecorderRef.current = rec;
      rec.start();
      setIsListening(true);
      setRecordSeconds(0);
      showVoiceMsg(null);
      clearRecordTimer();
      recordTimerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
    } catch (err) {
      console.error('Microphone access failed', err);
      setIsListening(false);
      stopMicTracks();
      clearRecordTimer();
      showVoiceMsg(VT.permission, 'error', 8000);
    }
  };
  // Stop recording and transcribe (Telegram-style send button).
  const sendRecording = () => {
    cancelRecRef.current = false;
    try { if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop(); } catch { /* ignore */ }
  };
  // Stop recording and throw the audio away (Telegram-style trash button).
  const cancelRecording = () => {
    cancelRecRef.current = true;
    try { if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    setIsListening(false);
    clearRecordTimer();
    setRecordSeconds(0);
    showVoiceMsg(null);
  };

  // Telegram-style recording bar shared by both input areas.
  const renderRecordingBar = () => (
    <div className="flex items-center gap-3 w-full px-2 py-1">
      <button type="button" onClick={cancelRecording} title={language === 'ru' ? 'Отменить' : language === 'en' ? 'Cancel' : 'Bekor qilish'}
        className="flex items-center justify-center h-9 w-9 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
        <Trash2 className="w-5 h-5" />
      </button>
      <span className="relative flex h-3 w-3 flex-shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
      </span>
      <span className="font-mono text-sm text-slate-700 tabular-nums">{fmtRecTime(recordSeconds)}</span>
      <span className="flex-1 text-xs text-slate-400 truncate">{VT.slideHint}</span>
      <Button type="button" onClick={sendRecording} size="icon"
        className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 h-10 w-10 rounded-full shadow-md flex-shrink-0">
        <Send className="w-4 h-4" />
      </Button>
    </div>
  );

  const stopSpeaking = () => {
    try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    setSpeakingId(null);
  };
  const speak = (text, id) => {
    if (!ttsSupported || !text) return;
    try {
      window.speechSynthesis.cancel();
      // Strip markdown so it reads cleanly.
      const clean = String(text).replace(/[#*_`>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000);
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = speechLang;
      u.onend = () => setSpeakingId(null);
      u.onerror = () => setSpeakingId(null);
      setSpeakingId(id);
      window.speechSynthesis.speak(u);
    } catch (err) { console.error('TTS error', err); setSpeakingId(null); }
  };
  const toggleSpeak = (text, id) => { speakingId === id ? stopSpeaking() : speak(text, id); };

  // Auto-read newly arrived assistant replies when enabled.
  useEffect(() => {
    if (!ttsEnabled || !ttsSupported || isLoading) return;
    const last = messages[messages.length - 1];
    if (last && last.role === 'assistant' && last.id && last.id !== lastSpokenRef.current) {
      lastSpokenRef.current = last.id;
      speak(last.content, last.id);
    }
  }, [messages, ttsEnabled, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop any audio/recording when leaving the page.
  useEffect(() => () => {
    try {
      window.speechSynthesis?.cancel();
      cancelRecRef.current = true;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    } catch { /* ignore */ }
  }, []);

  return (
    <div className="h-full flex flex-col bg-slate-50/50 relative overflow-hidden">
      {/* Subtle ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[720px] h-[720px] bg-gradient-to-b from-blue-100/40 via-purple-50/20 to-transparent rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col min-h-0">
        {!showChat ? (
          /* Landing View */
          <div className="flex flex-col items-center justify-center flex-1 px-6 py-10 animate-[fadeInUp_0.5s_ease-out]">
            <div className="w-full max-w-3xl mx-auto space-y-8">

              {/* Hero */}
              <div className="text-center space-y-4 animate-[fadeInUp_0.6s_ease-out]">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-md shadow-blue-500/20 animate-[scaleIn_0.5s_ease-out_0.2s_both]">
                  <Bot className="w-7 h-7 text-white" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                    {t('ai_assistant') || 'AI Yordamchi'}
                  </h1>
                  <p className="text-base text-slate-500 max-w-lg mx-auto">
                    {t('ai_assistant_description') || "Biznesingiz haqida istalgan savolni bering"}
                  </p>
                </div>
              </div>

              {/* Search Box */}
              <div className="animate-[fadeInUp_0.5s_ease-out_0.3s_both]">
                <div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md focus-within:shadow-md focus-within:border-blue-300 transition-all duration-200 p-1.5">
                  {isListening && (
                    <div className="absolute inset-0 z-10 bg-white rounded-2xl flex items-center px-2">
                      {renderRecordingBar()}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="pl-3.5 text-slate-400">
                      <Search className="w-5 h-5" />
                    </div>
                    <Input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={t('ask_anything') || "Biznesingiz haqida biror narsa so'rang..."}
                      className="border-0 text-base h-12 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-400 px-2"
                      disabled={isLoading}
                    />
                    {ttsSupported && (
                      <Button type="button" size="icon" variant="ghost" onClick={() => setTtsEnabled(v => !v)}
                        title={t('read_aloud') || 'Javoblarni ovoz bilan o\'qish'}
                        className={`h-10 w-10 rounded-xl ${ttsEnabled ? 'text-blue-600' : 'text-slate-400'}`}>
                        {ttsEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                      </Button>
                    )}
                    {sttSupported && (
                      <Button type="button" size="icon" variant="ghost" onClick={startListening} disabled={isTranscribing}
                        title={t('voice_input') || 'Ovozli kiritish'}
                        className="h-10 w-10 rounded-xl text-slate-500 hover:text-blue-600">
                        {isTranscribing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
                      </Button>
                    )}
                    <Button
                      onClick={() => handleSendMessage()}
                      disabled={!input.trim() || isLoading}
                      size="sm"
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-sm rounded-xl px-5 h-11 text-sm font-medium"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <span>{t('ask_ai') || "AI'dan so'rang"}</span>
                          <ArrowRight className="w-4 h-4 ml-1.5" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {voiceMsg && (
                <div className={`mt-2 text-xs text-center flex items-center justify-center gap-1.5 ${voiceMsg.type === 'error' ? 'text-red-600' : 'text-slate-500'}`}>
                  {voiceMsg.text}
                </div>
              )}

              {/* Suggested Queries */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider text-center">
                  {language === 'uz' ? 'Namuna savollar' : language === 'ru' ? 'Попробуйте спросить' : 'Try asking'}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {suggestedQueries.map((query, index) => {
                    const iconBg = [
                      'bg-green-50 text-green-600',
                      'bg-orange-50 text-orange-600',
                      'bg-blue-50 text-blue-600',
                      'bg-purple-50 text-purple-600',
                    ][index];
                    return (
                      <button
                        key={index}
                        onClick={() => handleSendMessage(query.text)}
                        disabled={isLoading}
                        className="group flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3.5 hover:border-slate-300 hover:shadow-sm transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed animate-[fadeInUp_0.4s_ease-out_both]"
                        style={{ animationDelay: `${0.4 + index * 0.08}s` }}
                      >
                        <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
                          <query.icon className="w-[18px] h-[18px]" />
                        </div>
                        <p className="flex-1 text-sm text-slate-700 leading-snug">
                          {query.text}
                        </p>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all duration-200 flex-shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        ) : (
          /* Chat View */
          <div className="flex flex-col flex-1 min-h-0 p-4 md:p-6 animate-[fadeInUp_0.4s_ease-out]">
            <div className="max-w-4xl mx-auto w-full flex flex-col flex-1 min-h-0 space-y-4">

              {/* Header */}
              <div className="flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowChat(false)}
                    className="rounded-xl"
                  >
                    ← {t('back') || 'Orqaga'}
                  </Button>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="font-bold text-slate-900">{t('ai_copilot') || 'AI Copilot'}</h2>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <p className="text-xs text-slate-500">{t('online') || 'Online'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat Area */}
              <div className="flex-1 flex flex-col min-h-0 bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-xl overflow-hidden">

                {/* Messages */}
                <ScrollArea className="flex-1 p-6">
                  <div className="space-y-5">
                    {messages.length === 0 && !isLoading && (
                      <div className="text-center py-16 animate-[fadeIn_0.4s_ease-out]">
                        <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center">
                          <Bot className="w-8 h-8 text-purple-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">
                          {t('ready_to_assist') || 'Yordam berishga tayyorman'}
                        </h3>
                        <p className="text-sm text-slate-500 max-w-md mx-auto">
                          {t('ai_empty_state_description') || "Ma'lumotlaringizni tahlil qilib, tushunchalar beraman"}
                        </p>
                      </div>
                    )}

                    {messages.map((message, index) => (
                      <div
                        key={message.id || index}
                        className={`flex items-start gap-3 animate-[fadeInUp_0.3s_ease-out] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                      >
                        {/* Avatar */}
                        {message.role === 'assistant' ? (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md">
                            <Bot className="w-4 h-4 text-white" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center flex-shrink-0 shadow-md">
                            <span className="text-xs font-semibold text-white">{getUserInitials()}</span>
                          </div>
                        )}

                        {/* Bubble + meta */}
                        <div className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} max-w-[80%]`}>
                          <div
                            className={`rounded-2xl px-4 py-3 ${
                              message.role === 'user'
                                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-tr-sm'
                                : 'bg-slate-100 text-slate-900 rounded-tl-sm'
                            }`}
                          >
                            {message.role === 'assistant' ? (
                              <div>
                                <div className="text-sm prose prose-sm max-w-none
                                  [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
                                  prose-p:my-2 prose-p:leading-relaxed
                                  prose-headings:mt-4 prose-headings:mb-2 prose-headings:font-semibold
                                  prose-strong:text-slate-900 prose-strong:font-semibold
                                  prose-ul:my-2 prose-ul:pl-5 prose-ul:list-disc prose-ul:marker:text-slate-400
                                  prose-ol:my-2 prose-ol:pl-5 prose-ol:list-decimal prose-ol:marker:text-slate-500 prose-ol:marker:font-medium
                                  prose-li:my-0.5 prose-li:leading-relaxed
                                  prose-table:border-collapse prose-th:border prose-th:border-slate-300 prose-th:p-2 prose-th:bg-slate-50 prose-td:border prose-td:border-slate-300 prose-td:p-2">
                                  <ReactMarkdown>{message.content}</ReactMarkdown>
                                </div>

                                {message.tool_calls && message.tool_calls.length > 0 && (
                                  <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                                    {message.tool_calls.map((toolCall, idx) => (
                                      <div key={idx} className="flex items-center gap-2 text-xs">
                                        <Zap className="w-3 h-3 text-purple-600" />
                                        <span className="font-medium text-slate-700">
                                          {getToolLabel(toolCall.name, language)}
                                        </span>
                                        {toolCall.status === 'completed' && (
                                          <Badge className="bg-green-100 text-green-700 text-xs">
                                            ✓ {language === 'uz' ? 'Bajarildi' : language === 'ru' ? 'Готово' : 'Completed'}
                                          </Badge>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            )}
                          </div>

                          {/* Timestamp + Copy */}
                          <div className={`flex items-center gap-2 mt-1.5 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            <span className="text-[10px] text-slate-400">
                              {formatMessageTime(message.created_at)}
                            </span>
                            {message.role === 'assistant' && (
                              <TooltipProvider delayDuration={300}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => handleCopyMessage(message.id, message.content)}
                                      className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded"
                                    >
                                      {copiedMessageId === message.id ? (
                                        <Check className="w-3.5 h-3.5 text-green-500" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{copiedMessageId === message.id ? (t('copied') || 'Nusxalandi') : (t('copy') || 'Nusxalash')}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {message.role === 'assistant' && ttsSupported && (
                              <TooltipProvider delayDuration={300}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => toggleSpeak(message.content, message.id)}
                                      className={`transition-colors p-0.5 rounded ${speakingId === message.id ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                      {speakingId === message.id ? <Square className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{speakingId === message.id ? (t('stop') || 'To‘xtatish') : (t('read_aloud') || 'Ovoz bilan o‘qish')}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Typing Indicator */}
                    {isLoading && (
                      <div className="flex items-start gap-3 animate-[fadeInUp_0.3s_ease-out]">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md">
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-slate-400 animate-[typingDot_1.4s_ease-in-out_infinite]"></span>
                            <span className="w-2 h-2 rounded-full bg-slate-400 animate-[typingDot_1.4s_ease-in-out_0.2s_infinite]"></span>
                            <span className="w-2 h-2 rounded-full bg-slate-400 animate-[typingDot_1.4s_ease-in-out_0.4s_infinite]"></span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Input Area */}
                <div className="border-t border-slate-200/60 p-4 flex-shrink-0">
                  <div className="relative">
                    {isListening && (
                      <div className="absolute inset-0 z-10 bg-white rounded-xl border border-slate-200 flex items-center px-2">
                        {renderRecordingBar()}
                      </div>
                    )}
                    <Textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={t('ask_anything') || "Savolingizni yozing..."}
                      className="min-h-[48px] max-h-[160px] resize-none pr-32 rounded-xl border-slate-200 focus:border-blue-400 focus:ring-blue-400/20"
                      disabled={isLoading}
                      rows={1}
                      onInput={(e) => {
                        e.target.style.height = 'auto';
                        e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
                      }}
                    />
                    {ttsSupported && (
                      <Button type="button" size="icon" variant="ghost" onClick={() => setTtsEnabled(v => !v)}
                        title={t('read_aloud') || 'Javoblarni ovoz bilan o\'qish'}
                        className={`absolute right-[5.5rem] bottom-2 h-9 w-9 rounded-lg ${ttsEnabled ? 'text-blue-600' : 'text-slate-400'}`}>
                        {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                      </Button>
                    )}
                    {sttSupported && (
                      <Button type="button" size="icon" variant="ghost" onClick={startListening} disabled={isTranscribing}
                        title={t('voice_input') || 'Ovozli kiritish'}
                        className="absolute right-12 bottom-2 h-9 w-9 rounded-lg text-slate-500 hover:text-blue-600">
                        {isTranscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                      </Button>
                    )}
                    <Button
                      onClick={() => handleSendMessage()}
                      disabled={!input.trim() || isLoading}
                      size="icon"
                      className="absolute right-2 bottom-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 h-9 w-9 rounded-lg shadow-md disabled:opacity-40"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  {voiceMsg && (
                    <div className={`mt-2 px-1 text-xs flex items-center gap-1.5 ${voiceMsg.type === 'error' ? 'text-red-600' : 'text-slate-500'}`}>
                      {voiceMsg.text}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes typingDot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
