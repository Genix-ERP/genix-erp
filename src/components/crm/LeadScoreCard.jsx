import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function LeadScoreCard({ score }) {
  const getScoreColor = (score) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    if (score >= 40) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return 'Hot';
    if (score >= 60) return 'Warm';
    if (score >= 40) return 'Cool';
    return 'Cold';
  };

  return (
    <div className="flex items-center gap-2">
      <div className="w-16">
        <Progress value={score} className="h-2" />
      </div>
      <Badge className={getScoreColor(score)}>
        {score || 0}/100
      </Badge>
    </div>
  );
}