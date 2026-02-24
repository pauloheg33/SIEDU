import { supabase } from './supabase';
import type {
  User,
  Event,
  EventFile,
  Attendance,
  EventNote,
  EventReport,
  EventCreateRequest,
  AttendanceCreateRequest,
  NoteCreateRequest,
  ReportCreateRequest,
  FileKind,
} from '@/types';

// Auth
export const authAPI = {
  register: async (data: { name: string; email: string; password: string }) => {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { name: data.name },
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Registration failed');

    // User profile is created automatically by the database trigger
    // No need to insert manually

    return authData;
  },

  login: async (data: { email: string; password: string }) => {
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) throw error;
    return authData;
  },

  logout: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  getUser: async (): Promise<User | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    return data as User;
  },

  getSession: () => supabase.auth.getSession(),
  onAuthStateChange: (callback: (event: string, session: any) => void) =>
    supabase.auth.onAuthStateChange(callback),
};

// Users
export const usersAPI = {
  list: async (): Promise<User[]> => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as User[];
  },

  update: async (id: string, updates: Partial<User>): Promise<User> => {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as User;
  },

  changeRole: async (id: string, role: 'ADMIN' | 'TEC_FORMACAO' | 'TEC_ACOMPANHAMENTO'): Promise<User> => {
    const { data, error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as User;
  },

  deactivate: async (id: string): Promise<User> => {
    const { data, error } = await supabase
      .from('users')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as User;
  },
};

// Events
type EventTypeFilter = 'FORMACAO' | 'PREMIACAO' | 'ENCONTRO' | 'OUTRO';
type EventStatusFilter = 'PLANEJADO' | 'REALIZADO' | 'ARQUIVADO';

export const eventsAPI = {
  list: async (params?: { type?: string; status?: string; search?: string }): Promise<Event[]> => {
    let query = supabase
      .from('events')
      .select('*, creator:users!created_by(*)')
      .order('start_at', { ascending: false });

    if (params?.type) query = query.eq('type', params.type as EventTypeFilter);
    if (params?.status) query = query.eq('status', params.status as EventStatusFilter);
    if (params?.search) query = query.ilike('title', `%${params.search}%`);

    const { data, error } = await query;
    if (error) throw error;
    return data as Event[];
  },

  get: async (id: string): Promise<Event> => {
    const { data, error } = await supabase
      .from('events')
      .select('*, creator:users!created_by(*)')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Event;
  },

  create: async (eventData: EventCreateRequest): Promise<Event> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Remove undefined values - use any to bypass strict Supabase typing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cleanData: any = { created_by: user.id };
    Object.entries(eventData).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        cleanData[key] = value;
      }
    });

    const { data, error } = await supabase
      .from('events')
      .insert(cleanData)
      .select()
      .single();

    if (error) throw error;
    return data as Event;
  },

  update: async (id: string, eventData: Partial<EventCreateRequest>): Promise<Event> => {
    // Remove undefined values - use any to bypass strict Supabase typing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cleanData: any = { updated_at: new Date().toISOString() };
    Object.entries(eventData).forEach(([key, value]) => {
      if (value !== undefined) {
        cleanData[key] = value;
      }
    });

    const { data, error } = await supabase
      .from('events')
      .update(cleanData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Event;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) throw error;
  },
};

// Helper: extract storage path from a Supabase public URL
function extractStoragePath(url: string, bucket: string): string | null {
  // URL format: https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx !== -1) return decodeURIComponent(url.substring(idx + marker.length));
  // Fallback: try to get last 2 segments (eventId/filename)
  const parts = url.split('/');
  if (parts.length >= 2) return parts.slice(-2).join('/');
  return null;
}

