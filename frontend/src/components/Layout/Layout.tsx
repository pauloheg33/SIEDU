import { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { UserRole } from '@/types';
import { 
  Home, 
  Calendar, 
  Users, 
  LogOut, 
  User,
  Menu,
  X
} from 'lucide-react';
import { useState } from 'react';
import './Layout.css';

const USER_ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Administrador',
  [UserRole.TEC_FORMACAO]: 'Técnico de Formação',
  [UserRole.TEC_ACOMPANHAMENTO]: 'Técnico SME',
};

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <img src="/SIEDE/logo.png" alt="Brasão Ararendá" className="sidebar-logo" />
            <div className="sidebar-brand-text">
              <h1 className="sidebar-title">EDUCA ARARENDÁ</h1>
              <span className="sidebar-subtitle">Ararendá</span>
            </div>
          </div>
          <button 
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={24} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <Link to="/dashboard" className="nav-link">
            <Home size={20} />
            <span>Dashboard</span>
          </Link>
          <Link to="/events" className="nav-link">
            <Calendar size={20} />
            <span>Eventos</span>
          </Link>
          {user?.role === 'ADMIN' && (
            <Link to="/users" className="nav-link">
              <Users size={20} />
              <span>Usuários</span>
            </Link>
          )}
        </nav>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div 
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="main-content">
        {/* Top bar */}
        <header className="topbar">
          <button 
            className="menu-toggle"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>

          <div className="topbar-right">
            <div className="user-menu">
              <div className="user-info">
                <User size={20} />
                <div>
                  <div className="user-name">{user?.name}</div>
                  <div className="user-role">{user?.role ? USER_ROLE_LABELS[user.role as UserRole] || user.role : ''}</div>
                </div>
              </div>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={handleLogout}
              >
                <LogOut size={16} />
                Sair
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="page-content">
          <div className="container">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
