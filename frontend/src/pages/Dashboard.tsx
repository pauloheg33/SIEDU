import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '@/components/Layout/Layout';
import { eventsAPI } from '@/lib/api';
import { Event, EventStatus, EventType } from '@/types';
import { Calendar, Plus, Filter } from 'lucide-react';
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

export default function Dashboard() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    search: '',
  });

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const params: any = {};
      if (filters.type) params.type = filters.type;
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;

      const data = await eventsAPI.list(params);
      setEvents(data);
    } catch (error: any) {
      toast.error('Erro ao carregar eventos');
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    setLoading(true);
    loadEvents();
  };

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
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
          <input
            type="text"
            className="form-input"
            placeholder="Buscar eventos..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
          
          <select
            className="form-select"
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          >
            <option value="">Todos os tipos</option>
            {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

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

      {/* Events Grid */}
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
        <div className="events-grid">
          {events.map((event) => (
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
    </Layout>
  );
}
