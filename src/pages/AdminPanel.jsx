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
  DollarSign, Package, Briefcase, Crown, Sparkles
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

  const [loadError, setLoadError] = useState(null);

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      if (!isSiteAdmin()) {
        navigate('/');
        return;
      }

      // Fetch all system users from the backend API
      const response = await apiClient.get('/admin/users');
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
              <span>{t('users_tab')}</span>
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
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <CardTitle>{t('user_management')}</CardTitle>
                  <Button onClick={() => setShowInviteModal(true)} className="bg-gradient-to-r from-indigo-600 to-purple-600">
                    <Plus className="w-4 h-4 mr-2" /> {t('invite_user')}
                  </Button>
                </div>
                <div className="flex gap-3 mt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder={t('search_users')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-full sm:w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('all_roles')}</SelectItem>
                      <SelectItem value="system_admin">{t('system_admin')}</SelectItem>
                      <SelectItem value="admin">{t('administrator')}</SelectItem>
                      <SelectItem value="manager">{t('manager')}</SelectItem>
                      <SelectItem value="finance_manager">{t('finance_manager')}</SelectItem>
                      <SelectItem value="sales_manager">{t('sales_manager')}</SelectItem>
                      <SelectItem value="inventory_manager">{t('inventory_manager')}</SelectItem>
                      <SelectItem value="hr_manager">{t('hr_manager')}</SelectItem>
                      <SelectItem value="user">{t('user')}</SelectItem>
                      <SelectItem value="limited_user">{t('limited_user')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('all_status')}</SelectItem>
                      <SelectItem value="trial">{t('trial')}</SelectItem>
                      <SelectItem value="active">{t('active')}</SelectItem>
                      <SelectItem value="expired">{t('expired')}</SelectItem>
                      <SelectItem value="blocked">{t('blocked')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : loadError ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="text-red-500 mb-4">
                      <AlertTriangle className="w-12 h-12" />
                    </div>
                    <p className="text-lg font-medium text-slate-900 mb-2">{t('failed_to_load_users')}</p>
                    <p className="text-sm text-red-600 mb-4">{loadError}</p>
                    <Button onClick={loadData} variant="outline">
                      {t('retry')}
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>{t('user_column')}</TableHead>
                          <TableHead>{t('contact')}</TableHead>
                          <TableHead>{t('role_plan')}</TableHead>
                          <TableHead>{t('status')}</TableHead>
                          <TableHead>{t('subscription')}</TableHead>
                          <TableHead>{t('actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((user) => {
                          const subInfo = getSubscriptionInfo(user);
                          const userStatus = user.subscription_status || 'trial';
                          const userPlan = user.subscription_plan || 'free_trial';
                          return (
                            <TableRow key={user.id} className={`hover:bg-slate-50 ${user.is_blocked ? 'opacity-60' : ''}`}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold relative">
                                    {user.full_name?.charAt(0) || 'U'}
                                    {user.is_blocked && (
                                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                                        <Ban className="w-3 h-3 text-white" />
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-medium">{user.full_name}</p>
                                    {user.created_date && (
                                      <p className="text-xs text-slate-500">
                                        {format(new Date(user.created_date), 'MMM dd, yyyy')}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <p className="text-sm">{user.email}</p>
                                {user.phone_number && (
                                  <p className="text-xs text-slate-500">{user.phone_number}</p>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <Badge className={getRoleBadgeColor(user.role)}>
                                    {getRoleDisplayName(user.role)}
                                  </Badge>
                                  {/* Only show plan badge if not on free trial (to avoid duplication with status) */}
                                  {userPlan !== 'free_trial' && (
                                    <Badge className={getPlanBadgeColor(userPlan)}>
                                      {getPlanDisplayName(userPlan)}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={getStatusBadgeColor(userStatus)}>
                                  {userStatus === 'trial' ? t('free_trial') : t(userStatus)}
                                </Badge>
                                {user.is_blocked && (
                                  <Badge className="ml-1 bg-red-100 text-red-800">{t('blocked')}</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {subInfo.daysRemaining !== null ? (
                                  <div className="text-sm">
                                    <p className={subInfo.isExpiring ? 'text-orange-600 font-semibold' : 'text-slate-600'}>
                                      {subInfo.daysRemaining > 0 ? `${subInfo.daysRemaining} ${t('days_left')}` : t('expired')}
                                    </p>
                                    {(user.trial_end_date || user.subscription_end_date) && (
                                      <p className="text-xs text-slate-500">
                                        {t('ends')}: {format(parseISO(user.trial_end_date || user.subscription_end_date), 'MMM dd, yyyy')}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-500">{t('no_expiry')}</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {user.id !== currentUser?.id && (
                                  <div className="flex gap-1">
                                    <Select 
                                      value={user.role} 
                                      onValueChange={(value) => updateUserRole(user.id, value)}
                                    >
                                      <SelectTrigger className="h-8 w-full sm:w-[120px] text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="system_admin">{t('system_admin')}</SelectItem>
                                        <SelectItem value="admin">{t('administrator')}</SelectItem>
                                        <SelectItem value="manager">{t('manager')}</SelectItem>
                                        <SelectItem value="finance_manager">{t('finance_manager')}</SelectItem>
                                        <SelectItem value="sales_manager">{t('sales_manager')}</SelectItem>
                                        <SelectItem value="inventory_manager">{t('inventory_manager')}</SelectItem>
                                        <SelectItem value="hr_manager">{t('hr_manager')}</SelectItem>
                                        <SelectItem value="user">{t('user')}</SelectItem>
                                        <SelectItem value="limited_user">{t('limited_user')}</SelectItem>
                                      </SelectContent>
                                    </Select>

                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => {
                                        setSelectedUser(user);
                                        setShowUpgradeModal(true);
                                      }}
                                      className="text-purple-600 hover:text-purple-700"
                                      title={t('upgrade_plan')}
                                    >
                                      <CreditCard className="w-3 h-3" />
                                    </Button>

                                    {userStatus === 'trial' && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setSelectedUser(user);
                                          setShowExtendTrialModal(true);
                                        }}
                                        title={t('extend_trial')}
                                      >
                                        <Gift className="w-3 h-3" />
                                      </Button>
                                    )}

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setSelectedUser(user);
                                        setShowBlockModal(true);
                                      }}
                                      className={user.is_blocked ? 'text-green-600 hover:text-green-700' : 'text-orange-600 hover:text-orange-700'}
                                      title={user.is_blocked ? t('unblock_user') : t('block_user')}
                                    >
                                      {user.is_blocked ? <UserCheck className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setSelectedUser(user);
                                        setShowDeleteModal(true);
                                      }}
                                      className="text-red-600 hover:text-red-700"
                                      title={t('delete_user')}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                )}
                                {user.id === currentUser?.id && (
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">{t('you')}</Badge>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setSelectedUser(user);
                                        setShowUpgradeModal(true);
                                      }}
                                      className="text-purple-600 hover:text-purple-700"
                                      title={t('upgrade_plan')}
                                    >
                                      <CreditCard className="w-3 h-3 mr-1" />
                                      <span className="text-xs">{t('upgrade')}</span>
                                    </Button>
                                  </div>
                                )}
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
