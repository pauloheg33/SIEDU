import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from './Dashboard';

const listPaginated = vi.fn();
vi.mock('@/lib/api', () => ({ eventsAPI: { listPaginated: (...args: unknown[]) => listPaginated(...args) } }));
vi.mock('@/components/Layout/Layout', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/events']}>
        <Routes><Route path="/events" element={<Dashboard />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Dashboard', () => {
  beforeEach(() => {
    localStorage.clear();
    listPaginated.mockReset();
  });

  it('shows automatic folders and applies a status filter', async () => {
    listPaginated.mockResolvedValue({ data: [], count: 0, page: 1, pageSize: 50 });
    renderDashboard();
    expect(await screen.findByRole('button', { name: /Formação/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Filtrar por status'), { target: { value: 'REALIZADO' } });
    await waitFor(() => expect(listPaginated).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'REALIZADO', pageSize: 50 })));
  });

  it('releases the error state and retries the event query', async () => {
    listPaginated.mockRejectedValueOnce(new Error('Rede indisponível'))
      .mockResolvedValueOnce({ data: [], count: 0, page: 1, pageSize: 50 });
    renderDashboard();
    expect(await screen.findByText('Rede indisponível')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(listPaginated).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Nenhum evento encontrado')).toBeInTheDocument();
  });
});
