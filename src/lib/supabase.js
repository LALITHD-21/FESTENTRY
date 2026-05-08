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
  'receipt_id,name,department,image_url,is_used,entry_time,section,college_name,whatsapp_number,usn,created_at,updated_at';

let liveDisplayAvailable = null;
let scanLogScannerColumnsAvailable = null;
let scannerSessionsAvailable = null;

const scanLogColumns = 'id,receipt_id,scan_time,status,created_at,scanner_id,scanner_name';
const legacyScanLogColumns = 'id,receipt_id,scan_time,status,created_at';

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
    usn: row.usn || '',
    college_name: row.college_name || '',
    whatsapp_number: row.whatsapp_number || '',
    photo_url: row.image_url || '',
    image_url: row.image_url || '',
    checked_in: Boolean(row.is_used),
    is_used: Boolean(row.is_used),
    entry_time: row.entry_time || null,
    created_at: row.created_at || null,
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
    .or('is_used.eq.false,is_used.is.null')
    .select(studentColumns)
    .maybeSingle();

  if (error) throw new Error(error.message || 'Unable to update attendance.');
  if (!data) {
    const latestStudent = await fetchStudentByPassId(receiptId);
    const duplicateError = new Error('Pass was already checked in.');
    duplicateError.code = 'DUPLICATE_CHECK_IN';
    duplicateError.student = latestStudent;
    throw duplicateError;
  }

  return normalizeStudent(data);
}

export async function getAttendanceStats() {
  requireSupabase();

  const [checkedIn, total] = await Promise.all([
    countStudents({ checkedIn: true, label: 'checked-in' }),
    countStudents({ label: 'total' }),
  ]);

  return {
    checkedIn,
    total,
  };
}

export async function fetchPassDetails() {
  requireSupabase();

  const pageSize = 1000;
  let from = 0;
  const rows = [];

  while (true) {
    const { data, error } = await supabase
      .from('students')
      .select(studentColumns)
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message || 'Unable to fetch total pass details.');

    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return rows.map(normalizeStudent);
}

async function countStudents({ checkedIn = null, label }) {
  let headQuery = supabase
    .from('students')
    .select('receipt_id', { count: 'exact', head: true });

  if (checkedIn !== null) headQuery = headQuery.eq('is_used', checkedIn);

  const headResult = await headQuery;
  if (!headResult.error && typeof headResult.count === 'number') return headResult.count;

  let fallbackQuery = supabase
    .from('students')
    .select('receipt_id', { count: 'exact' })
    .range(0, 0);

  if (checkedIn !== null) fallbackQuery = fallbackQuery.eq('is_used', checkedIn);

  const fallbackResult = await fallbackQuery;
  if (fallbackResult.error) {
    throw new Error(fallbackResult.error.message || `Unable to fetch ${label} count.`);
  }

  if (typeof fallbackResult.count === 'number') return fallbackResult.count;
  return fallbackResult.data?.length || 0;
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

export async function logScan(receiptId, status, scannerSession = null) {
  if (!supabase) return;

  const basePayload = {
    receipt_id: String(receiptId || '').trim(),
    scan_time: new Date().toISOString(),
    status,
  };
  const scannerPayload = normalizeScannerPayload(scannerSession);

  if (scannerPayload && scanLogScannerColumnsAvailable !== false) {
    const { error } = await supabase.from('scan_logs').insert({
      ...basePayload,
      ...scannerPayload,
    });

    if (!error) {
      scanLogScannerColumnsAvailable = true;
      return;
    }

    if (isMissingSchemaFeature(error)) {
      scanLogScannerColumnsAvailable = false;
    } else {
      return;
    }
  }

  await supabase.from('scan_logs').insert(basePayload);
}

export async function fetchScanLogs(limit = 40) {
  requireSupabase();

  const withScannerColumns = scanLogScannerColumnsAvailable !== false;
  let selectedScannerColumns = withScannerColumns;
  let { data, error } = await supabase
    .from('scan_logs')
    .select(withScannerColumns ? scanLogColumns : legacyScanLogColumns)
    .order('scan_time', { ascending: false })
    .limit(limit);

  if (error && withScannerColumns && isMissingSchemaFeature(error)) {
    scanLogScannerColumnsAvailable = false;
    selectedScannerColumns = false;
    const fallbackResult = await supabase
      .from('scan_logs')
      .select(legacyScanLogColumns)
      .order('scan_time', { ascending: false })
      .limit(limit);

    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error) throw new Error(error.message || 'Unable to fetch scan logs.');
  if (selectedScannerColumns) scanLogScannerColumnsAvailable = true;

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
      scannerId: log.scanner_id || '',
      scannerName: log.scanner_name || '',
    };
  });
}

