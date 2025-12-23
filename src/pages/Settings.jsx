import React from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Bell, LogOut, Lock, Crown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/contexts/AuthContext";

import ProfileSettings from "@/components/settings/ProfileSettings";
import NotificationSettings from "@/components/settings/NotificationSettings";
import ChangePasswordSettings from "@/components/settings/ChangePasswordSettings";
import SubscriptionSettings from "@/components/settings/SubscriptionSettings";

import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";

export default function Settings() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { logout } = useAuth();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'profile';
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      setIsLoggingOut(true);
      logout();
    }
  };

  return (
    <div className="p-6 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-[var(--genix-navy)]">{t('settings')}</h1>
          <p className="text-slate-600 mt-2">{t('settings_subtitle')}</p>
        </div>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">
              <User className="w-4 h-4 mr-2" />
              {t('profile')}
            </TabsTrigger>
            <TabsTrigger value="subscription">
              <Crown className="w-4 h-4 mr-2" />
              Obuna
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="w-4 h-4 mr-2" />
              {t('notifications')}
            </TabsTrigger>
            <TabsTrigger value="security">
              <Lock className="w-4 h-4 mr-2" />
              Security
            </TabsTrigger>
          </TabsList>
          <TabsContent value="profile" className="mt-6">
            <ProfileSettings />
          </TabsContent>
          <TabsContent value="subscription" className="mt-6">
            <SubscriptionSettings />
          </TabsContent>
          <TabsContent value="notifications" className="mt-6">
            <NotificationSettings />
          </TabsContent>
          <TabsContent value="security" className="mt-6">
            <ChangePasswordSettings />
          </TabsContent>
        </Tabs>

        {/* Logout Section */}
        <Card className="border-red-200 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <LogOut className="w-5 h-5 text-red-600" />
              Logout
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 mb-4">
              Sign out of your account and return to the login page.
            </p>
            <Button 
              onClick={handleLogout}
              disabled={isLoggingOut}
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoggingOut ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Logging out...
                </>
              ) : (
                <>
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}