import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Code, Copy, Check, Globe, MessageSquare, Palette } from 'lucide-react';
import { useAuth } from '@/components/contexts/AuthContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import apiClient from '@/api/client';
import { toast } from 'sonner';

export default function WebsiteScript() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [tenantCode, setTenantCode] = useState('');

  useEffect(() => {
    // Fetch tenant code from organizations API
    apiClient.get('/auth/me/organizations').then(res => {
      const orgs = res.data?.data || [];
      if (orgs.length > 0 && orgs[0].tenant_code) {
        setTenantCode(orgs[0].tenant_code);
      }
    }).catch(() => {});
    // Also try from subscription status
    apiClient.get('/subscription/status').then(res => {
      const code = res.data?.data?.tenant_code;
      if (code) setTenantCode(code);
    }).catch(() => {});
  }, []);

  const [color, setColor] = useState('#6366f1');
  const [lang, setLang] = useState('uz');
  const [position, setPosition] = useState('bottom-right');
  const [copied, setCopied] = useState(false);

  const apiBase = import.meta.env.VITE_API_URL || 'https://api.genixerp.com/api/v1';
  const appBase = window.location.origin;

  const scriptCode = `<script src="${appBase}/embed/lead-form.js"\n        data-tenant="${tenantCode}"\n        data-color="${color}"\n        data-lang="${lang}"\n        data-position="${position}"\n        data-api="${apiBase}">\n</script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopied(true);
    toast.success(language === 'uz' ? 'Nusxalandi!' : 'Copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader className="border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <Code className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {language === 'uz' ? 'Veb-sayt uchun skript' : language === 'ru' ? 'Скрипт для сайта' : 'Website Lead Capture Script'}
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                {language === 'uz'
                  ? 'Bu skriptni veb-saytingizga qo\'ying va mijozlar to\'g\'ridan-to\'g\'ri CRM ga tushadi'
                  : language === 'ru'
                  ? 'Вставьте этот скрипт на ваш сайт и заявки будут попадать прямо в CRM'
                  : 'Add this script to your website and leads will flow directly into your CRM'}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                <Palette className="w-3.5 h-3.5" />
                {language === 'uz' ? 'Rang' : language === 'ru' ? 'Цвет' : 'Color'}
              </label>
              <div className="flex gap-2">
                <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-12 h-10 p-1 cursor-pointer" />
                <Input value={color} onChange={(e) => setColor(e.target.value)} className="flex-1" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                <Globe className="w-3.5 h-3.5" />
                {language === 'uz' ? 'Til' : language === 'ru' ? 'Язык' : 'Language'}
              </label>
              <Select value={lang} onValueChange={setLang}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="uz">O'zbekcha</SelectItem>
                  <SelectItem value="ru">Русский</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5" />
                {language === 'uz' ? 'Joylashuv' : language === 'ru' ? 'Позиция' : 'Position'}
              </label>
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom-right">{language === 'uz' ? 'Pastda o\'ngda' : language === 'ru' ? 'Снизу справа' : 'Bottom Right'}</SelectItem>
                  <SelectItem value="bottom-left">{language === 'uz' ? 'Pastda chapda' : language === 'ru' ? 'Снизу слева' : 'Bottom Left'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tenant Code */}
          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
            <span className="text-sm text-slate-500">{language === 'uz' ? 'Sizning kodingiz:' : language === 'ru' ? 'Ваш код:' : 'Your code:'}</span>
            <Badge variant="outline" className="text-sm font-mono">{tenantCode || '—'}</Badge>
          </div>

          {/* Generated Script */}
          <div className="relative">
            <pre className="bg-slate-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto font-mono leading-relaxed">
              {scriptCode}
            </pre>
            <Button
              size="sm"
              onClick={handleCopy}
              className="absolute top-3 right-3 bg-white/10 hover:bg-white/20 text-white"
            >
              {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
              {copied ? (language === 'uz' ? 'Nusxalandi' : language === 'ru' ? 'Скопировано' : 'Copied') : (language === 'uz' ? 'Nusxalash' : language === 'ru' ? 'Копировать' : 'Copy')}
            </Button>
          </div>

          {/* Platform-specific instructions */}
          <div className="space-y-3">
            <h4 className="font-medium text-slate-900">
              {language === 'uz' ? 'Platformaga qarab o\'rnatish:' : language === 'ru' ? 'Установка по платформам:' : 'Installation by platform:'}
            </h4>

            {[
              {
                name: 'HTML / WordPress / Tilda',
                icon: '🌐',
                steps: language === 'uz'
                  ? ['index.html faylini oching', 'Skriptni </body> tegidan oldin qo\'ying', 'Saqlang va yangilang']
                  : language === 'ru'
                  ? ['Откройте index.html', 'Вставьте скрипт перед </body>', 'Сохраните и обновите']
                  : ['Open index.html', 'Paste script before </body>', 'Save and refresh']
              },
              {
                name: 'React / Next.js',
                icon: '⚛️',
                code: `// useEffect ichida qo'shing:\nuseEffect(() => {\n  const s = document.createElement('script');\n  s.src = '${appBase}/embed/lead-form.js';\n  s.setAttribute('data-tenant', '${tenantCode}');\n  s.setAttribute('data-color', '${color}');\n  s.setAttribute('data-lang', '${lang}');\n  s.setAttribute('data-api', '${apiBase}');\n  document.body.appendChild(s);\n  return () => document.body.removeChild(s);\n}, []);`,
                steps: language === 'uz'
                  ? ['App.jsx yoki Layout komponentiga useEffect qo\'shing']
                  : language === 'ru'
                  ? ['Добавьте useEffect в App.jsx или Layout компонент']
                  : ['Add useEffect to App.jsx or Layout component']
              },
              {
                name: 'Vue.js / Nuxt',
                icon: '💚',
                code: `// App.vue yoki layout faylida:\nmounted() {\n  const s = document.createElement('script');\n  s.src = '${appBase}/embed/lead-form.js';\n  s.setAttribute('data-tenant', '${tenantCode}');\n  s.setAttribute('data-color', '${color}');\n  s.setAttribute('data-lang', '${lang}');\n  s.setAttribute('data-api', '${apiBase}');\n  document.body.appendChild(s);\n}`,
                steps: language === 'uz'
                  ? ['App.vue ning mounted() ga qo\'shing']
                  : language === 'ru'
                  ? ['Добавьте в mounted() в App.vue']
                  : ['Add to mounted() in App.vue']
              }
            ].map((platform, idx) => (
              <details key={idx} className="border border-slate-200 rounded-lg overflow-hidden">
                <summary className="flex items-center gap-2 p-3 bg-slate-50 cursor-pointer hover:bg-slate-100 font-medium text-sm">
                  <span>{platform.icon}</span>
                  <span>{platform.name}</span>
                </summary>
                <div className="p-3 space-y-2">
                  <ol className="text-sm text-slate-600 space-y-1 list-decimal list-inside">
                    {platform.steps.map((step, i) => <li key={i}>{step}</li>)}
                  </ol>
                  {platform.code && (
                    <pre className="bg-slate-900 text-green-400 p-3 rounded-lg text-xs overflow-x-auto font-mono">{platform.code}</pre>
                  )}
                </div>
              </details>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
