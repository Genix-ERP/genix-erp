import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/contexts/AuthContext';
import { useSubscription } from '@/components/contexts/SubscriptionContext';
import apiClient from '@/api/client';
import { SendEmail } from '@/api/integrations';
import { useToast } from "@/components/ui/use-toast";
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Search, Shield, Users, Settings, Activity, AlertTriangle, CheckCircle, XCircle,
  Mail, Trash2, Ban, Clock, Gift, Calendar, CreditCard, UserX, UserCheck, AlertCircle,
  DollarSign, Package, Briefcase, Crown, Sparkles, Eye, Building2, Phone, Receipt
} from 'lucide-react';
import { format, differenceInDays, addDays, parseISO } from 'date-fns';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import PermissionsManagement from '@/components/admin/PermissionsManagement';

export default function AdminPanel() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { toast } = useToast();
  const { user: currentUser, isSiteAdmin } = useAuth();
  const {
    companyUsers,
    subscription,
    getPlanLimits,
    canAddUser,
    addUser: addCompanyUser,
    updateUser: updateCompanyUser,
    deleteUser: deleteCompanyUser,
    toggleUserStatus,
    changeUserRole
  } = useSubscription();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showExtendTrialModal, setShowExtendTrialModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [inviteData, setInviteData] = useState({
    email: '',
    full_name: '',
    role: 'user'
  });
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  const [blockData, setBlockData] = useState({
    reason: '',
    notify_user: true
  });

  const [extendTrialData, setExtendTrialData] = useState({
    days: 14,
    reason: ''
  });

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeData, setUpgradeData] = useState({
    plan: 'professional',
    duration: 12 // months
  });

  // Company/tenant state
  const [tenants, setTenants] = useState([]);
  const [filteredTenants, setFilteredTenants] = useState([]);
  const [tenantSearch, setTenantSearch] = useState('');
  const [tenantStatusFilter, setTenantStatusFilter] = useState('all');
  const [pricing, setPricing] = useState({ price_per_user_monthly: 0, price_per_user_yearly: 0 });
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [checkoutData, setCheckoutData] = useState({ users: 1, billing: 'monthly' });
  const [checkoutUrl, setCheckoutUrl] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showTenantDetailsModal, setShowTenantDetailsModal] = useState(false);
  const [tenantDetails, setTenantDetails] = useState(null);
  const [tenantDetailsLoading, setTenantDetailsLoading] = useState(false);

  const formatTenantStatus = (s) => {
    const map = {
      active: { uz: 'Faol', ru: 'Активный', en: 'Active' },
      trialing: { uz: 'Sinov', ru: 'Триал', en: 'Trial' },
      past_due: { uz: "To'lov kutilmoqda", ru: 'Просрочено', en: 'Past Due' },
      expired: { uz: 'Muddati tugagan', ru: 'Истёк', en: 'Expired' },
      cancelled: { uz: 'Bekor qilingan', ru: 'Отменено', en: 'Cancelled' },
    };
    const v = map[s];
    return v ? (v[language] || v.en) : s;
  };

  const formatPaymentStatus = (s) => {
    const map = {
      success: { uz: 'Muvaffaqiyatli', ru: 'Успешно', en: 'Success' },
      pending: { uz: 'Kutilmoqda', ru: 'В ожидании', en: 'Pending' },
      error: { uz: 'Xatolik', ru: 'Ошибка', en: 'Error' },
      revert: { uz: 'Bekor qilingan', ru: 'Возврат', en: 'Reverted' },
    };
    const v = map[s];
    return v ? (v[language] || v.en) : (s || '—');
  };

  const formatPlan = (plan) => {
    if (!plan) return '-';
    // "1users_monthly" → "1 user · monthly"
    const m = plan.match(/^(\d+)users?_(.+)$/);
    if (m) {
      const usersWord = language === 'uz' ? 'foyd.' : language === 'ru' ? 'польз.' : (m[1] === '1' ? 'user' : 'users');
      const periodMap = {
        monthly: { uz: 'oylik', ru: 'месячный', en: 'monthly' },
        '3months': { uz: '3 oy', ru: '3 мес.', en: '3 months' },
        '6months': { uz: '6 oy', ru: '6 мес.', en: '6 months' },
        yearly: { uz: 'yillik', ru: 'годовой', en: 'yearly' },
      };
      const p = periodMap[m[2]];
      const periodStr = p ? (p[language] || p.en) : m[2];
      return `${m[1]} ${usersWord} · ${periodStr}`;
    }
    return plan;
  };

  const openTenantDetails = async (tenant) => {
    setSelectedTenant(tenant);
    setShowTenantDetailsModal(true);
    setTenantDetails(null);
    setTenantDetailsLoading(true);
    try {
      const resp = await apiClient.get(`/admin/tenants/${tenant.id}`);
      setTenantDetails(resp.data?.data || resp.data);
    } catch (err) {
      console.error('Failed to load tenant details', err);
      toast({ title: 'Failed to load details', variant: 'destructive' });
    }
    setTenantDetailsLoading(false);
  };

  // Filter users when filters change
  useEffect(() => {
    let filtered = users;
    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(u => (u.subscription_status || 'trial') === statusFilter);
    }
    if (searchQuery) {
      filtered = filtered.filter(u =>
        u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredUsers(filtered);
  }, [users, searchQuery, roleFilter, statusFilter]);

  // Filter tenants
  useEffect(() => {
    let filtered = tenants;
    if (tenantStatusFilter !== 'all') {
      filtered = filtered.filter(t => t.subscription_status === tenantStatusFilter);
    }
    if (tenantSearch) {
      const q = tenantSearch.toLowerCase();
      filtered = filtered.filter(t =>
        t.name?.toLowerCase().includes(q) ||
        t.code?.toLowerCase().includes(q) ||
        t.owner_name?.toLowerCase().includes(q) ||
        t.owner_email?.toLowerCase().includes(q) ||
        t.owner_phone?.toLowerCase().includes(q)
      );
    }
    setFilteredTenants(filtered);
  }, [tenants, tenantSearch, tenantStatusFilter]);

  const [loadError, setLoadError] = useState(null);

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      if (!isSiteAdmin()) {
        navigate('/');
        return;
      }

      // Fetch tenants and pricing
      const [usersResp, tenantsResp, plansResp] = await Promise.all([
        apiClient.get('/admin/users'),
        apiClient.get('/admin/tenants'),
        apiClient.get('/subscription/plans').catch(() => ({ data: { data: {} } }))
      ]);
      setTenants(tenantsResp.data?.data || []);
      if (plansResp.data?.data) {
        setPricing(plansResp.data.data);
      }

      // Fetch all system users from the backend API
      const response = usersResp;
      const backendUsers = response.data?.data || [];

      // Map backend response to expected format (tenant owners only)
      const mappedUsers = backendUsers.map(u => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim(),
        role: u.role || 'owner',
        status: u.is_active === false ? 'blocked' : 'active',
        subscription_status: u.subscription_status || 'trial',
        subscription_plan: u.subscription_plan || 'free',
        is_blocked: u.is_active === false,
        created_date: u.created_at,
        last_login_at: u.last_login_at,
        tenant_id: u.tenant_id,
        tenant_name: u.tenant_name,
        tenant_code: u.tenant_code,
        user_count: u.user_count || 1,
        is_system_admin: u.is_system_admin
      }));

      setUsers(mappedUsers);
      setFilteredUsers(mappedUsers);
    } catch (error) {
      console.error('Error loading data from backend:', error);
      const errorMsg = error.response?.data?.error?.message || error.message || 'Failed to load users';
      setLoadError(`API Error: ${errorMsg} (Status: ${error.response?.status || 'unknown'})`);
      setUsers([]);
      setFilteredUsers([]);
    }
    setIsLoading(false);
  };

  // Load data when component mounts
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadData();
  }, []);

  const handleInviteUser = async () => {
    if (!inviteData.email || !inviteData.full_name) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Check if can add more users
    if (!canAddUser()) {
      const limits = getPlanLimits();
      toast.error(`Foydalanuvchi limiti tugadi! Joriy tarifingiz ${limits.maxUsers} ta foydalanuvchiga ruxsat beradi. Ko'proq foydalanuvchi qo'shish uchun tarifingizni yangilang.`);
      return;
    }

    setIsSendingInvite(true);

    // Add user to company users
    const result = addCompanyUser({
      email: inviteData.email,
      full_name: inviteData.full_name,
      role: inviteData.role,
      subscription_status: 'active',
      subscription_plan: subscription?.plan || 'free_trial'
    });

    if (result.success) {
      toast.success(`Foydalanuvchi qo'shildi! Ism: ${inviteData.full_name}, Email: ${inviteData.email}, Rol: ${getRoleDisplayName(inviteData.role)}`);
      setShowInviteModal(false);
      setInviteData({ email: '', full_name: '', role: 'user' });
    } else {
      toast.error(`Xatolik: ${result.message}`);
    }

    setIsSendingInvite(false);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      // Call backend API to delete user
      await apiClient.delete(`/admin/users/${selectedUser.id}`);

      // Remove user from local state
      setUsers(prev => prev.filter(u => u.id !== selectedUser.id));
      setFilteredUsers(prev => prev.filter(u => u.id !== selectedUser.id));

      toast({
        title: t('success'),
        description: t('user_deleted_successfully') || `${selectedUser.email} ${t('deleted')}`,
      });

      setShowDeleteModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        variant: "destructive",
        title: t('error'),
        description: error.response?.data?.error?.message || error.message || t('delete_failed'),
      });
    }
  };

  const handleBlockUser = async () => {
    if (!selectedUser) return;

    const isBlocking = selectedUser.status !== 'blocked';

    try {
      const result = updateCompanyUser(selectedUser.id, {
        status: isBlocking ? 'blocked' : 'active',
        blocked_reason: isBlocking ? blockData.reason : null,
        blocked_date: isBlocking ? new Date().toISOString() : null
      });

      if (result.success) {
        toast({
          title: t('success'),
          description: `${selectedUser.email} ${isBlocking ? t('user_blocked') : t('user_unblocked')}`,
        });
        setShowBlockModal(false);
        setSelectedUser(null);
        setBlockData({ reason: '', notify_user: true });
      } else {
        toast({
          variant: "destructive",
          title: t('error'),
          description: result.message || t('operation_failed'),
        });
      }
    } catch (error) {
      console.error('Error updating user status:', error);
      toast({
        variant: "destructive",
        title: t('error'),
        description: error.message || t('operation_failed'),
      });
    }
  };

  const handleExtendTrial = async () => {
    if (!selectedUser) return;

    try {
      const currentEndDate = selectedUser.trial_end_date
        ? parseISO(selectedUser.trial_end_date)
        : addDays(new Date(), 14);

      const newEndDate = addDays(currentEndDate, parseInt(extendTrialData.days));

      const result = updateCompanyUser(selectedUser.id, {
        trial_end_date: newEndDate.toISOString(),
        trial_start_date: selectedUser.trial_start_date || new Date().toISOString(),
        subscription_status: 'trial'
      });

      if (result.success) {
        toast.success(`Sinov muddati ${extendTrialData.days} kunga uzaytirildi! Yangi tugash sanasi: ${format(newEndDate, 'MMM dd, yyyy')}`);
        setShowExtendTrialModal(false);
        setSelectedUser(null);
        setExtendTrialData({ days: 14, reason: '' });
      } else {
        toast.error(`Xatolik: ${result.message}`);
      }
    } catch (error) {
      console.error('Error extending trial:', error);
      toast.error(`Xatolik: ${error.message}`);
    }
  };

  const handleUpgradeSubscription = async () => {
    if (!selectedUser) return;

    try {
      const startDate = new Date();
      const endDate = addDays(startDate, upgradeData.duration * 30);

      const result = updateCompanyUser(selectedUser.id, {
        subscription_status: 'active',
        subscription_plan: upgradeData.plan,
        subscription_start_date: startDate.toISOString(),
        subscription_end_date: endDate.toISOString(),
        trial_end_date: null
      });

      if (result.success) {
        toast.success(`Obuna faollashtirildi! Tarif: ${upgradeData.plan.toUpperCase()}, Amal qilish muddati: ${format(endDate, 'MMM dd, yyyy')}`);
        setShowUpgradeModal(false);
        setSelectedUser(null);
        setUpgradeData({ plan: 'professional', duration: 12 });
      } else {
        toast.error(`Xatolik: ${result.message}`);
      }
    } catch (error) {
      console.error('Error upgrading subscription:', error);
      toast.error(`Xatolik: ${error.message}`);
    }
  };

  const updateUserRole = async (userId, newRole) => {
    try {
      changeUserRole(userId, newRole);
    } catch (error) {
      console.error('Error updating user role:', error);
    }
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      system_admin: 'bg-red-100 text-red-800 border-red-200',
      admin: 'bg-purple-100 text-purple-800 border-purple-200',
      manager: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      finance_manager: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      sales_manager: 'bg-blue-100 text-blue-800 border-blue-200',
      inventory_manager: 'bg-orange-100 text-orange-800 border-orange-200',
      hr_manager: 'bg-pink-100 text-pink-800 border-pink-200',
      user: 'bg-slate-100 text-slate-800 border-slate-200',
      limited_user: 'bg-gray-100 text-gray-700 border-gray-200'
    };
    return colors[role] || colors.user;
  };

  const getRoleDisplayName = (role) => {
    const names = {
      system_admin: t('system_admin'),
      admin: t('administrator'),
      manager: t('manager'),
      finance_manager: t('finance_manager'),
      sales_manager: t('sales_manager'),
      inventory_manager: t('inventory_manager'),
      hr_manager: t('hr_manager'),
      user: t('user'),
      limited_user: t('limited_user'),
      owner: t('owner')
    };
    return names[role] || role;
  };

  const getPlanDisplayName = (plan) => {
    const names = {
      free: t('free'),
      free_trial: t('free_trial'),
      basic: t('plan_basic'),
      starter: t('plan_starter'),
      professional: t('plan_professional'),
      enterprise: t('plan_enterprise')
    };
    return names[plan] || plan;
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      trial: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      active: 'bg-green-100 text-green-800 border-green-200',
      expired: 'bg-red-100 text-red-800 border-red-200',
      blocked: 'bg-gray-100 text-gray-800 border-gray-200',
      cancelled: 'bg-orange-100 text-orange-800 border-orange-200'
    };
    return colors[status] || colors.trial;
  };

  const getPlanBadgeColor = (plan) => {
    const colors = {
      free_trial: 'bg-slate-100 text-slate-700 border-slate-200',
      basic: 'bg-blue-100 text-blue-700 border-blue-200',
      professional: 'bg-indigo-100 text-indigo-700 border-indigo-200',
      enterprise: 'bg-purple-100 text-purple-700 border-purple-200'
    };
    return colors[plan] || colors.free_trial;
  };

  const getSubscriptionInfo = (user) => {
    const endDate = user.trial_end_date || user.subscription_end_date;
    if (!endDate) return { daysRemaining: null, isExpiring: false };
    
    try {
      const daysRemaining = differenceInDays(parseISO(endDate), new Date());
      const isExpiring = daysRemaining <= 7 && daysRemaining > 0;
      
      return { daysRemaining, isExpiring };
    } catch (error) {
      return { daysRemaining: null, isExpiring: false };
    }
  };

  const metrics = {
    totalUsers: users.length,
    adminUsers: users.filter(u => u.role === 'admin' || u.role === 'system_admin').length,
    activeUsers: users.filter(u => (u.subscription_status || 'trial') === 'active').length,
    trialUsers: users.filter(u => (u.subscription_status || 'trial') === 'trial').length,
    blockedUsers: users.filter(u => u.is_blocked === true).length,
    enterpriseUsers: users.filter(u => u.subscription_plan === 'enterprise').length,
    expiringTrials: users.filter(u => {
      if ((u.subscription_status || 'trial') !== 'trial' || !u.trial_end_date) return false;
      try {
        const days = differenceInDays(parseISO(u.trial_end_date), new Date());
        return days <= 7 && days >= 0;
      } catch {
        return false;
      }
    }).length
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 md:p-8 rounded-2xl text-white shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-8 h-8" />
            <h1 className="text-2xl md:text-3xl font-bold">{t('admin_panel')}</h1>
            <Badge className="bg-white/20 text-white border-white/30">
              {t('enterprise_edition')}
            </Badge>
          </div>
        </div>

        {/* Metrics - Enhanced */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{metrics.totalUsers}</p>
              <p className="text-xs text-slate-600">{t('total_users')}</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{metrics.activeUsers}</p>
              <p className="text-xs text-slate-600">{t('active_users')}</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{metrics.trialUsers}</p>
              <p className="text-xs text-slate-600">{t('on_trial')}</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <CreditCard className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{metrics.enterpriseUsers}</p>
              <p className="text-xs text-slate-600">{t('enterprise')}</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <AlertCircle className="w-5 h-5 text-orange-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{metrics.expiringTrials}</p>
              <p className="text-xs text-slate-600">{t('expiring_soon')}</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Ban className="w-5 h-5 text-red-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{metrics.blockedUsers}</p>
              <p className="text-xs text-slate-600">{t('blocked')}</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Shield className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{metrics.adminUsers}</p>
              <p className="text-xs text-slate-600">{t('admins')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="w-full bg-white/80 backdrop-blur-sm p-1.5 rounded-xl border border-slate-200/60 shadow-lg flex flex-wrap justify-start gap-1 h-auto">
            <TabsTrigger value="users" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <Briefcase className="w-4 h-4" />
              <span>{language === 'uz' ? 'Kompaniyalar' : language === 'ru' ? 'Компании' : 'Companies'}</span>
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <span>{t('subscriptions')}</span>
            </TabsTrigger>
            <TabsTrigger value="roles" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <span>{t('roles')}</span>
            </TabsTrigger>
            <TabsTrigger value="permissions" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">{t('permissions')}</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <span>{t('settings')}</span>
            </TabsTrigger>
          </TabsList>

          {/* Users Tab - Enhanced */}
          <TabsContent value="users" className="mt-6">
            {/* Dashboard Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100"><Briefcase className="w-5 h-5 text-blue-600" /></div>
                    <div>
                      <p className="text-2xl font-bold">{tenants.length}</p>
                      <p className="text-xs text-slate-500">{language === 'uz' ? 'Jami kompaniyalar' : 'Total Companies'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100"><CheckCircle className="w-5 h-5 text-green-600" /></div>
                    <div>
                      <p className="text-2xl font-bold">{tenants.filter(t => t.subscription_status === 'active').length}</p>
                      <p className="text-xs text-slate-500">{language === 'uz' ? 'Faol obunalar' : 'Active Subscriptions'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-100"><Clock className="w-5 h-5 text-amber-600" /></div>
                    <div>
                      <p className="text-2xl font-bold">{tenants.filter(t => t.subscription_status === 'trialing').length}</p>
                      <p className="text-xs text-slate-500">{language === 'uz' ? 'Sinov muddatida' : 'Trialing'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-100"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
                    <div>
                      <p className="text-2xl font-bold">{tenants.filter(t => ['past_due', 'expired'].includes(t.subscription_status)).length}</p>
                      <p className="text-xs text-slate-500">{language === 'uz' ? 'Muddati tugagan' : 'Expired/Past Due'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white/80 backdrop-blur-sm">
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <CardTitle>{language === 'uz' ? 'Kompaniyalarni boshqarish' : 'Company Management'}</CardTitle>
                </div>
                <div className="flex gap-3 mt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder={language === 'uz' ? 'Kompaniyalarni qidirish...' : 'Search companies...'}
                      value={tenantSearch}
                      onChange={(e) => setTenantSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={tenantStatusFilter} onValueChange={setTenantStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{language === 'uz' ? 'Barcha holatlar' : 'All Status'}</SelectItem>
                      <SelectItem value="active">{language === 'uz' ? 'Faol' : 'Active'}</SelectItem>
                      <SelectItem value="trialing">{language === 'uz' ? 'Sinov' : 'Trial'}</SelectItem>
                      <SelectItem value="past_due">{language === 'uz' ? 'To\'lov kutilmoqda' : 'Past Due'}</SelectItem>
                      <SelectItem value="expired">{language === 'uz' ? 'Muddati tugagan' : 'Expired'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>{language === 'uz' ? 'Kompaniya' : 'Company'}</TableHead>
                          <TableHead>{language === 'uz' ? 'Egasi' : 'Owner'}</TableHead>
                          <TableHead>{language === 'uz' ? 'Foydalanuvchilar' : 'Users'}</TableHead>
                          <TableHead>{language === 'uz' ? 'Holat' : 'Status'}</TableHead>
                          <TableHead>{language === 'uz' ? 'Ro\'yxatdan o\'tgan' : 'Registered'}</TableHead>
                          <TableHead>{language === 'uz' ? 'Amallar' : 'Actions'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTenants.map((tenant) => {
                          const statusColors = {
                            active: 'bg-green-100 text-green-800',
                            trialing: 'bg-amber-100 text-amber-800',
                            past_due: 'bg-orange-100 text-orange-800',
                            expired: 'bg-red-100 text-red-800',
                            cancelled: 'bg-slate-100 text-slate-800',
                          };
                          const statusLabels = {
                            active: language === 'uz' ? 'Faol' : 'Active',
                            trialing: language === 'uz' ? 'Sinov' : 'Trial',
                            past_due: language === 'uz' ? 'To\'lov kutilmoqda' : 'Past Due',
                            expired: language === 'uz' ? 'Muddati tugagan' : 'Expired',
                            cancelled: language === 'uz' ? 'Bekor qilingan' : 'Cancelled',
                          };
                          return (
                            <TableRow key={tenant.id} className={`hover:bg-slate-50 ${!tenant.is_active ? 'opacity-60' : ''}`}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                                    {tenant.name?.charAt(0) || 'C'}
                                  </div>
                                  <div>
                                    <p className="font-medium">{tenant.name}</p>
                                    <p className="text-xs text-slate-500">{tenant.code}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <p className="text-sm font-medium">{tenant.owner_name || '-'}</p>
                                {tenant.owner_email && (
                                  <p className="text-xs text-slate-500">{tenant.owner_email}</p>
                                )}
                                {tenant.owner_phone && (
                                  <p className="text-xs text-slate-500">{tenant.owner_phone}</p>
                                )}
                                {!tenant.owner_email && !tenant.owner_phone && (
                                  <p className="text-xs text-slate-400">-</p>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Users className="w-4 h-4 text-slate-400" />
                                  <span className="font-medium">{tenant.user_count}</span>
                                  {tenant.paid_users > 0 && (
                                    <span className="text-xs text-slate-400">/ {tenant.paid_users} {language === 'uz' ? 'pullik' : 'paid'}</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  let status = tenant.subscription_status;
                                  let daysLeft = null;
                                  // Check if trial actually expired
                                  if (status === 'trialing' && tenant.trial_ends_at) {
                                    daysLeft = differenceInDays(new Date(tenant.trial_ends_at), new Date());
                                    if (daysLeft < 0) status = 'expired';
                                  }
                                  if (status === 'active' && tenant.account_clear_at) {
                                    daysLeft = differenceInDays(new Date(tenant.account_clear_at), new Date());
                                    if (daysLeft < 0) status = 'expired';
                                  }
                                  return (
                                    <>
                                      <Badge className={statusColors[status] || 'bg-slate-100 text-slate-600'}>
                                        {statusLabels[status] || status}
                                      </Badge>
                                      {daysLeft !== null && (
                                        <p className={`text-xs mt-1 ${daysLeft < 0 ? 'text-red-500' : daysLeft < 7 ? 'text-orange-500' : 'text-slate-500'}`}>
                                          {daysLeft > 0
                                            ? `${daysLeft} ${language === 'uz' ? 'kun qoldi' : 'days left'}`
                                            : `${Math.abs(daysLeft)} ${language === 'uz' ? 'kun oldin tugagan' : 'days ago'}`}
                                        </p>
                                      )}
                                    </>
                                  );
                                })()}
                              </TableCell>
                              <TableCell>
                                <p className="text-sm">{format(new Date(tenant.created_at), 'dd.MM.yyyy')}</p>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openTenantDetails(tenant)}
                                    className="text-blue-600 hover:text-blue-700"
                                    title={language === 'uz' ? 'Batafsil' : 'Details'}
                                  >
                                    <Eye className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedTenant(tenant);
                                      setCheckoutData({ users: tenant.user_count || 1, billing: 'monthly' });
                                      setCheckoutUrl(null);
                                      setShowSubscriptionModal(true);
                                    }}
                                    className="text-purple-600 hover:text-purple-700"
                                    title={language === 'uz' ? 'Obuna faollashtirish' : 'Activate Subscription'}
                                  >
                                    <CreditCard className="w-3 h-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subscriptions Tab */}
          <TabsContent value="subscriptions" className="mt-6">
            <div className="space-y-6">
              {/* Expiring Trials Alert */}
              {metrics.expiringTrials > 0 && (
                <Card className="bg-orange-50 border-orange-200">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <AlertCircle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-orange-900 mb-2">
                          {metrics.expiringTrials} Trial{metrics.expiringTrials > 1 ? 's' : ''} Expiring Soon
                        </h3>
                        <p className="text-sm text-orange-800 mb-4">
                          The following users have trials expiring within 7 days. Consider extending their trial or converting them to paid subscriptions.
                        </p>
                        <div className="space-y-2">
                          {users.filter(u => {
                            if ((u.subscription_status || 'trial') !== 'trial' || !u.trial_end_date) return false;
                            try {
                              const days = differenceInDays(parseISO(u.trial_end_date), new Date());
                              return days <= 7 && days >= 0;
                            } catch {
                              return false;
                            }
                          }).map(user => (
                            <div key={user.id} className="flex items-center justify-between bg-white p-3 rounded-lg">
                              <div>
                                <p className="font-medium text-slate-900">{user.full_name}</p>
                                <p className="text-sm text-slate-600">{user.email}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="text-sm font-semibold text-orange-600">
                                    {differenceInDays(parseISO(user.trial_end_date), new Date())} days left
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    Expires {format(parseISO(user.trial_end_date), 'MMM dd')}
                                  </p>
                                </div>
                                <Button 
                                  size="sm"
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setShowExtendTrialModal(true);
                                  }}
                                >
                                  <Gift className="w-3 h-3 mr-1" />
                                  Extend
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Subscription Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t('free_trial_users')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-yellow-600">{metrics.trialUsers}</p>
                    <p className="text-sm text-slate-600 mt-1">{t('14_day_trial_period')}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t('active_subscriptions')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-green-600">{metrics.activeUsers}</p>
                    <p className="text-sm text-slate-600 mt-1">{t('paid_users')}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t('expired_cancelled')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-red-600">
                      {users.filter(u => ['expired', 'cancelled'].includes(u.subscription_status || 'trial')).length}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">{t('inactive_users')}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t('blocked_users')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-gray-600">{metrics.blockedUsers}</p>
                    <p className="text-sm text-slate-600 mt-1">{t('access_suspended')}</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Roles & Permissions Tab - Enhanced */}
          <TabsContent value="roles" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* System Administrator */}
              <Card className="bg-white/80 backdrop-blur-sm border-red-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Shield className="w-5 h-5 text-red-600" />
                    {t('role_system_administrator')}
                  </CardTitle>
                  <p className="text-xs text-slate-500">{t('role_sysadmin_desc')}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_complete_system_access')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_server_infrastructure')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_database_admin')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_user_role_management')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_security_audit')}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Administrator */}
              <Card className="bg-white/80 backdrop-blur-sm border-purple-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Shield className="w-5 h-5 text-purple-600" />
                    {t('role_administrator')}
                  </CardTitle>
                  <p className="text-xs text-slate-500">{t('role_admin_desc')}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_user_management_invitations')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_subscription_billing')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_all_module_access')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_report_generation')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_workflow_configuration')}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Manager */}
              <Card className="bg-white/80 backdrop-blur-sm border-indigo-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="w-5 h-5 text-indigo-600" />
                    {t('role_manager')}
                  </CardTitle>
                  <p className="text-xs text-slate-500">{t('role_manager_desc')}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_multi_module_access')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_team_oversight')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_approval_workflows')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_analytics_reports')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-3 h-3 text-red-600" />
                    <span className="text-xs">{t('perm_no_user_management')}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Finance Manager */}
              <Card className="bg-white/80 backdrop-blur-sm border-emerald-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                    {t('role_finance_manager')}
                  </CardTitle>
                  <p className="text-xs text-slate-500">{t('role_finance_manager_desc')}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_full_finance_access')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_gl_ap_ar_management')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_financial_reporting')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_budget_forecast')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-3 h-3 text-red-600" />
                    <span className="text-xs">{t('perm_no_inventory_sales')}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Sales Manager */}
              <Card className="bg-white/80 backdrop-blur-sm border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="w-5 h-5 text-blue-600" />
                    {t('role_sales_manager')}
                  </CardTitle>
                  <p className="text-xs text-slate-500">{t('role_sales_manager_desc')}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_full_crm_access')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_sales_orders_quotes')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_customer_management')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_sales_analytics')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-3 h-3 text-red-600" />
                    <span className="text-xs">{t('perm_no_finance_hr')}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Inventory Manager */}
              <Card className="bg-white/80 backdrop-blur-sm border-orange-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="w-5 h-5 text-orange-600" />
                    {t('role_inventory_manager')}
                  </CardTitle>
                  <p className="text-xs text-slate-500">{t('role_inventory_manager_desc')}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_full_inventory_access')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_stock_movements')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_procurement_management')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_supplier_coordination')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-3 h-3 text-red-600" />
                    <span className="text-xs">{t('perm_no_finance_hr')}</span>
                  </div>
                </CardContent>
              </Card>

              {/* HR Manager */}
              <Card className="bg-white/80 backdrop-blur-sm border-pink-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Briefcase className="w-5 h-5 text-pink-600" />
                    {t('role_hr_manager')}
                  </CardTitle>
                  <p className="text-xs text-slate-500">{t('role_hr_manager_desc')}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_full_hr_access')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_employee_management')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_payroll_processing')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_recruitment_onboarding')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-3 h-3 text-red-600" />
                    <span className="text-xs">{t('perm_no_sales_inventory')}</span>
                  </div>
                </CardContent>
              </Card>

              {/* User */}
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="w-5 h-5 text-slate-600" />
                    {t('role_user')}
                  </CardTitle>
                  <p className="text-xs text-slate-500">{t('role_user_desc')}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_assigned_module_access')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_create_edit_records')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_view_own_data')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-3 h-3 text-red-600" />
                    <span className="text-xs">{t('perm_no_admin_functions')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-3 h-3 text-red-600" />
                    <span className="text-xs">{t('perm_no_user_management')}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Limited User */}
              <Card className="bg-white/80 backdrop-blur-sm border-gray-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="w-5 h-5 text-gray-600" />
                    {t('role_limited_user')}
                  </CardTitle>
                  <p className="text-xs text-slate-500">{t('role_limited_user_desc')}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_view_only_access')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">{t('perm_basic_reports_viewing')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-3 h-3 text-red-600" />
                    <span className="text-xs">{t('perm_cannot_create_records')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-3 h-3 text-red-600" />
                    <span className="text-xs">{t('perm_cannot_edit_data')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-3 h-3 text-red-600" />
                    <span className="text-xs">{t('perm_no_admin_access')}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* NEW: Permissions Management Tab */}
          <TabsContent value="permissions" className="mt-6">
            <PermissionsManagement />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-6">
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>{t('system_settings')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-3">{t('trial_configuration')}</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium">{t('default_trial_period')}</p>
                        <p className="text-sm text-slate-500">{t('for_new_user_invitations')}</p>
                      </div>
                      <Badge>{t('14_days')}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium">{t('trial_extension_available')}</p>
                        <p className="text-sm text-slate-500">{t('admin_can_extend_trials')}</p>
                      </div>
                      <Badge className="bg-green-100 text-green-800">{t('yes')}</Badge>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">{t('security')}</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium">{t('user_blocking')}</p>
                        <p className="text-sm text-slate-500">{t('suspend_user_access_temporarily')}</p>
                      </div>
                      <Badge className="bg-green-100 text-green-800">{t('enabled')}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium">{t('user_deletion')}</p>
                        <p className="text-sm text-slate-500">{t('permanently_remove_users')}</p>
                      </div>
                      <Badge className="bg-green-100 text-green-800">{t('enabled')}</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modals */}
        
        {/* Invite User Modal */}
        <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                {t('invite_new_user')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>📧 {t('14_day_free_trial')}:</strong> {t('new_users_trial_info')}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">{t('full_name')} *</label>
                <Input
                  placeholder={t('full_name_placeholder')}
                  value={inviteData.full_name}
                  onChange={(e) => setInviteData({...inviteData, full_name: e.target.value})}
                  disabled={isSendingInvite}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">{t('email_address')} *</label>
                <Input
                  type="email"
                  placeholder={t('email_placeholder')}
                  value={inviteData.email}
                  onChange={(e) => setInviteData({...inviteData, email: e.target.value})}
                  disabled={isSendingInvite}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">{t('role')} *</label>
                <Select
                  value={inviteData.role}
                  onValueChange={(value) => setInviteData({...inviteData, role: value})}
                  disabled={isSendingInvite}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system_admin">{t('role_system_administrator')}</SelectItem>
                    <SelectItem value="admin">{t('role_administrator')}</SelectItem>
                    <SelectItem value="manager">{t('role_manager')}</SelectItem>
                    <SelectItem value="finance_manager">{t('role_finance_manager')}</SelectItem>
                    <SelectItem value="sales_manager">{t('role_sales_manager')}</SelectItem>
                    <SelectItem value="inventory_manager">{t('role_inventory_manager')}</SelectItem>
                    <SelectItem value="hr_manager">{t('role_hr_manager')}</SelectItem>
                    <SelectItem value="user">{t('role_user')}</SelectItem>
                    <SelectItem value="limited_user">{t('role_limited_user')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1"
                  disabled={isSendingInvite}
                >
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handleInviteUser}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600"
                  disabled={!inviteData.email || !inviteData.full_name || isSendingInvite}
                >
                  {isSendingInvite ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      {t('sending')}...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      {t('send_invitation')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete User Modal */}
        <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="w-5 h-5" />
                {t('delete_user')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-900 mb-1">{t('warning_cannot_be_undone')}</p>
                    <p className="text-sm text-red-800">
                      {t('deleting_user_will_remove')}:
                    </p>
                    <ul className="text-sm text-red-800 mt-2 ml-4 list-disc">
                      <li>{t('user_account_login_access')}</li>
                      <li>{t('all_associated_data_records')}</li>
                      <li>{t('subscription_billing_history')}</li>
                    </ul>
                  </div>
                </div>
              </div>

              {selectedUser && (
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm font-medium mb-2">{t('user_to_be_deleted')}:</p>
                  <p className="font-semibold">{selectedUser.full_name}</p>
                  <p className="text-sm text-slate-600">{selectedUser.email}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedUser(null);
                  }}
                  className="flex-1"
                >
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handleDeleteUser}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t('delete_user')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Block/Unblock User Modal */}
        <Dialog open={showBlockModal} onOpenChange={setShowBlockModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedUser?.is_blocked ? (
                  <>
                    <UserCheck className="w-5 h-5 text-green-600" />
                    {t('unblock_user')}
                  </>
                ) : (
                  <>
                    <Ban className="w-5 h-5 text-orange-600" />
                    {t('block_user')}
                  </>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedUser && (
                <>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="font-semibold">{selectedUser.full_name}</p>
                    <p className="text-sm text-slate-600">{selectedUser.email}</p>
                    {selectedUser.is_blocked && selectedUser.blocked_reason && (
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-xs text-slate-500">{t('currently_blocked')}:</p>
                        <p className="text-sm text-slate-700">{selectedUser.blocked_reason}</p>
                      </div>
                    )}
                  </div>

                  {!selectedUser.is_blocked && (
                    <>
                      <div>
                        <label className="text-sm font-medium mb-1 block">{t('reason_for_blocking')} *</label>
                        <Textarea
                          placeholder={t('blocking_reason_placeholder')}
                          value={blockData.reason}
                          onChange={(e) => setBlockData({...blockData, reason: e.target.value})}
                          rows={3}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="notify_user"
                          checked={blockData.notify_user}
                          onChange={(e) => setBlockData({...blockData, notify_user: e.target.checked})}
                          className="w-4 h-4"
                        />
                        <label htmlFor="notify_user" className="text-sm">
                          {t('send_notification_email')}
                        </label>
                      </div>

                      <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <p className="text-sm text-orange-800">
                          <strong>{t('note')}:</strong> {t('blocked_users_note')}
                        </p>
                      </div>
                    </>
                  )}

                  {selectedUser.is_blocked && (
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm text-green-800">
                        <strong>{t('unblocking')}:</strong> {t('unblocking_note')}
                      </p>
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowBlockModal(false);
                    setSelectedUser(null);
                    setBlockData({ reason: '', notify_user: true });
                  }}
                  className="flex-1"
                >
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handleBlockUser}
                  className={`flex-1 ${selectedUser?.is_blocked ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                  disabled={!selectedUser?.is_blocked && !blockData.reason}
                >
                  {selectedUser?.is_blocked ? (
                    <>
                      <UserCheck className="w-4 h-4 mr-2" />
                      {t('unblock_user')}
                    </>
                  ) : (
                    <>
                      <Ban className="w-4 h-4 mr-2" />
                      {t('block_user')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Company Subscription Modal (Multicard Pricing) */}
        <Dialog open={showSubscriptionModal} onOpenChange={setShowSubscriptionModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                {language === 'uz' ? 'Obunani faollashtirish' : 'Activate Subscription'}
              </DialogTitle>
            </DialogHeader>
            {selectedTenant && (
              <div className="space-y-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="font-medium">{selectedTenant.name}</p>
                  <p className="text-sm text-slate-500">{selectedTenant.owner_email}</p>
                  <Badge className="mt-1">{selectedTenant.subscription_status}</Badge>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">{language === 'uz' ? 'Foydalanuvchilar soni' : 'Number of Users'}</label>
                    <Input
                      type="number"
                      min="1"
                      value={checkoutData.users}
                      onChange={(e) => setCheckoutData(prev => ({ ...prev, users: parseInt(e.target.value) || 1 }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{language === 'uz' ? 'Muddat' : 'Duration'}</label>
                    <Select value={checkoutData.billing} onValueChange={(v) => setCheckoutData(prev => ({ ...prev, billing: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">{language === 'uz' ? '1 oy' : '1 Month'}</SelectItem>
                        <SelectItem value="3months">{language === 'uz' ? '3 oy' : '3 Months'}</SelectItem>
                        <SelectItem value="6months">{language === 'uz' ? '6 oy' : '6 Months'}</SelectItem>
                        <SelectItem value="yearly">{language === 'uz' ? '12 oy (1 yil)' : '12 Months (1 Year)'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="p-4 bg-purple-50 rounded-lg space-y-2">
                  {(() => {
                    const monthsMap = { monthly: 1, '3months': 3, '6months': 6, yearly: 12 };
                    const months = monthsMap[checkoutData.billing] || 1;
                    const pricePerUser = checkoutData.billing === 'yearly'
                      ? (pricing.price_per_user_yearly || 0)
                      : (pricing.price_per_user_monthly || 0);
                    const total = pricePerUser * months * checkoutData.users;
                    return (
                      <>
                        <div className="flex justify-between text-sm">
                          <span>{language === 'uz' ? 'Narx (1 foydalanuvchi/oy)' : 'Price per user/month'}</span>
                          <span className="font-medium">{pricePerUser.toLocaleString()} so'm</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>{language === 'uz' ? 'Foydalanuvchilar' : 'Users'}</span>
                          <span>x {checkoutData.users}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>{language === 'uz' ? 'Muddat' : 'Duration'}</span>
                          <span>x {months} {language === 'uz' ? 'oy' : 'months'}</span>
                        </div>
                        <div className="border-t pt-2 flex justify-between font-bold text-lg">
                          <span>{language === 'uz' ? 'Jami' : 'Total'}</span>
                          <span className="text-purple-700">{total.toLocaleString()} so'm</span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {checkoutUrl && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-medium text-green-800 mb-1">{language === 'uz' ? 'To\'lov havolasi tayyor!' : 'Payment link ready!'}</p>
                    <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline break-all">
                      {checkoutUrl}
                    </a>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <Button
                    onClick={async () => {
                      setCheckoutLoading(true);
                      try {
                        // Manual activation: set tenant as active with paid_users and duration
                        const monthsMap = { monthly: 1, '3months': 3, '6months': 6, yearly: 12 };
                        const months = monthsMap[checkoutData.billing] || 1;
                        await apiClient.put(`/admin/tenants/${selectedTenant.id}/activate`, {
                          paid_users: checkoutData.users,
                          months: months,
                        });
                        toast({ title: language === 'uz' ? 'Obuna faollashtirildi!' : 'Subscription activated!' });
                        setShowSubscriptionModal(false);
                        loadData();
                      } catch (err) {
                        toast({ title: err.response?.data?.error?.message || 'Error', variant: 'destructive' });
                      }
                      setCheckoutLoading(false);
                    }}
                    disabled={checkoutLoading || checkoutData.users < 1}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {language === 'uz' ? 'Qo\'lda faollashtirish (naqd to\'lov)' : 'Manual Activate (cash payment)'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      setCheckoutLoading(true);
                      try {
                        const resp = await apiClient.post('/subscription/checkout', {
                          users: checkoutData.users,
                          billing: checkoutData.billing,
                        }, {
                          headers: { 'X-Tenant-ID': selectedTenant.id }
                        });
                        const url = resp.data?.data?.checkout_url;
                        if (url) {
                          setCheckoutUrl(url);
                        } else {
                          toast({ title: 'Failed to create checkout', variant: 'destructive' });
                        }
                      } catch (err) {
                        toast({ title: err.response?.data?.error?.message || 'Error', variant: 'destructive' });
                      }
                      setCheckoutLoading(false);
                    }}
                    disabled={checkoutLoading || checkoutData.users < 1}
                    className="w-full"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    {language === 'uz' ? 'To\'lov havolasini yaratish (Multicard)' : 'Generate Payment Link (Multicard)'}
                  </Button>
                  <Button variant="ghost" onClick={() => setShowSubscriptionModal(false)} className="w-full text-slate-500">
                    {language === 'uz' ? 'Bekor qilish' : 'Cancel'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Tenant Details Modal */}
        <Dialog open={showTenantDetailsModal} onOpenChange={setShowTenantDetailsModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                {language === 'uz' ? 'Kompaniya tafsilotlari' : language === 'ru' ? 'Детали компании' : 'Company details'}
                {selectedTenant && <Badge variant="outline" className="ml-2">{selectedTenant.name}</Badge>}
              </DialogTitle>
            </DialogHeader>

            {tenantDetailsLoading ? (
              <div className="py-12 text-center text-slate-500">
                {language === 'uz' ? 'Yuklanmoqda...' : 'Loading...'}
              </div>
            ) : tenantDetails ? (
              <div className="space-y-5 py-2">
                {/* Tenant overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-slate-500">{language === 'uz' ? 'Kod' : 'Code'}</p>
                    <p className="font-semibold text-sm">{tenantDetails.tenant?.code}</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <p className="text-xs text-slate-500">{language === 'uz' ? 'Reja' : 'Plan'}</p>
                    <p className="font-semibold text-sm">{formatPlan(tenantDetails.tenant?.subscription_plan)}</p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-lg">
                    <p className="text-xs text-slate-500">{language === 'uz' ? 'Holat' : 'Status'}</p>
                    <p className="font-semibold text-sm">{formatTenantStatus(tenantDetails.tenant?.subscription_status)}</p>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg">
                    <p className="text-xs text-slate-500">{language === 'uz' ? 'Pullik foydalanuvchilar' : 'Paid users'}</p>
                    <p className="font-semibold text-sm">{tenantDetails.tenant?.paid_users || 0}</p>
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 border rounded-lg">
                    <p className="text-xs text-slate-500">{language === 'uz' ? "Ro'yxatdan o'tgan" : 'Registered'}</p>
                    <p className="text-sm font-medium">{tenantDetails.tenant?.created_at ? format(new Date(tenantDetails.tenant.created_at), 'dd.MM.yyyy') : '-'}</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="text-xs text-slate-500">{language === 'uz' ? 'Trial tugaydi' : 'Trial ends'}</p>
                    <p className="text-sm font-medium">{tenantDetails.tenant?.trial_ends_at ? format(new Date(tenantDetails.tenant.trial_ends_at), 'dd.MM.yyyy') : '-'}</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="text-xs text-slate-500">{language === 'uz' ? 'Hisob tugaydi' : 'Account expires'}</p>
                    <p className="text-sm font-medium">
                      {tenantDetails.tenant?.account_clear_at ? format(new Date(tenantDetails.tenant.account_clear_at), 'dd.MM.yyyy') : '-'}
                      {tenantDetails.tenant?.account_clear_at && (() => {
                        const days = differenceInDays(new Date(tenantDetails.tenant.account_clear_at), new Date());
                        return <span className={`ml-2 text-xs ${days < 0 ? 'text-red-500' : days < 7 ? 'text-orange-500' : 'text-slate-400'}`}>
                          ({days >= 0 ? `${days} ${language === 'uz' ? 'kun qoldi' : 'days left'}` : `${Math.abs(days)} ${language === 'uz' ? 'kun oldin tugagan' : 'days ago'}`})
                        </span>;
                      })()}
                    </p>
                  </div>
                </div>

                {/* Counts strip */}
                <div className="flex gap-3">
                  <div className="flex-1 p-3 bg-slate-50 rounded-lg flex items-center gap-3">
                    <Users className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="text-xs text-slate-500">{language === 'uz' ? 'Foydalanuvchilar' : 'Users'}</p>
                      <p className="font-bold">{tenantDetails.user_count || 0}</p>
                    </div>
                  </div>
                  <div className="flex-1 p-3 bg-slate-50 rounded-lg flex items-center gap-3">
                    <Briefcase className="w-5 h-5 text-purple-500" />
                    <div>
                      <p className="text-xs text-slate-500">{language === 'uz' ? 'Xodimlar' : 'Employees'}</p>
                      <p className="font-bold">{tenantDetails.employee_count || 0}</p>
                    </div>
                  </div>
                  <div className="flex-1 p-3 bg-slate-50 rounded-lg flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-emerald-500" />
                    <div>
                      <p className="text-xs text-slate-500">{language === 'uz' ? 'Kompaniyalar' : 'Companies'}</p>
                      <p className="font-bold">{tenantDetails.org_count || 0}</p>
                    </div>
                  </div>
                </div>

                {/* Organizations */}
                {tenantDetails.organizations?.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Building2 className="w-4 h-4" /> {language === 'uz' ? 'Kompaniyalar' : 'Companies'}
                    </p>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="text-xs">{language === 'uz' ? 'Nomi' : 'Name'}</TableHead>
                            <TableHead className="text-xs">{language === 'uz' ? 'Kod' : 'Code'}</TableHead>
                            <TableHead className="text-xs">{language === 'uz' ? 'Valyuta' : 'Currency'}</TableHead>
                            <TableHead className="text-xs">{language === 'uz' ? 'Faol' : 'Active'}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tenantDetails.organizations.map(o => (
                            <TableRow key={o.id}>
                              <TableCell className="text-sm font-medium">{o.name}</TableCell>
                              <TableCell className="text-xs text-slate-500">{o.code}</TableCell>
                              <TableCell className="text-xs">{o.currency}</TableCell>
                              <TableCell>
                                {o.is_active
                                  ? <Badge className="bg-green-100 text-green-700 text-xs">✓</Badge>
                                  : <Badge className="bg-slate-100 text-slate-500 text-xs">×</Badge>}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Users */}
                <div>
                  <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4" /> {language === 'uz' ? 'Foydalanuvchilar' : 'Users'} ({tenantDetails.users?.length || 0})
                  </p>
                  <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="text-xs">{language === 'uz' ? 'F.I.O' : 'Name'}</TableHead>
                          <TableHead className="text-xs">{language === 'uz' ? 'Aloqa' : 'Contact'}</TableHead>
                          <TableHead className="text-xs">{language === 'uz' ? 'Rol' : 'Role'}</TableHead>
                          <TableHead className="text-xs">{language === 'uz' ? "So'nggi kirish" : 'Last login'}</TableHead>
                          <TableHead className="text-xs">{language === 'uz' ? 'Holat' : 'Status'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(tenantDetails.users || []).map(u => (
                          <TableRow key={u.id}>
                            <TableCell className="text-sm font-medium">{`${u.first_name} ${u.last_name}`.trim() || '-'}</TableCell>
                            <TableCell className="text-xs">
                              {u.email && <div className="text-slate-600">{u.email}</div>}
                              {u.phone && <div className="text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" />{u.phone}</div>}
                            </TableCell>
                            <TableCell className="text-xs text-slate-500">{u.role_name || '-'}</TableCell>
                            <TableCell className="text-xs text-slate-500">{u.last_login ? format(new Date(u.last_login), 'dd.MM.yyyy HH:mm') : '-'}</TableCell>
                            <TableCell>
                              {u.is_active
                                ? <Badge className="bg-green-100 text-green-700 text-xs">{language === 'uz' ? 'Faol' : 'Active'}</Badge>
                                : <Badge className="bg-slate-100 text-slate-500 text-xs">{language === 'uz' ? 'Nofaol' : 'Inactive'}</Badge>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Payment history */}
                <div>
                  <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Receipt className="w-4 h-4" /> {language === 'uz' ? "To'lovlar tarixi" : 'Payment history'} ({tenantDetails.payments?.length || 0})
                  </p>
                  {(tenantDetails.payments || []).length === 0 ? (
                    <div className="text-center py-6 bg-slate-50 rounded-lg text-sm text-slate-500">
                      {language === 'uz' ? "To'lovlar yo'q" : 'No payments yet'}
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden max-h-[260px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="text-xs">{language === 'uz' ? 'Sana' : 'Date'}</TableHead>
                            <TableHead className="text-xs">{language === 'uz' ? 'Reja' : 'Plan'}</TableHead>
                            <TableHead className="text-xs text-right">{language === 'uz' ? 'Summa' : 'Amount'}</TableHead>
                            <TableHead className="text-xs">{language === 'uz' ? 'Karta' : 'Card'}</TableHead>
                            <TableHead className="text-xs">{language === 'uz' ? 'Holat' : 'Status'}</TableHead>
                            <TableHead className="text-xs">Receipt</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tenantDetails.payments.map(p => (
                            <TableRow key={p.id}>
                              <TableCell className="text-xs">{format(new Date(p.created_at), 'dd.MM.yyyy HH:mm')}</TableCell>
                              <TableCell className="text-xs">{formatPlan(p.plan)}</TableCell>
                              <TableCell className="text-xs text-right font-medium">{Number(p.amount_uzs).toLocaleString()} {language === 'uz' ? "so'm" : 'UZS'}</TableCell>
                              <TableCell className="text-xs text-slate-500">
                                {p.card_pan ? `${(p.ps || '').toUpperCase()} ${p.card_pan}` : '-'}
                              </TableCell>
                              <TableCell>
                                <Badge className={`text-xs ${
                                  p.status === 'success' ? 'bg-green-100 text-green-700'
                                  : p.status === 'pending' ? 'bg-amber-100 text-amber-700'
                                  : p.status === 'error' ? 'bg-red-100 text-red-700'
                                  : p.status === 'revert' ? 'bg-orange-100 text-orange-700'
                                  : 'bg-slate-100 text-slate-500'
                                }`}>{formatPaymentStatus(p.status)}</Badge>
                              </TableCell>
                              <TableCell className="text-xs">
                                {p.receipt_url
                                  ? <a href={p.receipt_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{language === 'uz' ? "Ko'rish" : 'View'}</a>
                                  : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        {/* Upgrade Subscription Modal */}
        <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
          <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-purple-600" />
                {t('activate_subscription')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 overflow-y-auto flex-1">
              {selectedUser && (
                <>
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-purple-900 mb-1">{t('admin_privilege')}</p>
                        <p className="text-sm text-purple-800">
                          {t('admin_privilege_desc')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="font-semibold">{selectedUser.full_name}</p>
                    <p className="text-sm text-slate-600">{selectedUser.email}</p>
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs text-slate-500">{t('current_plan')}:</p>
                      <Badge className={getPlanBadgeColor(selectedUser.subscription_plan || 'free_trial')}>
                        {selectedUser.subscription_plan || t('free_trial')}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('subscription_plan')} *</label>
                    <Select
                      value={upgradeData.plan}
                      onValueChange={(value) => setUpgradeData({...upgradeData, plan: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            {t('plan_basic')} - $29/{t('month')}
                          </div>
                        </SelectItem>
                        <SelectItem value="professional">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                            {t('plan_professional')} - $99/{t('month')}
                          </div>
                        </SelectItem>
                        <SelectItem value="enterprise">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                            {t('plan_enterprise')} - $299/{t('month')}
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('subscription_duration')} *</label>
                    <Select
                      value={upgradeData.duration.toString()}
                      onValueChange={(value) => setUpgradeData({...upgradeData, duration: parseInt(value)})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 {t('month')}</SelectItem>
                        <SelectItem value="3">3 {t('months')}</SelectItem>
                        <SelectItem value="6">6 {t('months')}</SelectItem>
                        <SelectItem value="12">12 {t('months')} (1 {t('year')})</SelectItem>
                        <SelectItem value="24">24 {t('months')} (2 {t('years')})</SelectItem>
                        <SelectItem value="36">36 {t('months')} (3 {t('years')})</SelectItem>
                        <SelectItem value="120">{t('lifetime')} (10 {t('years')})</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Plan Features */}
                  <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {t(`plan_${upgradeData.plan}`)} {t('features')}:
                    </p>
                    {upgradeData.plan === 'basic' && (
                      <ul className="text-sm text-slate-600 space-y-1 ml-4 list-disc">
                        <li>{t('up_to_10_users')}</li>
                        <li>{t('core_erp_modules')}</li>
                        <li>{t('email_support')}</li>
                        <li>5GB {t('storage')}</li>
                      </ul>
                    )}
                    {upgradeData.plan === 'professional' && (
                      <ul className="text-sm text-slate-600 space-y-1 ml-4 list-disc">
                        <li>{t('up_to_50_users')}</li>
                        <li>{t('all_erp_modules')}</li>
                        <li>{t('ai_features_enabled')}</li>
                        <li>{t('priority_support')}</li>
                        <li>50GB {t('storage')}</li>
                        <li>{t('custom_reports')}</li>
                      </ul>
                    )}
                    {upgradeData.plan === 'enterprise' && (
                      <ul className="text-sm text-slate-600 space-y-1 ml-4 list-disc">
                        <li>{t('unlimited_users')}</li>
                        <li>{t('all_features_unlocked')}</li>
                        <li>{t('advanced_ai_analytics')}</li>
                        <li>{t('24_7_premium_support')}</li>
                        <li>{t('unlimited_storage')}</li>
                        <li>{t('custom_integrations')}</li>
                        <li>{t('dedicated_account_manager')}</li>
                        <li>{t('sla_guarantees')}</li>
                      </ul>
                    )}
                  </div>

                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-800">
                      <strong>{t('subscription_valid_until')}:</strong> {format(
                        addDays(new Date(), upgradeData.duration * 30),
                        'MMMM dd, yyyy'
                      )}
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowUpgradeModal(false);
                  setSelectedUser(null);
                  setUpgradeData({ plan: 'professional', duration: 12 });
                }}
                className="flex-1"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleUpgradeSubscription}
                className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                {t('activate_now_free')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Extend Trial Modal */}
        <Dialog open={showExtendTrialModal} onOpenChange={setShowExtendTrialModal}>
          <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-yellow-600" />
                {t('extend_free_trial')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 overflow-y-auto flex-1">
              {selectedUser && (
                <>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="font-semibold">{selectedUser.full_name}</p>
                    <p className="text-sm text-slate-600">{selectedUser.email}</p>
                    {selectedUser.trial_end_date && (
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-xs text-slate-500">{t('current_trial_ends')}:</p>
                        <p className="text-sm font-medium">{format(parseISO(selectedUser.trial_end_date), 'MMMM dd, yyyy')}</p>
                        <p className="text-xs text-orange-600">
                          {differenceInDays(parseISO(selectedUser.trial_end_date), new Date())} {t('days_remaining')}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('extension_period')} *</label>
                    <Select
                      value={extendTrialData.days.toString()}
                      onValueChange={(value) => setExtendTrialData({...extendTrialData, days: parseInt(value)})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 {t('days')}</SelectItem>
                        <SelectItem value="14">14 {t('days')} ({t('recommended')})</SelectItem>
                        <SelectItem value="30">30 {t('days')}</SelectItem>
                        <SelectItem value="60">60 {t('days')}</SelectItem>
                        <SelectItem value="90">90 {t('days')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('reason')} ({t('optional')})</label>
                    <Textarea
                      placeholder={t('extend_trial_reason_placeholder')}
                      value={extendTrialData.reason}
                      onChange={(e) => setExtendTrialData({...extendTrialData, reason: e.target.value})}
                      rows={2}
                    />
                  </div>

                  <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-sm text-yellow-800">
                      <strong>{t('new_trial_end_date')}:</strong> {format(
                        addDays(
                          selectedUser.trial_end_date ? parseISO(selectedUser.trial_end_date) : new Date(),
                          extendTrialData.days
                        ),
                        'MMMM dd, yyyy'
                      )}
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowExtendTrialModal(false);
                  setSelectedUser(null);
                  setExtendTrialData({ days: 14, reason: '' });
                }}
                className="flex-1"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleExtendTrial}
                className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
              >
                <Gift className="w-4 h-4 mr-2" />
                {t('extend_trial')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
