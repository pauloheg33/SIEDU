import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    listPaginated.mockReset();
    scrollIntoView.mockReset();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
  });

  it('shows automatic folders and applies a status filter', async () => {
    listPaginated.mockResolvedValue({ data: [], count: 0, page: 1, pageSize: 50 });
    renderDashboard();
    expect(await screen.findByRole('button', { name: /Formação/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Todos os eventos' })).toBeInTheDocument();
    await waitFor(() => expect(listPaginated).toHaveBeenCalledWith(expect.objectContaining({ scope: 'all' })));
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

  it('scrolls the folder grid below the sticky header when opening a folder', async () => {
    listPaginated.mockResolvedValue({ data: [], count: 0, page: 1, pageSize: 50 });
    renderDashboard();

    fireEvent.click(await screen.findByRole('button', { name: /Formação/ }));

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    await waitFor(() => expect(listPaginated).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'FORMACAO' })));
  });

  it('realigns the folder grid after the filtered query finishes', async () => {
    let resolveFilteredQuery: ((value: { data: never[]; count: number; page: number; pageSize: number }) => void) | undefined;
    listPaginated
      .mockResolvedValueOnce({ data: [], count: 0, page: 1, pageSize: 50 })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFilteredQuery = resolve; }));
    renderDashboard();

    fireEvent.click(await screen.findByRole('button', { name: /Formação/ }));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFilteredQuery?.({ data: [], count: 0, page: 1, pageSize: 50 });
    });
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(2));
  });

  it('does not auto-scroll folders on mobile screens', async () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    listPaginated.mockResolvedValue({ data: [], count: 0, page: 1, pageSize: 50 });
    renderDashboard();

    fireEvent.click(await screen.findByRole('button', { name: /Premiação/ }));

    expect(scrollIntoView).not.toHaveBeenCalled();
    await waitFor(() => expect(listPaginated).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'PREMIACAO' })));
  });
});
