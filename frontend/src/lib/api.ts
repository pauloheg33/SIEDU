import { supabase, getAuthenticatedUser, ensureFreshSession, querySignal, withTimeout } from './supabase';
import { FileScope } from '@/types';
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
  EventListParams,
  PaginatedEvents,
  EventCollaborator,
  CollaborationRole,
  PublicEventBundle,
} from '@/types';

function getPasswordResetUrl() {
  if (typeof window === 'undefined') {
    return 'https://pauloheg33.github.io/SIEDU/reset-password';
  }

  const baseUrl = import.meta.env.BASE_URL || '/';
  return new URL('reset-password', window.location.origin + baseUrl).toString();
}

// Auth
export const authAPI = {
  register: async (data: { name: string; email: string; password: string }) => {
    const { data: authData, error: authError } = await withTimeout(supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { name: data.name },
      },
    }), 15_000, 'Tempo esgotado ao cadastrar.');

    if (authError) throw authError;
    if (!authData.user) throw new Error('Registration failed');

    // User profile is created automatically by the database trigger
    // No need to insert manually

    return authData;
  },

  login: async (data: { email: string; password: string }) => {
    const { data: authData, error } = await withTimeout(supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    }), 15_000, 'Tempo esgotado ao fazer login.');

    if (error) throw error;
    return authData;
  },

  logout: async () => {
    const { error } = await withTimeout(supabase.auth.signOut(), 10_000, 'Tempo esgotado ao sair.');
    if (error) throw error;
  },

  requestPasswordReset: async (email: string) => {
    const { error } = await withTimeout(
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getPasswordResetUrl(),
      }),
      15_000,
      'Tempo esgotado ao solicitar recuperação de senha.',
    );

    if (error) throw error;
  },

  updatePassword: async (password: string) => {
    const { error } = await withTimeout(
      supabase.auth.updateUser({ password }),
      15_000,
      'Tempo esgotado ao atualizar a senha.',
    );

    if (error) throw error;
  },

  getUser: async (): Promise<User | null> => {
    try {
      const user = await getAuthenticatedUser();

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .abortSignal(querySignal(12_000))
        .eq('id', user.id)
        .single();

      if (error) throw error;
      if (!data?.is_active) throw new Error('Sua conta está inativa. Procure um administrador.');
      return data as User;
    } catch {
      return null;
    }
  },

  getSession: () => supabase.auth.getSession(),
  onAuthStateChange: (callback: (event: string, session: any) => void) =>
    supabase.auth.onAuthStateChange(callback),
};

// Users
export const usersAPI = {
  list: async (): Promise<User[]> => {
    await ensureFreshSession();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .abortSignal(querySignal(12_000))
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as User[];
  },

  update: async (id: string, updates: Partial<User>): Promise<User> => {
    await ensureFreshSession();
    if (updates.role !== undefined || updates.is_active !== undefined) {
      const { data, error } = await withTimeout(
        supabase.rpc('admin_update_user', {
          target_user_id: id,
          target_role: updates.role ?? null,
          target_active: updates.is_active ?? null,
        }).abortSignal(querySignal(15_000)),
        15_000,
        'Tempo esgotado ao atualizar o usuário.',
      );
      if (error) throw error;
      return data as unknown as User;
    }
    const { data, error } = await withTimeout(supabase
      .from('users')
      .update(updates)
      .abortSignal(querySignal(15_000))
      .eq('id', id)
      .select()
      .single(), 15_000, 'Tempo esgotado ao atualizar o perfil.');

    if (error) throw error;
    return data as User;
  },
};

// Events
type EventTypeFilter = 'FORMACAO' | 'PREMIACAO' | 'ENCONTRO' | 'OUTRO';
type EventStatusFilter = 'PLANEJADO' | 'REALIZADO' | 'ARQUIVADO';

