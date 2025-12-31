import { NavLink, Outlet } from 'react-router-dom';
import {
    Database, Settings, BarChart3, FileText,
    Search, Save, TrendingUp
} from 'lucide-react';

const navItems = [
    { path: '/', icon: Database, label: '資料管理' },
    { path: '/backtest', icon: Settings, label: '策略設定' },
    { path: '/results', icon: BarChart3, label: '回測報表' },
    { path: '/trades', icon: FileText, label: '交易明細' },
    { path: '/optimize', icon: Search, label: '參數優化' },
    { path: '/strategies', icon: Save, label: '已儲存策略' },
];

function Layout() {
    return (
        <div className="app">
            <aside className="sidebar">
                <div className="logo">
                    <TrendingUp size={28} />
                    <span>回測系統 Pro</span>
                </div>
                <nav>
                    {navItems.map(({ path, icon: Icon, label }) => (
                        <NavLink
                            key={path}
                            to={path}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <Icon size={20} />
                            <span>{label}</span>
                        </NavLink>
                    ))}
                </nav>
            </aside>
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
}

export default Layout;
