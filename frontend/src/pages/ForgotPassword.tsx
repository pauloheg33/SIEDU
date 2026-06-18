import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { toast } from 'react-toastify';
import { authAPI } from '@/lib/api';
import './Auth.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSent, setHasSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsSubmitting(true);
      await authAPI.requestPasswordReset(email);
      setHasSent(true);
      toast.success('Enviamos o link de recuperação para o e-mail informado.');
    } catch (error: any) {
      const message = error?.message || error?.error_description || 'Erro ao solicitar recuperação de senha';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon">
            <Mail size={28} />
          </div>
          <h1>Recuperar Senha</h1>
          <p>
            Informe seu e-mail para receber um link seguro de redefinição.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label" htmlFor="recovery-email">E-mail</label>
            <input
              id="recovery-email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={isSubmitting}
            style={{ width: '100%' }}
          >
            {isSubmitting ? 'Enviando...' : 'Enviar link de recuperação'}
          </button>
        </form>

        <div className="auth-footer">
          {hasSent
            ? 'Confira sua caixa de entrada e também a pasta de spam.'
            : 'Lembrou sua senha? '}
          {!hasSent && <Link to="/login">Voltar para o login</Link>}
        </div>
      </div>
    </div>
  );
}
