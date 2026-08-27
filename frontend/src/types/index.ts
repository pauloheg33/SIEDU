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

export enum CollaborationRole {
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}

export type EventLibraryScope = 'mine' | 'shared' | 'archived';
export type EventSort = 'newest' | 'oldest' | 'title';

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
  share_token?: string;
  client_request_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  creator?: User;
  access_role?: 'OWNER' | CollaborationRole;
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
  storage_path?: string;
  uploaded_by: string;
  created_at: string;
  uploader?: User;
}

export interface EventCollaborator {
  event_id: string;
  user_id: string;
  role: CollaborationRole;
  invited_by?: string;
  created_at: string;
  user?: User;
}

export interface EventListParams {
  type?: EventType;
  status?: EventStatus;
  search?: string;
  scope?: EventLibraryScope;
  sort?: EventSort;
  page?: number;
  pageSize?: number;
}

export interface PaginatedEvents {
  data: Event[];
  count: number;
  page: number;
  pageSize: number;
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
  client_request_id?: string;
}

export interface PublicEventBundle {
  event: Event;
  files: EventFile[];
  attendance: Attendance[];
  notes: EventNote[];
  report: EventReport | null;
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