export const eventsAPI = {
  list: async (params?: { type?: string; status?: string; search?: string }): Promise<Event[]> => {
    await ensureFreshSession();
    let query = supabase
      .from('events')
      .select('*, creator:users!created_by(*)')
      .abortSignal(querySignal(12_000))
      .order('start_at', { ascending: false });

    if (params?.type) query = query.eq('type', params.type as EventTypeFilter);
    if (params?.status) query = query.eq('status', params.status as EventStatusFilter);
    if (params?.search) query = query.ilike('title', `%${params.search}%`);

    const { data, error } = await query;
    if (error) throw error;
    return data as Event[];
  },

  listPaginated: async (params: EventListParams = {}): Promise<PaginatedEvents> => {
    const user = await getAuthenticatedUser();
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(50, Math.max(1, params.pageSize || 50));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('events')
      .select('id,title,type,status,start_at,end_at,location,audience,description,tags,schools,created_by,created_at,updated_at,share_token,client_request_id,creator:users!created_by(id,name,email,role,is_active,created_at)', { count: 'exact' })
      .abortSignal(querySignal(12_000));

    if (!params.scope || params.scope === 'all') query = query.neq('status', 'ARQUIVADO');
    if (params.scope === 'mine') query = query.eq('created_by', user.id).neq('status', 'ARQUIVADO');
    if (params.scope === 'shared') query = query.or(`created_by.neq.${user.id},created_by.is.null`).neq('status', 'ARQUIVADO');
    if (params.scope === 'archived') query = query.eq('status', 'ARQUIVADO');
    if (params.type) query = query.eq('type', params.type);
    if (params.status && params.scope !== 'archived') query = query.eq('status', params.status);
    if (params.search?.trim()) query = query.ilike('title', `%${params.search.trim()}%`);

    if (params.sort === 'title') query = query.order('title', { ascending: true });
    else query = query.order('start_at', { ascending: params.sort === 'oldest' });

    const { data, error, count } = await withTimeout(
      query.range(from, to),
      12_000,
      'Tempo esgotado ao carregar eventos.',
    );

    if (error) throw error;
    return { data: (data || []) as unknown as Event[], count: count || 0, page, pageSize };
  },

  get: async (id: string): Promise<Event> => {
    await ensureFreshSession();
    const { data, error } = await supabase
      .from('events')
      .select('*, creator:users!created_by(*)')
      .abortSignal(querySignal(12_000))
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Event;
  },

  create: async (eventData: EventCreateRequest): Promise<Event> => {
    const user = await getAuthenticatedUser();

    // Remove undefined values - use any to bypass strict Supabase typing
    const requestId = eventData.client_request_id || crypto.randomUUID();
    const cleanData: any = { created_by: user.id, client_request_id: requestId };
    Object.entries(eventData).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        cleanData[key] = value;
      }
    });

    const { data, error } = await withTimeout(supabase
      .from('events')
      .insert(cleanData)
      .abortSignal(querySignal())
      .select()
      .single(), 15_000, 'Tempo esgotado ao criar evento.');

    if (error) {
      if (error.code === '23505') {
        const { data: existing, error: existingError } = await supabase
          .from('events')
          .select('*')
          .abortSignal(querySignal(12_000))
          .eq('client_request_id', requestId)
          .eq('created_by', user.id)
          .single();
        if (!existingError && existing) return existing as Event;
      }
      throw error;
    }
    return data as Event;
  },

  update: async (id: string, eventData: Partial<EventCreateRequest>): Promise<Event> => {
    await ensureFreshSession();
    // Remove undefined values - use any to bypass strict Supabase typing
    const cleanData: any = { updated_at: new Date().toISOString() };
    Object.entries(eventData).forEach(([key, value]) => {
      if (value !== undefined) {
        cleanData[key] = value;
      }
    });

    const { data, error } = await withTimeout(supabase
      .from('events')
      .update(cleanData)
      .abortSignal(querySignal())
      .eq('id', id)
      .select()
      .single(), 15_000, 'Tempo esgotado ao atualizar evento.');

    if (error) throw error;
    return data as Event;
  },

  delete: async (id: string): Promise<void> => {
    await ensureFreshSession();
    const { error } = await withTimeout(
      supabase.from('events').delete().eq('id', id).abortSignal(querySignal(15_000)),
      15_000,
      'Tempo esgotado ao excluir o evento.',
    );
    if (error) throw error;
  },

  generateShareToken: async (id: string): Promise<string> => {
    const { data, error } = await withTimeout(
      supabase.rpc('set_event_share', { target_event_id: id, enabled: true }).abortSignal(querySignal(15_000)),
      15_000,
      'Tempo esgotado ao gerar link de compartilhamento.',
    );
    if (error) throw error;
    return data as string;
  },

  revokeShareToken: async (id: string): Promise<void> => {
    const { error } = await withTimeout(
      supabase.rpc('set_event_share', { target_event_id: id, enabled: false }).abortSignal(querySignal(15_000)),
      15_000,
      'Tempo esgotado ao revogar o compartilhamento.',
    );
    if (error) throw error;
  },
};

