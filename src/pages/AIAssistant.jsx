import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, Sparkles, Loader2, Search, Zap, TrendingUp, Users, Package, DollarSign, ArrowRight } from "lucide-react";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { toast } from "sonner";
import ReactMarkdown from 'react-markdown';

export default function AIAssistant() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const suggestedQueries = [
    { icon: TrendingUp, text: t('show_top_customers'), color: 'text-green-600' },
    { icon: Package, text: t('inventory_restocking'), color: 'text-orange-600' },
    { icon: DollarSign, text: t('revenue_trend_query'), color: 'text-blue-600' },
    { icon: Sparkles, text: t('cashflow_suggestions'), color: 'text-purple-600' },
  ];

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    initializeConversation();
  }, []);

  useEffect(() => {
    if (!conversation) return;

    const unsubscribe = base44.agents.subscribeToConversation(
      conversation.id,
      (data) => {
        setMessages(data.messages || []);
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [conversation]);

  const initializeConversation = async () => {
    try {
      const conv = await base44.agents.createConversation({
        agent_name: "business_copilot",
        metadata: {
          name: "Business AI Copilot Session",
          description: "Intelligent assistant for business operations"
        }
      });
      setConversation(conv);
      setMessages(conv.messages || []);
    } catch (error) {
      console.error("Error initializing conversation:", error);
      toast.error("Failed to initialize AI Assistant");
    }
  };

  const handleSendMessage = async (messageText = input) => {
    if (!messageText.trim() || !conversation || isLoading) return;

    setInput("");
    setIsLoading(true);
    setShowChat(true);

    try {
      await base44.agents.addMessage(conversation, {
        role: "user",
        content: messageText
      });
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-100/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-100/30 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-blue-50/20 to-purple-50/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10">
        {!showChat ? (
          /* Landing View */
          <div className="flex flex-col items-center justify-center min-h-screen p-6">
            <div className="w-full max-w-4xl mx-auto space-y-12 animate-fadeIn">
              
              {/* Logo Section */}
              <div className="text-center space-y-6">
                <div className="inline-flex items-center gap-3 mb-8">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-purple-400 rounded-2xl blur-xl opacity-40 animate-pulse"></div>
                    <div className="relative bg-gradient-to-br from-blue-500 to-purple-500 p-5 rounded-2xl shadow-2xl">
                      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="8" y="8" width="20" height="20" rx="4" fill="white" fillOpacity="0.9"/>
                        <rect x="36" y="8" width="20" height="20" rx="4" fill="white" fillOpacity="0.7"/>
                        <rect x="8" y="36" width="20" height="20" rx="4" fill="white" fillOpacity="0.7"/>
                        <rect x="36" y="36" width="20" height="20" rx="4" fill="white"/>
                      </svg>
                    </div>
                  </div>
                  <h1 className="text-6xl font-black tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent">
                    GENIX
                  </h1>
                </div>

                {/* AI-Powered ERP Divider */}
                <div className="flex items-center justify-center gap-6 mb-12">
                  <div className="h-px w-32 bg-gradient-to-r from-transparent via-slate-300 to-slate-300"></div>
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-xl"></div>
                    <h2 className="relative text-lg font-bold tracking-[0.3em] text-slate-400 uppercase">
                      AI-Powered ERP
                    </h2>
                  </div>
                  <div className="h-px w-32 bg-gradient-to-l from-transparent via-slate-300 to-slate-300"></div>
                </div>

                {/* Subtitle */}
                <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
                  {t('ai_copilot_intro')}
                </p>
              </div>

              {/* Search Box */}
              <div className="relative group">
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
                      onKeyPress={handleKeyPress}
                      placeholder={t('ask_anything')}
                      className="border-0 text-lg h-16 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-400"
                      disabled={isLoading || !conversation}
                    />
                    <Button
                      onClick={() => handleSendMessage()}
                      disabled={!input.trim() || isLoading || !conversation}
                      size="lg"
                      className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-8 h-14 text-base font-semibold mr-2"
                    >
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <span className="mr-2">{t('ask_ai')}</span>
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
                  {t('ai_insights')} • Try asking:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
                  {suggestedQueries.map((query, index) => (
                    <button
                      key={index}
                      onClick={() => handleSendMessage(query.text)}
                      disabled={isLoading || !conversation}
                      className="group relative bg-white/80 backdrop-blur-sm border border-slate-200/50 rounded-xl p-5 hover:shadow-xl hover:border-blue-300/50 transition-all duration-300 text-left disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-12 max-w-4xl mx-auto">
                {[
                  { icon: TrendingUp, label: t('revenue_analysis'), color: 'from-green-500 to-emerald-500' },
                  { icon: Users, label: t('customer_insights'), color: 'from-blue-500 to-cyan-500' },
                  { icon: Package, label: t('inventory_optimization'), color: 'from-orange-500 to-amber-500' },
                  { icon: DollarSign, label: t('financial_planning'), color: 'from-purple-500 to-pink-500' }
                ].map((feature, index) => (
                  <div key={index} className="group text-center space-y-3">
                    <div className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br ${feature.color} p-4 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300`}>
                      <feature.icon className="w-full h-full text-white" />
                    </div>
                    <p className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors">
                      {feature.label}
                    </p>
                  </div>
                ))}
              </div>

              {/* Badge */}
              <div className="flex justify-center">
                <Badge className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-blue-700 border border-blue-200/50 px-6 py-2 text-sm font-medium">
                  <Sparkles className="w-4 h-4 mr-2" />
                  {t('powered_by_ai')} • Auto-Execute • Multi-language
                </Badge>
              </div>
            </div>
          </div>
        ) : (
          /* Chat View */
          <div className="p-6 md:p-8 min-h-screen">
            <div className="max-w-5xl mx-auto space-y-6">
              
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowChat(false)}
                    className="rounded-xl"
                  >
                    ← Back
                  </Button>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="font-bold text-slate-900">{t('ai_copilot')}</h2>
                      <p className="text-xs text-slate-500">{t('powered_by_ai')}</p>
                    </div>
                  </div>
                </div>
                <Badge className="bg-green-100 text-green-700 border border-green-200">
                  <Zap className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              </div>

              {/* Chat Interface */}
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px] p-6">
                    <div className="space-y-4">
                      {messages.length === 0 && !isLoading && (
                        <div className="text-center py-12">
                          <Bot className="w-16 h-16 mx-auto mb-4 text-purple-500" />
                          <h3 className="text-lg font-semibold text-slate-700 mb-2">
                            Ready to assist
                          </h3>
                          <p className="text-sm text-slate-500 max-w-md mx-auto">
                            I can analyze your data and execute tasks automatically
                          </p>
                        </div>
                      )}

                      {messages.map((message, index) => (
                        <div
                          key={index}
                          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                              message.role === 'user'
                                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                                : 'bg-slate-100 text-slate-900'
                            }`}
                          >
                            {message.role === 'assistant' ? (
                              <div>
                                <ReactMarkdown className="text-sm prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                                  {message.content}
                                </ReactMarkdown>
                                
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
                                            ✓
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
                        </div>
                      ))}

                      {isLoading && (
                        <div className="flex justify-start">
                          <div className="bg-slate-100 rounded-2xl px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                              <span className="text-sm text-slate-600">{t('analyzing_data')}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>

                  <div className="border-t border-slate-200/60 p-4">
                    <div className="flex gap-2">
                      <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder={t('ask_anything')}
                        className="h-12"
                        disabled={isLoading || !conversation}
                      />
                      <Button
                        onClick={() => handleSendMessage()}
                        disabled={!input.trim() || isLoading || !conversation}
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-12 px-6"
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.8s ease-out;
        }
      `}</style>
    </div>
  );
}