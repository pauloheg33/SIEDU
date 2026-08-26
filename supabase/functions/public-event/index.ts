import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    ...corsHeaders,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
  },
});

function storagePath(url: string | null, bucket: string) {
  if (!url) return null;
  const marker = '/' + bucket + '/';
  const index = url.indexOf(marker);
  if (index < 0) return null;
  return decodeURIComponent(url.slice(index + marker.length).split('?')[0]);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  try {
    const { token } = await request.json();
    if (typeof token !== 'string' || !/^[0-9a-f-]{36}$/i.test(token)) {
      return json({ error: 'Link inválido.' }, 400);
    }

    const url = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceRoleKey) return json({ error: 'Serviço indisponível.' }, 503);
    const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*, creator:users!created_by(id,name,role)')
      .eq('share_token', token)
      .single();
    if (eventError || !event) return json({ error: 'Evento não encontrado ou compartilhamento revogado.' }, 404);

    const [filesResult, attendanceResult, notesResult, reportResult] = await Promise.all([
      supabase.from('event_files').select('*').eq('event_id', event.id).order('created_at', { ascending: false }),
      supabase.from('attendance').select('*').eq('event_id', event.id).order('person_name'),
      supabase.from('event_notes').select('*').eq('event_id', event.id).order('created_at', { ascending: false }),
      supabase.from('event_reports').select('*').eq('event_id', event.id).maybeSingle(),
    ]);

    const firstError = filesResult.error || attendanceResult.error || notesResult.error || reportResult.error;
    if (firstError) return json({ error: 'Não foi possível carregar o conteúdo compartilhado.' }, 500);

    const files = filesResult.data || [];
    for (const bucket of ['photos', 'documents']) {
      const entries = files
        .map((file) => ({
          file,
          path: file.storage_path || storagePath(file.url, bucket),
          expectedBucket: file.kind === 'PHOTO' ? 'photos' : 'documents',
        }))
        .filter((entry) => entry.expectedBucket === bucket && entry.path);
      if (!entries.length) continue;
      const { data: signed } = await supabase.storage.from(bucket).createSignedUrls(
        entries.map((entry) => entry.path as string),
        15 * 60,
      );
      signed?.forEach((item, index) => {
        if (item.signedUrl) {
          entries[index].file.url = item.signedUrl;
          entries[index].file.thumbnail_url = item.signedUrl;
        }
      });
    }

    return json({
      event,
      files,
      attendance: attendanceResult.data || [],
      notes: notesResult.data || [],
      report: reportResult.data || null,
    });
  } catch {
    return json({ error: 'Não foi possível abrir este compartilhamento.' }, 500);
  }
});
