import Layout from "./Layout.jsx";
import Login from "./Login";
import Register from "./Register";
import AcceptInvite from "./AcceptInvite";
import Dashboard from "./Dashboard";
import AIAssistant from "./AIAssistant";
import Inventory from "./Inventory";
import Workflows from "./Workflows";
import HR from "./HR";
import Apps from "./Apps";
import Customers from "./Customers";
import Settings from "./Settings";
import MySettings from "./MySettings";
import Financials from "./Financials";
import Notifications from "./Notifications";
import AdminPanel from "./AdminPanel";
import AdminSettings from "./AdminSettings";
import Manufacturing from "./Manufacturing";
import Procurement from "./Procurement";
import Projects from "./Projects";
import ProjectDetail from "./ProjectDetail";
import SalesOrders from "./SalesOrders";
import Assets from "./Assets";
import Expenses from "./Expenses";
import Payroll from "./Payroll";
import Contracts from "./Contracts";
import Companies from "./Companies";
import AddCompany from "./AddCompany";
import LeaveManagement from "./LeaveManagement";
import Attendance from "./Attendance";
import EmployeeContracts from "./EmployeeContracts";
import Cargo from "./Cargo";
import POS from "./POS";
import Construction from "./Construction";
import OperationTypeDetail from "./OperationTypeDetail";
import ForgotPassword from "./ForgotPassword";
import ResetPassword from "./ResetPassword";

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
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/accept-invite" element={<AcceptInvite />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
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
                <Route path="customers" element={<ModuleRoute moduleId="customers"><Customers /></ModuleRoute>} />
                <Route path="settings" element={<AdminRoute><Settings /></AdminRoute>} />
                <Route path="my-settings" element={<MySettings />} />
                <Route path="financials" element={<ModuleRoute moduleId="financials"><Financials /></ModuleRoute>} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="adminpanel" element={<AdminPanel />} />
                <Route path="adminsettings" element={<AdminSettings />} />
                <Route path="manufacturing" element={<ModuleRoute moduleId="manufacturing"><Manufacturing /></ModuleRoute>} />
                <Route path="procurement" element={<ModuleRoute moduleId="procurement"><Procurement /></ModuleRoute>} />
                <Route path="projects" element={<ModuleRoute moduleId="projects"><Projects /></ModuleRoute>} />
                <Route path="projects/:projectId" element={<ModuleRoute moduleId="projects"><ProjectDetail /></ModuleRoute>} />
                <Route path="salesorders" element={<ModuleRoute moduleId="sales_orders"><SalesOrders /></ModuleRoute>} />
                <Route path="pos" element={<ModuleRoute moduleId="sales_orders"><POS /></ModuleRoute>} />
                <Route path="assets" element={<ModuleRoute moduleId="assets"><Assets /></ModuleRoute>} />
                <Route path="expenses" element={<ModuleRoute moduleId="expenses"><Expenses /></ModuleRoute>} />
                <Route path="payroll" element={<ModuleRoute moduleId="payroll"><Payroll /></ModuleRoute>} />
                <Route path="contracts" element={<ModuleRoute moduleId="contracts"><Contracts /></ModuleRoute>} />
                <Route path="companies" element={<AdminRoute><Companies /></AdminRoute>} />
                <Route path="addcompany" element={<AdminRoute><AddCompany /></AdminRoute>} />
            </Route>
        </Routes>
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
