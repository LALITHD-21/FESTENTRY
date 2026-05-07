import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import concertPoster from '../assets/concert-poster.png';

const STORAGE_KEY = 'vivan-poster-alignment-v3';

const DEFAULT_ALIGNMENT = {
  photoLeft: 70.05,
  photoTop: 15.35,
  photoWidth: 23.05,
  photoHeight: 40.98,
  nameLeft: 65.4,
  nameTop: 68.5,
  nameWidth: 32.15,
  nameHeight: 11.6,
};

function getNameSize(name = '') {
  const length = name.trim().length;
  if (length > 30) return 'clamp(16px,2.05vw,34px)';
  if (length > 22) return 'clamp(18px,2.45vw,42px)';
  if (length > 15) return 'clamp(22px,3vw,54px)';
  return 'clamp(28px,3.7vw,70px)';
}

function readAlignment() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...DEFAULT_ALIGNMENT, ...(saved || {}) };
  } catch {
    return DEFAULT_ALIGNMENT;
  }
}

function slotStyle(left, top, width, height) {
  return {
    left: `${left}%`,
    top: `${top}%`,
    width: `${width}%`,
    height: `${height}%`,
  };
}

export default function PosterOverlay({ student }) {
  const frameRef = useRef(null);
  const previousStamp = useRef('');
  const [alignment, setAlignment] = useState(readAlignment);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alignment));
  }, [alignment]);

  const photoSlot = useMemo(
    () => slotStyle(alignment.photoLeft, alignment.photoTop, alignment.photoWidth, alignment.photoHeight),
    [alignment]
  );
  const nameSlot = useMemo(
    () => slotStyle(alignment.nameLeft, alignment.nameTop, alignment.nameWidth, alignment.nameHeight),
    [alignment]
  );

  useEffect(() => {
    if (!student?.updated_at || previousStamp.current === student.updated_at) return;
    previousStamp.current = student.updated_at;

    const rect = frameRef.current?.getBoundingClientRect();
    const origin = rect
      ? {
          x: (rect.left + rect.width * (alignment.photoLeft + alignment.photoWidth / 2) / 100) / window.innerWidth,
          y: (rect.top + rect.height * (alignment.photoTop + alignment.photoHeight / 2) / 100) / window.innerHeight,
        }
      : { x: 0.81, y: 0.4 };

    const colors = ['#00f5ff', '#ff00e5', '#f7c45c', '#ffffff', '#8b5cf6'];
    confetti({ particleCount: 140, spread: 100, origin, colors, startVelocity: 52, zIndex: 10000 });
    window.setTimeout(() => {
      confetti({ particleCount: 75, spread: 80, origin, colors, startVelocity: 38, zIndex: 10000 });
    }, 420);
  }, [alignment, student]);

  const updateAlignment = (key, value) => {
    setAlignment((current) => ({ ...current, [key]: Number(value) }));
  };

  return (
    <div className="poster-page flex h-screen w-screen items-center justify-center overflow-hidden bg-black">
      <motion.div
        ref={frameRef}
        className="poster-frame relative aspect-video overflow-hidden"
        initial={{ opacity: 0, scale: 1.015 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1 }}
      >
        <img src={concertPoster} alt="VIVAN VAIVIDHYA concert poster" className="absolute inset-0 h-full w-full object-cover" />

        <AnimatePresence mode="wait">
          {student?.name ? (
            <motion.div
              key={`${student.name}-${student.updated_at || ''}`}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="poster-photo absolute rounded-full"
                style={photoSlot}
                initial={{ opacity: 0, scale: 0.55, filter: 'blur(18px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                transition={{ type: 'spring', damping: 13, stiffness: 145 }}
              >
                <motion.div
                  className="absolute -inset-[4%] rounded-full bg-[conic-gradient(from_0deg,#ff00e5,#f7c45c,#ffffff,#00f5ff,#ff00e5)] blur-[3px]"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
                />
                <div className="poster-photo-inner relative h-full w-full overflow-hidden rounded-full bg-[#160018]">
                  {student.photo_url ? (
                    <img src={student.photo_url} alt={student.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-fuchsia-700 to-purple-950 font-orbitron text-[8vw] font-black text-white">
                      {student.name[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
              </motion.div>

              <motion.div
                className="absolute flex items-center justify-center px-[1.6%]"
                style={nameSlot}
                initial={{ opacity: 0, y: 28, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', damping: 17, stiffness: 170 }}
              >
                <motion.span
                  className="poster-name block w-full truncate text-center font-orbitron font-black uppercase"
                  style={{ fontSize: getNameSize(student.name) }}
                  initial={{ filter: 'blur(12px)' }}
                  animate={{ filter: 'blur(0px)' }}
                  transition={{ delay: 0.35, duration: 0.7 }}
                >
                  {student.name}
                </motion.span>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              className="absolute inset-0 flex items-end justify-center pb-[3%]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="rounded-lg border border-fuchsia-300/25 bg-black/45 px-5 py-3 text-center backdrop-blur-xl">
                <p className="font-orbitron text-xs uppercase tracking-[0.35em] text-fuchsia-100">Awaiting first check-in</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <button
        type="button"
        className="absolute bottom-3 right-3 z-30 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/5 bg-black/25 text-white/30 opacity-35 backdrop-blur-sm transition hover:border-fuchsia-200/20 hover:text-white/80 hover:opacity-90"
        onClick={() => setSettingsOpen((open) => !open)}
        title="Poster alignment"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
      </button>

      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            className="absolute bottom-12 right-3 z-30 w-[min(92vw,360px)] rounded-lg border border-fuchsia-300/20 bg-black/75 p-4 text-white shadow-2xl backdrop-blur-xl"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-orbitron text-xs uppercase tracking-widest text-fuchsia-100">Poster Alignment</p>
                <p className="text-[11px] text-white/45">Tiny percentage nudges, saved here</p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/65"
                onClick={() => setAlignment(DEFAULT_ALIGNMENT)}
                title="Reset alignment"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>

            <AlignmentSlider label="Photo X" value={alignment.photoLeft} min={68.8} max={71.4} step={0.025} onChange={(value) => updateAlignment('photoLeft', value)} />
            <AlignmentSlider label="Photo Y" value={alignment.photoTop} min={13.8} max={17.2} step={0.025} onChange={(value) => updateAlignment('photoTop', value)} />
            <AlignmentSlider label="Photo W" value={alignment.photoWidth} min={21.8} max={24.4} step={0.025} onChange={(value) => updateAlignment('photoWidth', value)} />
            <AlignmentSlider label="Photo H" value={alignment.photoHeight} min={39.2} max={43.2} step={0.025} onChange={(value) => updateAlignment('photoHeight', value)} />
            <div className="my-3 h-px bg-white/10" />
            <AlignmentSlider label="Name X" value={alignment.nameLeft} min={63.8} max={67.2} step={0.025} onChange={(value) => updateAlignment('nameLeft', value)} />
            <AlignmentSlider label="Name Y" value={alignment.nameTop} min={66.8} max={70.4} step={0.025} onChange={(value) => updateAlignment('nameTop', value)} />
            <AlignmentSlider label="Name W" value={alignment.nameWidth} min={29.5} max={34} step={0.025} onChange={(value) => updateAlignment('nameWidth', value)} />
            <AlignmentSlider label="Name H" value={alignment.nameHeight} min={9.5} max={13.5} step={0.025} onChange={(value) => updateAlignment('nameHeight', value)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AlignmentSlider({ label, value, min, max, step, onChange }) {
  return (
    <label className="mb-2 grid grid-cols-[72px_1fr_54px] items-center gap-2 text-[11px] text-white/60">
      <span className="uppercase tracking-wider">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="accent-fuchsia-400"
      />
      <span className="font-mono text-white/45">{value.toFixed(2)}</span>
    </label>
  );
}
