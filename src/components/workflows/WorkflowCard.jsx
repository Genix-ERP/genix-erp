import React from 'react';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Play,
  Pause,
  Edit,
  Clock,
  Users,
  DollarSign,
  TrendingUp,
  Settings,
  Trash2
} from "lucide-react";

const statusColors = {
  active: "bg-green-100 text-green-800 border-green-200",
  paused: "bg-yellow-100 text-yellow-800 border-yellow-200",
  draft: "bg-gray-100 text-gray-800 border-gray-200"
};

const automationColors = {
  manual: "bg-red-100 text-red-800 border-red-200",
  semi_automated: "bg-yellow-100 text-yellow-800 border-yellow-200",
  fully_automated: "bg-green-100 text-green-800 border-green-200"
};

const categoryIcons = {
  hr: Users,
  procurement: Settings,
  customer_support: Users,
  sales: TrendingUp,
  inventory: Settings,
  finance: DollarSign,
  marketing: TrendingUp
};

export default function WorkflowCard({ workflow, onEdit, onToggleStatus, onDelete }) {
  const { formatCurrency } = useCurrencyFormatter();
  const CategoryIcon = categoryIcons[workflow.category] || Settings;

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-8 h-8 bg-gradient-to-br from-[var(--genix-blue)] to-[var(--genix-purple)] rounded-lg flex items-center justify-center flex-shrink-0">
              <CategoryIcon className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base sm:text-lg leading-tight break-words">{workflow.name}</CardTitle>
              <p className="text-xs sm:text-sm text-slate-500 capitalize truncate">{workflow.category.replace('_', ' ')}</p>
            </div>
          </div>
          <Badge className={`${statusColors[workflow.status]} flex-shrink-0 text-xs`}>
            {workflow.status}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-2 break-words">
          {workflow.description}
        </p>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs sm:text-sm flex-wrap gap-2">
            <span className="text-slate-500 truncate">Automation Level</span>
            <Badge className={`${automationColors[workflow.automation_level]} text-xs flex-shrink-0`}>
              {workflow.automation_level?.replace('_', ' ')}
            </Badge>
          </div>

          {workflow.success_rate && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-slate-500">Success Rate</span>
                <span className="font-medium">{workflow.success_rate}%</span>
              </div>
              <Progress value={workflow.success_rate} className="h-2" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-2">
            {workflow.avg_completion_time && (
              <div className="flex items-center gap-2 min-w-0">
                <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 truncate">Avg Time</p>
                  <p className="text-sm font-medium truncate">{workflow.avg_completion_time}h</p>
                </div>
              </div>
            )}
            
            {workflow.cost_savings && (
              <div className="flex items-center gap-2 min-w-0">
                <DollarSign className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 truncate">Savings</p>
                  <p className="text-sm font-medium text-green-600 truncate">{formatCurrency(workflow.cost_savings)}/mo</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onToggleStatus(workflow)}
            className="flex-1 text-xs sm:text-sm"
          >
            {workflow.status === "active" ? (
              <>
                <Pause className="w-3 h-3 mr-1" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-3 h-3 mr-1" />
                Activate
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(workflow)}
            className="flex-1 text-xs sm:text-sm"
          >
            <Edit className="w-3 h-3 mr-1" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(workflow)}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs sm:text-sm"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}