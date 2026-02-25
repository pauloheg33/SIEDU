import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '@/components/Layout/Layout';
import { eventsAPI } from '@/lib/api';
import { EventType, EventStatus, EventCreateRequest } from '@/types';
import { Save, ArrowLeft } from 'lucide-react';
import { toast } from 'react-toastify';
import './EventForm.css';

const EVENT_TYPES = [
  { value: EventType.FORMACAO, label: 'Formação' },
  { value: EventType.PREMIACAO, label: 'Premiação' },
  { value: EventType.ENCONTRO, label: 'Visita de Acompanhamento' },
  { value: EventType.OUTRO, label: 'Outro' },
];

const EVENT_STATUS = [
  { value: EventStatus.PLANEJADO, label: 'Planejado' },
  { value: EventStatus.REALIZADO, label: 'Realizado' },
  { value: EventStatus.ARQUIVADO, label: 'Arquivado' },
];

export default function EventForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<EventCreateRequest>({
    title: '',
    type: EventType.FORMACAO,
    status: EventStatus.PLANEJADO,
    start_at: '',
    end_at: '',
    location: '',
    audience: '',
    description: '',
    tags: [],
    schools: [],
  });
  const [tagsInput, setTagsInput] = useState('');
  const [schoolsInput, setSchoolsInput] = useState('');

  useEffect(() => {
    if (isEditing) {
      loadEvent();
    }
  }, [id]);

  const loadEvent = async () => {
    try {
      setLoading(true);
      const event = await eventsAPI.get(id!);
      setFormData({
        title: event.title,
        type: event.type,
        status: event.status,
        start_at: formatDateTimeLocal(event.start_at),
        end_at: event.end_at ? formatDateTimeLocal(event.end_at) : '',
        location: event.location || '',
        audience: event.audience || '',
        description: event.description || '',
        tags: event.tags || [],
        schools: event.schools || [],
      });
      setTagsInput(event.tags?.join(', ') || '');
      setSchoolsInput(event.schools?.join(', ') || '');
    } catch (error) {
      toast.error('Erro ao carregar evento');
      navigate('/portfolio');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTimeLocal = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toISOString().slice(0, 16);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('O título é obrigatório');
      return;
    }

    if (!formData.start_at) {
      toast.error('A data de início é obrigatória');
      return;
    }

    try {
      setSaving(true);
      
      const eventData: EventCreateRequest = {
        ...formData,
        start_at: new Date(formData.start_at).toISOString(),
        end_at: formData.end_at ? new Date(formData.end_at).toISOString() : undefined,
        tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
        schools: schoolsInput.split(',').map(s => s.trim()).filter(Boolean),
      };

      if (isEditing) {
        await eventsAPI.update(id!, eventData);
        toast.success('Evento atualizado com sucesso!');
      } else {
        const event = await eventsAPI.create(eventData);
        toast.success('Evento criado com sucesso!');
        navigate(`/events/${event.id}`);
        return;
      }

      navigate(`/events/${id}`);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao salvar evento');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="loading">
          <div className="spinner" />
          <p>Carregando evento...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <button 
            className="btn btn-ghost" 
            onClick={() => navigate(-1)}
            style={{ marginBottom: '0.5rem' }}
          >
            <ArrowLeft size={20} />
            Voltar
          </button>
          <h1 className="page-title">
            {isEditing ? 'Editar Evento' : 'Novo Evento'}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="event-form">
        <div className="card">
          <div className="card-header">
            <h2>Informações Básicas</h2>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Título *</label>
              <input
                type="text"
                className="form-input"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Nome do evento"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Tipo *</label>
                <select
                  className="form-select"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as EventType })}
                >
                  {EVENT_TYPES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Status *</label>
                <select
                  className="form-select"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as EventStatus })}
                >
                  {EVENT_STATUS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Data/Hora Início *</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={formData.start_at}
                  onChange={(e) => setFormData({ ...formData, start_at: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Data/Hora Fim</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={formData.end_at}
                  onChange={(e) => setFormData({ ...formData, end_at: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Local</label>
              <input
                type="text"
                className="form-input"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Local do evento"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Público-Alvo</label>
              <input
                type="text"
                className="form-input"
                value={formData.audience}
                onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
                placeholder="Ex: Professores do Ensino Fundamental"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Descrição</label>
              <textarea
                className="form-textarea"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição detalhada do evento"
                rows={4}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tags/Categorias</label>
              <input
                type="text"
                className="form-input"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Separe as tags por vírgula"
              />
              <small className="form-hint">Ex: capacitação, tecnologia, educação</small>
            </div>

            <div className="form-group">
              <label className="form-label">Escolas Vinculadas</label>
              <input
                type="text"
                className="form-input"
                value={schoolsInput}
                onChange={(e) => setSchoolsInput(e.target.value)}
                placeholder="Separe as escolas por vírgula"
              />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={() => navigate(-1)}
          >
            Cancelar
          </button>
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? (
              <>
                <div className="spinner-small" />
                Salvando...
              </>
            ) : (
              <>
                <Save size={20} />
                {isEditing ? 'Salvar Alterações' : 'Criar Evento'}
              </>
            )}
          </button>
        </div>
      </form>
    </Layout>
  );
}
