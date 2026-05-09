import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Film, RefreshCcw, Volume2, Wifi } from 'lucide-react';
import PosterOverlay from '../components/PosterOverlay';
import { announceWelcomeBeautiful, primeWelcomeVoice, stopWelcomeVoice } from '../lib/speech';
import {
  fetchLatestDisplayStudent,
  fetchStudentByPassId,
  isSupabaseConfigured,
  subscribeToSuccessfulScanLogs,
  subscribeToWelcomeDisplay,
} from '../lib/supabase';

const welcomeSoundKey = 'vivan-welcome-sound-enabled';
const DISPLAY_HOLD_MS = 4300;

function normalizeDisplayStudent(student, fallback = {}) {
  const name = student?.name || student?.student_name || fallback.name || '';
  if (!name) return null;

  return {
    name,
    photo_url: student?.photo_url || student?.image_url || fallback.photo_url || '',
    updated_at: student?.updated_at || fallback.updated_at || new Date().toISOString(),
    source: student?.source || fallback.source || 'queue',
  };
}

export default function WelcomeScreen() {
  const [student, setStudent] = useState(null);
  const [queue, setQueue] = useState([]);
  const [isShowing, setIsShowing] = useState(false);
  const [status, setStatus] = useState(isSupabaseConfigured ? 'Connecting' : 'Missing Supabase env');
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(welcomeSoundKey) === 'true';
  });
  const [readyForSound, setReadyForSound] = useState(false);
  const announcedStamp = useRef('');
  const recentSignatures = useRef(new Map());
  const playbackTimer = useRef(null);

  const enqueueStudent = useCallback((nextStudent, fallback = {}) => {
    const displayStudent = normalizeDisplayStudent(nextStudent, fallback);
    if (!displayStudent) return;

    const now = Date.now();
    const signature = `${displayStudent.name}|${displayStudent.photo_url}`.toLowerCase();
    const lastSeen = recentSignatures.current.get(signature);

    if (lastSeen && now - lastSeen < 6500) return;

    recentSignatures.current.set(signature, now);
    for (const [key, value] of recentSignatures.current.entries()) {
      if (now - value > 30000) recentSignatures.current.delete(key);
    }

    setQueue((previous) => [...previous, displayStudent].slice(-25));
    setStatus('Queue Live');
  }, []);

  async function pullLatestStudent() {
    if (!isSupabaseConfigured) return;

    setStatus('Syncing');
    try {
      const latest = await fetchLatestDisplayStudent();
      if (latest) {
        const displayStudent = normalizeDisplayStudent(latest, { updated_at: latest.updated_at || new Date().toISOString() });
        if (displayStudent) {
          setStudent(displayStudent);
        }
      }
      setStatus('Queue Live');
    } catch {
      setStatus('Waiting for scan');
    }
  }

  function toggleWelcomeSound() {
    const nextEnabled = !soundEnabled;
    setSoundEnabled(nextEnabled);
    window.localStorage.setItem(welcomeSoundKey, String(nextEnabled));

    if (nextEnabled) {
      primeWelcomeVoice();
      return;
    }

    stopWelcomeVoice();
  }

  useEffect(() => {
    let alive = true;
    let unsubscribe = () => {};

    async function initWelcomeDisplay() {
      if (!isSupabaseConfigured) return;

      try {
        const latest = await fetchLatestDisplayStudent();
        if (alive && latest) {
          const displayStudent = normalizeDisplayStudent(latest);
          if (displayStudent) {
            announcedStamp.current = displayStudent.updated_at || '';
            setStudent(displayStudent);
          }
        }
        if (alive) setStatus('Queue Live');
      } catch {
        if (alive) setStatus('Waiting for scan');
      }

      if (alive) setReadyForSound(true);
      if (!alive) return;

      const unsubscribeWelcome = subscribeToWelcomeDisplay((nextStudent) => {
        enqueueStudent(nextStudent);
      });

      const unsubscribeScanLogs = subscribeToSuccessfulScanLogs(async (scanLog) => {
        try {
          const scannedStudent = await fetchStudentByPassId(scanLog.receipt_id);
          if (!alive || !scannedStudent) return;
          enqueueStudent(scannedStudent, {
            updated_at: scanLog.scan_time || scanLog.created_at || new Date().toISOString(),
            source: 'scan_logs',
          });
        } catch {
          // live_display/students realtime remains as the fallback channel.
        }
      });

      unsubscribe = () => {
        unsubscribeWelcome();
        unsubscribeScanLogs();
      };
    }

    initWelcomeDisplay();

    return () => {
      alive = false;
      unsubscribe();
    };
  }, [enqueueStudent]);

  useEffect(() => {
    if (isShowing || queue.length === 0 || playbackTimer.current) return;

    const nextStudent = queue[0];
    setQueue((previous) => previous.slice(1));
    setStudent(nextStudent);
    setIsShowing(true);
    setStatus(queue.length > 1 ? `Queue ${queue.length}` : 'Queue Live');

    playbackTimer.current = window.setTimeout(() => {
      playbackTimer.current = null;
      setIsShowing(false);
    }, DISPLAY_HOLD_MS);
  }, [isShowing, queue]);

  useEffect(() => () => window.clearTimeout(playbackTimer.current), []);

  useEffect(() => {
    const stamp = student?.updated_at || '';
    if (!readyForSound || !soundEnabled || !stamp || announcedStamp.current === stamp) return undefined;

    announcedStamp.current = stamp;
    const timer = window.setTimeout(() => announceWelcomeBeautiful(student.name), 420);
    return () => window.clearTimeout(timer);
  }, [readyForSound, soundEnabled, student?.name, student?.updated_at]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <PosterOverlay student={student} />

      <motion.div
        className="pointer-events-none absolute right-5 top-5 z-20 flex items-center gap-2 rounded-lg border border-white/10 bg-black/45 px-3 py-2 text-[10px] uppercase tracking-widest text-white/70 backdrop-blur-xl"
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <span className={`h-2 w-2 rounded-full ${status.includes('Queue') ? 'bg-emerald-400' : 'bg-amber-300'}`} />
        <Wifi className="h-3.5 w-3.5" />
        {status}
      </motion.div>

      <AnimatePresence>
        {queue.length > 0 && (
          <motion.div
            className="pointer-events-none absolute left-1/2 top-5 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-purple-200/20 bg-black/45 px-3 py-2 font-orbitron text-[10px] uppercase tracking-widest text-purple-100/85 backdrop-blur-xl"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <Film className="h-3.5 w-3.5" />
            {queue.length} Waiting
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        className="absolute bottom-5 left-5 z-30 inline-flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-black/55 px-3 py-2 font-orbitron text-[10px] uppercase tracking-widest text-cyan-100/80 backdrop-blur-xl transition hover:border-cyan-200/45 hover:text-cyan-50"
        onClick={pullLatestStudent}
      >
        <RefreshCcw className="h-4 w-4" />
        Quick Sync
      </button>

      <button
        type="button"
        className={`absolute bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-lg border bg-black/45 px-2.5 py-2 font-orbitron text-[9px] uppercase tracking-widest backdrop-blur-xl transition ${
          soundEnabled
            ? 'border-emerald-300/25 text-emerald-100/70 opacity-60 hover:opacity-100'
            : 'border-white/10 text-white/35 opacity-35 hover:border-fuchsia-300/30 hover:text-fuchsia-100/75 hover:opacity-100'
        }`}
        onClick={toggleWelcomeSound}
      >
        <Volume2 className="h-3.5 w-3.5" />
        {soundEnabled ? 'Sound On' : 'Enable Sound'}
      </button>
    </div>
  );
}
