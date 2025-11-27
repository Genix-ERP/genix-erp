import Layout from "./Layout.jsx";

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

import Manufacturing from "./Manufacturing";

import Procurement from "./Procurement";

import Projects from "./Projects";

import SalesOrders from "./SalesOrders";

import Assets from "./Assets";

import Expenses from "./Expenses";

import Payroll from "./Payroll";

import Contracts from "./Contracts";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

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
    
    Manufacturing: Manufacturing,
    
    Procurement: Procurement,
    
    Projects: Projects,
    
    SalesOrders: SalesOrders,
    
    Assets: Assets,
    
    Expenses: Expenses,
    
    Payroll: Payroll,
    
    Contracts: Contracts,
    
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

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Dashboard />} />
                
                
                <Route path="/Dashboard" element={<Dashboard />} />
                
                <Route path="/AIAssistant" element={<AIAssistant />} />
                
                <Route path="/Inventory" element={<Inventory />} />
                
                <Route path="/Workflows" element={<Workflows />} />
                
                <Route path="/HR" element={<HR />} />
                
                <Route path="/Apps" element={<Apps />} />
                
                <Route path="/Customers" element={<Customers />} />
                
                <Route path="/Settings" element={<Settings />} />
                
                <Route path="/Financials" element={<Financials />} />
                
                <Route path="/Notifications" element={<Notifications />} />
                
                <Route path="/AdminPanel" element={<AdminPanel />} />
                
                <Route path="/Manufacturing" element={<Manufacturing />} />
                
                <Route path="/Procurement" element={<Procurement />} />
                
                <Route path="/Projects" element={<Projects />} />
                
                <Route path="/SalesOrders" element={<SalesOrders />} />
                
                <Route path="/Assets" element={<Assets />} />
                
                <Route path="/Expenses" element={<Expenses />} />
                
                <Route path="/Payroll" element={<Payroll />} />
                
                <Route path="/Contracts" element={<Contracts />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}