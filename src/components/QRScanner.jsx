import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, CameraOff, Loader2, Play, RotateCcw, ScanLine } from 'lucide-react';

const READER_ID = 'vivan-mobile-qr-reader';
const COOLDOWN_MS = 2400;
const AUTO_START_DELAY_MS = 500;
const CAMERA_START_TIMEOUT_MS = 12000;

const scannerConfig = {
  fps: 12,
  qrbox: (viewfinder) => {
    const size = Math.floor(Math.min(viewfinder.width, viewfinder.height) * 0.72);
    return { width: size, height: size };
  },
  aspectRatio: 1,
  disableFlip: false,
};

const baseCameraCandidates = [
  { facingMode: { exact: 'environment' } },
  { facingMode: 'environment' },
  { facingMode: { ideal: 'environment' } },
  { facingMode: 'user' },
];

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function withTimeout(promise, ms, message) {
  let timer = null;

  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => {
      const error = new Error(message);
      error.name = 'TimeoutError';
      reject(error);
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer));
}

function isPermissionError(error) {
  const name = error?.name || '';
  const message = error?.message || '';
  return (
    name === 'NotAllowedError' ||
    name === 'PermissionDeniedError' ||
    name === 'SecurityError' ||
    /permission|denied|not allowed/i.test(message)
  );
}

function getCameraErrorMessage(error) {
  const name = error?.name || '';
  const message = error?.message || '';

  if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'Mobile camera needs HTTPS. Open the HTTPS scanner link, allow the certificate, then tap Start Camera.';
  }

  if (name === 'TimeoutError') {
    return 'Camera permission is waiting. Tap Allow in the browser prompt, then press Start Camera again.';
  }

  if (isPermissionError(error)) {
    return 'Camera permission is blocked. Open browser site settings, set Camera to Allow, then tap Start Camera.';
  }

  if (name === 'NotFoundError' || /not found|no camera|requested device not found/i.test(message)) {
    return 'No camera was found on this device.';
  }

  if (name === 'NotReadableError' || /in use|busy|could not start|track start/i.test(message)) {
    return 'Camera is busy in another app or tab. Close other camera apps, then tap Restart Camera.';
  }

  if (name === 'OverconstrainedError' || /constraint/i.test(message)) {
    return 'This camera mode is not supported. Tap Start Camera to try another camera.';
  }

  return message || 'Unable to start camera. Tap Start Camera.';
}

async function getReadyReader(shouldContinue) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    if (!shouldContinue()) return null;

    const reader = document.getElementById(READER_ID);
    const rect = reader?.getBoundingClientRect();

    if (reader && rect?.width > 120 && rect?.height > 120) {
      reader.innerHTML = '';
      return reader;
    }

    await wait(80);
  }

  throw new Error('Scanner view is not ready. Tap Start Camera again.');
}

function uniqCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = typeof candidate === 'string' ? candidate : JSON.stringify(candidate);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function getDeviceCandidates() {
  const devices = await withTimeout(Html5Qrcode.getCameras(), 2500, 'Camera list timed out.').catch(() => []);
  const rearCameras = devices.filter((device) => {
    const label = String(device.label || '').toLowerCase();
    return label.includes('back') || label.includes('rear') || label.includes('environment') || label.includes('wide');
  });
  const otherCameras = devices.filter((device) => !rearCameras.some((rearCamera) => rearCamera.id === device.id));

  return [...rearCameras, ...otherCameras].map((device) => device.id).filter(Boolean);
}

