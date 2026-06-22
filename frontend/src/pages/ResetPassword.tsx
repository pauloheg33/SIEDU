import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { toast } from 'react-toastify';
import { authAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import './Auth.css';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const startedFromRecoveryLink = hashParams.get('type') === 'recovery';

    const loadSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!isMounted) return;
      setHasRecoverySession(startedFromRecoveryLink && !!session);
      setIsCheckingSession(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === 'PASSWORD_RECOVERY') {
        setHasRecoverySession(true);
      } else if (event === 'SIGNED_OUT') {
        setHasRecoverySession(false);
      } else if (startedFromRecoveryLink && session) {
        setHasRecoverySession(true);
      }

      setIsCheckingSession(false);
    });

    void loadSession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }

    try {
      setIsSubmitting(true);
      await authAPI.updatePassword(password);
      await authAPI.logout();
      toast.success('Senha atualizada com sucesso. Faça login novamente.');
      navigate('/login');
    } catch (error: any) {
      const message = error?.message || error?.error_description || 'Erro ao redefinir senha';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-icon">
              <KeyRound size={28} />
            </div>
            <h1>Validando link</h1>
            <p>Estamos conferindo seu acesso de recuperação de senha.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!hasRecoverySession) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-icon">
              <KeyRound size={28} />
            </div>
            <h1>Link inválido ou expirado</h1>
            <p>Solicite um novo link para redefinir sua senha com segurança.</p>
          </div>

          <div className="auth-footer">
            <Link to="/forgot-password">Solicitar novo link</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon">
            <KeyRound size={28} />
          </div>
          <h1>Definir Nova Senha</h1>
          <p>Escolha uma nova senha para voltar a acessar o sistema.</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label" htmlFor="new-password">Nova senha</label>
            <input
              id="new-password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirm-new-password">Confirmar nova senha</label>
            <input
              id="confirm-new-password"
              type="password"
              className="form-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={isSubmitting}
            style={{ width: '100%' }}
          >
            {isSubmitting ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>

        <div className="auth-footer">
          <Link to="/login">Voltar para o login</Link>
        </div>
      </div>
    </div>
  );
}