// Files
export const filesAPI = {
  list: async (eventId: string, kind?: FileKind): Promise<EventFile[]> => {
    let query = supabase
      .from('event_files')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (kind) query = query.eq('kind', kind);

    const { data, error } = await query;
    if (error) throw error;

    const files = data as EventFile[];

    // Generate fresh signed URLs for each file (works even if bucket is not public)
    for (const file of files) {
      const bucket = file.kind === 'PHOTO' ? 'photos' : 'documents';
      const path = extractStoragePath(file.url, bucket);
      if (path) {
        const { data: signedData } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, 3600); // 1 hour expiry
        if (signedData?.signedUrl) {
          file.url = signedData.signedUrl;
          file.thumbnail_url = signedData.signedUrl;
        }
      }
    }

    return files;
  },

  upload: async (eventId: string, files: File[], kind: FileKind): Promise<EventFile[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const uploadedFiles: EventFile[] = [];

    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${eventId}/${crypto.randomUUID()}.${fileExt}`;
      const bucket = kind === 'PHOTO' ? 'photos' : 'documents';

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL (stored in DB as reference path)
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);

      // Generate a signed URL for immediate use
      const { data: signedData } = await supabase.storage
        .from(bucket)
        .createSignedUrl(fileName, 3600);
      const displayUrl = signedData?.signedUrl || urlData.publicUrl;

      // Save public URL to database (signed URLs regenerated on list)
      const { data: fileData, error: dbError } = await supabase
        .from('event_files')
        .insert({
          event_id: eventId,
          kind,
          filename: file.name,
          mime: file.type,
          size: file.size,
          url: urlData.publicUrl,
          thumbnail_url: urlData.publicUrl,
          uploaded_by: user.id,
        })
        .select('*, uploader:users!uploaded_by(*)')
        .single();

      if (dbError) throw dbError;
      uploadedFiles.push(fileData as EventFile);
    }

    return uploadedFiles;
  },

  delete: async (_eventId: string, fileId: string): Promise<void> => {
    // Get file info first
    const { data: file, error: fetchError } = await supabase
      .from('event_files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (fetchError) throw fetchError;

    // Delete from storage
    const bucket = file.kind === 'PHOTO' ? 'photos' : 'documents';
    const path = file.url.split('/').slice(-2).join('/');
    await supabase.storage.from(bucket).remove([path]);

    // Delete from database
    const { error } = await supabase.from('event_files').delete().eq('id', fileId);
    if (error) throw error;
  },
};

// Attendance
export const attendanceAPI = {
  list: async (eventId: string): Promise<Attendance[]> => {
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('event_id', eventId)
      .order('person_name');

    if (error) throw error;
    return data as Attendance[];
  },

  create: async (eventId: string, attendanceData: AttendanceCreateRequest): Promise<Attendance> => {
    const { data, error } = await supabase
      .from('attendance')
      .insert({ ...attendanceData, event_id: eventId })
      .select()
      .single();

    if (error) throw error;
    return data as Attendance;
  },

  createMany: async (eventId: string, records: AttendanceCreateRequest[]): Promise<Attendance[]> => {
    const { data, error } = await supabase
      .from('attendance')
      .insert(records.map(r => ({ ...r, event_id: eventId })))
      .select();

    if (error) throw error;
    return data as Attendance[];
  },

  delete: async (_eventId: string, attendanceId: string): Promise<void> => {
    const { error } = await supabase.from('attendance').delete().eq('id', attendanceId);
    if (error) throw error;
  },

  exportCSV: async (eventId: string): Promise<Blob> => {
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('event_id', eventId)
      .order('person_name');

    if (error) throw error;

    const headers = ['Nome', 'Função', 'Escola', 'Presente'];
    const rows = (data as Attendance[]).map(a => [
      a.person_name,
      a.person_role || '',
      a.school || '',
      a.present ? 'Sim' : 'Não',
    ]);

    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    return new Blob([csv], { type: 'text/csv' });
  },
};

// Notes
export const notesAPI = {
  list: async (eventId: string): Promise<EventNote[]> => {
    const { data, error } = await supabase
      .from('event_notes')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as EventNote[];
  },

  create: async (eventId: string, noteData: NoteCreateRequest): Promise<EventNote> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('event_notes')
      .insert({ ...noteData, event_id: eventId, created_by: user.id })
      .select()
      .single();

    if (error) throw error;
    return data as EventNote;
  },

  update: async (_eventId: string, noteId: string, noteData: NoteCreateRequest): Promise<EventNote> => {
    const { data, error } = await supabase
      .from('event_notes')
      .update({ ...noteData, updated_at: new Date().toISOString() })
      .eq('id', noteId)
      .select()
      .single();

    if (error) throw error;
    return data as EventNote;
  },

  delete: async (_eventId: string, noteId: string): Promise<void> => {
    const { error } = await supabase.from('event_notes').delete().eq('id', noteId);
    if (error) throw error;
  },
};

// Reports (Relatórios)
export const reportsAPI = {
  get: async (eventId: string): Promise<EventReport | null> => {
    const { data, error } = await supabase
      .from('event_reports')
      .select('*')
      .eq('event_id', eventId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data as unknown as EventReport;
  },

  upsert: async (eventId: string, reportData: ReportCreateRequest): Promise<EventReport> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Check if report exists
    const existing = await reportsAPI.get(eventId);

    if (existing) {
      // Update existing report
      const { data, error } = await supabase
        .from('event_reports')
        .update({ ...reportData, updated_at: new Date().toISOString() })
        .eq('event_id', eventId)
        .select('*')
        .single();

      if (error) throw error;
      return data as unknown as EventReport;
    } else {
      // Create new report
      const { data, error } = await supabase
        .from('event_reports')
        .insert({ ...reportData, event_id: eventId, created_by: user.id })
        .select('*')
        .single();

      if (error) throw error;
      return data as unknown as EventReport;
    }
  },

  delete: async (eventId: string): Promise<void> => {
    const { error } = await supabase.from('event_reports').delete().eq('event_id', eventId);
    if (error) throw error;
  },
};
