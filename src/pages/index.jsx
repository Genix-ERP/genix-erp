import React, { Suspense } from 'react';
import Layout from "./Layout.jsx";

const Login = React.lazy(() => import('./Login'));
const SharedReconciliation = React.lazy(() => import('./SharedReconciliation'));
const Register = React.lazy(() => import('./Register'));
const AcceptInvite = React.lazy(() => import('./AcceptInvite'));
const Dashboard = React.lazy(() => import('./Dashboard'));
const AIAssistant = React.lazy(() => import('./AIAssistant'));
const Inventory = React.lazy(() => import('./Inventory'));
const Workflows = React.lazy(() => import('./Workflows'));
const HR = React.lazy(() => import('./HR'));
const Apps = React.lazy(() => import('./Apps'));
const Customers = React.lazy(() => import('./Customers'));
const Settings = React.lazy(() => import('./Settings'));
const MySettings = React.lazy(() => import('./MySettings'));
const Financials = React.lazy(() => import('./Financials'));
const Notifications = React.lazy(() => import('./Notifications'));
const AdminPanel = React.lazy(() => import('./AdminPanel'));
const AdminSettings = React.lazy(() => import('./AdminSettings'));
const Manufacturing = React.lazy(() => import('./Manufacturing'));
const Procurement = React.lazy(() => import('./Procurement'));
const Projects = React.lazy(() => import('./Projects'));
const ProjectDetail = React.lazy(() => import('./ProjectDetail'));
const SalesOrders = React.lazy(() => import('./SalesOrders'));
const Assets = React.lazy(() => import('./Assets'));
const Expenses = React.lazy(() => import('./Expenses'));
const Payroll = React.lazy(() => import('./Payroll'));
const Contracts = React.lazy(() => import('./Contracts'));
const Companies = React.lazy(() => import('./Companies'));
const AddCompany = React.lazy(() => import('./AddCompany'));
const LeaveManagement = React.lazy(() => import('./LeaveManagement'));
const Attendance = React.lazy(() => import('./Attendance'));
const EmployeeContracts = React.lazy(() => import('./EmployeeContracts'));
const Cargo = React.lazy(() => import('./Cargo'));
const POS = React.lazy(() => import('./POS'));
const Construction = React.lazy(() => import('./Construction'));
const OperationTypeDetail = React.lazy(() => import('./OperationTypeDetail'));
const ForgotPassword = React.lazy(() => import('./ForgotPassword'));
const ResetPassword = React.lazy(() => import('./ResetPassword'));

const SuspenseFallback = (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>
);

