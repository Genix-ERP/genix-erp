import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { 
  DollarSign,
  Calendar,
  User,
  Phone,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Clock,
  AlertTriangle,
  Target
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function KanbanCard({ 
  card, 
  stage, 
  onDragStart, 
  onCall, 
  onEmail, 
  onAddNote,
  onEdit 
}) {
  const { formatCurrency } = useCurrencyFormatter();
  const getProbabilityColor = (probability) => {
    if (probability >= 80) return 'text-green-600';
    if (probability >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStagnationAlert = (days) => {
    if (days > 14) return { level: 'high', icon: AlertTriangle, color: 'text-red-600' };
    if (days > 7) return { level: 'medium', icon: Clock, color: 'text-yellow-600' };
    return null;
  };

  const stagnationAlert = getStagnationAlert(card.stagnationDays);

  return (
    <Card
      className={`cursor-move hover:shadow-md transition-all ${stage.lightColor} border-l-4 ${stage.color.replace('bg-', 'border-l-')} ${
        stagnationAlert?.level === 'high' ? 'ring-2 ring-red-200' : ''
      }`}
      draggable
      onDragStart={(e) => onDragStart(e, { ...card, stage: stage.id })}
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
                <DropdownMenuItem onClick={() => onEdit(card)}>Edit Deal</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAddNote(card)}>Add Note</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCall(card)}>Schedule Call</DropdownMenuItem>
                <DropdownMenuItem>View History</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Amount */}
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-green-600" />
          <span className="font-medium text-green-600">
            {formatCurrency(card.amount)}
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
        {card.riskFactors && card.riskFactors.length > 0 && (
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
          <Button 
            size="sm" 
            variant="outline" 
            className="h-6 text-xs flex-1"
            onClick={() => onCall(card)}
          >
            <Phone className="w-3 h-3 mr-1" />
            Call
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="h-6 text-xs flex-1"
            onClick={() => onEmail(card)}
          >
            <Mail className="w-3 h-3 mr-1" />
            Email
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="h-6 text-xs flex-1"
            onClick={() => onAddNote(card)}
          >
            <MessageSquare className="w-3 h-3 mr-1" />
            Note
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}