export const collaboratorsAPI = {
  list: async (eventId: string): Promise<EventCollaborator[]> => {
    const { data, error } = await withTimeout(
      supabase
        .from('event_collaborators')
        .select('event_id,user_id,role,invited_by,created_at,user:users!user_id(*)')
        .abortSignal(querySignal(12_000))
        .eq('event_id', eventId)
        .order('created_at'),
      12_000,
      'Tempo esgotado ao carregar colaboradores.',
    );
    if (error) throw error;
    return (data || []) as unknown as EventCollaborator[];
  },

  upsert: async (eventId: string, userId: string, role: CollaborationRole): Promise<EventCollaborator> => {
    const user = await getAuthenticatedUser();
    const { data, error } = await withTimeout(
      supabase
        .from('event_collaborators')
        .upsert({ event_id: eventId, user_id: userId, role, invited_by: user.id }, { onConflict: 'event_id,user_id' })
        .abortSignal(querySignal(15_000))
        .select('event_id,user_id,role,invited_by,created_at,user:users!user_id(*)')
        .single(),
      15_000,
      'Tempo esgotado ao salvar colaborador.',
    );
    if (error) throw error;
    return data as unknown as EventCollaborator;
  },

  remove: async (eventId: string, userId: string): Promise<void> => {
    const { error } = await withTimeout(
      supabase.from('event_collaborators').delete().eq('event_id', eventId).eq('user_id', userId).abortSignal(querySignal(15_000)),
      15_000,
      'Tempo esgotado ao remover colaborador.',
    );
    if (error) throw error;
  },
};

// Helper: extract storage path from a Supabase URL (public, signed, or render)
function extractStoragePath(url: string, bucket: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // Match multiple Supabase URL patterns
    const patterns = [
      `/storage/v1/object/public/${bucket}/`,
      `/storage/v1/render/image/public/${bucket}/`,
      `/storage/v1/object/sign/${bucket}/`,
    ];

    for (const pattern of patterns) {
      const idx = pathname.indexOf(pattern);
      if (idx !== -1) {
        return decodeURIComponent(pathname.substring(idx + pattern.length));
      }
    }

    // Fallback: last 2 path segments (eventId/filename)
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length >= 2) {
      return segments.slice(-2).join('/');
    }
  } catch {
    // Not a valid URL — treat as raw path
    if (url.includes('/')) return url;
  }
  return null;
}

