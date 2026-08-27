import { ReactNode, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Archive, CalendarDays, LogOut, Menu, Share2, UserRound, Users, X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { UserRole } from '@/types';
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
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = () => setSidebarOpen(false);
  const eventsLink = (scope: 'mine' | 'shared' | 'archived') => `/events?scope=${scope}`;
  const currentScope = (new URLSearchParams(location.search).get('scope') || 'shared') as 'mine' | 'shared' | 'archived';
  const scopeClass = (scope: 'mine' | 'shared' | 'archived') => `nav-link ${location.pathname === '/events' && currentScope === scope ? 'active' : ''}`;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="Navegação principal">
        <div className="sidebar-header">
          <NavLink to="/events" className="sidebar-brand" onClick={closeSidebar}>
            <img src="/SIEDU/logo.png" alt="Brasão de Ararendá" className="sidebar-logo" />
            <div className="sidebar-brand-text">
              <strong className="sidebar-title">SIEDU</strong>
              <span className="sidebar-subtitle">Evidências da Educação</span>
            </div>
          </NavLink>
          <button className="sidebar-toggle icon-button" onClick={closeSidebar} aria-label="Fechar menu">
            <X size={22} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <span className="nav-section-label">Biblioteca</span>
          <Link to={eventsLink('mine')} className={scopeClass('mine')} onClick={closeSidebar}>
            <CalendarDays size={19} /><span>Meus eventos</span>
          </Link>
          <Link to={eventsLink('shared')} className={scopeClass('shared')} onClick={closeSidebar}>
            <Share2 size={19} /><span>Compartilhados comigo</span>
          </Link>
          <Link to={eventsLink('archived')} className={scopeClass('archived')} onClick={closeSidebar}>
            <Archive size={19} /><span>Arquivados</span>
          </Link>

          {user?.role === UserRole.ADMIN && (
            <>
              <span className="nav-section-label nav-section-spaced">Administração</span>
              <NavLink to="/users" className="nav-link" onClick={closeSidebar}>
                <Users size={19} /><span>Usuários</span>
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-avatar" aria-hidden="true">
            {(user?.name || user?.email || 'U').slice(0, 1).toUpperCase()}
          </div>
          <div className="sidebar-user-copy">
            <strong>{user?.name || 'Usuário'}</strong>
            <span>{user?.role ? USER_ROLE_LABELS[user.role] : ''}</span>
          </div>
          <button className="icon-button sidebar-logout" onClick={handleLogout} title="Sair" aria-label="Sair">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-overlay" onClick={closeSidebar} aria-label="Fechar menu" />}

      <div className="main-content">
        <header className="topbar">
          <button className="icon-button menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu">
            <Menu size={22} />
          </button>
          <div className="topbar-context"><span className="topbar-product">Secretaria Municipal de Educação</span></div>
          <div className="topbar-user"><UserRound size={18} /><span>{user?.name || user?.email}</span></div>
        </header>
        <main className="page-content"><div className="container">{children}</div></main>
      </div>
    </div>
  );
}
