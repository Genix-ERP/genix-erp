import React from 'react';
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
import { Button } from '@/components/ui/button';
import {
  User,
  Settings,
  Bell,
  Lock,
  LogOut,
  ChevronDown
} from 'lucide-react';

export default function UserMenu({ compact = false }) {
  const { user: currentUser, logout, isSiteAdmin, isOwner } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const getRoleDisplay = () => {
    if (isSiteAdmin()) return t('site_admin') || 'Sayt Administratori';
    if (isOwner()) return t('owner') || 'Egasi';
    return t('user') || 'Foydalanuvchi';
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={compact
            ? "flex items-center gap-1.5 px-2 py-1.5 h-auto hover:bg-slate-100/80 rounded-lg"
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

            {/* User Info - Only show in non-compact mode or always show name */}
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
            {compact && (
              <span className="text-xs font-medium text-slate-900 truncate max-w-[80px]">
                {currentUser?.full_name || 'User'}
              </span>
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

        <DropdownMenuSeparator />

        {/* Logout */}
        <DropdownMenuItem
          onClick={() => {
            if (confirm(t('logout_confirm') || 'Chiqishni xohlaysizmi?')) {
              logout();
            }
          }}
          className="cursor-pointer text-red-600 focus:text-red-600"
        >
          <LogOut className="w-4 h-4 mr-2" />
          <span>{t('logout') || 'Chiqish'}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
