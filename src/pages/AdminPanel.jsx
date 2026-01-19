import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/contexts/AuthContext';
import { useSubscription } from '@/components/contexts/SubscriptionContext';
import apiClient from '@/api/client';
import { SendEmail } from '@/api/integrations';
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

  useEffect(() => {
    loadData();
  }, []);

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

  const loadData = async () => {
    try {
      if (!isSiteAdmin()) {
        navigate('/');
        return;
      }

      // Use companyUsers from SubscriptionContext
      setUsers(companyUsers);
      setFilteredUsers(companyUsers);
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setIsLoading(false);
  };

  // Sync users when companyUsers changes
  useEffect(() => {
    setUsers(companyUsers);
    setFilteredUsers(companyUsers);
  }, [companyUsers]);

  const handleInviteUser = async () => {
    if (!inviteData.email || !inviteData.full_name) {
      alert('Please fill in all required fields');
      return;
    }

    // Check if can add more users
    if (!canAddUser()) {
      const limits = getPlanLimits();
      alert(`⚠️ Foydalanuvchi limiti tugadi!\n\nJoriy tarifingiz ${limits.maxUsers} ta foydalanuvchiga ruxsat beradi.\n\nKo'proq foydalanuvchi qo'shish uchun tarifingizni yangilang.`);
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
      alert(`✅ Foydalanuvchi qo'shildi!\n\nIsm: ${inviteData.full_name}\nEmail: ${inviteData.email}\nRol: ${getRoleDisplayName(inviteData.role)}\n\nFoydalanuvchi tizimga kirish uchun parol yaratishi kerak.`);
      setShowInviteModal(false);
      setInviteData({ email: '', full_name: '', role: 'user' });
    } else {
      alert(`❌ Xatolik: ${result.message}`);
    }

    setIsSendingInvite(false);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      const result = deleteCompanyUser(selectedUser.id);
      if (result.success) {
        alert(`✅ Foydalanuvchi ${selectedUser.email} o'chirildi.`);
        setShowDeleteModal(false);
        setSelectedUser(null);
      } else {
        alert(`❌ Xatolik: ${result.message || 'O\'chirishda xatolik'}`);
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      alert(`❌ Xatolik: ${error.message}`);
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
        alert(`✅ Foydalanuvchi ${selectedUser.email} ${isBlocking ? 'bloklandi' : 'blokdan chiqarildi'}.`);
        setShowBlockModal(false);
        setSelectedUser(null);
        setBlockData({ reason: '', notify_user: true });
      } else {
        alert(`❌ Xatolik: ${result.message}`);
      }
    } catch (error) {
      console.error('Error updating user status:', error);
      alert(`❌ Xatolik: ${error.message}`);
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
        alert(`✅ Sinov muddati ${extendTrialData.days} kunga uzaytirildi!\nYangi tugash sanasi: ${format(newEndDate, 'MMM dd, yyyy')}`);
        setShowExtendTrialModal(false);
        setSelectedUser(null);
        setExtendTrialData({ days: 14, reason: '' });
      } else {
        alert(`❌ Xatolik: ${result.message}`);
      }
    } catch (error) {
      console.error('Error extending trial:', error);
      alert(`❌ Xatolik: ${error.message}`);
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
        alert(`✅ Obuna faollashtirildi!\nTarif: ${upgradeData.plan.toUpperCase()}\nAmal qilish muddati: ${format(endDate, 'MMM dd, yyyy')}`);
        setShowUpgradeModal(false);
        setSelectedUser(null);
        setUpgradeData({ plan: 'professional', duration: 12 });
      } else {
        alert(`❌ Xatolik: ${result.message}`);
      }
    } catch (error) {
      console.error('Error upgrading subscription:', error);
      alert(`❌ Xatolik: ${error.message}`);
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
      system_admin: 'System Admin',
      admin: 'Administrator',
      manager: 'Manager',
      finance_manager: 'Finance Manager',
      sales_manager: 'Sales Manager',
      inventory_manager: 'Inventory Manager',
      hr_manager: 'HR Manager',
      user: 'User',
      limited_user: 'Limited User'
    };
    return names[role] || role;
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
          <p className="text-white/90">{t('admin_panel_subtitle')}</p>
        </div>

        {/* Metrics - Enhanced */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{metrics.totalUsers}</p>
              <p className="text-xs text-slate-600">Total Users</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{metrics.activeUsers}</p>
              <p className="text-xs text-slate-600">Active</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{metrics.trialUsers}</p>
              <p className="text-xs text-slate-600">On Trial</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <CreditCard className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{metrics.enterpriseUsers}</p>
              <p className="text-xs text-slate-600">Enterprise</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <AlertCircle className="w-5 h-5 text-orange-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{metrics.expiringTrials}</p>
              <p className="text-xs text-slate-600">Expiring Soon</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Ban className="w-5 h-5 text-red-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{metrics.blockedUsers}</p>
              <p className="text-xs text-slate-600">Blocked</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Shield className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{metrics.adminUsers}</p>
              <p className="text-xs text-slate-600">Admins</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="w-full bg-white/80 backdrop-blur-sm p-1.5 rounded-xl border border-slate-200/60 shadow-lg flex flex-wrap justify-start gap-1 h-auto">
            <TabsTrigger value="users" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <span>Users</span>
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <span>Subscriptions</span>
            </TabsTrigger>
            <TabsTrigger value="roles" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <span>Roles</span>
            </TabsTrigger>
            <TabsTrigger value="permissions" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Permissions</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <span>Settings</span>
            </TabsTrigger>
          </TabsList>

          {/* Users Tab - Enhanced */}
          <TabsContent value="users" className="mt-6">
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <CardTitle>User Management</CardTitle>
                  <Button onClick={() => setShowInviteModal(true)} className="bg-gradient-to-r from-indigo-600 to-purple-600">
                    <Plus className="w-4 h-4 mr-2" /> Invite User
                  </Button>
                </div>
                <div className="flex gap-3 mt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="system_admin">System Admin</SelectItem>
                      <SelectItem value="admin">Administrator</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="finance_manager">Finance Manager</SelectItem>
                      <SelectItem value="sales_manager">Sales Manager</SelectItem>
                      <SelectItem value="inventory_manager">Inventory Manager</SelectItem>
                      <SelectItem value="hr_manager">HR Manager</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="limited_user">Limited User</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
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
                          <TableHead>User</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead>Role/Plan</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Subscription</TableHead>
                          <TableHead>Actions</TableHead>
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
                                      {userPlan}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={getStatusBadgeColor(userStatus)}>
                                  {userStatus === 'trial' ? 'Free Trial' : userStatus}
                                </Badge>
                                {user.is_blocked && (
                                  <Badge className="ml-1 bg-red-100 text-red-800">Blocked</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {subInfo.daysRemaining !== null ? (
                                  <div className="text-sm">
                                    <p className={subInfo.isExpiring ? 'text-orange-600 font-semibold' : 'text-slate-600'}>
                                      {subInfo.daysRemaining > 0 ? `${subInfo.daysRemaining} days left` : 'Expired'}
                                    </p>
                                    {(user.trial_end_date || user.subscription_end_date) && (
                                      <p className="text-xs text-slate-500">
                                        Ends: {format(parseISO(user.trial_end_date || user.subscription_end_date), 'MMM dd, yyyy')}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-500">No expiry</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {user.id !== currentUser?.id && (
                                  <div className="flex gap-1">
                                    <Select 
                                      value={user.role} 
                                      onValueChange={(value) => updateUserRole(user.id, value)}
                                    >
                                      <SelectTrigger className="h-8 w-[120px] text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="system_admin">System Admin</SelectItem>
                                        <SelectItem value="admin">Administrator</SelectItem>
                                        <SelectItem value="manager">Manager</SelectItem>
                                        <SelectItem value="finance_manager">Finance Mgr</SelectItem>
                                        <SelectItem value="sales_manager">Sales Mgr</SelectItem>
                                        <SelectItem value="inventory_manager">Inventory Mgr</SelectItem>
                                        <SelectItem value="hr_manager">HR Manager</SelectItem>
                                        <SelectItem value="user">User</SelectItem>
                                        <SelectItem value="limited_user">Limited User</SelectItem>
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
                                      title="Upgrade Plan"
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
                                        title="Extend Trial"
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
                                      title={user.is_blocked ? 'Unblock User' : 'Block User'}
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
                                      title="Delete User"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                )}
                                {user.id === currentUser?.id && (
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">You</Badge>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => {
                                        setSelectedUser(user);
                                        setShowUpgradeModal(true);
                                      }}
                                      className="text-purple-600 hover:text-purple-700"
                                      title="Upgrade Your Plan"
                                    >
                                      <CreditCard className="w-3 h-3 mr-1" />
                                      <span className="text-xs">Upgrade</span>
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
                    <CardTitle className="text-base">Free Trial Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-yellow-600">{metrics.trialUsers}</p>
                    <p className="text-sm text-slate-600 mt-1">14-day trial period</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Active Subscriptions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-green-600">{metrics.activeUsers}</p>
                    <p className="text-sm text-slate-600 mt-1">Paid users</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Expired/Cancelled</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-red-600">
                      {users.filter(u => ['expired', 'cancelled'].includes(u.subscription_status || 'trial')).length}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">Inactive users</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Blocked Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-gray-600">{metrics.blockedUsers}</p>
                    <p className="text-sm text-slate-600 mt-1">Access suspended</p>
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
                    System Administrator
                  </CardTitle>
                  <p className="text-xs text-slate-500">Full system control & configuration</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">Complete system access</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">Server & infrastructure management</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">Database administration</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">User & role management</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">Security & audit controls</span>
                  </div>
                </CardContent>
              </Card>

              {/* Administrator */}
              <Card className="bg-white/80 backdrop-blur-sm border-purple-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Shield className="w-5 h-5 text-purple-600" />
                    Administrator
                  </CardTitle>
                  <p className="text-xs text-slate-500">Business administration & oversight</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">User management & invitations</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">Subscription & billing control</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">All module access</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">Report generation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">Workflow configuration</span>
                  </div>
                </CardContent>
              </Card>

              {/* Manager */}
              <Card className="bg-white/80 backdrop-blur-sm border-indigo-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="w-5 h-5 text-indigo-600" />
                    Manager
                  </CardTitle>
                  <p className="text-xs text-slate-500">Cross-functional management</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">Multi-module access</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">Team oversight</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">Approval workflows</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">Analytics & reports</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-3 h-3 text-red-600" />
                    <span className="text-xs">No user management</span>
                  </div>
                </CardContent>
              </Card>

              {/* Finance Manager */}
              <Card className="bg-white/80 backdrop-blur-sm border-emerald-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                    Finance Manager
                  </CardTitle>
                  <p className="text-xs text-slate-500">Financial operations & reporting</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">Full finance module access</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">GL, AP, AR management</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">Financial reporting</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">Budget & forecast control</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-3 h-3 text-red-600" />
                    <span className="text-xs">No inventory/sales access</span>
                  </div>
                </CardContent>
              </Card>

              {/* Sales Manager */}
              <Card className="bg-white/80 backdrop-blur-sm border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="w-5 h-5 text-blue-600" />
                    Sales Manager
                  </CardTitle>
                  <p className="text-xs text-slate-500">Sales operations & CRM</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">Full CRM access</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">Sales orders & quotes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">Customer management</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">Sales analytics</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-3 h-3 text-red-600" />
                    <span className="text-xs">No finance/HR access</span>
                  </div>
                </CardContent>
              </Card>

              {/* Inventory Manager */}
              <Card className="bg-white/80 backdrop-blur-sm border-orange-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="w-5 h-5 text-orange-600" />
                    Inventory Manager
                  </CardTitle>
                  <p className="text-xs text-slate-500">Warehouse & inventory control</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">Full inventory access</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">Stock movements & adjustments</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">Procurement management</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">Supplier coordination</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-3 h-3 text-red-600" />
                    <span className="text-xs">No finance/HR access</span>
                  </div>
                </CardContent>
              </Card>

              {/* HR Manager */}
              <Card className="bg-white/80 backdrop-blur-sm border-pink-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Briefcase className="w-5 h-5 text-pink-600" />
                    HR Manager
                  </CardTitle>
                  <p className="text-xs text-slate-500">Human resources management</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">Full HR module access</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">Employee management</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">Payroll processing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">Recruitment & onboarding</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-3 h-3 text-red-600" />
                    <span className="text-xs">No sales/inventory access</span>
                  </div>
                </CardContent>
              </Card>

              {/* User */}
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="w-5 h-5 text-slate-600" />
                    User
                  </CardTitle>
                  <p className="text-xs text-slate-500">Standard operational access</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">Assigned module access</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">Create & edit records</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">View own data</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-3 h-3 text-red-600" />
                    <span className="text-xs">No admin functions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-3 h-3 text-red-600" />
                    <span className="text-xs">No user management</span>
                  </div>
                </CardContent>
              </Card>

              {/* Limited User */}
              <Card className="bg-white/80 backdrop-blur-sm border-gray-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="w-5 h-5 text-gray-600" />
                    Limited User
                  </CardTitle>
                  <p className="text-xs text-slate-500">Read-only access</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">View-only access</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs">Basic reports viewing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-3 h-3 text-red-600" />
                    <span className="text-xs">Cannot create records</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-3 h-3 text-red-600" />
                    <span className="text-xs">Cannot edit data</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-3 h-3 text-red-600" />
                    <span className="text-xs">No administrative access</span>
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
                <CardTitle>System Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-3">Trial Configuration</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium">Default Trial Period</p>
                        <p className="text-sm text-slate-500">For new user invitations</p>
                      </div>
                      <Badge>14 days</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium">Trial Extension Available</p>
                        <p className="text-sm text-slate-500">Admin can extend trials</p>
                      </div>
                      <Badge className="bg-green-100 text-green-800">Yes</Badge>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Security</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium">User Blocking</p>
                        <p className="text-sm text-slate-500">Suspend user access temporarily</p>
                      </div>
                      <Badge className="bg-green-100 text-green-800">Enabled</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium">User Deletion</p>
                        <p className="text-sm text-slate-500">Permanently remove users</p>
                      </div>
                      <Badge className="bg-green-100 text-green-800">Enabled</Badge>
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
                Invite New User
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>📧 14-Day Free Trial:</strong> New users automatically get a 14-day trial period to explore all features.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Full Name *</label>
                <Input
                  placeholder="John Doe"
                  value={inviteData.full_name}
                  onChange={(e) => setInviteData({...inviteData, full_name: e.target.value})}
                  disabled={isSendingInvite}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Email Address *</label>
                <Input
                  type="email"
                  placeholder="john@company.com"
                  value={inviteData.email}
                  onChange={(e) => setInviteData({...inviteData, email: e.target.value})}
                  disabled={isSendingInvite}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Role *</label>
                <Select 
                  value={inviteData.role} 
                  onValueChange={(value) => setInviteData({...inviteData, role: value})}
                  disabled={isSendingInvite}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system_admin">System Administrator</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="finance_manager">Finance Manager</SelectItem>
                    <SelectItem value="sales_manager">Sales Manager</SelectItem>
                    <SelectItem value="inventory_manager">Inventory Manager</SelectItem>
                    <SelectItem value="hr_manager">HR Manager</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="limited_user">Limited User</SelectItem>
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
                  Cancel
                </Button>
                <Button 
                  onClick={handleInviteUser} 
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600"
                  disabled={!inviteData.email || !inviteData.full_name || isSendingInvite}
                >
                  {isSendingInvite ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Send Invitation
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
                Delete User
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-900 mb-1">Warning: This action cannot be undone!</p>
                    <p className="text-sm text-red-800">
                      Deleting this user will permanently remove:
                    </p>
                    <ul className="text-sm text-red-800 mt-2 ml-4 list-disc">
                      <li>User account and login access</li>
                      <li>All associated data and records</li>
                      <li>Subscription and billing history</li>
                    </ul>
                  </div>
                </div>
              </div>

              {selectedUser && (
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm font-medium mb-2">User to be deleted:</p>
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
                  Cancel
                </Button>
                <Button 
                  onClick={handleDeleteUser}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete User
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
                    Unblock User
                  </>
                ) : (
                  <>
                    <Ban className="w-5 h-5 text-orange-600" />
                    Block User
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
                        <p className="text-xs text-slate-500">Currently blocked:</p>
                        <p className="text-sm text-slate-700">{selectedUser.blocked_reason}</p>
                      </div>
                    )}
                  </div>

                  {!selectedUser.is_blocked && (
                    <>
                      <div>
                        <label className="text-sm font-medium mb-1 block">Reason for Blocking *</label>
                        <Textarea
                          placeholder="e.g., Policy violation, Payment issues, Security concerns..."
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
                          Send notification email to user
                        </label>
                      </div>

                      <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <p className="text-sm text-orange-800">
                          <strong>Note:</strong> Blocked users cannot log in or access the system. You can unblock them anytime.
                        </p>
                      </div>
                    </>
                  )}

                  {selectedUser.is_blocked && (
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm text-green-800">
                        <strong>Unblocking:</strong> This user will regain full access to their account immediately.
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
                  Cancel
                </Button>
                <Button 
                  onClick={handleBlockUser}
                  className={`flex-1 ${selectedUser?.is_blocked ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                  disabled={!selectedUser?.is_blocked && !blockData.reason}
                >
                  {selectedUser?.is_blocked ? (
                    <>
                      <UserCheck className="w-4 h-4 mr-2" />
                      Unblock User
                    </>
                  ) : (
                    <>
                      <Ban className="w-4 h-4 mr-2" />
                      Block User
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
                Activate Subscription
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 overflow-y-auto flex-1">
              {selectedUser && (
                <>
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-purple-900 mb-1">Admin Privilege</p>
                        <p className="text-sm text-purple-800">
                          As an administrator, you can activate any subscription plan instantly without payment.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="font-semibold">{selectedUser.full_name}</p>
                    <p className="text-sm text-slate-600">{selectedUser.email}</p>
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs text-slate-500">Current Plan:</p>
                      <Badge className={getPlanBadgeColor(selectedUser.subscription_plan || 'free_trial')}>
                        {selectedUser.subscription_plan || 'Free Trial'}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">Subscription Plan *</label>
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
                            Basic - $29/month
                          </div>
                        </SelectItem>
                        <SelectItem value="professional">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                            Professional - $99/month
                          </div>
                        </SelectItem>
                        <SelectItem value="enterprise">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                            Enterprise - $299/month
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">Subscription Duration *</label>
                    <Select 
                      value={upgradeData.duration.toString()} 
                      onValueChange={(value) => setUpgradeData({...upgradeData, duration: parseInt(value)})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 month</SelectItem>
                        <SelectItem value="3">3 months</SelectItem>
                        <SelectItem value="6">6 months</SelectItem>
                        <SelectItem value="12">12 months (1 year)</SelectItem>
                        <SelectItem value="24">24 months (2 years)</SelectItem>
                        <SelectItem value="36">36 months (3 years)</SelectItem>
                        <SelectItem value="120">Lifetime (10 years)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Plan Features */}
                  <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {upgradeData.plan.charAt(0).toUpperCase() + upgradeData.plan.slice(1)} Features:
                    </p>
                    {upgradeData.plan === 'basic' && (
                      <ul className="text-sm text-slate-600 space-y-1 ml-4 list-disc">
                        <li>Up to 10 users</li>
                        <li>Core ERP modules</li>
                        <li>Email support</li>
                        <li>5GB storage</li>
                      </ul>
                    )}
                    {upgradeData.plan === 'professional' && (
                      <ul className="text-sm text-slate-600 space-y-1 ml-4 list-disc">
                        <li>Up to 50 users</li>
                        <li>All ERP modules</li>
                        <li>AI features enabled</li>
                        <li>Priority support</li>
                        <li>50GB storage</li>
                        <li>Custom reports</li>
                      </ul>
                    )}
                    {upgradeData.plan === 'enterprise' && (
                      <ul className="text-sm text-slate-600 space-y-1 ml-4 list-disc">
                        <li>✨ Unlimited users</li>
                        <li>✨ All features unlocked</li>
                        <li>✨ Advanced AI & analytics</li>
                        <li>✨ 24/7 premium support</li>
                        <li>✨ Unlimited storage</li>
                        <li>✨ Custom integrations</li>
                        <li>✨ Dedicated account manager</li>
                        <li>✨ SLA guarantees</li>
                      </ul>
                    )}
                  </div>

                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-800">
                      <strong>Subscription valid until:</strong> {format(
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
                Cancel
              </Button>
              <Button 
                onClick={handleUpgradeSubscription}
                className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Activate Now (FREE)
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
                Extend Free Trial
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
                        <p className="text-xs text-slate-500">Current trial ends:</p>
                        <p className="text-sm font-medium">{format(parseISO(selectedUser.trial_end_date), 'MMMM dd, yyyy')}</p>
                        <p className="text-xs text-orange-600">
                          {differenceInDays(parseISO(selectedUser.trial_end_date), new Date())} days remaining
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">Extension Period *</label>
                    <Select 
                      value={extendTrialData.days.toString()} 
                      onValueChange={(value) => setExtendTrialData({...extendTrialData, days: parseInt(value)})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 days</SelectItem>
                        <SelectItem value="14">14 days (recommended)</SelectItem>
                        <SelectItem value="30">30 days</SelectItem>
                        <SelectItem value="60">60 days</SelectItem>
                        <SelectItem value="90">90 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">Reason (Optional)</label>
                    <Textarea
                      placeholder="e.g., Interested in enterprise features, needs more evaluation time..."
                      value={extendTrialData.reason}
                      onChange={(e) => setExtendTrialData({...extendTrialData, reason: e.target.value})}
                      rows={2}
                    />
                  </div>

                  <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-sm text-yellow-800">
                      <strong>New trial end date:</strong> {format(
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
                Cancel
              </Button>
              <Button 
                onClick={handleExtendTrial}
                className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
              >
                <Gift className="w-4 h-4 mr-2" />
                Extend Trial
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
