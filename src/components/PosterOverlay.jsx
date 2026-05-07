import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
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
            <AlignmentSlider label="Name X" value={alignment.nameLeft} min={65.8} max={68.2} step={0.025} onChange={(value) => updateAlignment('nameLeft', value)} />
            <AlignmentSlider label="Name Y" value={alignment.nameTop} min={69.2} max={71.4} step={0.025} onChange={(value) => updateAlignment('nameTop', value)} />
            <AlignmentSlider label="Name W" value={alignment.nameWidth} min={28.2} max={31.6} step={0.025} onChange={(value) => updateAlignment('nameWidth', value)} />
            <AlignmentSlider label="Name H" value={alignment.nameHeight} min={6.8} max={9.2} step={0.025} onChange={(value) => updateAlignment('nameHeight', value)} />
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
