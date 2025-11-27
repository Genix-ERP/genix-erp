import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { InvokeLLM } from "@/api/integrations";
import { 
  DollarSign,
  Calendar,
  User,
  Phone,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Settings,
  TrendingUp,
  AlertTriangle,
  Clock,
  Target,
  Brain,
  Zap,
  CheckCircle,
  XCircle
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const defaultStages = [
  { id: 'new_lead', name: 'New Lead', color: 'bg-slate-500', lightColor: 'bg-slate-100' },
  { id: 'qualified', name: 'Qualified', color: 'bg-blue-500', lightColor: 'bg-blue-100' },
  { id: 'proposal', name: 'Proposal', color: 'bg-yellow-500', lightColor: 'bg-yellow-100' },
  { id: 'negotiation', name: 'Negotiation', color: 'bg-orange-500', lightColor: 'bg-orange-100' },
  { id: 'closed_won', name: 'Won', color: 'bg-green-500', lightColor: 'bg-green-100' },
  { id: 'closed_lost', name: 'Lost', color: 'bg-red-500', lightColor: 'bg-red-100' }
];

export default function AIKanbanBoard({ opportunities, onUpdate, callLogs, communications }) {
  const [stages, setStages] = useState(defaultStages);
  const [boardData, setBoardData] = useState({ columns: [] });
  const [draggedItem, setDraggedItem] = useState(null);
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [showStageConfig, setShowStageConfig] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);

  const generateBoardData = useCallback(() => {
    const columns = stages.map(stage => {
      const cards = opportunities
        .filter(opp => opp.stage === stage.id)
        .map(opp => ({
          id: opp.id,
          customer: opp.name,
          amount: opp.expected_value || 0,
          probability: opp.probability || 0,
          lastActivity: opp.last_activity_date,
          nextAction: opp.next_step,
          assignedTo: opp.assigned_to,
          expectedClose: opp.expected_close_date,
          riskFactors: opp.risk_factors || [],
          aiInsights: opp.ai_insights,
          stagnationDays: calculateStagnationDays(opp.last_activity_date)
        }))
        .sort((a, b) => b.probability - a.probability); // AI smart sorting by probability

      return {
        stage: stage.id,
        stageName: stage.name,
        cards,
        totalValue: cards.reduce((sum, card) => sum + card.amount, 0),
        avgProbability: cards.length > 0 ? cards.reduce((sum, card) => sum + card.probability, 0) / cards.length : 0
      };
    });

    setBoardData({ columns });
  }, [opportunities, stages]);

  const calculateStagnationDays = (lastActivity) => {
    if (!lastActivity) return 0;
    const daysDiff = Math.floor((new Date() - new Date(lastActivity)) / (1000 * 60 * 60 * 24));
    return daysDiff;
  };

  const generateAISuggestions = useCallback(async () => {
    try {
      const stagnantDeals = opportunities.filter(opp => {
        const daysSinceActivity = calculateStagnationDays(opp.last_activity_date);
        return daysSinceActivity > 7; // Stagnant if no activity for 7+ days
      });

      const highProbDeals = opportunities.filter(opp => 
        opp.probability > 70 && !['closed_won', 'closed_lost'].includes(opp.stage)
      );

      const suggestions = await InvokeLLM({
        prompt: `You are the Kanban AI of Genix CRM. Analyze this pipeline and provide intelligent stage movement suggestions:

        Current Pipeline:
        ${JSON.stringify(boardData.columns.map(col => ({
          stage: col.stageName,
          deals: col.cards.length,
          totalValue: col.totalValue,
          avgProbability: col.avgProbability
        })))}

        Stagnant Deals (no activity 7+ days): ${stagnantDeals.length}
        High Probability Deals (>70%): ${highProbDeals.length}

        Recent Activity Context:
        - Recent calls: ${callLogs.slice(0, 5).map(c => ({ outcome: c.call_outcome, sentiment: c.sentiment_score }))}
        - Recent communications: ${communications.slice(0, 5).map(c => ({ type: c.communication_type, sentiment: c.ai_sentiment }))}

        Provide 3-5 specific, actionable suggestions for stage movements or actions.`,
        response_json_schema: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["move_stage", "action_required", "risk_alert"] },
                  dealName: { type: "string" },
                  currentStage: { type: "string" },
                  suggestedStage: { type: "string" },
                  reason: { type: "string" },
                  confidence: { type: "number" },
                  urgency: { type: "string", enum: ["high", "medium", "low"] },
                  recommendedAction: { type: "string" }
                }
              }
            }
          }
        }
      });

      setAiSuggestions(suggestions.suggestions || []);
    } catch (error) {
      console.error("Error generating AI suggestions:", error);
    }
  }, [boardData, opportunities, callLogs, communications]);

  const handleAIQuery = async () => {
    if (!aiQuery.trim() || isProcessingAI) return;
    
    setIsProcessingAI(true);
    try {
      const response = await InvokeLLM({
        prompt: `You are the Kanban AI assistant. The user asked: "${aiQuery}"
        
        Current Board State:
        ${JSON.stringify(boardData, null, 2)}
        
        Available Actions:
        - Move deals between stages
        - Add/remove/rename stages
        - Sort deals within stages
        - Generate insights about pipeline health
        - Suggest next actions for specific deals
        
        Respond with actionable advice or execute the requested board operation.`,
        add_context_from_internet: false
      });
      
      setAiResponse(response);
    } catch (error) {
      console.error("Error processing AI query:", error);
      setAiResponse("Sorry, I encountered an error. Please try again.");
    }
    setIsProcessingAI(false);
  };

  const handleDragStart = (e, card) => {
    setDraggedItem(card);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetStage) => {
    e.preventDefault();
    if (draggedItem && draggedItem.stage !== targetStage) {
      
      // AI confirmation for significant moves
      if (shouldConfirmMove(draggedItem.stage, targetStage)) {
        const confirmation = await askAIConfirmation(draggedItem, targetStage);
        if (!confirmation) return;
      }

      // In a real implementation, update the opportunity stage
      console.log(`Moving ${draggedItem.customer} from ${draggedItem.stage} to ${targetStage}`);
      
      // Log the stage change
      await logStageChange(draggedItem, targetStage);
      
      onUpdate && onUpdate();
    }
    setDraggedItem(null);
  };

  const shouldConfirmMove = (fromStage, toStage) => {
    // Confirm moves that might be accidental or significant
    const significantMoves = [
      'negotiation_to_lost', 'proposal_to_lost', 'qualified_to_won'
    ];
    return significantMoves.some(move => move.includes(fromStage) && move.includes(toStage));
  };

  const askAIConfirmation = async (deal, targetStage) => {
    // In a real implementation, show a confirmation dialog
    return window.confirm(`Move ${deal.customer} to ${targetStage}? AI confidence: Medium`);
  };

  const logStageChange = async (deal, newStage) => {
    // Log stage change for AI learning
    console.log(`Stage change logged: ${deal.customer} moved to ${newStage}`);
  };

  const addCustomStage = async (stageName, position) => {
    const newStage = {
      id: stageName.toLowerCase().replace(/\s+/g, '_'),
      name: stageName,
      color: 'bg-purple-500',
      lightColor: 'bg-purple-100'
    };
    
    const newStages = [...stages];
    newStages.splice(position, 0, newStage);
    setStages(newStages);
  };

  const getProbabilityColor = (probability) => {
    if (probability >= 80) return 'text-green-600';
    if (probability >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getUrgencyBadge = (urgency) => {
    const colors = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-blue-100 text-blue-800'
    };
    return colors[urgency] || colors.medium;
  };

  const getStagnationAlert = (days) => {
    if (days > 14) return { level: 'high', icon: AlertTriangle, color: 'text-red-600' };
    if (days > 7) return { level: 'medium', icon: Clock, color: 'text-yellow-600' };
    return null;
  };

  useEffect(() => {
    generateBoardData();
  }, [generateBoardData]);

  useEffect(() => {
    if (boardData.columns.length > 0) {
      generateAISuggestions();
    }
  }, [generateAISuggestions, boardData]);

  return (
    <div className="space-y-6">
      {/* AI Control Panel */}
      <Card className="bg-gradient-to-r from-[var(--genix-blue)]/5 to-[var(--genix-purple)]/5 border-[var(--genix-blue)]/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-[var(--genix-purple)]" />
            Kanban AI Assistant
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Ask me anything: 'Move ACME to negotiation' or 'Show stagnant deals'"
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAIQuery()}
              className="flex-1"
            />
            <Button onClick={handleAIQuery} disabled={isProcessingAI}>
              {isProcessingAI ? "Processing..." : "Ask AI"}
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Settings className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Configure Kanban Stages</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">
                    Current stages: {stages.map(s => s.name).join(' → ')}
                  </p>
                  <Input placeholder="Add new stage (e.g., 'Demo Scheduled')" />
                  <Button className="w-full">Add Stage</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          
          {aiResponse && (
            <div className="p-4 bg-white rounded-lg border">
              <div className="flex items-start gap-3">
                <Brain className="w-5 h-5 text-[var(--genix-purple)] mt-0.5" />
                <div className="flex-1">
                  <p className="whitespace-pre-wrap">{aiResponse}</p>
                </div>
              </div>
            </div>
          )}

          {/* AI Suggestions */}
          {aiSuggestions.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-[var(--genix-purple)]" />
                AI Recommendations
              </h4>
              {aiSuggestions.slice(0, 3).map((suggestion, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{suggestion.dealName}</p>
                    <p className="text-xs text-slate-600">{suggestion.reason}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getUrgencyBadge(suggestion.urgency)}>
                      {suggestion.urgency}
                    </Badge>
                    <Button size="sm" variant="outline">
                      {suggestion.type === 'move_stage' ? 'Move' : 'Action'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kanban Board */}
      <div className="overflow-x-auto">
        <div className="flex gap-6 pb-4 min-w-max">
          {boardData.columns.map((column) => {
            const stage = stages.find(s => s.id === column.stage);
            if (!stage) return null;

            return (
              <div
                key={column.stage}
                className="flex-shrink-0 w-80"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, column.stage)}
              >
                <Card className="h-full bg-white/90 backdrop-blur-sm border-slate-200/60 shadow-lg">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${stage.color}`}></div>
                      <CardTitle className="text-sm font-medium">{stage.name}</CardTitle>
                      <Badge variant="outline" className="ml-auto">
                        {column.cards.length}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm text-slate-600">
                        ${column.totalValue.toLocaleString()}
                      </div>
                      {column.avgProbability > 0 && (
                        <div className="flex items-center gap-2 text-xs">
                          <span>Avg. Probability:</span>
                          <span className={getProbabilityColor(column.avgProbability)}>
                            {Math.round(column.avgProbability)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
                    {column.cards.map((card) => {
                      const stagnationAlert = getStagnationAlert(card.stagnationDays);
                      
                      return (
                        <Card
                          key={card.id}
                          className={`cursor-move hover:shadow-md transition-all ${stage.lightColor} border-l-4 ${stage.color.replace('bg-', 'border-l-')} ${
                            stagnationAlert?.level === 'high' ? 'ring-2 ring-red-200' : ''
                          }`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, { ...card, stage: column.stage })}
                        >
                          <CardContent className="p-4 space-y-3">
                            {/* Header */}
                            <div className="flex items-start justify-between">
                              <h4 className="font-semibold text-sm leading-tight">{card.customer}</h4>
                              <div className="flex items-center gap-1">
                                {stagnationAlert && (
                                  <stagnationAlert.icon className={`w-3 h-3 ${stagnationAlert.color}`} />
                                )}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                      <MoreHorizontal className="w-3 h-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent>
                                    <DropdownMenuItem>Edit Deal</DropdownMenuItem>
                                    <DropdownMenuItem>Add Note</DropdownMenuItem>
                                    <DropdownMenuItem>Schedule Call</DropdownMenuItem>
                                    <DropdownMenuItem>View History</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>

                            {/* Amount */}
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-green-600" />
                              <span className="font-medium text-green-600">
                                ${card.amount.toLocaleString()}
                              </span>
                            </div>

                            {/* Probability */}
                            {card.probability > 0 && (
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span>Win Probability</span>
                                  <span className={getProbabilityColor(card.probability)}>
                                    {card.probability}%
                                  </span>
                                </div>
                                <Progress value={card.probability} className="h-1" />
                              </div>
                            )}

                            {/* Timeline Info */}
                            <div className="space-y-1 text-xs text-slate-600">
                              {card.expectedClose && (
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-3 h-3" />
                                  <span>Close: {new Date(card.expectedClose).toLocaleDateString()}</span>
                                </div>
                              )}
                              {card.stagnationDays > 0 && (
                                <div className="flex items-center gap-2">
                                  <Clock className="w-3 h-3" />
                                  <span>Stagnant: {card.stagnationDays} days</span>
                                </div>
                              )}
                            </div>

                            {/* Assigned Rep */}
                            {card.assignedTo && (
                              <div className="flex items-center gap-2 text-xs text-slate-600">
                                <User className="w-3 h-3" />
                                <span>{card.assignedTo}</span>
                              </div>
                            )}

                            {/* Next Action */}
                            {card.nextAction && (
                              <div className="p-2 bg-[var(--genix-light-blue)]/30 rounded text-xs">
                                <span className="font-medium">Next: </span>
                                <span>{card.nextAction}</span>
                              </div>
                            )}

                            {/* Risk Factors */}
                            {card.riskFactors.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {card.riskFactors.slice(0, 2).map((risk, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs bg-red-50 text-red-700">
                                    {risk}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-1 pt-2">
                              <Button size="sm" variant="outline" className="h-6 text-xs flex-1">
                                <Phone className="w-3 h-3 mr-1" />
                                Call
                              </Button>
                              <Button size="sm" variant="outline" className="h-6 text-xs flex-1">
                                <Mail className="w-3 h-3 mr-1" />
                                Email
                              </Button>
                              <Button size="sm" variant="outline" className="h-6 text-xs flex-1">
                                <MessageSquare className="w-3 h-3 mr-1" />
                                Note
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}

                    {column.cards.length === 0 && (
                      <div className="text-center py-8 text-slate-400">
                        <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No deals in this stage</p>
                        <p className="text-xs">Drag deals here or use AI suggestions</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>

      {/* Board Analytics */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Pipeline Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {boardData.columns.reduce((sum, col) => sum + col.totalValue, 0).toLocaleString()}
              </div>
              <div className="text-sm text-slate-600">Total Pipeline Value</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {boardData.columns.reduce((sum, col) => sum + col.cards.length, 0)}
              </div>
              <div className="text-sm text-slate-600">Total Opportunities</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {Math.round(boardData.columns.reduce((sum, col) => sum + col.avgProbability * col.cards.length, 0) / 
                boardData.columns.reduce((sum, col) => sum + col.cards.length, 0) || 0)}%
              </div>
              <div className="text-sm text-slate-600">Avg Win Rate</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {boardData.columns.reduce((count, col) => 
                  count + col.cards.filter(card => card.stagnationDays > 7).length, 0
                )}
              </div>
              <div className="text-sm text-slate-600">Stagnant Deals</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}