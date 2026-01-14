import React from 'react';
import { useSubscription, PLAN_LIMITS } from '@/components/contexts/SubscriptionContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Sparkles,
  Users,
  HardDrive,
  Clock,
  Crown,
  Zap,
  AlertTriangle,
  CheckCircle,
  ArrowUpRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SubscriptionStatus({ compact = false }) {
  const {
    subscription,
    aiUsage,
    getPlanLimits,
    getRemainingAIRequests,
    getAIUsagePercentage,
    getTrialDaysRemaining,
    isTrialExpired,
    getUpgradeRecommendation
  } = useSubscription();

  const limits = getPlanLimits();
  const aiRemaining = getRemainingAIRequests();
  const aiPercentage = getAIUsagePercentage();
  const trialDays = getTrialDaysRemaining();
  const recommendations = getUpgradeRecommendation();

  const getPlanColor = (plan) => {
    const colors = {
      free_trial: 'bg-slate-100 text-slate-800',
      starter: 'bg-blue-100 text-blue-800',
      professional: 'bg-purple-100 text-purple-800',
      enterprise: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
    };
    return colors[plan] || colors.free_trial;
  };

  const getPlanIcon = (plan) => {
    if (plan === 'enterprise') return <Crown className="w-4 h-4" />;
    if (plan === 'professional') return <Zap className="w-4 h-4" />;
    return <Sparkles className="w-4 h-4" />;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl">
        <Badge className={`${getPlanColor(subscription?.plan)} flex items-center gap-1`}>
          {getPlanIcon(subscription?.plan)}
          {limits.name}
        </Badge>

        {subscription?.status === 'trial' && trialDays > 0 && (
          <span className="text-xs text-slate-500">
            <Clock className="w-3 h-3 inline mr-1" />
            {trialDays} kun qoldi
          </span>
        )}

        {limits.aiRequestsPerMonth !== -1 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">AI:</span>
            <Progress value={aiPercentage} className="w-16 h-1.5" />
            <span className={aiPercentage >= 80 ? 'text-orange-600' : 'text-slate-600'}>
              {aiRemaining}/{limits.aiRequestsPerMonth}
            </span>
          </div>
        )}

        <Link to="/settings?tab=subscription">
          <Button variant="ghost" size="sm" className="h-6 text-xs">
            <ArrowUpRight className="w-3 h-3" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-[var(--genix-blue)]/10 to-[var(--genix-purple)]/10 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {getPlanIcon(subscription?.plan)}
            Obuna Holati
          </CardTitle>
          <Badge className={`${getPlanColor(subscription?.plan)} flex items-center gap-1 px-3 py-1`}>
            {limits.name}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Trial Warning */}
        {subscription?.status === 'trial' && (
          <div className={`flex items-start gap-3 p-4 rounded-lg ${
            trialDays <= 3 ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
          }`}>
            <AlertTriangle className={`w-5 h-5 mt-0.5 ${trialDays <= 3 ? 'text-red-500' : 'text-amber-500'}`} />
            <div>
              <p className={`font-medium ${trialDays <= 3 ? 'text-red-700' : 'text-amber-700'}`}>
                Sinov muddati: {trialDays} kun qoldi
              </p>
              <p className="text-sm text-slate-600 mt-1">
                Sinov tugagandan so'ng ba'zi funksiyalar cheklanadi. Obunani faollashtiring.
              </p>
            </div>
          </div>
        )}

        {/* AI Usage */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              <span className="font-medium">AI So'rovlar</span>
            </div>
            <span className="text-sm text-slate-600">
              {limits.aiRequestsPerMonth === -1 ? (
                <span className="text-green-600 font-medium">Cheksiz</span>
              ) : (
                `${aiUsage.count} / ${limits.aiRequestsPerMonth}`
              )}
            </span>
          </div>
          {limits.aiRequestsPerMonth !== -1 && (
            <div className="space-y-1">
              <Progress
                value={aiPercentage}
                className={`h-2 ${aiPercentage >= 80 ? '[&>div]:bg-orange-500' : '[&>div]:bg-purple-500'}`}
              />
              <p className="text-xs text-slate-500">
                {aiRemaining} ta so'rov qoldi bu oy uchun
              </p>
            </div>
          )}
        </div>

        {/* User Limit */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              <span className="font-medium">Foydalanuvchilar</span>
            </div>
            <span className="text-sm text-slate-600">
              {limits.maxUsers === -1 ? (
                <span className="text-green-600 font-medium">Cheksiz</span>
              ) : (
                `${subscription?.currentUsers || 1} / ${limits.maxUsers}`
              )}
            </span>
          </div>
          {limits.maxUsers !== -1 && (
            <Progress
              value={((subscription?.currentUsers || 1) / limits.maxUsers) * 100}
              className="h-2"
            />
          )}
        </div>

        {/* Storage */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-green-500" />
              <span className="font-medium">Cloud Xotira</span>
            </div>
            <span className="text-sm text-slate-600">
              {limits.cloudStorageGB === -1 ? (
                <span className="text-green-600 font-medium">Cheksiz</span>
              ) : (
                `${limits.cloudStorageGB} GB`
              )}
            </span>
          </div>
        </div>

        {/* Features */}
        <div className="border-t pt-4 space-y-2">
          <p className="font-medium text-sm text-slate-700">Asosiy Xususiyatlar:</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {Object.entries(limits.features).slice(0, 8).map(([key, enabled]) => (
              <div key={key} className="flex items-center gap-2">
                {enabled ? (
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300" />
                )}
                <span className={enabled ? 'text-slate-700' : 'text-slate-400'}>
                  {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Upgrade Recommendations */}
        {recommendations.length > 0 && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-100">
            <p className="font-medium text-purple-700 mb-2">Tavsiya:</p>
            {recommendations.map((rec, i) => (
              <p key={i} className="text-sm text-purple-600">{rec.message}</p>
            ))}
          </div>
        )}

        {/* Upgrade Button */}
        {subscription?.plan !== 'enterprise' && (
          <Link to="/settings?tab=subscription">
            <Button className="w-full bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
              <Crown className="w-4 h-4 mr-2" />
              Obunani Yangilash
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

// Small badge for sidebar/header
export function SubscriptionBadge() {
  const { subscription, getPlanLimits, getTrialDaysRemaining } = useSubscription();
  const limits = getPlanLimits();
  const trialDays = getTrialDaysRemaining();

  const getPlanColor = (plan) => {
    const colors = {
      free_trial: 'bg-slate-100 text-slate-700 border-slate-200',
      starter: 'bg-blue-100 text-blue-700 border-blue-200',
      professional: 'bg-purple-100 text-purple-700 border-purple-200',
      enterprise: 'bg-gradient-to-r from-amber-400 to-orange-400 text-white border-amber-300'
    };
    return colors[plan] || colors.free_trial;
  };

  return (
    <div className="flex items-center gap-2">
      <Badge className={`${getPlanColor(subscription?.plan)} text-[10px] border`}>
        {limits.name}
      </Badge>
      {subscription?.status === 'trial' && trialDays > 0 && trialDays <= 7 && (
        <span className="text-[10px] text-orange-600 animate-pulse">
          {trialDays}d left
        </span>
      )}
    </div>
  );
}

// AI Usage indicator for AI Assistant page
export function AIUsageIndicator() {
  const { aiUsage, getPlanLimits, getRemainingAIRequests, getAIUsagePercentage } = useSubscription();
  const limits = getPlanLimits();
  const remaining = getRemainingAIRequests();
  const percentage = getAIUsagePercentage();

  if (limits.aiRequestsPerMonth === -1) {
    return (
      <div className="flex items-center gap-2 text-xs text-green-600">
        <Sparkles className="w-3.5 h-3.5" />
        <span>Cheksiz AI so'rovlar</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <Sparkles className={`w-3.5 h-3.5 ${percentage >= 80 ? 'text-orange-500' : 'text-purple-500'}`} />
        <span className="text-xs text-slate-600">
          {remaining} / {limits.aiRequestsPerMonth} so'rov
        </span>
      </div>
      <Progress
        value={percentage}
        className={`w-20 h-1.5 ${percentage >= 80 ? '[&>div]:bg-orange-500' : '[&>div]:bg-purple-500'}`}
      />
      {percentage >= 80 && (
        <Link to="/settings?tab=subscription">
          <Button variant="ghost" size="sm" className="h-5 text-[10px] text-orange-600 hover:text-orange-700 p-1">
            Yangilash
          </Button>
        </Link>
      )}
    </div>
  );
}
