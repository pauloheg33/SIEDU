import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Layout from '@/components/Layout/Layout';
import { eventsAPI, filesAPI, attendanceAPI, notesAPI, reportsAPI, collaboratorsAPI, usersAPI } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import {
  Event,
  EventFile,
  Attendance,
  EventNote,
  EventReport,
  EventType,
  EventStatus,
  FileKind,
  FileScope,
  EventCollaborator,
  CollaborationRole,
  User,
  UserRole,
} from '@/types';
import { 
  ArrowLeft, Edit, Trash2, Calendar, MapPin, Users, 
  Image, FileText, ClipboardList, MessageSquare, 
  Upload, Plus, X, Check, Save, Eye, File, Share2, Copy, Download, UserPlus, Shield, UserRound
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-toastify';
import { QRCodeSVG } from 'qrcode.react';
import './EventDetail.css';

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

const EVENT_STATUS_COLORS: Record<EventStatus, string> = {
  [EventStatus.PLANEJADO]: 'badge-warning',
  [EventStatus.REALIZADO]: 'badge-success',
  [EventStatus.ARQUIVADO]: 'badge-secondary',
};

type TabType = 'overview' | 'photos' | 'report' | 'attendance' | 'notes' | 'collaborators';

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  
  const cachedEvent = queryClient.getQueryData<Event>(['event', id]);
  const [event, setEvent] = useState<Event | null>(cachedEvent || null);
  const [loading, setLoading] = useState(!cachedEvent);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [tabLoading, setTabLoading] = useState(false);
  const [tabError, setTabError] = useState('');
  
  // Photos
  const [photos, setPhotos] = useState<EventFile[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [failedPhotoFiles, setFailedPhotoFiles] = useState<File[]>([]);
  const [photoUploadStatus, setPhotoUploadStatus] = useState<Array<{ key: string; name: string; status: 'pending' | 'uploading' | 'complete' | 'error' }>>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<EventFile | null>(null);
  
  // Report (Relatório)
  const [report, setReport] = useState<EventReport | null>(null);
  const [reportContent, setReportContent] = useState('');
  const [savingReport, setSavingReport] = useState(false);
  const [reportPdfs, setReportPdfs] = useState<EventFile[]>([]);
  const [uploadingReportPdf, setUploadingReportPdf] = useState(false);
  const [reportPpts, setReportPpts] = useState<EventFile[]>([]);
  const [uploadingReportPpt, setUploadingReportPpt] = useState(false);
  const [previewReportPdf, setPreviewReportPdf] = useState<EventFile | null>(null);
  const [previewReportPpt, setPreviewReportPpt] = useState<EventFile | null>(null);
  
  // Attendance
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [showAddAttendee, setShowAddAttendee] = useState(false);
  const [newAttendee, setNewAttendee] = useState({
    person_name: '',
    person_role: '',
    school: '',
    present: true,
  });
  const [attendancePdfs, setAttendancePdfs] = useState<EventFile[]>([]);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [previewPdf, setPreviewPdf] = useState<EventFile | null>(null);
  
  // Notes
  const [notes, setNotes] = useState<EventNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Share
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [generatingToken, setGeneratingToken] = useState(false);

  // Collaboration
  const [collaborators, setCollaborators] = useState<EventCollaborator[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedCollaborator, setSelectedCollaborator] = useState('');
  const [selectedRole, setSelectedRole] = useState<CollaborationRole>(CollaborationRole.EDITOR);
  const [savingCollaborator, setSavingCollaborator] = useState(false);

  useEffect(() => {
    if (id) {
      loadEvent();
      collaboratorsAPI.list(id).then(setCollaborators).catch(() => setCollaborators([]));
    }
  }, [id]);

  useEffect(() => {
    if (id && event) {
      loadTabData();
    }
  }, [activeTab, id, event]);

  const loadEvent = async () => {
    try {
      if (!event) setLoading(true);
      const data = await eventsAPI.get(id!);
      setEvent(data);
      queryClient.setQueryData(['event', id], data);
      if (data.share_token) setShareToken(data.share_token);
    } catch (error) {
      toast.error('Erro ao carregar evento');
      navigate('/events');
    } finally {
      setLoading(false);
    }
  };

  const loadTabData = async () => {
    try {
      setTabLoading(activeTab !== 'overview');
      setTabError('');
      switch (activeTab) {
        case 'photos': {
          const photosData = await filesAPI.list(id!, FileKind.PHOTO);
          setPhotos(photosData);
          break;
        }
        case 'report': {
          const [reportData, reportPdfFiles, reportPptFiles] = await Promise.all([
            reportsAPI.get(id!),
            filesAPI.list(id!, FileKind.DOC, FileScope.REPORT_PDF),
            filesAPI.list(id!, FileKind.DOC, FileScope.REPORT_PPT),
          ]);
          setReport(reportData);
          setReportContent(reportData?.content || '');
          setReportPdfs(reportPdfFiles);
          setReportPpts(reportPptFiles);
          break;
        }
        case 'attendance': {
          const [attendanceData, pdfFiles] = await Promise.all([
            attendanceAPI.list(id!),
            filesAPI.list(id!, FileKind.DOC, FileScope.ATTENDANCE_PDF),
          ]);
          setAttendance(attendanceData);
          setAttendancePdfs(pdfFiles);
          break;
        }
        case 'notes': {
          const notesData = await notesAPI.list(id!);
          setNotes(notesData);
          break;
        }
        case 'collaborators': {
          const [collaboratorData, usersData] = await Promise.all([
            collaboratorsAPI.list(id!),
            usersAPI.list(),
          ]);
          setCollaborators(collaboratorData);
          setAvailableUsers(usersData.filter((user) => user.is_active));
          break;
        }
      }
    } catch (error) {
      console.error('Error loading tab data:', error);
      setTabError(error instanceof Error ? error.message : 'Não foi possível carregar esta seção.');
    } finally {
      setTabLoading(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!window.confirm('Tem certeza que deseja excluir este evento?')) return;
    
    try {
      await eventsAPI.delete(id!);
      queryClient.removeQueries({ queryKey: ['event', id] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Evento excluído com sucesso');
      navigate('/events');
    } catch (error) {
      toast.error('Erro ao excluir evento');
    }
  };

  // Photo handlers
  const uploadPhotos = async (files: File[]) => {
    if (!files.length) return;
    const fileKey = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;
    setPhotoUploadStatus(files.map((file) => ({ key: fileKey(file), name: file.name, status: 'pending' })));
    try {
      setUploadingPhotos(true);
      const uploaded = await filesAPI.upload(id!, files, FileKind.PHOTO, FileScope.UNSCOPED, (file, status) => {
        setPhotoUploadStatus((current) => current.map((item) => item.key === fileKey(file) ? { ...item, status } : item));
      });
      setPhotos((current) => [...uploaded, ...current]);
      setFailedPhotoFiles([]);
      toast.success('Fotos enviadas com sucesso!');
    } catch (error: any) {
      if (error?.uploadedFiles?.length) setPhotos((current) => [...error.uploadedFiles, ...current]);
      setFailedPhotoFiles(error?.failedFiles || files);
      toast.error(error?.message || 'Erro ao enviar fotos');
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    try {
      await uploadPhotos(Array.from(files));
    } finally {
      e.target.value = '';
    }
  };

  const isPptFile = (file: File) => {
    const pptMimes = [
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/octet-stream',
    ];
    const lowerName = file.name.toLowerCase();
    return pptMimes.includes(file.type) || lowerName.endsWith('.ppt') || lowerName.endsWith('.pptx');
  };

  const handleDeletePhoto = async (fileId: string) => {
    if (!window.confirm('Excluir esta foto?')) return;
    
    try {
      await filesAPI.delete(id!, fileId);
      toast.success('Foto excluída');
      setPhotos(photos.filter(p => p.id !== fileId));
      setSelectedPhoto(null);
    } catch (error) {
      toast.error('Erro ao excluir foto');
    }
  };

  const handleDownloadPhoto = (photo: EventFile) => {
    const link = document.createElement('a');
    link.href = photo.url;
    link.download = photo.filename || 'download';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Download iniciado');
  };

  // Report handlers
  const handleReportPdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    const file = files[0];
    if (file.type !== 'application/pdf') {
      toast.error('Por favor, selecione um arquivo PDF');
      return;
    }

    try {
      setUploadingReportPdf(true);
      const [uploaded] = await filesAPI.upload(id!, [file], FileKind.DOC, FileScope.REPORT_PDF);
      setReportPdfs((current) => [uploaded, ...current]);
      toast.success('PDF do relatório enviado com sucesso!');
    } catch (error) {
      toast.error('Erro ao enviar PDF do relatório');
    } finally {
      setUploadingReportPdf(false);
      e.target.value = '';
    }
  };

  const handleDeleteReportPdf = async (fileId: string) => {
    if (!window.confirm('Excluir este PDF do relatório?')) return;

    try {
      await filesAPI.delete(id!, fileId);
      toast.success('PDF excluído');
      setReportPdfs(reportPdfs.filter(p => p.id !== fileId));
      if (previewReportPdf?.id === fileId) setPreviewReportPdf(null);
    } catch (error) {
      toast.error('Erro ao excluir PDF');
    }
  };

  const handleReportPptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    const file = files[0];
    if (!isPptFile(file)) {
      toast.error('Por favor, selecione um arquivo PPT ou PPTX');
      return;
    }

    try {
      setUploadingReportPpt(true);
      const [uploaded] = await filesAPI.upload(id!, [file], FileKind.DOC, FileScope.REPORT_PPT);
      setReportPpts((current) => [uploaded, ...current]);
      toast.success('PPT do relatório enviado com sucesso!');
    } catch (error) {
      toast.error('Erro ao enviar PPT do relatório');
    } finally {
      setUploadingReportPpt(false);
      e.target.value = '';
    }
  };

  const handleDeleteReportPpt = async (fileId: string) => {
    if (!window.confirm('Excluir este PPT do relatório?')) return;

    try {
      await filesAPI.delete(id!, fileId);
      toast.success('PPT excluído');
      setReportPpts(reportPpts.filter(p => p.id !== fileId));
      if (previewReportPpt?.id === fileId) setPreviewReportPpt(null);
    } catch (error) {
      toast.error('Erro ao excluir PPT');
    }
  };

  const handleSaveReport = async () => {
    if (!reportContent.trim()) {
      toast.error('O conteúdo do relatório é obrigatório');
      return;
    }

    try {
      setSavingReport(true);
      const savedReport = await reportsAPI.upsert(id!, { content: reportContent });
      setReport(savedReport);
      toast.success('Relatório salvo com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar relatório');
    } finally {
      setSavingReport(false);
    }
  };

  // Attendance handlers
  const handleAddAttendee = async () => {
    if (!newAttendee.person_name.trim()) {
      toast.error('O nome é obrigatório');
      return;
    }

    try {
      const created = await attendanceAPI.create(id!, newAttendee);
      setAttendance((current) => [...current, created].sort((a, b) => a.person_name.localeCompare(b.person_name)));
      toast.success('Participante adicionado');
      setNewAttendee({ person_name: '', person_role: '', school: '', present: true });
      setShowAddAttendee(false);
    } catch (error) {
      toast.error('Erro ao adicionar participante');
    }
  };

  const handleDeleteAttendee = async (attendeeId: string) => {
    if (!window.confirm('Remover este participante?')) return;
    
    try {
      await attendanceAPI.delete(id!, attendeeId);
      setAttendance(attendance.filter(a => a.id !== attendeeId));
    } catch (error) {
      toast.error('Erro ao remover participante');
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    const file = files[0];
    if (file.type !== 'application/pdf') {
      toast.error('Por favor, selecione um arquivo PDF');
      return;
    }

    try {
      setUploadingPdf(true);
      const [uploaded] = await filesAPI.upload(id!, [file], FileKind.DOC, FileScope.ATTENDANCE_PDF);
      setAttendancePdfs((current) => [uploaded, ...current]);
      toast.success('PDF de frequência enviado com sucesso!');
    } catch (error) {
      toast.error('Erro ao enviar PDF');
    } finally {
      setUploadingPdf(false);
      e.target.value = '';
    }
  };

  const handleDeletePdf = async (fileId: string) => {
    if (!window.confirm('Excluir este PDF de frequência?')) return;

    try {
      await filesAPI.delete(id!, fileId);
      toast.success('PDF excluído');
      setAttendancePdfs(attendancePdfs.filter(p => p.id !== fileId));
      if (previewPdf?.id === fileId) setPreviewPdf(null);
    } catch (error) {
      toast.error('Erro ao excluir PDF');
    }
  };

  // Notes handlers
  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    try {
      setSavingNote(true);
      const created = await notesAPI.create(id!, { text: newNote });
      setNotes((current) => [created, ...current]);
      toast.success('Observação adicionada');
      setNewNote('');
    } catch (error) {
      toast.error('Erro ao adicionar observação');
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm('Excluir esta observação?')) return;
    
    try {
      await notesAPI.delete(id!, noteId);
      setNotes(notes.filter(n => n.id !== noteId));
    } catch (error) {
      toast.error('Erro ao excluir observação');
    }
  };

  // Share handlers
  const handleShare = async () => {
    if (shareToken) {
      setShowShareModal(true);
      return;
    }

    if (!window.confirm('O link público mostrará todos os dados do evento, incluindo frequência, observações, relatórios e arquivos. Deseja ativar o compartilhamento?')) return;

    try {
      setGeneratingToken(true);
      const token = await eventsAPI.generateShareToken(id!);
      setShareToken(token);
      setShowShareModal(true);
    } catch (error) {
      toast.error('Erro ao gerar link de compartilhamento');
    } finally {
      setGeneratingToken(false);
    }
  };

  const getShareUrl = () => {
    const base = window.location.origin;
    return `${base}/SIEDU/share/${shareToken}`;
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl());
      toast.success('Link copiado!');
    } catch {
      toast.error('Erro ao copiar link');
    }
  };

  const handleRevokeShare = async () => {
    if (!window.confirm('Revogar o compartilhamento? O QR Code atual deixará de funcionar.')) return;

    try {
      await eventsAPI.revokeShareToken(id!);
      setShareToken(null);
      setShowShareModal(false);
      toast.success('Compartilhamento revogado');
    } catch (error) {
      toast.error('Erro ao revogar compartilhamento');
    }
  };

  const currentCollaboration = collaborators.find((item) => item.user_id === currentUser?.id);
  const isOwner = event?.created_by === currentUser?.id;
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const canManage = Boolean(isOwner || isAdmin);
  const canEdit = Boolean(canManage || currentCollaboration?.role === CollaborationRole.EDITOR);

  const handleSaveCollaborator = async () => {
    if (!selectedCollaborator) {
      toast.error('Selecione um usuário.');
      return;
    }
    try {
      setSavingCollaborator(true);
      const saved = await collaboratorsAPI.upsert(id!, selectedCollaborator, selectedRole);
      setCollaborators((current) => [...current.filter((item) => item.user_id !== saved.user_id), saved]);
      setSelectedCollaborator('');
      toast.success('Colaborador adicionado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível adicionar o colaborador.');
    } finally {
      setSavingCollaborator(false);
    }
  };

  const handleRemoveCollaborator = async (userId: string) => {
    if (!window.confirm('Remover este colaborador do evento?')) return;
    try {
      await collaboratorsAPI.remove(id!, userId);
      setCollaborators((current) => current.filter((item) => item.user_id !== userId));
      toast.success('Colaborador removido.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível remover o colaborador.');
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

  if (!event) return null;

  return (
    <Layout>
      {/* Header */}
      <div className="event-detail-header">
        <div className="header-left">
          <button className="btn btn-ghost" onClick={() => navigate('/events')}>
            <ArrowLeft size={20} />
            Voltar
          </button>
          <div className="event-info">
            <div className="event-badges">
              <span className="badge badge-primary">{EVENT_TYPE_LABELS[event.type]}</span>
              <span className={`badge ${EVENT_STATUS_COLORS[event.status]}`}>{EVENT_STATUS_LABELS[event.status]}</span>
            </div>
            <h1>{event.title}</h1>
          </div>
        </div>
        <div className="header-actions">
          {canManage && (
          <button 
            className="btn btn-secondary" 
            onClick={handleShare}
            disabled={generatingToken}
          >
            <Share2 size={18} />
            {generatingToken ? 'Gerando...' : 'Compartilhar'}
          </button>
          )}
          {canEdit && (
          <Link to={`/events/${id}/edit`} className="btn btn-secondary">
            <Edit size={18} />
            Editar
          </Link>
          )}
          {canManage && (
          <button className="btn btn-danger" onClick={handleDeleteEvent}>
            <Trash2 size={18} />
            Excluir
          </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Calendar size={18} />
          Visão Geral
        </button>
        <button 
          className={`tab ${activeTab === 'photos' ? 'active' : ''}`}
          onClick={() => setActiveTab('photos')}
        >
          <Image size={18} />
          Fotos
        </button>
        <button 
          className={`tab ${activeTab === 'report' ? 'active' : ''}`}
          onClick={() => setActiveTab('report')}
        >
          <FileText size={18} />
          Relatório
        </button>
        <button 
          className={`tab ${activeTab === 'attendance' ? 'active' : ''}`}
          onClick={() => setActiveTab('attendance')}
        >
          <ClipboardList size={18} />
          Frequência
        </button>
        <button 
          className={`tab ${activeTab === 'notes' ? 'active' : ''}`}
          onClick={() => setActiveTab('notes')}
        >
          <MessageSquare size={18} />
          Observações
        </button>
        <button
          className={`tab ${activeTab === 'collaborators' ? 'active' : ''}`}
          onClick={() => setActiveTab('collaborators')}
        >
          <UserRound size={18} />
          Colaboradores
        </button>
      </div>

      {/* Tab Content */}
      <div className={`tab-content ${canEdit ? '' : 'read-only'}`}>
        {tabLoading && <div className="tab-feedback"><span className="spinner" /><span>Carregando seção...</span></div>}
        {tabError && <div className="tab-error"><span>{tabError}</span><button className="btn btn-secondary btn-sm" onClick={loadTabData}>Tentar novamente</button></div>}
        {!canEdit && activeTab !== 'overview' && activeTab !== 'collaborators' && (
          <div className="read-only-notice"><Eye size={17} />Você possui acesso somente para leitura neste evento.</div>
        )}
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <div className="info-grid">
              <div className="info-card">
                <Calendar size={24} />
                <div>
                  <label>Data/Hora</label>
                  <p>
                    {format(new Date(event.start_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    {event.end_at && ` - ${format(new Date(event.end_at), "HH:mm", { locale: ptBR })}`}
                  </p>
                </div>
              </div>
              
              {event.location && (
                <div className="info-card">
                  <MapPin size={24} />
                  <div>
                    <label>Local</label>
                    <p>{event.location}</p>
                  </div>
                </div>
              )}
              
              {event.audience && (
                <div className="info-card">
                  <Users size={24} />
                  <div>
                    <label>Público-Alvo</label>
                    <p>{event.audience}</p>
                  </div>
                </div>
              )}
            </div>

            {event.description && (
              <div className="description-card">
                <h3>Descrição</h3>
                <p>{event.description}</p>
              </div>
            )}

            {event.tags && event.tags.length > 0 && (
              <div className="tags-section">
                <h3>Tags</h3>
                <div className="tags-list">
                  {event.tags.map((tag, i) => (
                    <span key={i} className="tag">{tag}</span>
                  ))}
                </div>
              </div>
            )}

            {event.schools && event.schools.length > 0 && (
              <div className="schools-section">
                <h3>Escolas Vinculadas</h3>
                <ul>
                  {event.schools.map((school, i) => (
                    <li key={i}>{school}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Photos Tab */}
        {activeTab === 'photos' && (
          <div className="photos-tab">
            <div className="tab-header">
              <h3>Galeria de Fotos</h3>
              <label className="btn btn-primary">
                <Upload size={18} />
                {uploadingPhotos ? 'Enviando...' : 'Enviar Fotos'}
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhotos}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {photoUploadStatus.length > 0 && (
              <div className="upload-status-list" aria-live="polite">
                {photoUploadStatus.map((item) => (
                  <div className={`upload-status upload-status-${item.status}`} key={item.key}>
                    <span>{item.name}</span>
                    <strong>{item.status === 'pending' ? 'Na fila' : item.status === 'uploading' ? 'Enviando' : item.status === 'complete' ? 'Concluído' : 'Falhou'}</strong>
                  </div>
                ))}
                {failedPhotoFiles.length > 0 && !uploadingPhotos && (
                  <button className="btn btn-secondary" type="button" onClick={() => uploadPhotos(failedPhotoFiles)}>
                    Tentar novamente somente os que falharam
                  </button>
                )}
              </div>
            )}

            {photos.length === 0 ? (
              <div className="empty-state">
                <Image size={48} />
                <p>Nenhuma foto adicionada</p>
              </div>
            ) : (
              <div className="photos-grid">
                {photos.map((photo) => (
                  <div 
                    key={photo.id} 
                    className="photo-item"
                    onClick={() => setSelectedPhoto(photo)}
                  >
                    <img 
                      src={photo.thumbnail_url || photo.url} 
                      alt={photo.filename}
                      loading="lazy"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (target.src !== photo.url) {
                          target.src = photo.url;
                        }
                      }}
                    />
                    <div className="photo-actions">
                      <button 
                        className="download-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadPhoto(photo);
                        }}
                        title="Baixar foto"
                      >
                        <Download size={16} />
                      </button>
                      <button 
                        className="delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePhoto(photo.id);
                        }}
                        title="Deletar foto"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Lightbox */}
            {selectedPhoto && (
              <div className="lightbox" onClick={() => setSelectedPhoto(null)}>
                <button className="close-btn" onClick={() => setSelectedPhoto(null)}>
                  <X size={24} />
                </button>
                <img 
                  src={selectedPhoto.url} 
                  alt={selectedPhoto.filename}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Report Tab - Relatório */}
        {activeTab === 'report' && (
          <div className="report-tab">
            <div className="tab-header">
              <h3>Relatório do Evento</h3>
              <div className="header-buttons">
                <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                  <Upload size={18} />
                  {uploadingReportPdf ? 'Enviando...' : 'Enviar PDF'}
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleReportPdfUpload}
                    disabled={uploadingReportPdf}
                    style={{ display: 'none' }}
                  />
                </label>
                <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                  <Upload size={18} />
                  {uploadingReportPpt ? 'Enviando...' : 'Upload de PPT'}
                  <input
                    type="file"
                    accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    onChange={handleReportPptUpload}
                    disabled={uploadingReportPpt}
                    style={{ display: 'none' }}
                  />
                </label>
                <button 
                  className="btn btn-primary"
                  onClick={handleSaveReport}
                  disabled={savingReport}
                >
                  <Save size={18} />
                  {savingReport ? 'Salvando...' : 'Salvar Relatório'}
                </button>
              </div>
            </div>

            {/* PDFs do Relatório */}
            {reportPdfs.length > 0 && (
              <div className="report-pdfs-section">
                <h4>PDFs Anexados</h4>
                <div className="report-pdfs-list">
                  {reportPdfs.map((pdf) => (
                    <div key={pdf.id} className="report-pdf-item">
                      <div className="report-pdf-info" onClick={() => setPreviewReportPdf(previewReportPdf?.id === pdf.id ? null : pdf)}>
                        <File size={20} />
                        <div>
                          <span className="report-pdf-name">{pdf.filename}</span>
                          <span className="report-pdf-size">{(pdf.size / 1024).toFixed(0)} KB</span>
                        </div>
                      </div>
                      <div className="report-pdf-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => setPreviewReportPdf(previewReportPdf?.id === pdf.id ? null : pdf)}>
                          <Eye size={16} />
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteReportPdf(pdf.id)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {previewReportPdf && (
                  <div className="report-pdf-preview">
                    <iframe
                      src={previewReportPdf.url}
                      title={previewReportPdf.filename}
                      width="100%"
                      height="600px"
                      style={{ border: '1px solid #d1d5db', borderRadius: '0.5rem' }}
                    />
                  </div>
                )}
              </div>
            )}

            {reportPpts.length > 0 && (
              <div className="report-pdfs-section">
                <h4>PPTs Anexados</h4>
                <div className="report-pdfs-list">
                  {reportPpts.map((ppt) => (
                    <div key={ppt.id} className="report-pdf-item">
                      <div className="report-pdf-info">
                        <FileText size={20} />
                        <div>
                          <span className="report-pdf-name">{ppt.filename}</span>
                          <span className="report-pdf-size">{(ppt.size / 1024).toFixed(0)} KB</span>
                        </div>
                      </div>
                      <div className="report-pdf-actions">
                        <a
                          className="btn btn-ghost btn-sm"
                          href={ppt.url}
                          target="_blank"
                          rel="noreferrer"
                          title="Abrir PPT"
                        >
                          <Eye size={16} />
                        </a>
                        <button className="btn btn-ghost btn-sm" onClick={() => setPreviewReportPpt(previewReportPpt?.id === ppt.id ? null : ppt)}>
                          <FileText size={16} />
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteReportPpt(ppt.id)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {previewReportPpt && (
                  <div className="report-pdf-preview">
                    <p>
                      O arquivo <strong>{previewReportPpt.filename}</strong> foi selecionado. Use o botão de visualização para abrir em nova aba.
                    </p>
                  </div>
                )}
              </div>
            )}
            
            <div className="report-form">
              <p className="report-description">
                Ou digite o relatório manualmente abaixo:
              </p>
              <textarea
                className="form-textarea report-textarea"
                placeholder="Digite o relatório do evento aqui..."
                value={reportContent}
                onChange={(e) => setReportContent(e.target.value)}
                rows={15}
              />
              {report && (
                <p className="report-meta">
                  Última atualização: {new Date(report.updated_at).toLocaleString('pt-BR')} 
                  {report.author && ` por ${report.author.name}`}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Attendance Tab */}
        {activeTab === 'attendance' && (
          <div className="attendance-tab">
            <div className="tab-header">
              <h3>Lista de Presença ({attendance.length})</h3>
              <div className="header-buttons">
                <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                  <Upload size={18} />
                  {uploadingPdf ? 'Enviando...' : 'Importar PDF'}
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handlePdfUpload}
                    disabled={uploadingPdf}
                    style={{ display: 'none' }}
                  />
                </label>
                <button 
                  className="btn btn-primary"
                  onClick={() => setShowAddAttendee(true)}
                >
                  <Plus size={18} />
                  Adicionar
                </button>
              </div>
            </div>

            {showAddAttendee && (
              <div className="add-attendee-form">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Nome *"
                  value={newAttendee.person_name}
                  onChange={(e) => setNewAttendee({ ...newAttendee, person_name: e.target.value })}
                />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Função/Cargo"
                  value={newAttendee.person_role}
                  onChange={(e) => setNewAttendee({ ...newAttendee, person_role: e.target.value })}
                />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Escola"
                  value={newAttendee.school}
                  onChange={(e) => setNewAttendee({ ...newAttendee, school: e.target.value })}
                />
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={newAttendee.present}
                    onChange={(e) => setNewAttendee({ ...newAttendee, present: e.target.checked })}
                  />
                  Presente
                </label>
                <div className="form-actions">
                  <button className="btn btn-secondary" onClick={() => setShowAddAttendee(false)}>
                    Cancelar
                  </button>
                  <button className="btn btn-primary" onClick={handleAddAttendee}>
                    Adicionar
                  </button>
                </div>
              </div>
            )}

            {/* Uploaded PDFs */}
            {attendancePdfs.length > 0 && (
              <div className="attendance-pdfs">
                <h4 className="pdf-section-title">PDFs de Frequência</h4>
                <div className="pdf-list">
                  {attendancePdfs.map((pdf) => (
                    <div key={pdf.id} className="pdf-item">
                      <div className="pdf-item-info">
                        <File size={20} />
                        <div className="pdf-item-details">
                          <span className="pdf-name">{pdf.filename}</span>
                          <span className="pdf-meta">
                            {(pdf.size / 1024).toFixed(0)} KB &middot; {new Date(pdf.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                      <div className="pdf-item-actions">
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => setPreviewPdf(previewPdf?.id === pdf.id ? null : pdf)}
                          title="Pré-visualizar"
                        >
                          <Eye size={16} />
                          {previewPdf?.id === pdf.id ? 'Fechar' : 'Visualizar'}
                        </button>
                        <button
                          className="btn btn-icon btn-danger"
                          onClick={() => handleDeletePdf(pdf.id)}
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* PDF Preview */}
                {previewPdf && (
                  <div className="pdf-preview">
                    <div className="pdf-preview-header">
                      <span>{previewPdf.filename}</span>
                      <button className="btn btn-sm btn-secondary" onClick={() => setPreviewPdf(null)}>
                        <X size={16} />
                        Fechar
                      </button>
                    </div>
                    <iframe
                      src={previewPdf.url}
                      className="pdf-preview-frame"
                      title={`Pré-visualização: ${previewPdf.filename}`}
                    />
                  </div>
                )}
              </div>
            )}

            {attendance.length === 0 && attendancePdfs.length === 0 ? (
              <div className="empty-state">
                <ClipboardList size={48} />
                <p>Nenhum participante registrado</p>
                <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '0.5rem' }}>
                  Adicione participantes ou importe um PDF de frequência
                </p>
              </div>
            ) : attendance.length > 0 ? (
              <table className="attendance-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Função</th>
                    <th>Escola</th>
                    <th>Presença</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((a) => (
                    <tr key={a.id}>
                      <td>{a.person_name}</td>
                      <td>{a.person_role || '-'}</td>
                      <td>{a.school || '-'}</td>
                      <td>
                        {a.present ? (
                          <span className="presence-yes"><Check size={16} /> Sim</span>
                        ) : (
                          <span className="presence-no"><X size={16} /> Não</span>
                        )}
                      </td>
                      <td>
                        <button 
                          className="btn btn-icon btn-danger"
                          onClick={() => handleDeleteAttendee(a.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <div className="notes-tab">
            <div className="add-note">
              <textarea
                className="form-textarea"
                placeholder="Adicionar observação..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={3}
              />
              <button 
                className="btn btn-primary"
                onClick={handleAddNote}
                disabled={savingNote || !newNote.trim()}
              >
                {savingNote ? 'Salvando...' : 'Adicionar Observação'}
              </button>
            </div>

            {notes.length === 0 ? (
              <div className="empty-state">
                <MessageSquare size={48} />
                <p>Nenhuma observação registrada</p>
              </div>
            ) : (
              <div className="notes-list">
                {notes.map((note) => (
                  <div key={note.id} className="note-card">
                    <div className="note-header">
                      <span className="note-author">{note.author?.name || 'Usuário'}</span>
                      <span className="note-date">
                        {format(new Date(note.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="note-text">{note.text}</p>
                    <button 
                      className="btn btn-icon btn-danger"
                      onClick={() => handleDeleteNote(note.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'collaborators' && (
          <div className="collaborators-tab">
            <div className="collaboration-heading">
              <div><h2>Colaboradores do evento</h2><p>Defina quem pode editar ou apenas consultar este conteúdo.</p></div>
              <span className="badge badge-primary"><Shield size={14} />{collaborators.length + 1} pessoa(s)</span>
            </div>

            {canManage && (
              <div className="collaborator-form card">
                <div className="collaborator-select">
                  <label className="form-label" htmlFor="collaborator-user">Usuário</label>
                  <select id="collaborator-user" className="form-select" value={selectedCollaborator} onChange={(e) => setSelectedCollaborator(e.target.value)}>
                    <option value="">Selecione um usuário</option>
                    {availableUsers.filter((user) => user.id !== event.created_by && !collaborators.some((item) => item.user_id === user.id)).map((user) => <option key={user.id} value={user.id}>{user.name} — {user.email}</option>)}
                  </select>
                </div>
                <div><label className="form-label" htmlFor="collaborator-role">Permissão</label><select id="collaborator-role" className="form-select" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value as CollaborationRole)}><option value={CollaborationRole.EDITOR}>Pode editar</option><option value={CollaborationRole.VIEWER}>Somente leitura</option></select></div>
                <button className="btn btn-primary" disabled={savingCollaborator || !selectedCollaborator} onClick={handleSaveCollaborator}>{savingCollaborator ? <span className="spinner-small" /> : <UserPlus size={17} />}Adicionar</button>
              </div>
            )}

            <div className="collaborator-list">
              <div className="collaborator-row owner-row">
                <span className="collaborator-avatar"><UserRound size={18} /></span>
                <span className="collaborator-copy"><strong>{event.creator?.name || 'Proprietário do evento'}</strong><small>{event.creator?.email || 'Criador original'}</small></span>
                <span className="badge badge-success">Proprietário</span>
              </div>
              {collaborators.map((collaborator) => (
                <div className="collaborator-row" key={collaborator.user_id}>
                  <span className="collaborator-avatar"><UserRound size={18} /></span>
                  <span className="collaborator-copy"><strong>{collaborator.user?.name || 'Usuário'}</strong><small>{collaborator.user?.email || ''}</small></span>
                  <select className="form-select compact-collaborator-role" disabled={!canManage || savingCollaborator} value={collaborator.role} onChange={async (e) => { setSavingCollaborator(true); try { const saved = await collaboratorsAPI.upsert(id!, collaborator.user_id, e.target.value as CollaborationRole); setCollaborators((current) => current.map((item) => item.user_id === saved.user_id ? saved : item)); toast.success('Permissão atualizada.'); } catch (error) { toast.error(error instanceof Error ? error.message : 'Erro ao atualizar permissão.'); } finally { setSavingCollaborator(false); } }}><option value={CollaborationRole.EDITOR}>Editor</option><option value={CollaborationRole.VIEWER}>Leitor</option></select>
                  {canManage && <button className="btn btn-ghost btn-sm collaborator-remove" onClick={() => handleRemoveCollaborator(collaborator.user_id)}><X size={16} />Remover</button>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Share Modal */}
      {showShareModal && shareToken && (
        <div className="share-modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="share-modal" onClick={(e) => e.stopPropagation()}>
            <div className="share-modal-header">
              <h2>Compartilhar Evento</h2>
              <button className="btn btn-icon" onClick={() => setShowShareModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="share-modal-body">
              <p className="share-description">
                Escaneie o QR Code abaixo para acessar a página pública do evento com todas as informações, fotos, relatório e frequência.
              </p>
              <div className="share-warning"><Shield size={18} /><span>Quem tiver este link poderá visualizar também nomes da frequência, observações, relatórios e arquivos. Compartilhe somente com pessoas autorizadas.</span></div>

              <div className="qr-code-container">
                <QRCodeSVG 
                  value={getShareUrl()} 
                  size={220}
                  level="H"
                  includeMargin
                  bgColor="#ffffff"
                  fgColor="#176b4d"
                />
              </div>

              <div className="share-link-section">
                <label>Link de compartilhamento:</label>
                <div className="share-link-row">
                  <input 
                    type="text" 
                    className="form-input share-link-input" 
                    value={getShareUrl()} 
                    readOnly 
                  />
                  <button className="btn btn-primary" onClick={handleCopyLink} title="Copiar link">
                    <Copy size={18} />
                    Copiar
                  </button>
                </div>
              </div>
            </div>

            <div className="share-modal-footer">
              <button className="btn btn-danger-outline" onClick={handleRevokeShare}>
                <X size={18} />
                Revogar Compartilhamento
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
