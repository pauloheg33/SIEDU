import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { publicAPI } from '@/lib/api';
import {
  Event,
  EventFile,
  Attendance,
  EventReport,
  EventType,
  EventStatus,
} from '@/types';
import { 
  Calendar, MapPin, Users, Image, FileText, 
  ClipboardList, Check, X, File
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import './PublicEvent.css';

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

export default function PublicEvent() {
  const { token } = useParams();

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [photos, setPhotos] = useState<EventFile[]>([]);
  const [report, setReport] = useState<EventReport | null>(null);
  const [reportFiles, setReportFiles] = useState<EventFile[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<EventFile | null>(null);

  useEffect(() => {
    if (token) loadPublicEvent();
  }, [token]);

  const loadPublicEvent = async () => {
    try {
      setLoading(true);
      const data = await publicAPI.getEventByToken(token!);
      if (!data) {
        setNotFound(true);
        return;
      }
      setEvent(data);

      // Load all data in parallel
      const [photosData, reportData, attendanceData, reportFilesData] = await Promise.all([
        publicAPI.getPhotos(data.id),
        publicAPI.getReport(data.id),
        publicAPI.getAttendance(data.id),
        publicAPI.getReportFiles(data.id),
      ]);

      setPhotos(photosData);
      setReport(reportData);
      setAttendance(attendanceData);
      setReportFiles(reportFilesData);
    } catch (error) {
      console.error('Error loading public event:', error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="public-page">
        <div className="public-loading">
          <div className="spinner" />
          <p>Carregando evento...</p>
        </div>
      </div>
    );
  }

  if (notFound || !event) {
    return (
      <div className="public-page">
        <div className="public-not-found">
          <h1>Evento não encontrado</h1>
          <p>O link de compartilhamento é inválido ou foi revogado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="public-page">
      {/* Header */}
      <header className="public-header">
        <div className="public-header-content">
          <div className="public-logo">
            <span className="public-logo-icon">📚</span>
            <span className="public-logo-text">SIEDU</span>
          </div>
          <p className="public-subtitle">Sistema Integrado de Evidências da Educação</p>
        </div>
      </header>

      {/* Event Content */}
      <main className="public-main">
        {/* Event Title Section */}
        <div className="public-event-header">
          <div className="public-badges">
            <span className="badge badge-primary">{EVENT_TYPE_LABELS[event.type]}</span>
            <span className="badge badge-secondary">{EVENT_STATUS_LABELS[event.status]}</span>
          </div>
          <h1 className="public-event-title">{event.title}</h1>
        </div>

        {/* Event Info */}
        <section className="public-section">
          <div className="public-info-grid">
            <div className="public-info-card">
              <Calendar size={22} />
              <div>
                <label>Data/Hora</label>
                <p>
                  {format(new Date(event.start_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  {event.end_at && ` - ${format(new Date(event.end_at), "HH:mm", { locale: ptBR })}`}
                </p>
              </div>
            </div>

            {event.location && (
              <div className="public-info-card">
                <MapPin size={22} />
                <div>
                  <label>Local</label>
                  <p>{event.location}</p>
                </div>
              </div>
            )}

            {event.audience && (
              <div className="public-info-card">
                <Users size={22} />
                <div>
                  <label>Público-Alvo</label>
                  <p>{event.audience}</p>
                </div>
              </div>
            )}
          </div>

          {event.description && (
            <div className="public-description">
              <p>{event.description}</p>
            </div>
          )}

          {event.tags && event.tags.length > 0 && (
            <div className="public-tags">
              {event.tags.map((tag, i) => (
                <span key={i} className="tag">{tag}</span>
              ))}
            </div>
          )}

          {event.schools && event.schools.length > 0 && (
            <div className="public-schools">
              <h3>Escolas Vinculadas</h3>
              <ul>
                {event.schools.map((school, i) => (
                  <li key={i}>{school}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Photos Section */}
        {photos.length > 0 && (
          <section className="public-section">
            <h2 className="public-section-title">
              <Image size={22} />
              Galeria de Fotos ({photos.length})
            </h2>
            <div className="public-photos-grid">
              {photos.map((photo) => (
                <div 
                  key={photo.id} 
                  className="public-photo-item"
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
                </div>
              ))}
            </div>

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
          </section>
        )}

        {/* Report Section */}
        {(report || reportFiles.length > 0) && (
          <section className="public-section">
            <h2 className="public-section-title">
              <FileText size={22} />
              Relatório
            </h2>

            {reportFiles.length > 0 && (
              <div className="public-report-files">
                {reportFiles.map((file) => (
                  <a 
                    key={file.id} 
                    className="public-report-file"
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <File size={20} />
                    <div>
                      <span className="file-name">{file.filename}</span>
                      <span className="file-size">{(file.size / 1024).toFixed(0)} KB</span>
                    </div>
                  </a>
                ))}
              </div>
            )}

            {report && (
              <div className="public-report-content">
                <p>{report.content}</p>
              </div>
            )}
          </section>
        )}

        {/* Attendance Section */}
        {attendance.length > 0 && (
          <section className="public-section">
            <h2 className="public-section-title">
              <ClipboardList size={22} />
              Lista de Presença ({attendance.length})
            </h2>
            <div className="public-table-wrapper">
              <table className="public-attendance-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Função</th>
                    <th>Escola</th>
                    <th>Presença</th>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="public-footer">
        <p>SIEDU &mdash; Sistema Integrado de Evidências da Educação &bull; Ararendá-CE</p>
      </footer>
    </div>
  );
}