function waitForVideo(video) {
  if (!video || video.readyState >= 2) return Promise.resolve();

  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, 1800);
    video.addEventListener(
      'canplay',
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

export default function QRScanner({
  onScan,
  disabled = false,
  restartSignal = 0,
  resetSignal = 0,
  onStatusChange,
}) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const scannerRef = useRef(null);
  const mountedRef = useRef(false);
  const startingRef = useRef(false);
  const startTokenRef = useRef(0);
  const statusRef = useRef('idle');
  const onScanRef = useRef(onScan);
  const disabledRef = useRef(disabled);
  const lastScanRef = useRef({ value: '', time: 0 });

  const setScannerStatus = useCallback(
    (nextStatus, nextError = '') => {
      setStatus(nextStatus);
      statusRef.current = nextStatus;
      setError(nextError);
      onStatusChange?.(nextStatus, nextError);
    },
    [onStatusChange]
  );

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;

    if (!scanner) return;

    try {
      if (scanner.isScanning) await scanner.stop();
    } catch {
      // Scanner may already be stopped.
    }

    try {
      scanner.clear();
    } catch {
      // Reader DOM can disappear during route changes or hot reload.
    }
  }, []);

  const startCandidate = useCallback(async (cameraConfig, handleSuccess) => {
    const reader = document.getElementById(READER_ID);
    if (reader) reader.innerHTML = '';

    const scanner = new Html5Qrcode(READER_ID, false);
    scannerRef.current = scanner;

    try {
      await withTimeout(
        scanner.start(cameraConfig, scannerConfig, handleSuccess, () => {}),
        CAMERA_START_TIMEOUT_MS,
        'Camera permission timed out.'
      );

      const video = document.querySelector(`#${READER_ID} video`);
      if (video) {
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.setAttribute('muted', 'true');
        video.setAttribute('autoplay', 'true');
        await waitForVideo(video);
      }

      return scanner;
    } catch (candidateError) {
      if (scannerRef.current === scanner) scannerRef.current = null;

      try {
        if (scanner.isScanning) await scanner.stop();
      } catch {
        // Candidate failed before the camera fully opened.
      }

      try {
        scanner.clear();
      } catch {
        // Reader DOM can be cleared by the next candidate.
      }

      throw candidateError;
    }
  }, []);

  const startScanner = useCallback(
    async ({ force = false } = {}) => {
      if (startingRef.current && !force) return;
      if (statusRef.current === 'active' && !force) return;

      const token = startTokenRef.current + 1;
      startTokenRef.current = token;
      startingRef.current = true;
      lastScanRef.current = { value: '', time: 0 };
      setScannerStatus('starting');
      await stopScanner();

      try {
        await wait(160);
        if (!mountedRef.current || token !== startTokenRef.current) return;

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera needs Chrome, Edge, or Safari with HTTPS enabled.');
        }

        if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          throw new Error('Open the HTTPS scanner link on mobile to allow camera access.');
        }

        await getReadyReader(() => mountedRef.current && token === startTokenRef.current);
        if (!mountedRef.current || token !== startTokenRef.current) return;

        const handleSuccess = (decodedText) => {
          const value = decodedText.trim();
          if (!value || disabledRef.current) return;

          const now = Date.now();
          if (lastScanRef.current.value === value && now - lastScanRef.current.time < COOLDOWN_MS) return;

          lastScanRef.current = { value, time: now };
          onScanRef.current?.(value);
        };

        let lastCameraError = null;
        let activeScanner = null;
        const directCandidates = uniqCandidates(baseCameraCandidates);

        for (const cameraCandidate of directCandidates) {
          if (!mountedRef.current || token !== startTokenRef.current) return;

          try {
            activeScanner = await startCandidate(cameraCandidate, handleSuccess);
            break;
          } catch (candidateError) {
            lastCameraError = candidateError;
            if (isPermissionError(candidateError)) break;
            await wait(120);
          }
        }

        if (!activeScanner && !isPermissionError(lastCameraError)) {
          const deviceCandidates = await getDeviceCandidates();

          for (const cameraCandidate of deviceCandidates) {
            if (!mountedRef.current || token !== startTokenRef.current) return;

            try {
              activeScanner = await startCandidate(cameraCandidate, handleSuccess);
              break;
            } catch (candidateError) {
              lastCameraError = candidateError;
              if (isPermissionError(candidateError)) break;
              await wait(120);
            }
          }
        }

        if (!activeScanner) throw lastCameraError || new Error('No camera could be started.');

        if (!mountedRef.current || token !== startTokenRef.current) {
          await stopScanner();
          return;
        }

        setScannerStatus('active');
      } catch (scannerError) {
        if (!mountedRef.current || token !== startTokenRef.current) return;
        await stopScanner();
        setScannerStatus('error', getCameraErrorMessage(scannerError));
      } finally {
        if (token === startTokenRef.current) startingRef.current = false;
      }
    },
    [setScannerStatus, startCandidate, stopScanner]
  );

  const restartScanner = useCallback(() => {
    startScanner({ force: true });
  }, [startScanner]);

  useEffect(() => {
    mountedRef.current = true;
    const timer = window.setTimeout(() => startScanner(), AUTO_START_DELAY_MS);

    const handleVisibility = () => {
      if (!document.hidden && scannerRef.current === null && statusRef.current === 'active') {
        startScanner({ force: true });
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      mountedRef.current = false;
      startTokenRef.current += 1;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      stopScanner();
    };
  }, [startScanner, stopScanner]);

  useEffect(() => {
    if (restartSignal > 0) restartScanner();
  }, [restartSignal, restartScanner]);

  useEffect(() => {
    lastScanRef.current = { value: '', time: 0 };
  }, [resetSignal]);

  return (
    <section className="scanner-card relative overflow-hidden rounded-lg border border-cyan-300/30 bg-black/55 p-3 shadow-[0_0_70px_rgba(0,245,255,0.16)] backdrop-blur-2xl">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-cyan-200" />
          <div>
            <p className="font-orbitron text-xs uppercase tracking-[0.28em] text-cyan-100">QR Scanner</p>
            <p className="text-xs text-white/45">Tap Start Camera if permission was blocked</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-widest text-white/60">
          <span className={`h-2 w-2 rounded-full ${status === 'active' ? 'bg-emerald-400' : status === 'error' ? 'bg-red-400' : status === 'starting' ? 'bg-amber-300' : 'bg-white/30'}`} />
          {status}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-white/10 bg-black">
        <div id={READER_ID} className="min-h-[320px] w-full" />

        {status === 'active' && (
          <>
            <div className="pointer-events-none absolute inset-0 scanner-grid" />
            <div className="scan-bar pointer-events-none absolute inset-x-[8%] top-0 h-0.5 rounded-full bg-cyan-200 shadow-[0_0_24px_#00f5ff]" />
            <div className="pointer-events-none absolute left-5 top-5 h-10 w-10 border-l-2 border-t-2 border-cyan-200" />
            <div className="pointer-events-none absolute right-5 top-5 h-10 w-10 border-r-2 border-t-2 border-pink-300" />
            <div className="pointer-events-none absolute bottom-5 left-5 h-10 w-10 border-b-2 border-l-2 border-pink-300" />
            <div className="pointer-events-none absolute bottom-5 right-5 h-10 w-10 border-b-2 border-r-2 border-cyan-200" />
          </>
        )}

        <AnimatePresence>
          {status === 'starting' && (
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 text-cyan-100 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="font-orbitron text-xs uppercase tracking-widest">Opening camera</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {(status === 'error' || status === 'idle') && (
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90 p-5 text-center backdrop-blur"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {status === 'error' ? <CameraOff className="h-10 w-10 text-red-300" /> : <Camera className="h-10 w-10 text-cyan-200" />}
              <p className="text-sm leading-relaxed text-white/70">{error || 'Camera is ready to start.'}</p>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/30 bg-cyan-500/15 px-4 py-2 font-orbitron text-xs uppercase tracking-widest text-cyan-100"
                onClick={restartScanner}
              >
                {status === 'error' ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {status === 'error' ? 'Start Camera' : 'Start Camera'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 font-orbitron text-[10px] uppercase tracking-widest text-cyan-100"
          onClick={restartScanner}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Restart Camera
        </button>
        <div className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] uppercase tracking-widest text-white/45">
          <Camera className="h-3.5 w-3.5 text-pink-200" />
          Point at QR
        </div>
      </div>
    </section>
  );
}
