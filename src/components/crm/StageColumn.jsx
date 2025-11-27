import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Target, Plus } from "lucide-react";
import KanbanCard from "./KanbanCard";

export default function StageColumn({ 
  column, 
  stage, 
  onDragOver, 
  onDrop, 
  onDragStart,
  onCall,
  onEmail,
  onAddNote,
  onEdit
}) {
  const getProbabilityColor = (probability) => {
    if (probability >= 70) return 'text-green-600';
    if (probability >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div
      className="flex-shrink-0 w-80"
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, column.stage)}
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
          {column.cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              stage={stage}
              onDragStart={onDragStart}
              onCall={onCall}
              onEmail={onEmail}
              onAddNote={onAddNote}
              onEdit={onEdit}
            />
          ))}

          {column.cards.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No deals in this stage</p>
              <p className="text-xs">Drag deals here or use AI suggestions</p>
            </div>
          )}

          {/* Add Deal Button */}
          <Button 
            variant="ghost" 
            className="w-full h-8 text-xs text-slate-500 hover:text-slate-700 border-dashed border"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Deal
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}