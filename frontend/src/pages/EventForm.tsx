import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarClock, FileText, MapPin, Save, Tags, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import Layout from '@/components/Layout/Layout';
import { eventsAPI } from '@/lib/api';
import { EventCreateRequest, EventStatus, EventType } from '@/types';
import './EventForm.css';

const EVENT_TYPES = [
  { value: EventType.FORMACAO, label: 'Formação' },
  { value: EventType.PREMIACAO, label: 'Premiação' },
  { value: EventType.ENCONTRO, label: 'Visita de Acompanhamento' },
  { value: EventType.OUTRO, label: 'Outro' },
];

const EVENT_STATUSES = [
  { value: EventStatus.PLANEJADO, label: 'Planejado' },
  { value: EventStatus.REALIZADO, label: 'Realizado' },
  { value: EventStatus.ARQUIVADO, label: 'Arquivado' },
];

const EMPTY_FORM: EventCreateRequest = {
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
};

export function toLocalDateTime(isoDate: string) {
  const date = new Date(isoDate);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function parseCommaList(value: string) {
  return Array.from(new Set(value.split(',').map((item) => item.trim()).filter(Boolean)));
}

export default function EventForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const requestId = useRef(crypto.randomUUID());
  const savingRef = useRef(false);
  const [formData, setFormData] = useState<EventCreateRequest>(EMPTY_FORM);
  const [tagsInput, setTagsInput] = useState('');
  const [schoolsInput, setSchoolsInput] = useState('');
  const [initialSnapshot, setInitialSnapshot] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const eventQuery = useQuery({
    queryKey: ['event', id],
    queryFn: () => eventsAPI.get(id!),
    enabled: isEditing,
    retry: 1,
  });

  useEffect(() => {
    if (!eventQuery.data) {
      if (!isEditing && !initialSnapshot) setInitialSnapshot(JSON.stringify({ formData: EMPTY_FORM, tagsInput: '', schoolsInput: '' }));
      return;
    }
    const event = eventQuery.data;
    const nextForm: EventCreateRequest = {
      title: event.title,
      type: event.type,
      status: event.status,
      start_at: toLocalDateTime(event.start_at),
      end_at: event.end_at ? toLocalDateTime(event.end_at) : '',
      location: event.location || '',
      audience: event.audience || '',
      description: event.description || '',
      tags: event.tags || [],
      schools: event.schools || [],
    };
    const nextTags = (event.tags || []).join(', ');
    const nextSchools = (event.schools || []).join(', ');
    setFormData(nextForm);
    setTagsInput(nextTags);
    setSchoolsInput(nextSchools);
    setInitialSnapshot(JSON.stringify({ formData: nextForm, tagsInput: nextTags, schoolsInput: nextSchools }));
  }, [eventQuery.data, isEditing]);

  const currentSnapshot = useMemo(() => JSON.stringify({ formData, tagsInput, schoolsInput }), [formData, tagsInput, schoolsInput]);
  const isDirty = Boolean(initialSnapshot) && currentSnapshot !== initialSnapshot;

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const nextErrors: Record<string, string> = {};
      if (!formData.title.trim()) nextErrors.title = 'Informe um título.';
      if (!formData.start_at) nextErrors.start_at = 'Informe a data de início.';
      if (formData.end_at && new Date(formData.end_at) < new Date(formData.start_at)) nextErrors.end_at = 'A data final deve ser posterior ao início.';
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length) throw new Error('Revise os campos destacados.');

      const payload: EventCreateRequest = {
        ...formData,
        title: formData.title.trim(),
        start_at: new Date(formData.start_at).toISOString(),
        end_at: formData.end_at ? new Date(formData.end_at).toISOString() : undefined,
        tags: parseCommaList(tagsInput),
        schools: parseCommaList(schoolsInput),
        client_request_id: isEditing ? undefined : requestId.current,
      };
      return isEditing ? eventsAPI.update(id!, payload) : eventsAPI.create(payload);
    },
    onSuccess: (event) => {
      queryClient.setQueryData(['event', event.id], event);
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setInitialSnapshot(currentSnapshot);
      toast.success(isEditing ? 'Evento atualizado com sucesso.' : 'Evento criado com sucesso.');
      navigate(`/events/${event.id}`, { replace: true });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o evento.'),
  });

  const submitForm = () => {
    if (savingRef.current) return;
    savingRef.current = true;
    saveMutation.mutate(undefined, { onSettled: () => { savingRef.current = false; } });
  };

  const leaveForm = () => {
    if (isDirty && !window.confirm('Existem alterações não salvas. Deseja sair mesmo assim?')) return;
    navigate(isEditing ? `/events/${id}` : '/events');
  };

  const setField = <K extends keyof EventCreateRequest>(field: K, value: EventCreateRequest[K]) => {
    setFormData((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: '' }));
  };

  if (eventQuery.isLoading) {
    return <Layout><div className="form-shell"><div className="form-title-skeleton skeleton" /><div className="form-card-skeleton skeleton" /></div></Layout>;
  }

  if (eventQuery.isError) {
    return <Layout><div className="empty-state error-state"><FileText size={44} /><h3>Não foi possível abrir o evento</h3><p>{eventQuery.error instanceof Error ? eventQuery.error.message : 'Tente novamente.'}</p><button className="btn btn-secondary" onClick={() => eventQuery.refetch()}>Tentar novamente</button></div></Layout>;
  }

  return (
    <Layout>
      <div className="form-page-header">
        <button className="btn btn-ghost" onClick={leaveForm}><ArrowLeft size={18} />Voltar</button>
        <div><span className="eyebrow">{isEditing ? 'Atualização' : 'Novo registro'}</span><h1>{isEditing ? 'Editar evento' : 'Criar evento'}</h1><p>Preencha as informações que ajudam a equipe a localizar e compreender esta evidência.</p></div>
      </div>

      <form className="event-form" onSubmit={(event) => { event.preventDefault(); submitForm(); }} noValidate>
        <section className="form-section card">
          <div className="form-section-heading"><span><FileText size={19} /></span><div><h2>Informações básicas</h2><p>Nome, categoria e situação atual do evento.</p></div></div>
          <div className="form-section-body">
            <div className="form-group">
              <label className="form-label" htmlFor="event-title">Título *</label>
              <input id="event-title" className="form-input" value={formData.title} onChange={(event) => setField('title', event.target.value)} placeholder="Ex.: Formação de professores alfabetizadores" aria-invalid={Boolean(errors.title)} />
              {errors.title && <span className="form-error">{errors.title}</span>}
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label" htmlFor="event-type">Tipo *</label><select id="event-type" className="form-select" value={formData.type} onChange={(event) => setField('type', event.target.value as EventType)}>{EVENT_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></div>
              <div className="form-group"><label className="form-label" htmlFor="event-status">Status *</label><select id="event-status" className="form-select" value={formData.status} onChange={(event) => setField('status', event.target.value as EventStatus)}>{EVENT_STATUSES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></div>
            </div>
          </div>
        </section>

        <section className="form-section card">
          <div className="form-section-heading"><span><CalendarClock size={19} /></span><div><h2>Quando e onde</h2><p>Período e local de realização.</p></div></div>
          <div className="form-section-body">
            <div className="form-row">
              <div className="form-group"><label className="form-label" htmlFor="event-start">Início *</label><input id="event-start" type="datetime-local" className="form-input" value={formData.start_at} onChange={(event) => setField('start_at', event.target.value)} aria-invalid={Boolean(errors.start_at)} />{errors.start_at && <span className="form-error">{errors.start_at}</span>}</div>
              <div className="form-group"><label className="form-label" htmlFor="event-end">Término</label><input id="event-end" type="datetime-local" className="form-input" value={formData.end_at || ''} onChange={(event) => setField('end_at', event.target.value)} aria-invalid={Boolean(errors.end_at)} />{errors.end_at && <span className="form-error">{errors.end_at}</span>}</div>
            </div>
            <div className="field-with-icon"><MapPin size={18} /><div className="form-group"><label className="form-label" htmlFor="event-location">Local</label><input id="event-location" className="form-input" value={formData.location || ''} onChange={(event) => setField('location', event.target.value)} placeholder="Escola, auditório ou comunidade" /></div></div>
          </div>
        </section>

        <section className="form-section card">
          <div className="form-section-heading"><span><Users size={19} /></span><div><h2>Contexto educacional</h2><p>Público, descrição e referências para busca.</p></div></div>
          <div className="form-section-body">
            <div className="form-group"><label className="form-label" htmlFor="event-audience">Público-alvo</label><input id="event-audience" className="form-input" value={formData.audience || ''} onChange={(event) => setField('audience', event.target.value)} placeholder="Ex.: Professores do Ensino Fundamental" /></div>
            <div className="form-group"><label className="form-label" htmlFor="event-description">Descrição</label><textarea id="event-description" className="form-textarea" rows={5} value={formData.description || ''} onChange={(event) => setField('description', event.target.value)} placeholder="Descreva objetivos, atividades e resultados esperados." /></div>
            <div className="form-row">
              <div className="field-with-icon compact-icon"><Tags size={17} /><div className="form-group"><label className="form-label" htmlFor="event-tags">Tags</label><input id="event-tags" className="form-input" value={tagsInput} onChange={(event) => setTagsInput(event.target.value)} placeholder="alfabetização, formação" /><span className="form-hint">Separe por vírgulas.</span></div></div>
              <div className="form-group"><label className="form-label" htmlFor="event-schools">Escolas envolvidas</label><input id="event-schools" className="form-input" value={schoolsInput} onChange={(event) => setSchoolsInput(event.target.value)} placeholder="Escola A, Escola B" /><span className="form-hint">Separe por vírgulas.</span></div>
            </div>
          </div>
        </section>

        <div className="form-action-bar">
          <div className="save-status">{isDirty ? <><span className="unsaved-dot" />Alterações não salvas</> : 'Tudo salvo'}</div>
          <div><button type="button" className="btn btn-secondary" onClick={leaveForm}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={saveMutation.isPending || (isEditing && !isDirty)}>{saveMutation.isPending ? <><span className="spinner-small" />Salvando...</> : <><Save size={17} />Salvar evento</>}</button></div>
        </div>
      </form>
    </Layout>
  );
}
