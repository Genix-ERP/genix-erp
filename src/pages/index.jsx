import React, { Suspense } from 'react';
import Layout from "./Layout.jsx";
import ErrorBoundary from "@/components/ErrorBoundary";

// Retry wrapper for lazy imports — handles stale chunks after deployments
function lazyRetry(importFn) {
    return React.lazy(() =>
        importFn().catch(() => {
            // Chunk failed to load (likely a new deployment), reload once
            const reloaded = sessionStorage.getItem('lazy_reload');
            if (!reloaded) {
                sessionStorage.setItem('lazy_reload', '1');
                window.location.reload();
                return new Promise(() => {}); // hang while reloading
            }
            sessionStorage.removeItem('lazy_reload');
            return importFn(); // retry once after reload flag is set
        })
    );
}

const Login = lazyRetry(() => import('./Login'));
const SharedReconciliation = lazyRetry(() => import('./SharedReconciliation'));
const Register = lazyRetry(() => import('./Register'));
const AcceptInvite = lazyRetry(() => import('./AcceptInvite'));
const Dashboard = lazyRetry(() => import('./Dashboard'));
const AIAssistant = lazyRetry(() => import('./AIAssistant'));
const Inventory = lazyRetry(() => import('./Inventory'));
const Workflows = lazyRetry(() => import('./Workflows'));
const HR = lazyRetry(() => import('./HR'));
const Apps = lazyRetry(() => import('./Apps'));
const Customers = lazyRetry(() => import('./Customers'));
const Settings = lazyRetry(() => import('./Settings'));
const MySettings = lazyRetry(() => import('./MySettings'));
const Financials = lazyRetry(() => import('./Financials'));
const Notifications = lazyRetry(() => import('./Notifications'));
const AdminPanel = lazyRetry(() => import('./AdminPanel'));
const AdminSettings = lazyRetry(() => import('./AdminSettings'));
const Manufacturing = lazyRetry(() => import('./Manufacturing'));
const ManufacturingKiosk = lazyRetry(() => import('@/components/manufacturing/KioskMode'));
const Procurement = lazyRetry(() => import('./Procurement'));
const Tasks = lazyRetry(() => import('./Tasks'));
const TaskBoard = lazyRetry(() => import('./TaskBoard'));
const SalesOrders = lazyRetry(() => import('./SalesOrders'));
const Assets = lazyRetry(() => import('./Assets'));
const Expenses = lazyRetry(() => import('./Expenses'));
const Payroll = lazyRetry(() => import('./Payroll'));
const EmployeeCabinet = lazyRetry(() => import('./EmployeeCabinet'));
const Contracts = lazyRetry(() => import('./Contracts'));
const ContractDetail = lazyRetry(() => import('./ContractDetail'));
const Companies = lazyRetry(() => import('./Companies'));
const AddCompany = lazyRetry(() => import('./AddCompany'));
const LeaveManagement = lazyRetry(() => import('./LeaveManagement'));
const Attendance = lazyRetry(() => import('./Attendance'));
const EmployeeContracts = lazyRetry(() => import('./EmployeeContracts'));
const Cargo = lazyRetry(() => import('./Cargo'));
const POS = lazyRetry(() => import('./POS'));
const Construction = lazyRetry(() => import('./Construction'));
const DirectorDashboard = lazyRetry(() => import('./DirectorDashboard'));
const OperationTypeDetail = lazyRetry(() => import('./OperationTypeDetail'));
const ForgotPassword = lazyRetry(() => import('./ForgotPassword'));
const ResetPassword = lazyRetry(() => import('./ResetPassword'));
const PaymentSuccess = lazyRetry(() => import('./PaymentSuccess'));
const PaymentError = lazyRetry(() => import('./PaymentError'));

const SuspenseFallback = (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>
);

import { BrowserRouter as Router, Route, Routes, useLocation, useParams, Navigate, Outlet } from 'react-router-dom';
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
    Tasks: Tasks,
    TaskBoard: TaskBoard,
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
    DirectorDashboard: DirectorDashboard,
}

// Old /projects/:projectId deep links keep working — migration 440 reuses the
// project id as the task-board id.
function LegacyProjectRedirect() {
    const { projectId } = useParams();
    return <Navigate to={`/tasks/${projectId}`} replace />;
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    // Hyphenated routes (employee-contracts, leave-management) must resolve
    // to their CamelCase page keys — comparing without the hyphens. Before
    // this, they fell back to Dashboard and the header showed "Asosiy panel".
    const normalized = urlLastPart.toLowerCase().replace(/-/g, '');
    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === normalized);
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

