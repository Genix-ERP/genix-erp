import React, { useState, useRef, useEffect } from "react";
import { useAI } from "@/components/contexts/AIContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, X, Minimize2, Maximize2, Sparkles, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
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
  } = useAI();

  const [input, setInput] = useState("");
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize conversation
  useEffect(() => {
    if (isOpen && !activeConversation) {
      createConversation({
        name: "AI Chatbox Session",
        description: "Quick AI assistance"
      });
    }
  }, [isOpen]);

  // Send initial prompt if provided
  useEffect(() => {
    if (isOpen && initialPrompt && !isLoading) {
      handleSendMessage(initialPrompt);
    }
  }, [isOpen, initialPrompt]);

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
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col">
      {/* Chat Window */}
      <div
        className={`bg-white rounded-2xl shadow-2xl border border-slate-200 transition-all duration-300 ${
          isMinimized ? 'h-16 w-80' : 'h-[600px] w-96'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-gradient-to-r from-blue-500 to-purple-500 rounded-t-2xl">
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
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={t('ask_anything') || "Ask me anything..."}
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button
                  onClick={() => handleSendMessage()}
                  disabled={isLoading || !input.trim()}
                  className="bg-gradient-to-r from-blue-500 to-purple-500"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
