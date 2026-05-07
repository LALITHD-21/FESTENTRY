import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock3, Radio, RefreshCcw, RotateCcw, Satellite, Sparkles, Trash2, Wifi, Zap } from 'lucide-react';
import AttendanceCard from '../components/AttendanceCard';
import DuplicateModal from '../components/DuplicateModal';
import QRScanner from '../components/QRScanner';
import ScanLogs from '../components/ScanLogs';
import SuccessToast from '../components/SuccessToast';
import scannerSound from '../assets/scanner.mp3';
import successSound from '../assets/success.mp3';
import warningSound from '../assets/warning.mp3';
import { speakWelcome } from '../lib/speech';
import {
  fetchStudentByPassId,
  fetchScanLogs,
  isSupabaseConfigured,
  logScan,
  markStudentCheckedIn,
  publishLiveDisplay,
  quickSyncStudentToDisplay,
  resetAttendanceToZero,
  subscribeToScanLogs,
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
  const [resettingAttendance, setResettingAttendance] = useState(false);
  const lockRef = useRef(false);
  const unlockTimer = useRef(null);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => window.clearTimeout(unlockTimer.current), []);

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
    setToast({
      type: 'info',
      title: 'Session Reset',
      message: 'Local counters and visible logs were cleared.',
    });
    setScannerResetKey((key) => key + 1);
  }, [unlockNow]);

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

  const handleScan = useCallback(
    async (rawPassId) => {
      const passId = String(rawPassId || '').trim();
      if (!passId || lockRef.current || processing) return;

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
          await logScan(passId, 'invalid');
          playAudio(warningSound, 'error');
          setCounts((previous) => ({ ...previous, invalid: previous.invalid + 1 }));
          setToast({
            type: 'invalid',
            passId,
            title: 'Invalid Scan',
            message: 'No student found for this QR pass.',
          });
          addLog({ status: 'invalid', passId, detail: 'No matching student record' });
          releaseLock(2600);
          return;
        }

        if (student.checked_in) {
          await logScan(passId, 'duplicate');
          playAudio(warningSound, 'error');
          if (navigator.vibrate) navigator.vibrate([180, 90, 180, 90, 260]);
          setCounts((previous) => ({ ...previous, duplicate: previous.duplicate + 1 }));
          setDuplicateStudent(student);
          addLog({ status: 'duplicate', passId, name: student.name, detail: student.section || 'Already checked in' });
          releaseLock(4200);
          return;
        }

        const checkedInStudent = await markStudentCheckedIn(student.receipt_id);
        await publishLiveDisplay(checkedInStudent);
        await logScan(passId, 'success');
        playAudio(successSound);
        window.setTimeout(() => speakWelcome(checkedInStudent.name), 420);
        setLastSuccessStudent(checkedInStudent);
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
        });
        releaseLock(1700);
      } catch (error) {
        playAudio(warningSound, 'error');
        setCounts((previous) => ({ ...previous, invalid: previous.invalid + 1 }));
        setToast({
          type: 'invalid',
          passId,
          title: 'Scan Failed',
          message: error?.message || 'Unable to process QR pass.',
        });
        addLog({ status: 'invalid', passId, detail: error?.message || 'Processing failed' });
        releaseLock(2800);
      } finally {
        setProcessing(false);
      }
    },
    [addLog, processing, releaseLock]
  );

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

        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <QRScanner
            onScan={handleScan}
            disabled={processing || Boolean(duplicateStudent)}
            restartSignal={scannerRestartKey}
            resetSignal={scannerResetKey}
            onStatusChange={(nextStatus) => setScannerStatus(nextStatus)}
          />
        </motion.section>

        <section className="grid grid-cols-2 gap-2">
          <ActionButton icon={RefreshCcw} label="Fresh Scan" onClick={startFreshScan} />
          <ActionButton icon={Satellite} label="Quick Sync" onClick={quickSyncWelcome} />
          <ActionButton icon={RotateCcw} label="Restart Cam" onClick={() => setScannerRestartKey((key) => key + 1)} />
          <ActionButton icon={Trash2} label="Reset Session" onClick={resetSession} danger />
        </section>

        <div className="grid grid-cols-2 gap-3">
          <StatusChip icon={Radio} label="Scanner" value={processing ? 'Processing' : scannerStatus} />
          <StatusChip icon={Clock3} label="Realtime" value={isSupabaseConfigured ? 'Online' : 'Missing env'} />
        </div>

        <AttendanceCard
          refreshKey={refreshKey}
          totalScans={stats.total}
          successScans={stats.success}
          duplicateScans={stats.duplicate}
          onResetAttendance={resetAttendanceCount}
          resettingAttendance={resettingAttendance}
        />

        <ScanLogs logs={logs} />
      </main>

      <DuplicateModal open={Boolean(duplicateStudent)} student={duplicateStudent} onClose={() => setDuplicateStudent(null)} />
      <SuccessToast toast={toast} />
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 py-2 font-orbitron text-[10px] uppercase tracking-widest backdrop-blur-xl transition active:scale-[0.98] ${
        danger
          ? 'border-red-300/25 bg-red-500/10 text-red-100'
          : 'border-cyan-300/25 bg-cyan-400/10 text-cyan-100'
      }`}
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
