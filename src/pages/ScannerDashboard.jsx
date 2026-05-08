import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  Clock3,
  Gauge,
  LogOut,
  Megaphone,
  Moon,
  Radio,
  RefreshCcw,
  RotateCcw,
  Satellite,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  Wifi,
  Zap,
} from 'lucide-react';
import AttendanceCard from '../components/AttendanceCard';
import DuplicateModal from '../components/DuplicateModal';
import QRScanner from '../components/QRScanner';
import ScanLogs from '../components/ScanLogs';
import ScannerLogin from '../components/ScannerLogin';
import SuccessToast from '../components/SuccessToast';
import scannerSound from '../assets/scanner.mp3';
import successSound from '../assets/success.mp3';
import warningSound from '../assets/warning.mp3';
import { downloadPassListPdf } from '../lib/attendancePdf';
import { clearScannerSession, getStoredScannerSession } from '../lib/scannerAuth';
import { announceAlreadyCheckedIn, announcePermitted, notifyScan } from '../lib/speech';
import {
  clearScanLogs,
  fetchPassDetails,
  fetchStudentByPassId,
  fetchScanLogs,
  isSupabaseConfigured,
  logScan,
  markStudentCheckedIn,
  publishLiveDisplay,
  quickSyncStudentToDisplay,
  resetAttendanceToZero,
  signOutScannerSession,
  subscribeToScanLogs,
  touchScannerSession,
  upsertScannerSession,
} from '../lib/supabase';

function playAudio(src, fallback = 'beep') {
  const audio = new Audio(src);
  audio.volume = 0.9;
  audio.play().catch(() => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = fallback === 'error' ? 'square' : 'sine';
    osc.frequency.setValueAtTime(fallback === 'error' ? 170 : 1180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(fallback === 'error' ? 80 : 1620, ctx.currentTime + 0.16);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.32);
  });
}