export async function clearScanLogs() {
  requireSupabase();

  const { error } = await supabase
    .from('scan_logs')
    .delete()
    .gte('id', 0);

  if (error) throw new Error(error.message || 'Unable to clear scan logs.');
  return true;
}

export async function upsertScannerSession(scannerSession) {
  if (!supabase || !scannerSession) return false;

  const now = new Date().toISOString();
  const payload = {
    scanner_id: scannerSession.scanner_id,
    scanner_name: scannerSession.scanner_name,
    scanner_label: scannerSession.scanner_label || scannerSession.scanner_id,
    login_at: scannerSession.login_at || now,
    last_seen_at: now,
    is_active: true,
  };

  const { error } = await supabase
    .from('scanner_sessions')
    .upsert(payload, { onConflict: 'scanner_id' });

  scannerSessionsAvailable = !error;
  return !error;
}

export async function touchScannerSession(scannerSession) {
  if (!supabase || !scannerSession || scannerSessionsAvailable === false) return false;

  const { error } = await supabase
    .from('scanner_sessions')
    .update({ last_seen_at: new Date().toISOString(), is_active: true })
    .eq('scanner_id', scannerSession.scanner_id);

  if (error) {
    if (isMissingSchemaFeature(error)) scannerSessionsAvailable = false;
    return false;
  }

  scannerSessionsAvailable = true;
  return true;
}

export async function signOutScannerSession(scannerSession) {
  if (!supabase || !scannerSession || scannerSessionsAvailable === false) return false;

  const { error } = await supabase
    .from('scanner_sessions')
    .update({ last_seen_at: new Date().toISOString(), is_active: false })
    .eq('scanner_id', scannerSession.scanner_id);

  if (error) {
    if (isMissingSchemaFeature(error)) scannerSessionsAvailable = false;
    return false;
  }

  scannerSessionsAvailable = true;
  return true;
}

export async function fetchScannerSessions() {
  requireSupabase();

  const { data, error } = await supabase
    .from('scanner_sessions')
    .select('scanner_id,scanner_name,scanner_label,login_at,last_seen_at,is_active')
    .order('scanner_id', { ascending: true });

  if (error) {
    scannerSessionsAvailable = false;
    throw new Error(error.message || 'Unable to fetch scanner sessions.');
  }

  scannerSessionsAvailable = true;
  return (data || []).map((session) => ({
    scannerId: session.scanner_id,
    scannerName: session.scanner_name,
    scannerLabel: session.scanner_label,
    loginAt: session.login_at,
    lastSeenAt: session.last_seen_at,
    isActive: Boolean(session.is_active),
  }));
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
      { event: '*', schema: 'public', table: 'scan_logs' },
      () => onChange?.()
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export function subscribeToScannerSessions(onChange) {
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`scanner-sessions-${Date.now()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'scanner_sessions' },
      () => onChange?.()
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export function subscribeToSuccessfulScanLogs(onScan) {
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`welcome-success-scan-logs-${Date.now()}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'scan_logs' },
      (payload) => {
        if (payload.new?.status !== 'success') return;
        onScan?.(payload.new);
      }
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

function normalizeScannerPayload(scannerSession) {
  if (!scannerSession?.scanner_id) return null;

  return {
    scanner_id: String(scannerSession.scanner_id).trim().toUpperCase(),
    scanner_name: String(scannerSession.scanner_name || scannerSession.scanner_id).trim(),
  };
}

function isMissingSchemaFeature(error) {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();

  return (
    code === '42703' ||
    code === '42p01' ||
    message.includes('schema cache') ||
    message.includes('scanner_id') ||
    message.includes('scanner_sessions') ||
    message.includes('column') ||
    message.includes('relation')
  );
}
