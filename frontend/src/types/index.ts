export enum UserRole {
  ADMIN = 'ADMIN',
  TEC_FORMACAO = 'TEC_FORMACAO',
  TEC_ACOMPANHAMENTO = 'TEC_ACOMPANHAMENTO',
}

export enum EventType {
  FORMACAO = 'FORMACAO',
  PREMIACAO = 'PREMIACAO',
  ENCONTRO = 'ENCONTRO',
  OUTRO = 'OUTRO',
}

export enum EventStatus {
  PLANEJADO = 'PLANEJADO',
  REALIZADO = 'REALIZADO',
  ARQUIVADO = 'ARQUIVADO',
}

export enum FileKind {
  PHOTO = 'PHOTO',
  DOC = 'DOC',
}

export enum FileScope {
  UNSCOPED = 'UNSCOPED',
  REPORT_PDF = 'REPORT_PDF',
  ATTENDANCE_PDF = 'ATTENDANCE_PDF',
  REPORT_PPT = 'REPORT_PPT',
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface Event {
  id: string;
  title: string;
  type: EventType;
  status: EventStatus;
  start_at: string;
  end_at?: string;
  location?: string;
  audience?: string;
  description?: string;
  tags: string[];
  schools: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
  creator: User;
}

export interface EventFile {
  id: string;
  event_id: string;
  kind: FileKind;
  scope: FileScope;
  filename: string;
  mime: string;
  size: number;
  url: string;
  thumbnail_url?: string;
  uploaded_by: string;
  created_at: string;
  uploader?: User;
}

export interface Attendance {
  id: string;
  event_id: string;
  person_name: string;
  person_role?: string;
  school?: string;
  present: boolean;
  created_at: string;
}

export interface EventNote {
  id: string;
  event_id: string;
  text: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  author?: User;
}

export interface EventReport {
  id: string;
  event_id: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  author?: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface EventCreateRequest {
  title: string;
  type: EventType;
  status: EventStatus;
  start_at: string;
  end_at?: string;
  location?: string;
  audience?: string;
  description?: string;
  tags: string[];
  schools: string[];
}

export interface AttendanceCreateRequest {
  person_name: string;
  person_role?: string;
  school?: string;
  present: boolean;
}

export interface NoteCreateRequest {
  text: string;
}

export interface ReportCreateRequest {
  content: string;
}
