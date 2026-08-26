import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, ShieldCheck, UserCheck, UserRound, UserX, Users as UsersIcon } from 'lucide-react';
import { toast } from 'react-toastify';
import Layout from '@/components/Layout/Layout';
import { usersAPI } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { User, UserRole } from '@/types';
import './Users.css';

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Administrador',
  [UserRole.TEC_FORMACAO]: 'Técnico de Formação',
  [UserRole.TEC_ACOMPANHAMENTO]: 'Técnico SME',
};

export default function Users() {
  const currentUser = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: usersAPI.list, staleTime: 60_000 });
  const mutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<User> }) => usersAPI.update(id, updates),
    onSuccess: (updated) => {
      queryClient.setQueryData<User[]>(['users'], (current = []) => current.map((user) => user.id === updated.id ? updated : user));
      toast.success('Usuário atualizado.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar o usuário.'),
  });

  const users = usersQuery.data || [];
  const activeAdminCount = users.filter((user) => user.role === UserRole.ADMIN && user.is_active).length;
  const filteredUsers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    if (!term) return users;
    return users.filter((user) => `${user.name} ${user.email} ${ROLE_LABELS[user.role]}`.toLocaleLowerCase('pt-BR').includes(term));
  }, [search, users]);

  if (currentUser?.role !== UserRole.ADMIN) return <Navigate to="/events" replace />;

  const updateRole = (user: User, role: UserRole) => {
    if (user.role === UserRole.ADMIN && role !== UserRole.ADMIN && user.is_active && activeAdminCount <= 1) {
      toast.error('Mantenha pelo menos um administrador ativo.');
      return;
    }
    mutation.mutate({ id: user.id, updates: { role } });
  };

  const toggleActive = (user: User) => {
    if (user.id === currentUser.id) {
      toast.error('Você não pode desativar a própria conta.');
      return;
    }
    if (user.role === UserRole.ADMIN && user.is_active && activeAdminCount <= 1) {
      toast.error('Mantenha pelo menos um administrador ativo.');
      return;
    }
    mutation.mutate({ id: user.id, updates: { is_active: !user.is_active } });
  };

  return (
    <Layout>
      <div className="users-header">
        <div>
          <span className="eyebrow">Administração</span>
          <h1>Usuários</h1>
          <p>Gerencie funções e acesso à biblioteca SIEDU.</p>
        </div>
        <div className="users-summary"><ShieldCheck size={20} /><span><strong>{activeAdminCount}</strong> administrador(es) ativo(s)</span></div>
      </div>

      <div className="users-toolbar card">
        <label className="search-box">
          <Search size={18} /><span className="sr-only">Buscar usuários</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, e-mail ou função..." />
        </label>
        <span>{filteredUsers.length} usuário(s)</span>
      </div>

      {usersQuery.isLoading ? (
        <div className="user-list">{Array.from({ length: 5 }).map((_, index) => <div className="user-row skeleton" key={index} />)}</div>
      ) : usersQuery.isError ? (
        <div className="empty-state error-state"><UsersIcon size={44} /><h3>Não foi possível carregar os usuários</h3><button className="btn btn-secondary" onClick={() => usersQuery.refetch()}>Tentar novamente</button></div>
      ) : (
        <div className="table-wrap">
          <table className="table users-table">
            <thead><tr><th>Usuário</th><th>Função</th><th>Status</th><th><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className={!user.is_active ? 'inactive-user' : ''}>
                  <td><div className="user-identity"><span className="user-list-avatar"><UserRound size={18} /></span><span><strong>{user.name}</strong><small>{user.email}</small></span></div></td>
                  <td>
                    <select className="form-select compact-select" value={user.role} disabled={mutation.isPending} onChange={(event) => updateRole(user, event.target.value as UserRole)}>
                      {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </td>
                  <td><span className={`badge ${user.is_active ? 'badge-success' : 'badge-secondary'}`}>{user.is_active ? 'Ativo' : 'Inativo'}</span></td>
                  <td className="user-actions"><button className={`btn btn-sm ${user.is_active ? 'btn-danger-outline' : 'btn-secondary'}`} disabled={mutation.isPending || user.id === currentUser.id} onClick={() => toggleActive(user)}>{user.is_active ? <UserX size={15} /> : <UserCheck size={15} />}{user.is_active ? 'Desativar' : 'Ativar'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
