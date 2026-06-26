import React, { useState, useRef, useEffect } from "react";
import { useAI } from "@/components/contexts/AIContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, X, Minimize2, Maximize2, Sparkles, Loader2, Mic, Trash2, PlusCircle } from "lucide-react";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { aiService } from "@/api/services/ai";
import ReactMarkdown from 'react-markdown';

export default function AIChatBox({ isOpen, onClose, initialPrompt = null }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    messages,
    isLoading,
    sendMessage,
    createConversation,
    activeConversation,
    clearConversation,
  } = useAI();

  const [input, setInput] = useState("");
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef(null);
  const initialPromptSentRef = useRef(null);

  // ===== Draggable window (grab the header to move) =====
  const dragRef = useRef(null);
  const dragInfo = useRef(null);
  const [pos, setPos] = useState(null); // {x,y} top-left in px; null = default corner
  const onDragStart = (e) => {
    if (e.target.closest('button')) return; // let header buttons work
    const rect = dragRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragInfo.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    setPos({ x: rect.left, y: rect.top });
    e.preventDefault();
  };
  useEffect(() => {
    const onMove = (e) => {
      if (!dragInfo.current) return;
      const w = dragRef.current?.offsetWidth || 384;
      const h = dragRef.current?.offsetHeight || 600;
      let x = e.clientX - dragInfo.current.dx;
      let y = e.clientY - dragInfo.current.dy;
      x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
      y = Math.max(8, Math.min(y, window.innerHeight - h - 8));
      setPos({ x, y });
    };
    const onUp = () => { dragInfo.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // ===== Voice: Telegram-style record → transcribe (Gemini) → send =====
  const langHint = language === 'uz' ? 'uz' : language === 'ru' ? 'ru' : 'en';
  const recordingSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
    && typeof window !== 'undefined' && !!window.MediaRecorder;
  const mediaRecorderRef = useRef(null);
  const mediaChunksRef = useRef([]);
  const mediaStreamRef = useRef(null);
  const cancelRecRef = useRef(false);
  const recordTimerRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [voiceMsg, setVoiceMsg] = useState(null);
  const voiceMsgTimer = useRef(null);
  const showVoiceMsg = (text, type = 'info', autoHideMs = 0) => {
    if (voiceMsgTimer.current) clearTimeout(voiceMsgTimer.current);
    setVoiceMsg(text ? { text, type } : null);
    if (text && autoHideMs) voiceMsgTimer.current = setTimeout(() => setVoiceMsg(null), autoHideMs);
  };
  const VT = {
    transcribing: language === 'ru' ? 'Распознавание речи…' : language === 'en' ? 'Transcribing…' : 'Nutq matnga o‘girilmoqda…',
    permission: language === 'ru' ? 'Нет доступа к микрофону.' : language === 'en' ? 'Microphone access denied.' : 'Mikrofonga ruxsat berilmadi.',
    noAudio: language === 'ru' ? 'Звук не записан.' : language === 'en' ? 'No audio captured.' : 'Ovoz yozilmadi.',
    fail: language === 'ru' ? 'Распознавание недоступно.' : language === 'en' ? 'Transcription unavailable.' : 'Transkripsiya ishlamadi.',
    slideHint: language === 'ru' ? 'Запись…' : language === 'en' ? 'Recording…' : 'Yozilmoqda…',
  };
  const stopMicTracks = () => {
    try { mediaStreamRef.current?.getTracks().forEach(tr => tr.stop()); } catch { /* ignore */ }
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
        if (cancelRecRef.current) { showVoiceMsg(null); return; }
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
          showVoiceMsg(VT.fail, 'error', 9000);
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
  const sendRecording = () => {
    cancelRecRef.current = false;
    try { if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop(); } catch { /* ignore */ }
  };
  const cancelRecording = () => {
    cancelRecRef.current = true;
    try { if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    setIsListening(false);
    clearRecordTimer();
    setRecordSeconds(0);
    showVoiceMsg(null);
  };
  useEffect(() => () => {
    try {
      cancelRecRef.current = true;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
      mediaStreamRef.current?.getTracks().forEach(tr => tr.stop());
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    } catch { /* ignore */ }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize a conversation only when there's no active one AND no restored
  // history — otherwise we'd wipe the persisted chat the user expects to see.
  useEffect(() => {
    if (isOpen && !activeConversation && messages.length === 0) {
      createConversation({
        name: "AI Chatbox Session",
        description: "Quick AI assistance"
      });
    }
  }, [isOpen, activeConversation, messages.length]);

  // Send initial prompt if provided (only once per prompt)
  useEffect(() => {
    if (isOpen && initialPrompt && activeConversation && initialPrompt !== initialPromptSentRef.current) {
      initialPromptSentRef.current = initialPrompt;
      handleSendMessage(initialPrompt);
    }
  }, [isOpen, initialPrompt, activeConversation]);

  // Reset the sent prompt ref when chatbox closes
  useEffect(() => {
    if (!isOpen) {
      initialPromptSentRef.current = null;
    }
  }, [isOpen]);

  const handleSendMessage = async (messageText = input) => {
    if (!messageText.trim() || isLoading) return;

    setInput("");
    await sendMessage(messageText);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={dragRef}
      className={`fixed z-[9999] flex flex-col ${pos ? '' : 'bottom-4 right-4'}`}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
    >
      {/* Chat Window */}
      <div
        className={`bg-white rounded-2xl shadow-2xl border border-slate-200 transition-all duration-300 ${
          isMinimized ? 'h-16 w-80' : 'h-[600px] w-96'
        }`}
      >
        {/* Header (drag handle) */}
        <div
          onMouseDown={onDragStart}
          className="flex items-center justify-between p-4 border-b border-slate-200 bg-gradient-to-r from-blue-500 to-purple-500 rounded-t-2xl cursor-move select-none"
        >
          <div className="flex items-center gap-2 text-white">
            <Bot className="w-5 h-5" />
            <span className="font-semibold">{t('ai_assistant')}</span>
            <Badge className="bg-white/20 text-white border-white/30 text-xs">
              <Sparkles className="w-3 h-3 mr-1" />
              {t('live')}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => clearConversation && clearConversation()}
              title={t('new_chat') || 'New chat'}
              className="text-white hover:bg-white/20 h-8 w-8 p-0"
            >
              <PlusCircle className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsMinimized(!isMinimized)}
              className="text-white hover:bg-white/20 h-8 w-8 p-0"
            >
              {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="text-white hover:bg-white/20 h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Messages Area */}
        {!isMinimized && (
          <>
            <ScrollArea className="h-[calc(100%-8rem)] p-4">
              <div className="space-y-4">
                {messages.length === 0 && (
                  <div className="text-center py-8">
                    <Bot className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500 text-sm">{t('ask_ai_assistant')}</p>
                  </div>
                )}

                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                          : 'bg-slate-100 text-slate-900'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm max-w-none">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-100 rounded-2xl px-4 py-3">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 border-t border-slate-200">
              {isListening ? (
                <div className="flex items-center gap-2 w-full bg-white rounded-xl border border-slate-200 px-2 py-1.5">
                  <button type="button" onClick={cancelRecording}
                    title={language === 'ru' ? 'Отменить' : language === 'en' ? 'Cancel' : 'Bekor qilish'}
                    className="flex items-center justify-center h-9 w-9 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <span className="relative flex h-3 w-3 flex-shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                  <span className="font-mono text-sm text-slate-700 tabular-nums">{fmtRecTime(recordSeconds)}</span>
                  <span className="flex-1 text-xs text-slate-400 truncate">{VT.slideHint}</span>
                  <Button onClick={sendRecording} size="icon"
                    className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 h-9 w-9 rounded-full flex-shrink-0">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={t('ask_anything') || "Ask me anything..."}
                    disabled={isLoading}
                    className="flex-1"
                  />
                  {recordingSupported && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={startListening}
                      disabled={isTranscribing}
                      title={t('voice_input') || 'Ovozli kiritish'}
                      className="text-slate-500 hover:text-blue-600 flex-shrink-0"
                    >
                      {isTranscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                    </Button>
                  )}
                  <Button
                    onClick={() => handleSendMessage()}
                    disabled={isLoading || !input.trim()}
                    className="bg-gradient-to-r from-blue-500 to-purple-500"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              )}
              {voiceMsg && (
                <div className={`mt-2 px-1 text-xs flex items-center gap-1.5 ${voiceMsg.type === 'error' ? 'text-red-600' : 'text-slate-500'}`}>
                  {voiceMsg.text}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
