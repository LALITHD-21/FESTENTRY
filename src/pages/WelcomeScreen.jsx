import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Radio, RefreshCcw, Volume2, Wifi } from 'lucide-react';
import PosterOverlay from '../components/PosterOverlay';
import { announceWelcomeBeautiful, primeWelcomeVoice, stopWelcomeVoice } from '../lib/speech';
import {
  fetchLatestDisplayStudent,
  isSupabaseConfigured,
  subscribeToWelcomeDisplay,
} from '../lib/supabase';

const welcomeSoundKey = 'vivan-welcome-sound-enabled';

export default function WelcomeScreen() {
  const [student, setStudent] = useState(null);
  const [status, setStatus] = useState(isSupabaseConfigured ? 'Connecting' : 'Missing Supabase env');
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(welcomeSoundKey) === 'true';
  });
  const [readyForSound, setReadyForSound] = useState(false);
  const announcedStamp = useRef('');

  async function pullLatestStudent() {
    if (!isSupabaseConfigured) return;

    setStatus('Syncing');
    try {
      const latest = await fetchLatestDisplayStudent();
      if (latest) setStudent({ ...latest, updated_at: latest.updated_at || new Date().toISOString() });
      setStatus('Realtime Live');
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
          announcedStamp.current = latest.updated_at || '';
          setStudent(latest);
        }
        if (alive) setStatus('Realtime Live');
      } catch {
        if (alive) setStatus('Waiting for scan');
      }

      if (alive) setReadyForSound(true);
      if (!alive) return;
      unsubscribe = subscribeToWelcomeDisplay((nextStudent) => {
        setStudent(nextStudent);
        setStatus('Realtime Live');
      });
    }

    initWelcomeDisplay();

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const stamp = student?.updated_at || '';
    if (!readyForSound || !soundEnabled || !stamp || announcedStamp.current === stamp) return;

    announcedStamp.current = stamp;
    const timer = window.setTimeout(() => announceWelcomeBeautiful(student.name), 420);
    return () => window.clearTimeout(timer);
  }, [readyForSound, soundEnabled, student?.name, student?.updated_at]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <PosterOverlay student={student} />

      <motion.div
        className="pointer-events-none absolute left-5 top-5 z-20 flex items-center gap-2 rounded-lg border border-fuchsia-300/25 bg-black/45 px-3 py-2 text-[10px] uppercase tracking-widest text-fuchsia-100/85 backdrop-blur-xl"
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <Radio className="h-3.5 w-3.5" />
        Welcome Display
      </motion.div>

      <motion.div
        className="pointer-events-none absolute right-5 top-5 z-20 flex items-center gap-2 rounded-lg border border-white/10 bg-black/45 px-3 py-2 text-[10px] uppercase tracking-widest text-white/70 backdrop-blur-xl"
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <span className={`h-2 w-2 rounded-full ${status === 'Realtime Live' ? 'bg-emerald-400' : 'bg-amber-300'}`} />
        <Wifi className="h-3.5 w-3.5" />
        {status}
      </motion.div>

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
