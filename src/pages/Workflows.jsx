import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Workflow as WorkflowIcon, ShieldAlert } from "lucide-react";

import WorkflowSettings from "@/components/admin-settings/WorkflowSettings";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useAuth } from "@/components/contexts/AuthContext";

export default function Workflows() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { user, isSiteAdmin, isOwner } = useAuth();
  const navigate = useNavigate();

  const hasAdminAccess = () => {
    if (!user) return false;
    return isSiteAdmin() || isOwner() || user.role === "admin" || user.role === "system_admin";
  };

  useEffect(() => {
    if (!hasAdminAccess()) navigate("/");
  }, [user]);

  if (!hasAdminAccess()) {
    return (
      <div className="p-6 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
        <div className="max-w-md mx-auto mt-20">
          <Card className="border-red-200">
            <CardContent className="p-8 text-center">
              <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-slate-900 mb-2">{t("access_denied")}</h2>
              <p className="text-slate-600 mb-6">{t("workflows_admin_only")}</p>
              <Button onClick={() => navigate("/")} variant="outline">
                {t("go_to_dashboard")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--genix-blue)] to-[var(--genix-purple)] flex items-center justify-center flex-shrink-0 shadow-lg">
            <WorkflowIcon className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[var(--genix-navy)]">
              {t("automation_rules") || "Avtomatlashtirish qoidalari"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {t("automation_rules_desc") ||
                "Voqealar va shartlar asosida harakatlarni avtomatik ishga tushiruvchi qoidalarni sozlash"}
            </p>
          </div>
        </div>

        <WorkflowSettings />
      </div>
    </div>
  );
}
