import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Archive, CalendarDays, ChevronLeft, ChevronRight, Folder, Grid2X2, List, MapPin, Plus, Search, SlidersHorizontal, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Layout from '@/components/Layout/Layout';
import { eventsAPI } from '@/lib/api';
import { Event, EventLibraryScope, EventSort, EventStatus, EventType } from '@/types';
import './Dashboard.css';

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  [EventType.FORMACAO]: 'Formação',
  [EventType.PREMIACAO]: 'Premiação',
  [EventType.ENCONTRO]: 'Visita de Acompanhamento',
  [EventType.OUTRO]: 'Outros',
};

const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  [EventStatus.PLANEJADO]: 'Planejado',
  [EventStatus.REALIZADO]: 'Realizado',
  [EventStatus.ARQUIVADO]: 'Arquivado',
};

const STATUS_COLORS: Record<EventStatus, string> = {
  [EventStatus.PLANEJADO]: 'badge-warning',
  [EventStatus.REALIZADO]: 'badge-success',
  [EventStatus.ARQUIVADO]: 'badge-secondary',
};

const TYPE_ORDER = [EventType.FORMACAO, EventType.PREMIACAO, EventType.ENCONTRO, EventType.OUTRO];
const SCOPE_TITLES: Record<EventLibraryScope, { title: string; description: string }> = {
  mine: { title: 'Meus eventos', description: 'Eventos criados por você' },
  shared: { title: 'Compartilhados comigo', description: 'Eventos em que você participa como editor ou leitor' },
  archived: { title: 'Arquivados', description: 'Histórico de eventos arquivados' },
};

function EventCard({ event, view }: { event: Event; view: 'grid' | 'list' }) {
  return (
    <Link to={`/events/${event.id}`} className={`event-card event-card-${view}`}>
      <div className="event-card-icon"><CalendarDays size={22} /></div>
      <div className="event-card-main">
        <div className="event-card-badges">
          <span className={`badge ${STATUS_COLORS[event.status]}`}>{EVENT_STATUS_LABELS[event.status]}</span>
          <span className="event-type-label">{EVENT_TYPE_LABELS[event.type]}</span>
        </div>
        <h3>{event.title}</h3>
        <div className="event-card-meta">
          <span><CalendarDays size={15} />{format(new Date(event.start_at), "dd MMM yyyy, HH:mm", { locale: ptBR })}</span>
          {event.location && <span><MapPin size={15} />{event.location}</span>}
        </div>
      </div>
      <div className="event-card-owner">
        <Users size={15} />
        <span>{event.creator?.name || 'Equipe SIEDU'}</span>
      </div>
    </Link>
  );
}

