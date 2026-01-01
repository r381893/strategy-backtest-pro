import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
    Database, Settings, BarChart3, FileText,
    Search, Save, TrendingUp, Menu, X
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
    const [menuOpen, setMenuOpen] = useState(false);

    const handleNavClick = () => {
        setMenuOpen(false);
    };

    return (
        <div className="app">
            {/* 手機版漢堡選單按鈕 */}
            <button
                className="mobile-menu-btn mobile-only"
                onClick={() => setMenuOpen(!menuOpen)}
                style={{
                    position: 'fixed',
                    top: '1rem',
                    left: '1rem',
                    zIndex: 1001,
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '0.75rem',
                    color: 'white',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
                }}
            >
                {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* 側邊欄 */}
            <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
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
                            onClick={handleNavClick}
                        >
                            <Icon size={20} />
                            <span>{label}</span>
                        </NavLink>
                    ))}
                </nav>
            </aside>

            {/* 遮罩層 */}
            {menuOpen && (
                <div
                    className="sidebar-overlay mobile-only"
                    onClick={() => setMenuOpen(false)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.5)',
                        zIndex: 998
                    }}
                />
            )}

            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
}

export default Layout;