// SEC-04 (docs/admin-panel/audit.md): platform control-plane route guard.
// Gates strictly on the server-provided is_system_admin flag — NOT the tenant
// owner/site-admin role — and returns Navigate BEFORE rendering any child, so
// the platform console never flashes to a tenant user. The backend
// RequireSystemAdmin remains the real boundary; this is defence-in-depth.
function SystemAdminRoute({ children }) {
    const { isSystemAdmin, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!isSystemAdmin()) {
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
        return <ErrorBoundary>{children}</ErrorBoundary>;
    }

    // Check module-specific permission
    if (!canAccessModule(moduleId)) {
        return <Navigate to="/dashboard" replace />;
    }

    return <ErrorBoundary>{children}</ErrorBoundary>;
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
            <Route path="/payment-success" element={<PaymentSuccess />} />
            <Route path="/payment-error" element={<PaymentError />} />
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
                {/* Xodim (HR) contracts keep their own page; business contracts live in Shartnomalar */}
                <Route path="employee-contracts" element={<ModuleRoute moduleId="hr"><EmployeeContracts /></ModuleRoute>} />
                <Route path="cargo" element={<ModuleRoute moduleId="cargo"><Cargo /></ModuleRoute>} />
                <Route path="construction" element={<ModuleRoute moduleId="construction"><Construction /></ModuleRoute>} />
                <Route path="directordashboard" element={<ModuleRoute moduleId="director_dashboard"><DirectorDashboard /></ModuleRoute>} />
                <Route path="apps" element={<AdminRoute><Apps /></AdminRoute>} />
                <Route path="customers" element={<ModuleRoute moduleId="crm"><Customers /></ModuleRoute>} />
                <Route path="settings" element={<AdminRoute><Settings /></AdminRoute>} />
                <Route path="my-settings" element={<MySettings />} />
                <Route path="financials" element={<ModuleRoute moduleId="finance"><Financials /></ModuleRoute>} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="adminpanel" element={<SystemAdminRoute><AdminPanel /></SystemAdminRoute>} />
                <Route path="adminsettings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
                <Route path="manufacturing" element={<ModuleRoute moduleId="manufacturing"><Manufacturing /></ModuleRoute>} />
                {/* Ustaxona kiosk — tablet-first shop-floor terminal (B3) */}
                <Route path="manufacturing/kiosk" element={<ModuleRoute moduleId="manufacturing"><ManufacturingKiosk /></ModuleRoute>} />
                <Route path="procurement" element={<ModuleRoute moduleId="purchase"><Procurement /></ModuleRoute>} />
                <Route path="tasks" element={<ModuleRoute moduleId="tasks"><Tasks /></ModuleRoute>} />
                <Route path="tasks/:boardId" element={<ModuleRoute moduleId="tasks"><TaskBoard /></ModuleRoute>} />
                {/* Legacy Loyihalar URLs → Vazifalar (board ids reuse old project ids) */}
                <Route path="projects" element={<Navigate to="/tasks" replace />} />
                <Route path="projects/:projectId" element={<LegacyProjectRedirect />} />
                <Route path="salesorders" element={<ModuleRoute moduleId="sales"><SalesOrders /></ModuleRoute>} />
                <Route path="pos" element={<ModuleRoute moduleId="sales"><POS /></ModuleRoute>} />
                <Route path="assets" element={<ModuleRoute moduleId="assets"><Assets /></ModuleRoute>} />
                <Route path="expenses" element={<ModuleRoute moduleId="expenses"><Expenses /></ModuleRoute>} />
                {/* Profit tax is now mounted as a tab inside Financials
                    per §8.1 of ТЗ_Ish_Haqi_Soliq_Tolik.docx, so no
                    dedicated route here. Link to it with
                    /financials?tab=profit-tax. */}
                <Route path="payroll" element={<ModuleRoute moduleId="payroll"><Payroll /></ModuleRoute>} />
                {/* Xodim kabineti — employee self-service (own payslips/loan).
                    Deliberately NOT module-gated: any logged-in user may see
                    their own data; scoping happens server-side via /my/*. */}
                <Route path="employee-cabinet" element={<EmployeeCabinet />} />
                <Route path="contracts" element={<ModuleRoute moduleId="contracts"><Contracts /></ModuleRoute>} />
                <Route path="contracts/:contractId" element={<ModuleRoute moduleId="contracts"><ContractDetail /></ModuleRoute>} />
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
