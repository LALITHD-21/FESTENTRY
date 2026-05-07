import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        params: { eventsPerSecond: 10 },
      },
    })
  : null;

const studentColumns =
  'receipt_id,name,department,image_url,is_used,entry_time,section,college_name,whatsapp_number';

let liveDisplayAvailable = null;

function requireSupabase() {
  if (!supabase) {
    throw new Error('Missing Supabase environment variables.');
  }
}

export function normalizeStudent(row) {
  if (!row) return null;

  return {
    id: row.receipt_id,
    pass_id: row.receipt_id,
    receipt_id: row.receipt_id,
    name: row.name || 'Unknown Student',
    section: row.section || row.department || row.college_name || '',
    department: row.department || '',
    college_name: row.college_name || '',
    whatsapp_number: row.whatsapp_number || '',
    photo_url: row.image_url || '',
    image_url: row.image_url || '',
    checked_in: Boolean(row.is_used),
    is_used: Boolean(row.is_used),
    entry_time: row.entry_time || null,
    updated_at: row.updated_at || null,
  };
}

export async function fetchStudentByPassId(passId) {
  requireSupabase();
  const receiptId = String(passId || '').trim();
  if (!receiptId) return null;

  const { data, error } = await supabase
    .from('students')
    .select(studentColumns)
    .eq('receipt_id', receiptId)
    .maybeSingle();

  if (error) throw new Error(error.message || 'Unable to fetch student.');
  return normalizeStudent(data);
}

export async function markStudentCheckedIn(receiptId) {
  requireSupabase();

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('students')
    .update({
      is_used: true,
      entry_time: now,
      updated_at: now,
    })
    .eq('receipt_id', receiptId)
    .select(studentColumns)
    .single();

  if (error) throw new Error(error.message || 'Unable to update attendance.');
  return normalizeStudent(data);
}

export async function getAttendanceStats() {
  requireSupabase();

  const [checkedResult, totalResult] = await Promise.all([
    supabase
      .from('students')
      .select('receipt_id', { count: 'exact', head: true })
      .eq('is_used', true),
    supabase.from('students').select('receipt_id', { count: 'exact', head: true }),
  ]);

  if (checkedResult.error) throw new Error(checkedResult.error.message || 'Unable to fetch checked-in count.');
  if (totalResult.error) throw new Error(totalResult.error.message || 'Unable to fetch total count.');

  return {
    checkedIn: checkedResult.count || 0,
    total: totalResult.count || 0,
  };
}

export async function resetAttendanceToZero() {
  requireSupabase();

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('students')
    .update({
      is_used: false,
      entry_time: null,
      updated_at: now,
    })
    .eq('is_used', true)
    .select('receipt_id');

  if (error) throw new Error(error.message || 'Unable to reset attendance.');

  return {
    resetCount: data?.length || 0,
  };
}

export async function logScan(receiptId, status) {
  if (!supabase) return;

  await supabase.from('scan_logs').insert({
    receipt_id: String(receiptId || '').trim(),
    scan_time: new Date().toISOString(),
    status,
  });
}

export async function fetchScanLogs(limit = 40) {
  requireSupabase();

  const { data, error } = await supabase
    .from('scan_logs')
    .select('id,receipt_id,scan_time,status,created_at')
    .order('scan_time', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message || 'Unable to fetch scan logs.');

  const receiptIds = [...new Set((data || []).map((log) => log.receipt_id).filter(Boolean))];
  let studentsById = new Map();

  if (receiptIds.length > 0) {
    const studentResult = await supabase
      .from('students')
      .select('receipt_id,name,department,section,college_name,image_url')
      .in('receipt_id', receiptIds);

    if (!studentResult.error) {
      studentsById = new Map((studentResult.data || []).map((student) => [student.receipt_id, normalizeStudent(student)]));
    }
  }

  return (data || []).map((log) => {
    const student = studentsById.get(log.receipt_id);
    return {
      id: String(log.id),
      passId: log.receipt_id,
      status: log.status === 'success' ? 'success' : log.status === 'duplicate' ? 'duplicate' : 'invalid',
      name: student?.name || '',
      detail: student?.section || student?.department || student?.college_name || log.status,
      scanTime: log.scan_time || log.created_at,
    };
  });
}

export async function publishLiveDisplay(student) {
  if (!supabase || !student) return false;

  const payload = {
    id: 1,
    student_name: student.name,
    photo_url: student.photo_url || student.image_url || '',
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('live_display')
    .upsert(payload, { onConflict: 'id' });

  liveDisplayAvailable = !error;
  return !error;
}

export async function quickSyncStudentToDisplay(student) {
  if (!supabase || !student) return false;

  const published = await publishLiveDisplay(student);
  if (published) return true;

  const receiptId = student.receipt_id || student.pass_id || student.id;
  if (!receiptId) return false;

  const { error } = await supabase
    .from('students')
    .update({ updated_at: new Date().toISOString() })
    .eq('receipt_id', receiptId);

  return !error;
}

export async function fetchLatestDisplayStudent() {
  requireSupabase();

  const liveResult = await supabase
    .from('live_display')
    .select('id,student_name,photo_url,updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (liveResult.data && !liveResult.error) {
    liveDisplayAvailable = true;
    return {
      name: liveResult.data.student_name,
      photo_url: liveResult.data.photo_url || '',
      updated_at: liveResult.data.updated_at,
      source: 'live_display',
    };
  }

  if (liveResult.error) liveDisplayAvailable = false;

  const { data, error } = await supabase
    .from('students')
    .select(studentColumns)
    .eq('is_used', true)
    .not('entry_time', 'is', null)
    .order('entry_time', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message || 'Unable to fetch latest check-in.');

  const student = normalizeStudent(data);
  return student
    ? {
        name: student.name,
        photo_url: student.photo_url,
        updated_at: student.entry_time,
        source: 'students',
      }
    : null;
}

export function subscribeToAttendance(onChange) {
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`students-attendance-${Date.now()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'students' },
      () => onChange?.()
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export function subscribeToScanLogs(onChange) {
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`scan-logs-${Date.now()}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'scan_logs' },
      () => onChange?.()
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export function subscribeToWelcomeDisplay(onStudent) {
  if (!supabase) return () => {};

  const liveChannel =
    liveDisplayAvailable === false
      ? null
      : supabase
          .channel(`live-display-${Date.now()}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'live_display' },
            (payload) => {
              if (!payload.new) return;
              onStudent?.({
                name: payload.new.student_name,
                photo_url: payload.new.photo_url || '',
                updated_at: payload.new.updated_at,
                source: 'live_display',
              });
            }
          )
          .subscribe();

  const studentChannel = supabase
    .channel(`students-display-${Date.now()}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'students' },
      (payload) => {
        const student = normalizeStudent(payload.new);
        if (!student?.checked_in) return;
        onStudent?.({
          name: student.name,
          photo_url: student.photo_url,
          updated_at: student.updated_at || student.entry_time || new Date().toISOString(),
          source: 'students',
        });
      }
    )
    .subscribe();

  return () => {
    if (liveChannel) supabase.removeChannel(liveChannel);
    supabase.removeChannel(studentChannel);
  };
}
