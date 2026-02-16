import React, { useState } from 'react';
import { useSubscription, PLAN_LIMITS } from '@/components/contexts/SubscriptionContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Crown,
  Sparkles,
  Users,
  HardDrive,
  Check,
  X,
  Zap,
  Clock,
  AlertTriangle,
  ArrowRight,
  Star
} from 'lucide-react';

export default function SubscriptionSettings() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    subscription,
    aiUsage,
    getPlanLimits,
    getRemainingAIRequests,
    getAIUsagePercentage,
    getTrialDaysRemaining,
    upgradePlan
  } = useSubscription();

  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const currentLimits = getPlanLimits();
  const aiRemaining = getRemainingAIRequests();
  const aiPercentage = getAIUsagePercentage();
  const trialDays = getTrialDaysRemaining();

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      price: 299,
      description: t('starter_description') || 'Kichik bizneslar uchun',
      userLabel: '10 gacha foydalanuvchi',
      icon: Sparkles,
      color: 'from-blue-500 to-blue-600',
      highlights: [
        'AI yordamida ma\'lumot kiritish',
        'Asosiy moliyaviy boshqaruv',
        'Oddiy inventar kuzatuvi',
        'Standart hisobotlar (15+ hisobot)',
        'Email yordam (24s javob)',
        '5 GB Cloud xotira',
        'Mobil kirish',
        'Bitta kompaniya profili'
      ]
    },
    {
      id: 'professional',
      name: 'Professional',
      price: 499,
      description: t('professional_description') || "O'sib borayotgan kompaniyalar uchun",
      userLabel: '50 gacha foydalanuvchi',
      icon: Zap,
      color: 'from-purple-500 to-purple-600',
      popular: true,
      highlights: [
        "Starter'dagi hamma narsa, qo'shimcha:",
        'AI tahlil va prognozlash',
        'Avtomatlashtirilgan ish oqimi mexanizmi',
        'Maxsus hisobot qurish',
        'Ustuvor yordam (8s javob)',
        'API kirish (5,000 chaqiruv/oy)',
        '50 GB Cloud xotira',
        '3 tagacha kompaniya profili',
        'Xavfsizlik va ruxsatlar'
      ]
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 999,
      description: t('enterprise_description') || 'Katta korxonalar uchun',
      userLabel: 'Cheksiz foydalanuvchilar',
      icon: Crown,
      color: 'from-amber-500 to-orange-500',
      highlights: [
        "Professional'dagi hamma narsa, qo'shimcha:",
        "To'liq AI to'plami (Chatbot, Prognoz AI)",
        "AI asosida ta'minot zanjirini optimallashtirish",
        "Maxsus AI model o'qitish",
        'Maxsus hisob menejeri',
        'White-Label variantlar',
        '24/7 Premium yordam (1s javob)',
        'Cheksiz API chaqiruvlar',
        'Cheksiz Cloud xotira',
        'Cheksiz kompaniya profillari',
        'On-Premise joylashtirilish varianti',
        'Muvofiqlik (SOC2, GDPR)',
        'Maxsus integratsiyalar'
      ]
    }
  ];

  const handleUpgrade = async (planId) => {
    setIsUpgrading(true);
    // Simulate upgrade process
    await new Promise(resolve => setTimeout(resolve, 1500));
    upgradePlan(planId);
    setIsUpgrading(false);
    setSelectedPlan(null);
  };

  const getPlanBadgeColor = (planId) => {
    const colors = {
      free_trial: 'bg-slate-100 text-slate-700',
      starter: 'bg-blue-100 text-blue-700',
      professional: 'bg-purple-100 text-purple-700',
      enterprise: 'bg-gradient-to-r from-amber-400 to-orange-400 text-white'
    };
    return colors[planId] || colors.free_trial;
  };

  return (
    <div className="space-y-8">
      {/* Current Plan Status */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-[var(--genix-blue)]/10 to-[var(--genix-purple)]/10">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-purple-600" />
              {t('current_subscription')}
            </CardTitle>
            <Badge className={`${getPlanBadgeColor(subscription?.plan)} px-3 py-1`}>
              {currentLimits.name}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Trial Warning */}
          {subscription?.status === 'trial' && trialDays > 0 && (
            <div className={`flex items-start gap-3 p-4 rounded-lg mb-6 ${
              trialDays <= 3 ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
            }`}>
              <AlertTriangle className={`w-5 h-5 mt-0.5 ${trialDays <= 3 ? 'text-red-500' : 'text-amber-500'}`} />
              <div>
                <p className={`font-medium ${trialDays <= 3 ? 'text-red-700' : 'text-amber-700'}`}>
                  {t('trial_period')}: {trialDays} {t('days_remaining')}
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  {t('trial_end_warning')}
                </p>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-6">
            {/* AI Usage */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-600">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium">{t('ai_requests')}</span>
              </div>
              {currentLimits.aiRequestsPerMonth === -1 ? (
                <p className="text-2xl font-bold text-green-600">{t('unlimited')}</p>
              ) : (
                <>
                  <p className="text-2xl font-bold text-slate-900">
                    {aiUsage.count} / {currentLimits.aiRequestsPerMonth}
                  </p>
                  <Progress
                    value={aiPercentage}
                    className={`h-2 ${aiPercentage >= 80 ? '[&>div]:bg-orange-500' : '[&>div]:bg-purple-500'}`}
                  />
                  <p className="text-xs text-slate-500">{aiRemaining} {t('requests_remaining')}</p>
                </>
              )}
            </div>

            {/* Users */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-600">
                <Users className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium">{t('users')}</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {currentLimits.maxUsers === -1 ? t('unlimited') : `${subscription?.currentUsers || 1} / ${currentLimits.maxUsers}`}
              </p>
              {currentLimits.maxUsers !== -1 && (
                <Progress value={((subscription?.currentUsers || 1) / currentLimits.maxUsers) * 100} className="h-2" />
              )}
            </div>

            {/* Storage */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-600">
                <HardDrive className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium">{t('cloud_storage')}</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {currentLimits.cloudStorageGB === -1 ? t('unlimited') : `${currentLimits.cloudStorageGB} GB`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Available Plans */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">{t('available_plans')}</h3>
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrentPlan = subscription?.plan === plan.id;
            const PlanIcon = plan.icon;

            return (
              <Card
                key={plan.id}
                className={`relative overflow-hidden transition-all duration-300 ${
                  isCurrentPlan ? 'ring-2 ring-purple-500 shadow-lg' : 'hover:shadow-lg'
                } ${plan.popular ? 'border-purple-300' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                    <Star className="w-3 h-3 inline mr-1" />
                    {t('popular') || 'Mashhur'}
                  </div>
                )}

                <CardHeader className={`bg-gradient-to-r ${plan.color} text-white pb-8`}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <PlanIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <p className="text-white/80 text-sm">{plan.description}</p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-6 -mt-4">
                  <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-slate-900">${plan.price}</span>
                      <span className="text-slate-500">/oy</span>
                    </div>
                    {plan.userLabel && (
                      <Badge variant="secondary" className="mt-2 font-normal">
                        {plan.userLabel}
                      </Badge>
                    )}
                  </div>

                  <ul className="space-y-3 mb-6">
                    {plan.highlights.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-slate-600">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {isCurrentPlan ? (
                    <Button disabled className="w-full bg-slate-100 text-slate-500">
                      <Check className="w-4 h-4 mr-2" />
                      {t('current_plan')}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={isUpgrading}
                      className={`w-full bg-gradient-to-r ${plan.color} hover:opacity-90`}
                    >
                      {isUpgrading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          {t('upgrade') || "O'tish"}
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Feature Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>{t('feature_comparison')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">{t('feature')}</th>
                  <th className="text-center py-3 px-4">Starter</th>
                  <th className="text-center py-3 px-4 bg-purple-50">Professional</th>
                  <th className="text-center py-3 px-4">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {[
                  [t('price') || 'Narx', '$299/oy', '$499/oy', '$999/oy'],
                  [t('users') || 'Foydalanuvchilar', '10 gacha', '50 gacha', t('unlimited') || 'Cheksiz'],
                  [t('cloud_storage') || 'Cloud xotira', '5 GB', '50 GB', t('unlimited') || 'Cheksiz'],
                  [t('ai_requests') || 'AI so\'rovlar', '500/oy', '2,500/oy', t('unlimited') || 'Cheksiz'],
                  [t('api_access') || 'API kirish', <X className="w-4 h-4 text-red-400 mx-auto" />, '5,000/oy', t('unlimited') || 'Cheksiz'],
                  [t('company_profiles') || 'Kompaniya profillari', '1', '3', t('unlimited') || 'Cheksiz'],
                  ['AI tahlil va prognozlash', <X className="w-4 h-4 text-red-400 mx-auto" />, <Check className="w-4 h-4 text-green-500 mx-auto" />, <Check className="w-4 h-4 text-green-500 mx-auto" />],
                  ['Ish oqimi avtomatizatsiya', <X className="w-4 h-4 text-red-400 mx-auto" />, <Check className="w-4 h-4 text-green-500 mx-auto" />, <Check className="w-4 h-4 text-green-500 mx-auto" />],
                  ['Maxsus AI model', <X className="w-4 h-4 text-red-400 mx-auto" />, <X className="w-4 h-4 text-red-400 mx-auto" />, <Check className="w-4 h-4 text-green-500 mx-auto" />],
                  ['White-Label', <X className="w-4 h-4 text-red-400 mx-auto" />, <X className="w-4 h-4 text-red-400 mx-auto" />, <Check className="w-4 h-4 text-green-500 mx-auto" />],
                  ['On-Premise', <X className="w-4 h-4 text-red-400 mx-auto" />, <X className="w-4 h-4 text-red-400 mx-auto" />, <Check className="w-4 h-4 text-green-500 mx-auto" />],
                  ['SOC2, GDPR', <X className="w-4 h-4 text-red-400 mx-auto" />, <X className="w-4 h-4 text-red-400 mx-auto" />, <Check className="w-4 h-4 text-green-500 mx-auto" />],
                  [t('support') || 'Yordam', 'Email (24s)', 'Ustuvor (8s)', '24/7 Premium (1s)'],
                ].map(([feature, starter, professional, enterprise], index) => (
                  <tr key={index} className="border-b last:border-0">
                    <td className="py-3 px-4 font-medium text-slate-700">{feature}</td>
                    <td className="py-3 px-4 text-center text-slate-600">{starter}</td>
                    <td className="py-3 px-4 text-center text-slate-600 bg-purple-50">{professional}</td>
                    <td className="py-3 px-4 text-center text-slate-600">{enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Contact for Enterprise */}
      <Card className="bg-gradient-to-r from-slate-900 to-slate-800 text-white">
        <CardContent className="p-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold mb-2">{t('custom_requirements')}</h3>
              <p className="text-slate-300">
                {t('custom_requirements_description')}
              </p>
            </div>
            <Button className="bg-white text-slate-900 hover:bg-slate-100">
              {t('contact_us')}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