import { BrowserRouter as Router, Route, Routes, useLocation, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/components/contexts/AuthContext';
import { LanguageProvider } from '@/components/contexts/LanguageContext';
import { EmployeePermissionsProvider, useEmployeePermissions } from '@/components/contexts/EmployeePermissionsContext';

const PAGES = {
    Dashboard: Dashboard,
    AIAssistant: AIAssistant,
    Inventory: Inventory,
    Workflows: Workflows,
    HR: HR,
    Apps: Apps,
    Customers: Customers,
    Settings: Settings,
    MySettings: MySettings,
    Financials: Financials,
    Notifications: Notifications,
    AdminPanel: AdminPanel,
    AdminSettings: AdminSettings,
    Manufacturing: Manufacturing,
    Procurement: Procurement,
    Projects: Projects,
    ProjectDetail: ProjectDetail,
    SalesOrders: SalesOrders,
    Assets: Assets,
    Expenses: Expenses,
    Payroll: Payroll,
    Contracts: Contracts,
    Companies: Companies,
    AddCompany: AddCompany,
    LeaveManagement: LeaveManagement,
    Attendance: Attendance,
    EmployeeContracts: EmployeeContracts,
    Cargo: Cargo,
    Construction: Construction,
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Protected route wrapper
function ProtectedRoute({ children }) {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return children;
}

// Admin-only route wrapper (for site_admin and owner)
function AdminRoute({ children }) {
    const { isOwner, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!isOwner()) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
}

// Module permission route wrapper - checks if user has read access to a module
function ModuleRoute({ children, moduleId }) {
    const { isLoading: authLoading, isSiteAdmin, isOwner } = useAuth();
    const { canAccessModule, isLoading: permLoading, isAdmin } = useEmployeePermissions();

    if (authLoading || permLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    // Admins always have access
    if (isAdmin || isSiteAdmin() || isOwner()) {
        return children;
    }

    // Check module-specific permission
    if (!canAccessModule(moduleId)) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
}

// Layout wrapper that uses Outlet for child routes
function LayoutWrapper() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);

    return (
        <Layout currentPageName={currentPage}>
            <Outlet />
        </Layout>
    );
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    return (
        <Suspense fallback={SuspenseFallback}>
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/accept-invite" element={<AcceptInvite />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/shared/reconciliation/:token" element={<SharedReconciliation />} />
            <Route
                path="/"
                element={
                    <ProtectedRoute>
                        <LayoutWrapper />
                    </ProtectedRoute>
                }
            >
                <Route index element={<Dashboard />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="aiassistant" element={<AIAssistant />} />
                <Route path="inventory" element={<ModuleRoute moduleId="inventory"><Inventory /></ModuleRoute>} />
                <Route path="inventory/operation-type/:id" element={<ModuleRoute moduleId="inventory"><OperationTypeDetail /></ModuleRoute>} />
                <Route path="workflows" element={<Workflows />} />
                <Route path="hr" element={<ModuleRoute moduleId="hr"><HR /></ModuleRoute>} />
                <Route path="leave-management" element={<ModuleRoute moduleId="hr"><LeaveManagement /></ModuleRoute>} />
                <Route path="attendance" element={<ModuleRoute moduleId="hr"><Attendance /></ModuleRoute>} />
                <Route path="employee-contracts" element={<ModuleRoute moduleId="hr"><EmployeeContracts /></ModuleRoute>} />
                <Route path="cargo" element={<ModuleRoute moduleId="cargo"><Cargo /></ModuleRoute>} />
                <Route path="construction" element={<ModuleRoute moduleId="construction"><Construction /></ModuleRoute>} />
                <Route path="apps" element={<AdminRoute><Apps /></AdminRoute>} />
                <Route path="customers" element={<ModuleRoute moduleId="crm"><Customers /></ModuleRoute>} />
                <Route path="settings" element={<AdminRoute><Settings /></AdminRoute>} />
                <Route path="my-settings" element={<MySettings />} />
                <Route path="financials" element={<ModuleRoute moduleId="finance"><Financials /></ModuleRoute>} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="adminpanel" element={<AdminRoute><AdminPanel /></AdminRoute>} />
                <Route path="adminsettings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
                <Route path="manufacturing" element={<ModuleRoute moduleId="manufacturing"><Manufacturing /></ModuleRoute>} />
                <Route path="procurement" element={<ModuleRoute moduleId="purchase"><Procurement /></ModuleRoute>} />
                <Route path="projects" element={<ModuleRoute moduleId="projects"><Projects /></ModuleRoute>} />
                <Route path="projects/:projectId" element={<ModuleRoute moduleId="projects"><ProjectDetail /></ModuleRoute>} />
                <Route path="salesorders" element={<ModuleRoute moduleId="sales"><SalesOrders /></ModuleRoute>} />
                <Route path="pos" element={<ModuleRoute moduleId="sales"><POS /></ModuleRoute>} />
                <Route path="assets" element={<ModuleRoute moduleId="assets"><Assets /></ModuleRoute>} />
                <Route path="expenses" element={<ModuleRoute moduleId="expenses"><Expenses /></ModuleRoute>} />
                <Route path="payroll" element={<ModuleRoute moduleId="payroll"><Payroll /></ModuleRoute>} />
                <Route path="contracts" element={<ModuleRoute moduleId="contracts"><Contracts /></ModuleRoute>} />
                <Route path="companies" element={<AdminRoute><Companies /></AdminRoute>} />
                <Route path="addcompany" element={<AdminRoute><AddCompany /></AdminRoute>} />
            </Route>
        </Routes>
        </Suspense>
    );
}

export default function Pages() {
    return (
        <Router>
            <LanguageProvider>
                <AuthProvider>
                    <EmployeePermissionsProvider>
                        <PagesContent />
                    </EmployeePermissionsProvider>
                </AuthProvider>
            </LanguageProvider>
        </Router>
    );
}
