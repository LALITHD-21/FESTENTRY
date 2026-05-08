import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react';
import warningSound from '../assets/warning.mp3';

function playWarningSound() {
  const audio = new Audio(warningSound);
  audio.volume = 0.32;
  audio.playbackRate = 0.82;
  audio.play().catch(() => {});

  const fadeDelay = window.setTimeout(() => {
    const fade = window.setInterval(() => {
      audio.volume = Math.max(0, audio.volume - 0.045);
      if (audio.volume <= 0.02) {
        window.clearInterval(fade);
        audio.pause();
        audio.currentTime = 0;
      }
    }, 80);
  }, 1800);

  return () => {
    window.clearTimeout(fadeDelay);
    audio.pause();
    audio.currentTime = 0;
  };
}

export default function DuplicateModal({ open, student, onClose }) {
  useEffect(() => {
    if (!open) return undefined;

    const stopWarningSound = playWarningSound();
    if (navigator.vibrate) navigator.vibrate([180, 90, 180, 90, 260]);
    const timer = window.setTimeout(onClose, 4200);

    return () => {
      stopWarningSound?.();
      window.clearTimeout(timer);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && student && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center overflow-hidden bg-black/90 p-4 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,51,102,0.28),transparent_42%)]" />
          <div className="absolute inset-0 danger-grid" />
          <motion.div
            className="absolute h-[60vmin] w-[60vmin] rounded-full border border-red-400/20"
            animate={{ scale: [0.88, 1.22, 0.88], opacity: [0.32, 0.06, 0.32] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          />

          <motion.section
            className="relative w-full max-w-md overflow-hidden rounded-lg border border-red-300/45 bg-[#15040b]/90 p-7 text-center shadow-[0_0_90px_rgba(255,51,102,0.3)]"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, x: [0, -8, 8, -4, 4, 0] }}
            exit={{ scale: 0.82, opacity: 0 }}
            transition={{ type: 'spring', damping: 18 }}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-lg border border-white/10 bg-white/5 p-2 text-white/55"
              aria-label="Close duplicate warning"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-500 via-amber-300 to-red-500 warning-bar" />

            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-red-300/50 bg-red-500/15">
              <ShieldAlert className="h-10 w-10 text-red-100" />
            </div>

            <h2 className="font-orbitron text-2xl font-black uppercase tracking-widest text-red-100 text-glow-red">
              ⚠ Pass Already Used
            </h2>
            <p className="mt-2 text-sm text-red-100/65">Duplicate entry blocked immediately.</p>

            <div className="my-6 flex items-center justify-center gap-4">
              <div className="h-20 w-20 overflow-hidden rounded-full border border-red-300/40 bg-red-500/15">
                {student.photo_url ? (
                  <img src={student.photo_url} alt={student.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-orbitron text-3xl font-black text-red-100">
                    {student.name?.[0]?.toUpperCase() || '!'}
                  </div>
                )}
              </div>
              <div className="text-left">
                <p className="font-orbitron text-lg font-bold text-white">{student.name}</p>
                <p className="text-xs uppercase tracking-[0.24em] text-red-100/60">{student.section || 'Student'}</p>
                <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-300/25 bg-red-500/10 px-3 py-2 text-[10px] uppercase tracking-widest text-red-100">
                  <AlertTriangle className="h-4 w-4" />
                  checked in already
                </div>
              </div>
            </div>

            <div className="h-1 overflow-hidden rounded-full bg-white/10">
              <motion.div className="h-full rounded-full bg-red-400" initial={{ width: '100%' }} animate={{ width: '0%' }} transition={{ duration: 4.2, ease: 'linear' }} />
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
