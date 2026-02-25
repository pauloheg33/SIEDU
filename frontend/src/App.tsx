import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { useAuthStore } from '@/store/authStore';
import { supabaseConfigured } from '@/lib/supabase';
import 'react-toastify/dist/ReactToastify.css';
import '@/styles/global.css';

// Pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Dashboard from '@/pages/Dashboard';
import EventForm from '@/pages/EventForm';
import EventDetail from '@/pages/EventDetail';

// Error component for missing configuration
function ConfigError() {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      padding: '2rem',
      textAlign: 'center',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <h1 style={{ color: '#dc2626', marginBottom: '1rem' }}>Erro de Configuração</h1>
      <p style={{ color: '#666', maxWidth: '500px' }}>
        As variáveis de ambiente do Supabase não estão configuradas.
        <br /><br />
        Configure os secrets no GitHub:
        <br />
        <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>
      </p>
    </div>
  );
}

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh' 
      }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    if (supabaseConfigured) {
      initialize();
    }
  }, [initialize]);

  if (!supabaseConfigured) {
    return <ConfigError />;
  }

  return (
    <BrowserRouter basename="/SIEDU">
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected routes */}
        <Route
          path="/portfolio"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/new"
          element={
            <ProtectedRoute>
              <EventForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/:id"
          element={
            <ProtectedRoute>
              <EventDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/:id/edit"
          element={
            <ProtectedRoute>
              <EventForm />
            </ProtectedRoute>
          }
        />

        {/* Redirect root to portfolio */}
        <Route path="/" element={<Navigate to="/portfolio" replace />} />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/portfolio" replace />} />
      </Routes>

      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </BrowserRouter>
  );
}

export default App;