// Files
export const filesAPI = {
  list: async (eventId: string, kind?: FileKind, scope?: FileScope): Promise<EventFile[]> => {
    await ensureFreshSession();
    let query = supabase
      .from('event_files')
      .select('*')
      .abortSignal(querySignal())
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (kind) query = query.eq('kind', kind);
  if (scope) query = query.eq('scope', scope);

    const { data, error } = await query;
    if (error) throw error;

    const files = (data || []) as EventFile[];
    const byBucket = new Map<string, Array<{ file: EventFile; path: string }>>();

    for (const file of files) {
      const bucket = file.kind === 'PHOTO' ? 'photos' : 'documents';
      const path = file.storage_path || extractStoragePath(file.url, bucket);
      if (!path) continue;
      const current = byBucket.get(bucket) || [];
      current.push({ file, path });
      byBucket.set(bucket, current);
    }

    await Promise.all(Array.from(byBucket.entries()).map(async ([bucket, entries]) => {
      const { data: signed, error: signedError } = await withTimeout(
        supabase.storage.from(bucket).createSignedUrls(entries.map((entry) => entry.path), 3600),
        12_000,
        'Tempo esgotado ao preparar os arquivos.',
      );
      if (signedError) throw signedError;
      signed?.forEach((item, index) => {
        if (item.signedUrl) {
          entries[index].file.url = item.signedUrl;
          entries[index].file.thumbnail_url = item.signedUrl;
        }
      });
    }));

    return files;
  },

  upload: async (
    eventId: string,
    files: File[],
    kind: FileKind,
    scope: FileScope = FileScope.UNSCOPED,
    onStatus?: (file: File, status: 'uploading' | 'complete' | 'error') => void,
  ): Promise<EventFile[]> => {
    const user = await getAuthenticatedUser();

    const uploadOne = async (file: File): Promise<EventFile> => {
      onStatus?.(file, 'uploading');
      try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${eventId}/${crypto.randomUUID()}.${fileExt}`;
      const bucket = kind === 'PHOTO' ? 'photos' : 'documents';

      // Upload to storage
      const { error: uploadError } = await withTimeout(supabase.storage
        .from(bucket)
        .upload(fileName, file), 30_000, 'Tempo esgotado no upload do arquivo.');

      if (uploadError) throw uploadError;

      // Get public URL (stored in DB as reference path)
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);

      // Save public URL to database (signed URLs regenerated on list)
      const { data: fileData, error: dbError } = await withTimeout(supabase
        .from('event_files')
        .insert({
          event_id: eventId,
          kind,
          scope,
          filename: file.name,
          mime: file.type,
          size: file.size,
          url: urlData.publicUrl,
          thumbnail_url: urlData.publicUrl,
          storage_path: fileName,
          uploaded_by: user.id,
        })
        .abortSignal(querySignal(15_000))
        .select('*, uploader:users!uploaded_by(*)')
        .single(), 15_000, 'Arquivo enviado, mas falhou ao salvar metadados.');

      if (dbError) {
        await supabase.storage.from(bucket).remove([fileName]);
        throw dbError;
      }
      onStatus?.(file, 'complete');
      return fileData as EventFile;
      } catch (error) {
        onStatus?.(file, 'error');
        throw error;
      }
    };

    const uploadedFiles: EventFile[] = [];
    const failures: Error[] = [];
    const failedFiles: File[] = [];
    for (let index = 0; index < files.length; index += 3) {
      const batch = files.slice(index, index + 3);
      const settled = await Promise.allSettled(batch.map(uploadOne));
      settled.forEach((result, batchIndex) => {
        if (result.status === 'fulfilled') uploadedFiles.push(result.value);
        else {
          failures.push(result.reason instanceof Error ? result.reason : new Error(String(result.reason)));
          failedFiles.push(batch[batchIndex]);
        }
      });
    }

    if (failures.length) {
      const error = new Error(`${uploadedFiles.length} arquivo(s) enviado(s); ${failures.length} falharam.`);
      Object.assign(error, { uploadedFiles, failures, failedFiles });
      throw error;
    }
    return uploadedFiles;
  },

  delete: async (_eventId: string, fileId: string): Promise<void> => {
    await ensureFreshSession();
    // Get file info first
    const { data: file, error: fetchError } = await withTimeout(supabase
      .from('event_files')
      .select('*')
      .abortSignal(querySignal(12_000))
      .eq('id', fileId)
      .single(), 12_000, 'Tempo esgotado ao localizar o arquivo.');

    if (fetchError) throw fetchError;

    // Delete from storage
    const bucket = file.kind === 'PHOTO' ? 'photos' : 'documents';
    const path = file.storage_path || extractStoragePath(file.url, bucket);
    if (path) {
      const { error: storageError } = await withTimeout(
        supabase.storage.from(bucket).remove([path]),
        15_000,
        'Tempo esgotado ao excluir o arquivo.',
      );
      if (storageError) throw storageError;
    }

    // Delete from database
    const { error } = await withTimeout(
      supabase.from('event_files').delete().eq('id', fileId).abortSignal(querySignal(15_000)),
      15_000,
      'Tempo esgotado ao excluir metadados do arquivo.',
    );
    if (error) throw error;
  },
};

// Attendance
export const attendanceAPI = {
  list: async (eventId: string): Promise<Attendance[]> => {
    await ensureFreshSession();
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .abortSignal(querySignal(12_000))
      .eq('event_id', eventId)
      .order('person_name');

    if (error) throw error;
    return data as Attendance[];
  },

  create: async (eventId: string, attendanceData: AttendanceCreateRequest): Promise<Attendance> => {
    await ensureFreshSession();
    const { data, error } = await withTimeout(supabase
      .from('attendance')
      .insert({ ...attendanceData, event_id: eventId })
      .abortSignal(querySignal(15_000))
      .select()
      .single(), 15_000, 'Tempo esgotado ao salvar presença.');

    if (error) throw error;
    return data as Attendance;
  },

  createMany: async (eventId: string, records: AttendanceCreateRequest[]): Promise<Attendance[]> => {
    await ensureFreshSession();
    const { data, error } = await withTimeout(supabase
      .from('attendance')
      .insert(records.map(r => ({ ...r, event_id: eventId })))
      .abortSignal(querySignal(15_000))
      .select(), 15_000, 'Tempo esgotado ao salvar lista de presença.');

    if (error) throw error;
    return data as Attendance[];
  },

  delete: async (_eventId: string, attendanceId: string): Promise<void> => {
    await ensureFreshSession();
    const { error } = await withTimeout(
      supabase.from('attendance').delete().eq('id', attendanceId).abortSignal(querySignal(15_000)),
      15_000,
      'Tempo esgotado ao remover participante.',
    );
    if (error) throw error;
  },

  exportCSV: async (eventId: string): Promise<Blob> => {
    await ensureFreshSession();
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .abortSignal(querySignal(12_000))
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
    await ensureFreshSession();
    const { data, error } = await supabase
      .from('event_notes')
      .select('*')
      .abortSignal(querySignal(12_000))
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as EventNote[];
  },

  create: async (eventId: string, noteData: NoteCreateRequest): Promise<EventNote> => {
    const user = await getAuthenticatedUser();

    const { data, error } = await withTimeout(supabase
      .from('event_notes')
      .insert({ ...noteData, event_id: eventId, created_by: user.id })
      .abortSignal(querySignal(15_000))
      .select()
      .single(), 15_000, 'Tempo esgotado ao salvar observação.');

    if (error) throw error;
    return data as EventNote;
  },

  update: async (_eventId: string, noteId: string, noteData: NoteCreateRequest): Promise<EventNote> => {
    await ensureFreshSession();
    const { data, error } = await withTimeout(supabase
      .from('event_notes')
      .update({ ...noteData, updated_at: new Date().toISOString() })
      .abortSignal(querySignal(15_000))
      .eq('id', noteId)
      .select()
      .single(), 15_000, 'Tempo esgotado ao atualizar observação.');

    if (error) throw error;
    return data as EventNote;
  },

  delete: async (_eventId: string, noteId: string): Promise<void> => {
    await ensureFreshSession();
    const { error } = await withTimeout(
      supabase.from('event_notes').delete().eq('id', noteId).abortSignal(querySignal(15_000)),
      15_000,
      'Tempo esgotado ao excluir observação.',
    );
    if (error) throw error;
  },
};

// Reports (Relatórios)
export const reportsAPI = {
  get: async (eventId: string): Promise<EventReport | null> => {
    await ensureFreshSession();
    const { data, error } = await supabase
      .from('event_reports')
      .select('*')
      .abortSignal(querySignal())
      .eq('event_id', eventId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data as unknown as EventReport;
  },

  upsert: async (eventId: string, reportData: ReportCreateRequest): Promise<EventReport> => {
    const user = await getAuthenticatedUser();

    // Check if report exists
    const existing = await reportsAPI.get(eventId);

    if (existing) {
      // Update existing report
      const { data, error } = await withTimeout(supabase
        .from('event_reports')
        .update({ ...reportData, updated_at: new Date().toISOString() })
        .abortSignal(querySignal(15_000))
        .eq('event_id', eventId)
        .select('*')
        .single(), 15_000, 'Tempo esgotado ao atualizar relatório.');

      if (error) throw error;
      return data as unknown as EventReport;
    } else {
      // Create new report
      const { data, error } = await withTimeout(supabase
        .from('event_reports')
        .insert({ ...reportData, event_id: eventId, created_by: user.id })
        .abortSignal(querySignal(15_000))
        .select('*')
        .single(), 15_000, 'Tempo esgotado ao salvar relatório.');

      if (error) throw error;
      return data as unknown as EventReport;
    }
  },

  delete: async (eventId: string): Promise<void> => {
    await ensureFreshSession();
    const { error } = await withTimeout(
      supabase.from('event_reports').delete().eq('event_id', eventId).abortSignal(querySignal(15_000)),
      15_000,
      'Tempo esgotado ao excluir relatório.',
    );
    if (error) throw error;
  },
};

// Public API (no auth required - for shared event pages)
export const publicAPI = {
  getBundleByToken: async (token: string): Promise<PublicEventBundle> => {
    const { data, error } = await withTimeout(
      supabase.functions.invoke('public-event', { body: { token } }),
      15_000,
      'Tempo esgotado ao abrir o evento compartilhado.',
    );
    if (error) throw error;
    if (!data?.event) throw new Error('Evento compartilhado não encontrado.');
    return data as PublicEventBundle;
  },
};
