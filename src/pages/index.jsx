import Layout from "./Layout.jsx";
import Login from "./Login";
import Register from "./Register";
import Dashboard from "./Dashboard";
import AIAssistant from "./AIAssistant";
import Inventory from "./Inventory";
import Workflows from "./Workflows";
import HR from "./HR";
import Apps from "./Apps";
import Customers from "./Customers";
import Settings from "./Settings";
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

import { BrowserRouter as Router, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/components/contexts/AuthContext';

const PAGES = {
    Dashboard: Dashboard,
    AIAssistant: AIAssistant,
    Inventory: Inventory,
    Workflows: Workflows,
    HR: HR,
    Apps: Apps,
    Customers: Customers,
    Settings: Settings,
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

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);

    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
                path="/*"
                element={
                    <ProtectedRoute>
                        <Layout currentPageName={currentPage}>
                            <Routes>
                                <Route path="/" element={<Dashboard />} />
                                <Route path="/dashboard" element={<Dashboard />} />
                                <Route path="/aiassistant" element={<AIAssistant />} />
                                <Route path="/inventory" element={<Inventory />} />
                                <Route path="/workflows" element={<Workflows />} />
                                <Route path="/hr" element={<HR />} />
                                <Route path="/leave-management" element={<LeaveManagement />} />
                                <Route path="/attendance" element={<Attendance />} />
                                <Route path="/employee-contracts" element={<EmployeeContracts />} />
                                <Route path="/apps" element={<Apps />} />
                                <Route path="/customers" element={<Customers />} />
                                <Route path="/settings" element={<Settings />} />
                                <Route path="/financials" element={<Financials />} />
                                <Route path="/notifications" element={<Notifications />} />
                                <Route path="/adminpanel" element={<AdminPanel />} />
                                <Route path="/adminsettings" element={<AdminSettings />} />
                                <Route path="/manufacturing" element={<Manufacturing />} />
                                <Route path="/procurement" element={<Procurement />} />
                                <Route path="/projects" element={<Projects />} />
                                <Route path="/projects/:projectId" element={<ProjectDetail />} />
                                <Route path="/salesorders" element={<SalesOrders />} />
                                <Route path="/assets" element={<Assets />} />
                                <Route path="/expenses" element={<Expenses />} />
                                <Route path="/payroll" element={<Payroll />} />
                                <Route path="/contracts" element={<Contracts />} />
                                <Route path="/companies" element={<Companies />} />
                                <Route path="/addcompany" element={<AddCompany />} />
                            </Routes>
                        </Layout>
                    </ProtectedRoute>
                }
            />
        </Routes>
    );
}

export default function Pages() {
    return (
        <Router>
            <AuthProvider>
                <PagesContent />
            </AuthProvider>
        </Router>
    );
}
