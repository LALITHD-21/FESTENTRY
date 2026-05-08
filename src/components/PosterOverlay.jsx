import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { RotateCcw, X } from 'lucide-react';
import concertPoster from '../assets/concert-poster.png';

const STORAGE_KEY = 'vivan-poster-alignment-v4';

const DEFAULT_ALIGNMENT = {
  photoLeft: 70.05,
  photoTop: 15.35,
  photoWidth: 23.05,
  photoHeight: 40.98,
  nameLeft: 66.9,
  nameTop: 70.35,
  nameWidth: 29.9,
  nameHeight: 8.05,
};

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
              initial={{ opacity: 0, scale: 0.978, filter: 'blur(14px) brightness(1.22)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px) brightness(1)' }}
              exit={{ opacity: 0, scale: 1.026, filter: 'blur(16px) brightness(0.74)' }}
              transition={{ duration: 0.78, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.div
                className="cinematic-welcome-sweep absolute inset-0"
                initial={{ x: '-130%', opacity: 0 }}
                animate={{ x: '130%', opacity: [0, 0.9, 0] }}
                transition={{ duration: 1.15, ease: [0.16, 1, 0.3, 1] }}
              />
              <motion.div
                className="poster-photo absolute rounded-full"
                style={photoSlot}
                initial={{ opacity: 0, scale: 0.48, y: 24, filter: 'blur(20px) saturate(1.6)' }}
                animate={{ opacity: 1, scale: [0.48, 1.09, 1], y: 0, filter: 'blur(0px) saturate(1.05)' }}
                exit={{ opacity: 0, scale: 1.08, y: -14, filter: 'blur(12px) saturate(0.8)' }}
                transition={{ duration: 0.92, ease: [0.16, 1, 0.3, 1], times: [0, 0.72, 1] }}
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
                className="poster-name-slot absolute flex items-center justify-center"
                style={nameSlot}
                initial={{ opacity: 0, y: 28, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', damping: 17, stiffness: 170 }}
              >
                <PosterName name={student.name} />
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
        className="absolute right-4 top-1/2 z-[90] inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-fuchsia-200/20 bg-black/45 font-orbitron text-sm font-black uppercase tracking-widest text-white/55 shadow-[0_0_24px_rgba(255,0,229,0.18)] backdrop-blur-xl transition hover:border-fuchsia-200/55 hover:bg-fuchsia-500/15 hover:text-white hover:shadow-[0_0_36px_rgba(255,0,229,0.3)]"
        onClick={() => setSettingsOpen((open) => !open)}
        title="Open alignment settings"
      >
        A
      </button>

      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            className="absolute bottom-0 right-0 top-0 z-[85] w-[min(92vw,390px)] overflow-y-auto border-l border-fuchsia-300/20 bg-black/82 p-5 text-white shadow-[-22px_0_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
            initial={{ opacity: 0, x: 420 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 420 }}
            transition={{ type: 'spring', damping: 24, stiffness: 190 }}
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="font-orbitron text-xs uppercase tracking-widest text-fuchsia-100">Photo & Name Alignment</p>
                <p className="mt-1 text-[11px] text-white/45">Saved live on this display</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/65 transition hover:text-white"
                  onClick={() => setAlignment(DEFAULT_ALIGNMENT)}
                  title="Reset alignment"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/65 transition hover:text-white"
                  onClick={() => setSettingsOpen(false)}
                  title="Close alignment"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mb-3 rounded-lg border border-white/10 bg-white/[0.045] p-3">
              <p className="mb-3 font-orbitron text-[10px] uppercase tracking-widest text-cyan-100">Photo Circle</p>
              <AlignmentSlider label="Photo X" value={alignment.photoLeft} min={67.8} max={72.4} step={0.025} onChange={(value) => updateAlignment('photoLeft', value)} />
              <AlignmentSlider label="Photo Y" value={alignment.photoTop} min={12.8} max={18.2} step={0.025} onChange={(value) => updateAlignment('photoTop', value)} />
              <AlignmentSlider label="Photo W" value={alignment.photoWidth} min={20.8} max={25.4} step={0.025} onChange={(value) => updateAlignment('photoWidth', value)} />
              <AlignmentSlider label="Photo H" value={alignment.photoHeight} min={38.2} max={44.2} step={0.025} onChange={(value) => updateAlignment('photoHeight', value)} />
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.045] p-3">
              <p className="mb-3 font-orbitron text-[10px] uppercase tracking-widest text-fuchsia-100">Name Box</p>
              <AlignmentSlider label="Name X" value={alignment.nameLeft} min={63.4} max={69.6} step={0.025} onChange={(value) => updateAlignment('nameLeft', value)} />
              <AlignmentSlider label="Name Y" value={alignment.nameTop} min={67.0} max={72.8} step={0.025} onChange={(value) => updateAlignment('nameTop', value)} />
              <AlignmentSlider label="Name W" value={alignment.nameWidth} min={24.0} max={34.5} step={0.025} onChange={(value) => updateAlignment('nameWidth', value)} />
              <AlignmentSlider label="Name H" value={alignment.nameHeight} min={6.0} max={12.5} step={0.025} onChange={(value) => updateAlignment('nameHeight', value)} />
            </div>

            <div className="mt-4 rounded-lg border border-purple-200/10 bg-purple-500/10 p-3 text-[11px] leading-relaxed text-white/55">
              Use tiny movements. The photo should sit exactly inside the poster circle; the name should stay centered in the black name plate.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PosterName({ name }) {
  const slotRef = useRef(null);
  const textRef = useRef(null);
  const [fontSize, setFontSize] = useState(42);
  const displayName = formatPosterName(name);

  useLayoutEffect(() => {
    const fitName = () => {
      const slot = slotRef.current;
      const text = textRef.current;
      if (!slot || !text || !displayName) return;

      const rect = slot.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const maxSize = Math.min(rect.height * 0.84, rect.width * 0.13, 76);
      let low = 14;
      let high = Math.max(18, maxSize);
      let best = low;

      for (let index = 0; index < 14; index += 1) {
        const mid = (low + high) / 2;
        text.style.fontSize = `${mid}px`;

        if (text.scrollWidth <= rect.width * 0.965 && text.scrollHeight <= rect.height * 0.9) {
          best = mid;
          low = mid;
        } else {
          high = mid;
        }
      }

      setFontSize(best);
    };

    fitName();
    document.fonts?.ready?.then(fitName);

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fitName) : null;
    if (slotRef.current) observer?.observe(slotRef.current);
    window.addEventListener('resize', fitName);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', fitName);
    };
  }, [displayName]);

  return (
    <div ref={slotRef} className="flex h-full w-full items-center justify-center overflow-hidden px-[1.5%] py-[0.8%]">
      <motion.span
        ref={textRef}
        className="poster-name block max-w-full whitespace-nowrap text-center"
        style={{ fontSize: `${fontSize}px` }}
        initial={{ filter: 'blur(12px) drop-shadow(0 0 8px rgba(255,255,255,0.5))' }}
        animate={{ filter: 'blur(0px) drop-shadow(0 0 10px rgba(255,255,255,0.82)) drop-shadow(0 0 16px rgba(124,58,237,0.35))' }}
        transition={{ delay: 0.35, duration: 0.7 }}
      >
        {displayName}
      </motion.span>
    </div>
  );
}

function formatPosterName(name) {
  const cleaned = String(name || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';

  const letters = cleaned.replace(/[^\p{L}]/gu, '');
  if (!letters || letters !== letters.toUpperCase()) return cleaned;

  return cleaned
    .toLowerCase()
    .replace(/(^|[\s.'-])(\p{L})/gu, (match, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
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
