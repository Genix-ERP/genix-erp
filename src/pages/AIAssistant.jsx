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
  Users, Package, DollarSign, ArrowRight, Copy, Check
} from "lucide-react";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { AIUsageIndicator } from "@/components/subscription/SubscriptionStatus";
import ReactMarkdown from 'react-markdown';

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

  useEffect(() => {
    if (!activeConversation) {
      createConversation({
        name: "Business AI Copilot Session",
        description: "Intelligent assistant for business operations"
      });
    }
  }, []);

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
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-white to-blue-50/30 relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-100/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-100/30 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-blue-50/20 to-purple-50/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col min-h-0">
        {!showChat ? (
          /* Landing View */
          <div className="flex flex-col items-center justify-center flex-1 p-6 animate-[fadeInUp_0.5s_ease-out]">
            <div className="w-full max-w-4xl mx-auto space-y-10">

              {/* Hero Title */}
              <div className="text-center space-y-4 animate-[fadeInUp_0.6s_ease-out]">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl shadow-xl shadow-blue-500/25 animate-[scaleIn_0.5s_ease-out_0.2s_both]">
                  <Bot className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {t('ai_assistant') || 'AI Yordamchi'}
                </h1>
                <p className="text-lg text-slate-500 max-w-xl mx-auto">
                  {t('ai_assistant_description') || "Biznesingiz haqida biror narsa so'rang..."}
                </p>
              </div>

              {/* Search Box */}
              <div className="relative group animate-[fadeInUp_0.5s_ease-out_0.3s_both]">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl blur-xl opacity-0 group-hover:opacity-20 transition-all duration-500"></div>
                <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200/50 p-2 transition-all duration-300 hover:shadow-3xl">
                  <div className="flex items-center gap-3">
                    <div className="pl-4 text-slate-400">
                      <Search className="w-6 h-6" />
                    </div>
                    <Input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={t('ask_anything') || "Biznesingiz haqida biror narsa so'rang..."}
                      className="border-0 text-lg h-16 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-400"
                      disabled={isLoading}
                    />
                    <Button
                      onClick={() => handleSendMessage()}
                      disabled={!input.trim() || isLoading}
                      size="lg"
                      className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-8 h-14 text-base font-semibold mr-2"
                    >
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <span className="mr-2">{t('ask_ai') || "AI'dan so'rang"}</span>
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Suggested Queries */}
              <div className="space-y-4">
                <p className="text-center text-sm font-medium text-slate-500 uppercase tracking-wider">
                  {t('ai_insights') || 'AI TAHLILLARI'} - Try asking:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
                  {suggestedQueries.map((query, index) => (
                    <button
                      key={index}
                      onClick={() => handleSendMessage(query.text)}
                      disabled={isLoading}
                      className="group relative bg-white/80 backdrop-blur-sm border border-slate-200/50 rounded-xl p-5 hover:shadow-xl hover:border-blue-300/50 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300 text-left disabled:opacity-50 disabled:cursor-not-allowed animate-[fadeInUp_0.4s_ease-out_both]"
                      style={{ animationDelay: `${0.4 + index * 0.1}s` }}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${
                          index === 0 ? 'from-green-100 to-green-200' :
                          index === 1 ? 'from-orange-100 to-orange-200' :
                          index === 2 ? 'from-blue-100 to-blue-200' :
                          'from-purple-100 to-purple-200'
                        } flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                          <query.icon className={`w-6 h-6 ${query.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
                            {query.text}
                          </p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-8 max-w-4xl mx-auto">
                {[
                  { icon: TrendingUp, label: t('revenue_analysis') || 'Daromad tahlili', color: 'from-green-500 to-emerald-500' },
                  { icon: Users, label: t('customer_insights') || 'Mijozlar tushunchalari', color: 'from-blue-500 to-cyan-500' },
                  { icon: Package, label: t('inventory_optimization') || 'Ombor optimallashtirish', color: 'from-orange-500 to-amber-500' },
                  { icon: DollarSign, label: t('financial_planning') || 'Moliyaviy rejalashtirish', color: 'from-purple-500 to-pink-500' }
                ].map((feature, index) => (
                  <div
                    key={index}
                    className="group text-center space-y-3 animate-[fadeInUp_0.4s_ease-out_both]"
                    style={{ animationDelay: `${0.5 + index * 0.1}s` }}
                  >
                    <div className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br ${feature.color} p-4 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300`}>
                      <feature.icon className="w-full h-full text-white" />
                    </div>
                    <p className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors">
                      {feature.label}
                    </p>
                  </div>
                ))}
              </div>

              {/* AI Usage Indicator */}
              <div className="flex justify-center">
                <div className="bg-white/80 backdrop-blur-sm rounded-xl px-4 py-2 border border-slate-200/50 shadow-sm">
                  <AIUsageIndicator />
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
                <div className="flex items-center gap-3">
                  <AIUsageIndicator />
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
                                <div className="text-sm prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-table:border-collapse prose-th:border prose-th:border-slate-300 prose-th:p-2 prose-th:bg-slate-50 prose-td:border prose-td:border-slate-300 prose-td:p-2">
                                  <ReactMarkdown>{message.content}</ReactMarkdown>
                                </div>

                                {message.tool_calls && message.tool_calls.length > 0 && (
                                  <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                                    {message.tool_calls.map((toolCall, idx) => (
                                      <div key={idx} className="flex items-center gap-2 text-xs">
                                        <Zap className="w-3 h-3 text-purple-600" />
                                        <span className="font-medium text-slate-700">
                                          {toolCall.name?.split('.').pop() || 'Action'}
                                        </span>
                                        {toolCall.status === 'completed' && (
                                          <Badge className="bg-green-100 text-green-700 text-xs">
                                            ✓ Completed
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
                    <Textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={t('ask_anything') || "Savolingizni yozing..."}
                      className="min-h-[48px] max-h-[160px] resize-none pr-14 rounded-xl border-slate-200 focus:border-blue-400 focus:ring-blue-400/20"
                      disabled={isLoading}
                      rows={1}
                      onInput={(e) => {
                        e.target.style.height = 'auto';
                        e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
                      }}
                    />
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