function formatTime(date = new Date()) {
  return new Date(date).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export default function ScannerDashboard() {
  const [clock, setClock] = useState(new Date());
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState(null);
  const [duplicateStudent, setDuplicateStudent] = useState(null);
  const [logs, setLogs] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [counts, setCounts] = useState({ total: 0, success: 0, duplicate: 0, invalid: 0 });
  const [scannerRestartKey, setScannerRestartKey] = useState(0);
  const [scannerResetKey, setScannerResetKey] = useState(0);
  const [scannerStatus, setScannerStatus] = useState('idle');
  const [lastSuccessStudent, setLastSuccessStudent] = useState(null);
  const [lastSuccessAt, setLastSuccessAt] = useState('');
  const [resettingAttendance, setResettingAttendance] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);
  const [downloadingAttendance, setDownloadingAttendance] = useState(false);
  const [fastMode, setFastMode] = useState(() => window.localStorage.getItem('vivan-fast-scan-mode') === 'true');
  const [wakeLockEnabled, setWakeLockEnabled] = useState(() => window.localStorage.getItem('vivan-keep-awake') === 'true');
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [scannerSession, setScannerSession] = useState(() => getStoredScannerSession());
  const lockRef = useRef(false);
  const unlockTimer = useRef(null);
  const wakeLockRef = useRef(null);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const releaseWakeLock = useCallback(async () => {
    const lock = wakeLockRef.current;
    wakeLockRef.current = null;

    try {
      await lock?.release?.();
    } catch {
      // The browser may already have released it.
    }

    setWakeLockActive(false);
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) {
      setWakeLockEnabled(false);
      window.localStorage.setItem('vivan-keep-awake', 'false');
      setToast({
        type: 'invalid',
        title: 'Keep Awake Unsupported',
        message: 'This browser does not support screen wake lock.',
      });
      return;
    }

    try {
      await releaseWakeLock();
      const lock = await navigator.wakeLock.request('screen');
      wakeLockRef.current = lock;
      setWakeLockActive(true);
      lock.addEventListener('release', () => setWakeLockActive(false), { once: true });
    } catch (error) {
      setWakeLockActive(false);
      setToast({
        type: 'invalid',
        title: 'Keep Awake Failed',
        message: error?.message || 'Tap again after interacting with the page.',
      });
    }
  }, [releaseWakeLock]);

  useEffect(() => {
    if (wakeLockEnabled) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    return () => releaseWakeLock();
  }, [releaseWakeLock, requestWakeLock, wakeLockEnabled]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && wakeLockEnabled && !wakeLockRef.current) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [requestWakeLock, wakeLockEnabled]);

  useEffect(() => () => window.clearTimeout(unlockTimer.current), []);

  useEffect(() => {
    if (!scannerSession) return undefined;

    upsertScannerSession(scannerSession);
    const interval = window.setInterval(() => {
      touchScannerSession(scannerSession);
    }, 15000);

    return () => window.clearInterval(interval);
  }, [scannerSession]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), toast.type === 'success' ? 2800 : 3800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadRealtimeLogs = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      const nextLogs = await fetchScanLogs(40);
      setLogs(nextLogs);
    } catch {
      // Keep optimistic logs if permissions for scan_logs are not available.
    }
  }, []);

  useEffect(() => {
    loadRealtimeLogs();
    const unsubscribe = subscribeToScanLogs(loadRealtimeLogs);
    return unsubscribe;
  }, [loadRealtimeLogs]);

  const stats = useMemo(
    () => ({
      total: counts.total,
      success: counts.success,
      duplicate: counts.duplicate,
      invalid: counts.invalid,
      approvalRate: counts.total > 0 ? Math.round((counts.success / counts.total) * 100) : 0,
    }),
    [counts]
  );

  const releaseLock = useCallback((delay = 1300) => {
    window.clearTimeout(unlockTimer.current);
    unlockTimer.current = window.setTimeout(() => {
      lockRef.current = false;
    }, delay);
  }, []);

  const unlockNow = useCallback(() => {
    window.clearTimeout(unlockTimer.current);
    lockRef.current = false;
  }, []);

  const addLog = useCallback((entry) => {
    setLogs((previous) =>
      [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          time: formatTime(),
          ...entry,
        },
        ...previous,
      ].slice(0, 40)
    );
  }, []);

  const handleScannerLogin = useCallback((session) => {
    setScannerSession(session);
    upsertScannerSession(session);
    setToast({
      type: 'success',
      title: 'Scanner Online',
      message: `${session.scanner_name} is live as ${session.scanner_id}.`,
    });
  }, []);

  const handleScannerLogout = useCallback(async () => {
    await signOutScannerSession(scannerSession);
    clearScannerSession();
    setScannerSession(null);
    unlockNow();
    setDuplicateStudent(null);
  }, [scannerSession, unlockNow]);

  const startFreshScan = useCallback(() => {
    unlockNow();
    setDuplicateStudent(null);
    setToast({
      type: 'info',
      title: 'Fresh Scan Ready',
      message: 'Scanner cooldown cleared and camera restarted.',
    });
    setScannerResetKey((key) => key + 1);
    setScannerRestartKey((key) => key + 1);
  }, [unlockNow]);

  const resetSession = useCallback(() => {
    unlockNow();
    setCounts({ total: 0, success: 0, duplicate: 0, invalid: 0 });
    setLogs([]);
    setLastSuccessStudent(null);
    setLastSuccessAt('');
    setToast({
      type: 'info',
      title: 'Session Reset',
      message: 'Local counters and visible logs were cleared.',
    });
    setScannerResetKey((key) => key + 1);
  }, [unlockNow]);

  const clearAllScanLogs = useCallback(async () => {
    if (clearingLogs) return;

    const confirmed = window.confirm('Clear all scan logs? Attendance status will stay unchanged.');
    if (!confirmed) return;

    setClearingLogs(true);
    unlockNow();

    try {
      if (!isSupabaseConfigured) {
        throw new Error('Supabase is not configured.');
      }

      await clearScanLogs();
      setLogs([]);
      setCounts({ total: 0, success: 0, duplicate: 0, invalid: 0 });
      setToast({
        type: 'success',
        title: 'Scan Logs Cleared',
        message: 'Logs and local scan counters are now fresh.',
      });
    } catch (error) {
      setToast({
        type: 'invalid',
        title: 'Clear Failed',
        message: error?.message || 'Unable to clear scan logs right now.',
      });
    } finally {
      setClearingLogs(false);
    }
  }, [clearingLogs, unlockNow]);

  const resetAttendanceCount = useCallback(async () => {
    if (resettingAttendance) return;

    const confirmed = window.confirm(
      'Reset live attendance to 0? This will mark all checked-in students as unused and clear their entry times.'
    );

    if (!confirmed) return;

    unlockNow();
    setDuplicateStudent(null);
    setResettingAttendance(true);

    try {
      if (!isSupabaseConfigured) {
        throw new Error('Supabase is not configured.');
      }

      const { resetCount } = await resetAttendanceToZero();
      setCounts({ total: 0, success: 0, duplicate: 0, invalid: 0 });
      setLastSuccessStudent(null);
      setLastSuccessAt('');
      setRefreshKey((key) => key + 1);
      setScannerResetKey((key) => key + 1);
      setToast({
        type: 'success',
        title: 'Attendance Reset',
        message: `${resetCount} checked-in ${resetCount === 1 ? 'entry was' : 'entries were'} reset. Live count is now 0.`,
      });
    } catch (error) {
      setToast({
        type: 'invalid',
        title: 'Reset Failed',
        message: error?.message || 'Unable to reset attendance right now.',
      });
    } finally {
      setResettingAttendance(false);
    }
  }, [resettingAttendance, unlockNow]);

  const downloadAttendanceDetails = useCallback(async () => {
    if (downloadingAttendance) return;

    setDownloadingAttendance(true);

    try {
      if (!isSupabaseConfigured) {
        throw new Error('Supabase is not configured.');
      }

      const students = await fetchPassDetails();
      if (students.length === 0) {
        setToast({
          type: 'info',
          title: 'No Passes Found',
          message: 'No pass records were found in Supabase.',
        });
        return;
      }

      downloadPassListPdf(students);
      setToast({
        type: 'success',
        title: 'Total Pass PDF Ready',
        message: `${students.length} issued ${students.length === 1 ? 'pass' : 'passes'} exported from Supabase.`,
      });
    } catch (error) {
      setToast({
        type: 'invalid',
        title: 'PDF Export Failed',
        message: error?.message || 'Unable to download total pass details.',
      });
    } finally {
      setDownloadingAttendance(false);
    }
  }, [downloadingAttendance]);

  const quickSyncWelcome = useCallback(async () => {
    if (!lastSuccessStudent) {
      setToast({
        type: 'info',
        title: 'No Student Yet',
        message: 'Scan one valid pass before quick sync.',
      });
      return;
    }

    const synced = await quickSyncStudentToDisplay(lastSuccessStudent);
    setToast({
      type: synced ? 'success' : 'invalid',
      title: synced ? 'Welcome Synced' : 'Sync Failed',
      name: lastSuccessStudent.name,
      message: synced ? 'Latest student was pushed to the welcome screen.' : 'Could not push to Supabase realtime.',
    });
  }, [lastSuccessStudent]);

  const toggleFastMode = useCallback(() => {
    const nextMode = !fastMode;
    setFastMode(nextMode);
    window.localStorage.setItem('vivan-fast-scan-mode', String(nextMode));
    setToast({
      type: 'info',
      title: nextMode ? 'Crowd Mode On' : 'Crowd Mode Off',
      message: nextMode ? 'Successful scan cooldown is shorter for faster queues.' : 'Scanner cooldown returned to normal.',
    });
  }, [fastMode]);

  const toggleWakeLock = useCallback(() => {
    const nextEnabled = !wakeLockEnabled;
    setWakeLockEnabled(nextEnabled);
    window.localStorage.setItem('vivan-keep-awake', String(nextEnabled));
    setToast({
      type: 'info',
      title: nextEnabled ? 'Keep Awake On' : 'Keep Awake Off',
      message: nextEnabled ? 'Phone screen will try to stay awake while scanning.' : 'Screen wake lock disabled.',
    });
  }, [wakeLockEnabled]);

  const requestNotifications = useCallback(async () => {
    if (!('Notification' in window)) {
      setToast({
        type: 'invalid',
        title: 'Notifications Unsupported',
        message: 'This browser does not support web notifications.',
      });
      return;
    }

    const permission = await Notification.requestPermission();
    setToast({
      type: permission === 'granted' ? 'success' : 'invalid',
      title: permission === 'granted' ? 'Notifications Ready' : 'Notifications Blocked',
      message: permission === 'granted' ? 'Scan alerts can now appear on this phone.' : 'Allow notifications in browser settings.',
    });
  }, []);

  const handleScan = useCallback(
    async (rawPassId) => {
      const passId = String(rawPassId || '').trim();
      if (!passId || lockRef.current || processing || !scannerSession) return;

      lockRef.current = true;
      setProcessing(true);
      setCounts((previous) => ({ ...previous, total: previous.total + 1 }));
      playAudio(scannerSound);

      try {
        if (!isSupabaseConfigured) {
          throw new Error('Supabase is not configured.');
        }

        const student = await fetchStudentByPassId(passId);

        if (!student) {
          await logScan(passId, 'invalid', scannerSession);
          playAudio(warningSound, 'error');
          setCounts((previous) => ({ ...previous, invalid: previous.invalid + 1 }));
          setToast({
            type: 'invalid',
            passId,
            title: 'Invalid Scan',
            message: 'No student found for this QR pass.',
          });
          addLog({
            status: 'invalid',
            passId,
            detail: 'No matching student record',
            scannerId: scannerSession.scanner_id,
            scannerName: scannerSession.scanner_name,
          });
          releaseLock(2600);
          return;
        }

        const showDuplicate = async (duplicateRecord) => {
          await logScan(passId, 'duplicate', scannerSession);
          announceAlreadyCheckedIn(duplicateRecord?.name);
          void notifyScan({
            title: 'DENIED',
            body: `${duplicateRecord?.name || passId} was already scanned.`,
            tag: `duplicate-${duplicateRecord?.receipt_id || passId}`,
          });
          if (navigator.vibrate) navigator.vibrate([180, 90, 180, 90, 260]);
          setCounts((previous) => ({ ...previous, duplicate: previous.duplicate + 1 }));
          setDuplicateStudent(duplicateRecord || student);
          addLog({
            status: 'duplicate',
            passId,
            name: duplicateRecord?.name || student.name,
            detail: duplicateRecord?.section || student.section || 'Denied. Already scanned',
            scannerId: scannerSession.scanner_id,
            scannerName: scannerSession.scanner_name,
          });
          releaseLock(4200);
        };

        if (student.checked_in) {
          await showDuplicate(student);
          return;
        }

        let checkedInStudent = null;

        try {
          checkedInStudent = await markStudentCheckedIn(student.receipt_id);
        } catch (markError) {
          if (markError?.code === 'DUPLICATE_CHECK_IN') {
            await showDuplicate(markError.student || student);
            return;
          }

          throw markError;
        }

        await publishLiveDisplay(checkedInStudent);
        await logScan(passId, 'success', scannerSession);
        playAudio(successSound);
        announcePermitted(checkedInStudent.name);
        void notifyScan({
          title: 'PERMITTED',
          body: `${checkedInStudent.name} checked in successfully.`,
          tag: `success-${checkedInStudent.receipt_id || passId}`,
        });
        setLastSuccessStudent(checkedInStudent);
        setLastSuccessAt(new Date().toISOString());
        setCounts((previous) => ({ ...previous, success: previous.success + 1 }));
        setRefreshKey((key) => key + 1);
        setToast({
          type: 'success',
          passId,
          name: checkedInStudent.name,
          title: 'Entry Approved',
          message: 'Attendance marked and display updated.',
        });
        addLog({
          status: 'success',
          passId,
          name: checkedInStudent.name,
          detail: checkedInStudent.section || 'Welcome display pushed',
          scannerId: scannerSession.scanner_id,
          scannerName: scannerSession.scanner_name,
        });
        releaseLock(fastMode ? 900 : 1700);
      } catch (error) {
        playAudio(warningSound, 'error');
        setCounts((previous) => ({ ...previous, invalid: previous.invalid + 1 }));
        setToast({
          type: 'invalid',
          passId,
          title: 'Scan Failed',
          message: error?.message || 'Unable to process QR pass.',
        });
        addLog({
          status: 'invalid',
          passId,
          detail: error?.message || 'Processing failed',
          scannerId: scannerSession.scanner_id,
          scannerName: scannerSession.scanner_name,
        });
        releaseLock(2800);
      } finally {
        setProcessing(false);
      }
    },
    [addLog, fastMode, processing, releaseLock, scannerSession]
  );

  if (!scannerSession) {
    return <ScannerLogin onLogin={handleScannerLogin} />;
  }

  return (
    <div className="scanner-page relative min-h-dvh overflow-hidden bg-[#05030a] text-white">
      <div className="ambient-layer" />
      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-4 pb-24">
        <header className="flex items-center justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-pink-300/25 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.26em] text-pink-100/80">
              <Sparkles className="h-3.5 w-3.5" />
              Scanner
            </div>
            <h1 className="font-orbitron text-2xl font-black uppercase tracking-wider text-gradient-cyan-pink">
              VIVAN VAIVIDHYA
            </h1>
            <p className="text-xs uppercase tracking-[0.35em] text-white/45">Live in concert</p>
          </div>
          <div className="text-right">
            <div className="mb-1 flex items-center justify-end gap-1.5 text-[10px] uppercase tracking-widest text-emerald-200/80">
              <Wifi className="h-3 w-3" />
              {isSupabaseConfigured ? 'Synced' : 'Config'}
            </div>
            <p className="font-orbitron text-xs text-cyan-100">{formatTime(clock)}</p>
          </div>
        </header>

        <section className="rounded-lg border border-white/10 bg-white/[0.045] p-3 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-orbitron text-[10px] uppercase tracking-[0.22em] text-white/38">Logged Scanner</p>
              <p className="mt-1 truncate text-sm font-semibold text-white">
                {scannerSession.scanner_id} | {scannerSession.scanner_name}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <a
                href="/admin"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-fuchsia-300/20 bg-fuchsia-500/10 text-fuchsia-100"
                title="Admin dashboard"
              >
                <ShieldCheck className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={handleScannerLogout}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-300/20 bg-red-500/10 text-red-100"
                title="Logout scanner"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <QRScanner
            onScan={handleScan}
            disabled={processing || Boolean(duplicateStudent)}
            restartSignal={scannerRestartKey}
            resetSignal={scannerResetKey}
            onStatusChange={(nextStatus) => setScannerStatus(nextStatus)}
          />
        </motion.section>

        <section className="grid grid-cols-3 gap-2">
          <ModeButton icon={Zap} label="Crowd" value={fastMode ? 'Fast' : 'Normal'} active={fastMode} onClick={toggleFastMode} />
          <ModeButton icon={Moon} label="Awake" value={wakeLockActive ? 'On' : wakeLockEnabled ? 'Ready' : 'Off'} active={wakeLockEnabled} onClick={toggleWakeLock} />
          <ModeButton icon={Bell} label="Alerts" value="Enable" onClick={requestNotifications} />
        </section>

        <section className="grid grid-cols-2 gap-2">
          <ActionButton icon={RefreshCcw} label="Fresh Scan" onClick={startFreshScan} />
          <ActionButton icon={Satellite} label="Quick Sync" onClick={quickSyncWelcome} />
          <ActionButton icon={RotateCcw} label="Restart Cam" onClick={() => setScannerRestartKey((key) => key + 1)} />
          <ActionButton icon={Trash2} label={clearingLogs ? 'Clearing' : 'Clear Logs'} onClick={clearAllScanLogs} disabled={clearingLogs} />
          <ActionButton icon={Trash2} label="Reset Session" onClick={resetSession} danger />
        </section>

        <div className="grid grid-cols-2 gap-3">
          <StatusChip icon={Radio} label="Scanner" value={processing ? 'Processing' : scannerStatus} />
          <StatusChip icon={Gauge} label="Approval" value={`${stats.approvalRate}%`} />
        </div>

        <LastApprovedCard
          student={lastSuccessStudent}
          lastSuccessAt={lastSuccessAt}
          onReannounce={() => lastSuccessStudent && announcePermitted(lastSuccessStudent.name)}
          onSync={quickSyncWelcome}
        />

        <AttendanceCard
          refreshKey={refreshKey}
          totalScans={stats.total}
          successScans={stats.success}
          duplicateScans={stats.duplicate}
          onResetAttendance={resetAttendanceCount}
          resettingAttendance={resettingAttendance}
          onDownloadAttendance={downloadAttendanceDetails}
          downloadingAttendance={downloadingAttendance}
        />

        <ScanLogs logs={logs} />

        <footer className="pb-6 pt-2 text-center">
          <div className="mx-auto inline-flex max-w-full items-center justify-center rounded-full border border-fuchsia-300/18 bg-black/35 px-4 py-2 shadow-[0_0_26px_rgba(255,0,229,0.12)] backdrop-blur-xl">
            <span className="font-orbitron text-[9px] font-bold uppercase tracking-[0.2em] text-white/58">
              MADE BY VAISIRI STUDENTS | ALL RIGHTS RESERVED
            </span>
          </div>
        </footer>
      </main>

      <DuplicateModal open={Boolean(duplicateStudent)} student={duplicateStudent} onClose={() => setDuplicateStudent(null)} />
      <SuccessToast toast={toast} />
    </div>
  );
}

