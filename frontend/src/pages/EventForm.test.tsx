import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EventForm, { parseCommaList } from './EventForm';

const create = vi.fn();
vi.mock('@/lib/api', () => ({
  eventsAPI: {
    create: (...args: unknown[]) => create(...args),
    update: vi.fn(),
    get: vi.fn(),
  },
}));
vi.mock('@/components/Layout/Layout', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/events/new']}>
        <Routes>
          <Route path="/events/new" element={<EventForm />} />
          <Route path="/events/:id" element={<div>Detalhe salvo</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('EventForm', () => {
  beforeEach(() => create.mockReset());

  it('normalizes comma-separated values without duplicates', () => {
    expect(parseCommaList('formação, leitura, formação,  ')).toEqual(['formação', 'leitura']);
  });

  it('keeps invalid data on screen and does not call the API', async () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: /salvar evento/i }));
    expect(await screen.findByText('Informe um título.')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('creates once and navigates after a successful explicit save', async () => {
    create.mockResolvedValue({ id: 'event-1', title: 'Formação', type: 'FORMACAO', status: 'PLANEJADO' });
    renderForm();
    fireEvent.change(screen.getByLabelText('Título *'), { target: { value: 'Formação' } });
    fireEvent.change(screen.getByLabelText('Início *'), { target: { value: '2026-08-26T09:00' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar evento/i }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Detalhe salvo')).toBeInTheDocument();
    expect(create.mock.calls[0][0].client_request_id).toMatch(/[0-9a-f-]{36}/);
  });

  it('prevents a duplicate request while the first save is pending', async () => {
    create.mockResolvedValue({ id: 'event-2', title: 'Evento sem duplicação', type: 'FORMACAO', status: 'PLANEJADO' });
    renderForm();
    fireEvent.change(screen.getByLabelText('Título *'), { target: { value: 'Evento sem duplicação' } });
    fireEvent.change(screen.getByLabelText('Início *'), { target: { value: '2026-08-26T09:00' } });
    const save = screen.getByRole('button', { name: /salvar evento/i });
    fireEvent.click(save);
    fireEvent.click(save);
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Detalhe salvo')).toBeInTheDocument();
  });
});
