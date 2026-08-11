import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/components/contexts/AuthContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  User,
  Settings,
  Bell,
  Lock,
  LogOut,
  ChevronDown,
  Wallet
} from 'lucide-react';

export default function UserMenu({ compact = false }) {
  const { user: currentUser, logout, isSiteAdmin, isOwner } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const getRoleDisplay = () => {
    if (isSiteAdmin()) return t('site_admin') || 'Sayt Administratori';
    if (isOwner()) return t('owner') || 'Egasi';
    return t('user') || 'Foydalanuvchi';
  };

  const handleLogout = () => {
    setShowLogoutDialog(false);
    logout();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={compact
              ? "flex items-center gap-1.5 px-1.5 h-9 hover:bg-slate-100 rounded-lg"
              : "w-full justify-between px-3 py-2 h-auto hover:bg-slate-100/80"
            }
          >
            <div className={`flex items-center min-w-0 ${compact ? 'gap-1.5' : 'gap-2'}`}>
              {/* User Avatar */}
              <div className={`bg-gradient-to-br from-[var(--genix-blue)] to-[var(--genix-purple)] rounded-full flex items-center justify-center flex-shrink-0 ${
                compact ? 'w-7 h-7' : 'w-10 h-10'
              }`}>
                <span className={`text-white font-semibold ${compact ? 'text-[10px]' : 'text-sm'}`}>
                  {currentUser?.full_name?.charAt(0) || 'U'}
                </span>
              </div>

              {/* User Info - Only show in non-compact mode */}
              {!compact && (
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-sm font-semibold text-slate-900 truncate max-w-[120px]">
                    {currentUser?.full_name || 'User'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {getRoleDisplay()}
                  </span>
                </div>
              )}
            </div>

            {!compact && <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
            {compact && <ChevronDown className="w-3 h-3 text-slate-400 flex-shrink-0" />}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="flex flex-col">
            <span className="font-semibold">{currentUser?.full_name || 'User'}</span>
            <span className="text-xs text-slate-500 font-normal">{currentUser?.email}</span>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          {/* My Settings */}
          <Link to="/my-settings?tab=profile">
            <DropdownMenuItem className="cursor-pointer">
              <User className="w-4 h-4 mr-2 text-slate-500" />
              <span>{t('my_settings') || 'Mening sozlamalarim'}</span>
            </DropdownMenuItem>
          </Link>

          <Link to="/my-settings?tab=security">
            <DropdownMenuItem className="cursor-pointer">
              <Lock className="w-4 h-4 mr-2 text-slate-500" />
              <span>{t('change_password') || 'Parolni o\'zgartirish'}</span>
            </DropdownMenuItem>
          </Link>

          <Link to="/my-settings?tab=notifications">
            <DropdownMenuItem className="cursor-pointer">
              <Bell className="w-4 h-4 mr-2 text-slate-500" />
              <span>{t('notifications') || 'Bildirishnomalar'}</span>
            </DropdownMenuItem>
          </Link>

          {/* Xodim kabineti — own payslips, own advances/debts. Server-side
              scoped via /my/*; shows a friendly empty state for accounts
              with no linked employee record. */}
          <Link to="/employee-cabinet">
            <DropdownMenuItem className="cursor-pointer">
              <Wallet className="w-4 h-4 mr-2 text-slate-500" />
              <span>{t('employee_portal') || 'Xodim kabineti'}</span>
            </DropdownMenuItem>
          </Link>

          <DropdownMenuSeparator />

          {/* Logout */}
          <DropdownMenuItem
            onClick={() => setShowLogoutDialog(true)}
            className="cursor-pointer text-red-600 focus:text-red-600"
          >
            <LogOut className="w-4 h-4 mr-2" />
            <span>{t('logout') || 'Chiqish'}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('logout') || 'Chiqish'}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('logout_confirm') || 'Tizimdan chiqishni xohlaysizmi?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel') || 'Bekor qilish'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700"
            >
              {t('logout') || 'Chiqish'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