function LibrarySkeleton() {
  return <div className="events-grid">{Array.from({ length: 6 }).map((_, index) => <div className="event-skeleton skeleton" key={index} />)}</div>;
}

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const scope = (searchParams.get('scope') as EventLibraryScope) || 'mine';
  const selectedType = (searchParams.get('type') as EventType | null) || undefined;
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const status = (searchParams.get('status') as EventStatus | null) || undefined;
  const sort = (searchParams.get('sort') as EventSort | null) || 'newest';
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchInput);
  const [view, setView] = useState<'grid' | 'list'>(() => (localStorage.getItem('siedu:event-view') === 'list' ? 'list' : 'grid'));
  const folderGridRef = useRef<HTMLDivElement>(null);
  const pendingFolderScrollRef = useRef(false);

  const scrollFolderGridIntoView = useCallback(() => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    folderGridRef.current?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (debouncedSearch) next.set('q', debouncedSearch); else next.delete('q');
    next.delete('page');
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [debouncedSearch]);

  const queryParams = useMemo(() => ({
    scope,
    type: selectedType,
    status,
    search: debouncedSearch || undefined,
    sort,
    page,
    pageSize: 50,
  }), [scope, selectedType, status, debouncedSearch, sort, page]);

  const eventsQuery = useQuery({
    queryKey: ['events', queryParams],
    queryFn: () => eventsAPI.listPaginated(queryParams),
    placeholderData: (previous) => previous,
  });

  useEffect(() => {
    if (!pendingFolderScrollRef.current || eventsQuery.isFetching) return;

    const frame = window.requestAnimationFrame(() => {
      scrollFolderGridIntoView();
      pendingFolderScrollRef.current = false;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [eventsQuery.dataUpdatedAt, eventsQuery.isFetching, scrollFolderGridIntoView, selectedType]);

  const updateParam = (name: string, value?: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value); else next.delete(name);
    if (name !== 'page') next.delete('page');
    setSearchParams(next);
  };

  const changeView = (next: 'grid' | 'list') => {
    setView(next);
    localStorage.setItem('siedu:event-view', next);
  };

  const openFolder = (type: EventType) => {
    const isMobile = window.matchMedia?.('(max-width: 860px)').matches ?? false;
    pendingFolderScrollRef.current = !isMobile;
    updateParam('type', type);
    if (!isMobile) window.requestAnimationFrame(scrollFolderGridIntoView);
  };

  const totalPages = Math.max(1, Math.ceil((eventsQuery.data?.count || 0) / 50));
  const events = eventsQuery.data?.data || [];
  const scopeCopy = SCOPE_TITLES[scope] || SCOPE_TITLES.mine;

  return (
    <Layout>
      <div className="library-header">
        <div>
          <div className="breadcrumbs"><span>Biblioteca</span><ChevronRight size={14} />{selectedType && <span>{EVENT_TYPE_LABELS[selectedType]}</span>}</div>
          <h1>{selectedType ? EVENT_TYPE_LABELS[selectedType] : scopeCopy.title}</h1>
          <p>{selectedType ? `Eventos organizados na pasta ${EVENT_TYPE_LABELS[selectedType]}` : scopeCopy.description}</p>
        </div>
        <Link to="/events/new" className="btn btn-primary"><Plus size={18} />Novo evento</Link>
      </div>

      <section className="library-search" aria-label="Pesquisa e filtros">
        <label className="search-box">
          <Search size={19} />
          <span className="sr-only">Buscar eventos</span>
          <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Buscar eventos por título..." />
        </label>
        <div className="filter-control">
          <SlidersHorizontal size={17} />
          <select aria-label="Filtrar por status" value={status || ''} onChange={(event) => updateParam('status', event.target.value)}>
            <option value="">Todos os status</option>
            {Object.entries(EVENT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="filter-control">
          <select aria-label="Ordenar eventos" value={sort} onChange={(event) => updateParam('sort', event.target.value)}>
            <option value="newest">Mais recentes</option>
            <option value="oldest">Mais antigos</option>
            <option value="title">Título A–Z</option>
          </select>
        </div>
        <div className="view-toggle" aria-label="Modo de visualização">
          <button className={view === 'grid' ? 'active' : ''} onClick={() => changeView('grid')} aria-label="Visualizar em grade"><Grid2X2 size={17} /></button>
          <button className={view === 'list' ? 'active' : ''} onClick={() => changeView('list')} aria-label="Visualizar em lista"><List size={18} /></button>
        </div>
      </section>

      <section className="folder-section" aria-labelledby="folder-title">
        <div className="section-title-row">
          <div><h2 id="folder-title">Pastas por tipo</h2><span>Organização automática dos eventos</span></div>
          {selectedType && <button className="btn btn-ghost btn-sm" onClick={() => updateParam('type')}>Ver todas</button>}
        </div>
        <div className="folder-grid" ref={folderGridRef}>
          {TYPE_ORDER.map((type) => (
            <button key={type} className={`type-folder type-folder-${type.toLowerCase()} ${selectedType === type ? 'selected' : ''}`} onClick={() => openFolder(type)}>
              <span className="type-folder-icon"><Folder size={24} fill="currentColor" /></span>
              <span><strong>{EVENT_TYPE_LABELS[type]}</strong><small>Abrir pasta</small></span>
            </button>
          ))}
        </div>
      </section>

      <section className="events-section" aria-live="polite">
        <div className="section-title-row">
          <div><h2>Eventos</h2><span>{eventsQuery.data ? `${eventsQuery.data.count} registro(s)` : 'Carregando registros'}</span></div>
          {eventsQuery.isFetching && !eventsQuery.isLoading && <span className="refresh-indicator"><span className="spinner-small" />Atualizando</span>}
        </div>

        {eventsQuery.isLoading ? <LibrarySkeleton /> : eventsQuery.isError ? (
          <div className="empty-state error-state">
            <Archive size={44} /><h3>Não foi possível carregar os eventos</h3>
            <p>{eventsQuery.error instanceof Error ? eventsQuery.error.message : 'Verifique sua conexão e tente novamente.'}</p>
            <button className="btn btn-secondary" onClick={() => eventsQuery.refetch()}>Tentar novamente</button>
          </div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <CalendarDays size={48} /><h3>Nenhum evento encontrado</h3>
            <p>Ajuste os filtros ou crie um novo evento para começar.</p>
            <Link to="/events/new" className="btn btn-primary"><Plus size={18} />Criar evento</Link>
          </div>
        ) : (
          <div className={view === 'grid' ? 'events-grid' : 'events-list'}>{events.map((event) => <EventCard key={event.id} event={event} view={view} />)}</div>
        )}

        {eventsQuery.data && eventsQuery.data.count > 50 && (
          <div className="pagination">
            <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => updateParam('page', String(page - 1))}><ChevronLeft size={16} />Anterior</button>
            <span>Página {page} de {totalPages}</span>
            <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => updateParam('page', String(page + 1))}>Próxima<ChevronRight size={16} /></button>
          </div>
        )}
      </section>
    </Layout>
  );
}