function ModeButton({ icon: Icon, label, value, active = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-3 text-left backdrop-blur-xl transition active:scale-[0.98] ${
        active
          ? 'border-fuchsia-300/35 bg-fuchsia-400/15 shadow-[0_0_28px_rgba(255,0,229,0.12)]'
          : 'border-white/10 bg-white/[0.045]'
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <Icon className={`h-4 w-4 ${active ? 'text-fuchsia-100' : 'text-cyan-100/70'}`} />
        <span className={`h-2 w-2 rounded-full ${active ? 'bg-emerald-300' : 'bg-white/20'}`} />
      </div>
      <p className="font-orbitron text-[10px] uppercase tracking-widest text-white/40">{label}</p>
      <p className="mt-1 truncate font-orbitron text-xs font-bold text-white">{value}</p>
    </button>
  );
}

function LastApprovedCard({ student, lastSuccessAt, onReannounce, onSync }) {
  if (!student) {
    return (
      <section className="rounded-lg border border-white/10 bg-white/[0.045] p-4 backdrop-blur-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-black/25">
            <UserCheck className="h-5 w-5 text-white/35" />
          </div>
          <div>
            <p className="font-orbitron text-xs uppercase tracking-[0.24em] text-white/55">Last Approved</p>
            <p className="mt-1 text-sm text-white/35">Waiting for first successful scan</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <motion.section
      key={`${student.receipt_id || student.name}-${lastSuccessAt}`}
      className="overflow-hidden rounded-lg border border-emerald-300/20 bg-emerald-400/[0.075] p-4 shadow-[0_0_38px_rgba(16,185,129,0.12)] backdrop-blur-2xl"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 170 }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-emerald-200" />
          <span className="font-orbitron text-xs uppercase tracking-[0.24em] text-emerald-100">Last Approved</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/45">
          <Clock3 className="h-3.5 w-3.5" />
          {lastSuccessAt ? formatTime(lastSuccessAt) : 'Now'}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-emerald-200/25 bg-emerald-500/10">
          {student.photo_url ? (
            <img src={student.photo_url} alt={student.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-orbitron text-2xl font-black text-emerald-100">
              {student.name?.[0]?.toUpperCase() || 'A'}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-orbitron text-lg font-bold text-white">{student.name}</p>
          <p className="truncate text-xs uppercase tracking-[0.22em] text-emerald-100/55">
            {student.section || student.department || student.college_name || 'Entry approved'}
          </p>
          <p className="mt-1 truncate font-mono text-[11px] text-white/35">{student.receipt_id || student.pass_id}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onReannounce}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 font-orbitron text-[10px] uppercase tracking-widest text-emerald-100"
        >
          <Megaphone className="h-3.5 w-3.5" />
          Announce
        </button>
        <button
          type="button"
          onClick={onSync}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 font-orbitron text-[10px] uppercase tracking-widest text-cyan-100"
        >
          <Satellite className="h-3.5 w-3.5" />
          Display
        </button>
      </div>
    </motion.section>
  );
}

function ActionButton({ icon: Icon, label, onClick, danger = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 py-2 font-orbitron text-[10px] uppercase tracking-widest backdrop-blur-xl transition active:scale-[0.98] ${
        danger
          ? 'border-red-300/25 bg-red-500/10 text-red-100'
          : 'border-cyan-300/25 bg-cyan-400/10 text-cyan-100'
      } ${disabled ? 'cursor-wait opacity-55' : ''}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function StatusChip({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.045] p-3 backdrop-blur-xl">
      <div className="mb-2 flex items-center gap-2 text-cyan-100">
        <Icon className="h-4 w-4" />
        <span className="text-[10px] uppercase tracking-widest text-white/40">{label}</span>
      </div>
      <p className="font-orbitron text-sm font-bold text-white">{value}</p>
    </div>
  );
}
