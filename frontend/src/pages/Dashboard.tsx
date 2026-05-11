import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '@/components/Layout/Layout';
import { eventsAPI } from '@/lib/api';
import { Event, EventStatus, EventType } from '@/types';
import { Calendar, Plus, Folder, ChevronDown, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-toastify';
import './Dashboard.css';

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  [EventType.FORMACAO]: 'Formação',
  [EventType.PREMIACAO]: 'Premiação',
  [EventType.ENCONTRO]: 'Visita de Acompanhamento',
  [EventType.OUTRO]: 'Outro',
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

const EVENT_TYPE_ORDER: EventType[] = [
  EventType.FORMACAO,
  EventType.PREMIACAO,
  EventType.ENCONTRO,
  EventType.OUTRO,
];

type Filters = {
  status: string;
  search: string;
};

export default function Dashboard() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    status: '',
    search: '',
  });
  const [openFolders, setOpenFolders] = useState<Record<EventType, boolean>>(() =>
    EVENT_TYPE_ORDER.reduce((acc, type) => {
      acc[type] = false;
      return acc;
    }, {} as Record<EventType, boolean>),
  );

  useEffect(() => {
    // Safety net: if loadEvents hangs, force loading=false after 20 s
    const bailout = setTimeout(() => {
      setLoading(false);
      toast.error('Tempo de conexão esgotado. Verifique sua internet e recarregue a página.');
    }, 20_000);
    loadEvents().finally(() => clearTimeout(bailout));
  }, []);

  const loadEvents = async (activeFilters: Filters = filters) => {
    try {
      const params: any = {};
      if (activeFilters.status) params.status = activeFilters.status;
      if (activeFilters.search) params.search = activeFilters.search;

      const data = await eventsAPI.list(params);
      setEvents(data);
    } catch (error: any) {
      const isAbort = error?.name === 'AbortError' || String(error?.message).toLowerCase().includes('abort');
      toast.error(isAbort
        ? 'Tempo de conexão esgotado. Verifique sua internet e tente novamente.'
        : (error?.message || 'Erro ao carregar eventos'));
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    setLoading(true);
    loadEvents();
  };

  const toggleFolder = (type: EventType) => {
    setOpenFolders((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  const eventsByType = EVENT_TYPE_ORDER.reduce((groups, type) => {
    groups[type] = events.filter((event) => event.type === type);
    return groups;
  }, {} as Record<EventType, Event[]>);

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Portifólio</h1>
          <p className="page-subtitle">SIEDU - Gerencie eventos e evidências</p>
        </div>
        <Link to="/events/new" className="btn btn-primary">
          <Plus size={20} />
          Novo Evento
        </Link>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="filters">
          <div className="filters-row">
            <input
              type="text"
              className="form-input"
              placeholder="Buscar eventos..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />

            <select
              className="form-select"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">Todos os status</option>
              {Object.entries(EVENT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <button className="btn btn-secondary" onClick={handleFilter}>
              <Filter size={18} />
              Filtrar
            </button>
          </div>

        </div>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner" />
          <p>Carregando eventos...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="empty-state">
          <Calendar size={64} />
          <h3>Nenhum evento encontrado</h3>
          <p>Crie seu primeiro evento para começar</p>
          <Link to="/events/new" className="btn btn-primary">
            <Plus size={20} />
            Criar Evento
          </Link>
        </div>
      ) : (
        <div className="folders-container" role="tablist" aria-label="Pastas de tipo de evento">
          {EVENT_TYPE_ORDER.map((type) => {
            const eventsOfType = eventsByType[type] || [];
            return (
              <div key={type} className="folder-group">
                <button
                  type="button"
                  className={`folder-header ${openFolders[type] ? 'open' : ''}`}
                  onClick={() => toggleFolder(type)}
                  aria-expanded={openFolders[type]}
                >
                  <div className="folder-icon">
                    <Folder size={18} />
                  </div>
                  <div className="folder-details">
                    <div className="folder-title">{EVENT_TYPE_LABELS[type]}</div>
                    <div className="folder-count">{eventsOfType.length} evento{eventsOfType.length !== 1 ? 's' : ''}</div>
                  </div>
                  <ChevronDown size={18} className={`folder-chevron ${openFolders[type] ? 'open' : ''}`} />
                </button>

                {openFolders[type] && (
                  <div className="folder-content">
                    {eventsOfType.length === 0 ? (
                      <div className="folder-empty">Nenhum evento neste tipo.</div>
                    ) : (
                      <div className="events-grid">
                        {eventsOfType.map((event) => (
                          <Link
                            key={event.id}
                            to={`/events/${event.id}`}
                            className="event-card"
                          >
                            <div className="event-header">
                              <span className={`badge ${STATUS_COLORS[event.status]}`}>
                                {EVENT_STATUS_LABELS[event.status]}
                              </span>
                              <span className="event-type">
                                {EVENT_TYPE_LABELS[event.type]}
                              </span>
                            </div>

                            <h3 className="event-title">{event.title}</h3>

                            <div className="event-meta">
                              <div className="event-date">
                                <Calendar size={16} />
                                {format(new Date(event.start_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </div>
                              {event.location && (
                                <div className="event-location">{event.location}</div>
                              )}
                            </div>

                            <div className="event-footer">
                              <span className="event-author">Por {event.creator?.name || 'Desconhecido'}</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
