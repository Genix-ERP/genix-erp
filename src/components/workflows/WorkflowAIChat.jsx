import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, Loader2, Sparkles, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ReactMarkdown from 'react-markdown';

export default function WorkflowAIChat({ onWorkflowUpdate }) {
  const [isOpen, setIsOpen] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && !conversation) {
      initializeConversation();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!conversation) return;

    console.log('🔌 Subscribing to conversation:', conversation.id);
    
    const unsubscribe = base44.agents.subscribeToConversation(
      conversation.id,
      (data) => {
        console.log('📨 Received update:', data);
        setMessages(data.messages || []);
        setIsLoading(false);
      }
    );

    return () => {
      console.log('🔌 Unsubscribing from conversation');
      unsubscribe();
    };
  }, [conversation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const initializeConversation = async () => {
    try {
      console.log('🚀 Initializing workflow manager conversation...');
      const conv = await base44.agents.createConversation({
        agent_name: "workflow_manager",
        metadata: {
          name: "Workflow Automation Chat",
          description: "AI-powered workflow management conversation"
        }
      });
      console.log('✅ Conversation created:', conv);
      setConversation(conv);
      setMessages(conv.messages || []);
    } catch (error) {
      console.error("❌ Error initializing conversation:", error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !conversation || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    try {
      console.log('📤 Sending message:', userMessage);
      await base44.agents.addMessage(conversation, {
        role: "user",
        content: userMessage
      });
    } catch (error) {
      console.error("❌ Error sending message:", error);
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
      <Card className="shadow-2xl border-slate-200/60">
        <CardHeader className="border-b border-slate-200/60 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Workflow AI Assistant</CardTitle>
                <p className="text-xs text-white/80">Powered by OpenAI</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-white/20"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ScrollArea className="h-96 p-4">
            <div className="space-y-4">
              {messages.length === 0 && !isLoading && (
                <div className="text-center py-8">
                  <Sparkles className="w-12 h-12 mx-auto mb-4 text-[var(--genix-purple)]" />
                  <p className="text-sm text-slate-600 mb-2">
                    Hi! I'm your Workflow AI Assistant
                  </p>
                  <p className="text-xs text-slate-500">
                    I can help you create, optimize, and manage workflows
                  </p>
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white'
                        : 'bg-slate-100 text-slate-900'
                    }`}
                  >
                    {message.role === 'assistant' ? (
                      <ReactMarkdown className="text-sm prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        {message.content}
                      </ReactMarkdown>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    )}
                    
                    {message.tool_calls && message.tool_calls.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {message.tool_calls.map((toolCall, idx) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="text-xs bg-white/20"
                          >
                            <Sparkles className="w-3 h-3 mr-1" />
                            {toolCall.name?.split('.').pop() || 'Action'}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 rounded-2xl px-4 py-3">
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--genix-blue)]" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="border-t border-slate-200/60 p-4">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me to create a workflow, optimize processes..."
                className="resize-none min-h-[60px]"
                disabled={isLoading || !conversation}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading || !conversation}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}