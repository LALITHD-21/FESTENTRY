import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, CameraOff, Keyboard, Play, RotateCcw, ScanLine, Square, Video } from 'lucide-react';

const READER_ID = 'vivan-mobile-qr-reader';
const COOLDOWN_MS = 2400;

const scanConfig = {
  fps: 10,
  qrbox: (viewfinder) => {
    const size = Math.floor(Math.min(viewfinder.width, viewfinder.height) * 0.72);
    return { width: size, height: size };
  },
  aspectRatio: 1,
  disableFlip: false,
};

function isCameraSupported() {
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

function getSecureContextMessage() {
  if (window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return '';
  }

  return 'Mobile camera needs HTTPS. Open the HTTPS scanner link, then allow camera access.';
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function withTimeout(promise, ms) {
  let timer = null;
  const timeout = new Promise((resolve) => {
    timer = window.setTimeout(resolve, ms);
  });

  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer));
}

function cameraLabel(camera, index) {
  return camera?.label || `Camera ${index + 1}`;
}

function isBackCamera(camera) {
  return /back|rear|environment|wide|main/i.test(camera?.label || '');
}

function getReadableCameraMessage(error) {
  const message = `${error?.name || ''} ${error?.message || error || ''}`.trim();

  if (/notreadable|could not start video|video source|track start/i.test(message)) {
    return 'Camera is busy or locked. Close other camera apps/tabs, then tap Restart Camera.';
  }

  if (/notallowed|permission|denied/i.test(message)) {
    return 'Camera permission was blocked. Open browser site settings and allow camera access.';
  }

  if (/notfound|device not found|no camera/i.test(message)) {
    return 'No camera was found on this browser. Try Chrome on the phone.';
  }

  if (/overconstrained|constraint/i.test(message)) {
    return 'This camera rejected the requested mode. Pick another camera and restart.';
  }

  return message || 'Could not start the video camera.';
}

function releaseReaderVideoTracks() {
  const reader = document.getElementById(READER_ID);
  const videos = reader ? Array.from(reader.querySelectorAll('video')) : [];

  videos.forEach((video) => {
    const stream = video.srcObject;
    if (stream?.getTracks) {
      stream.getTracks().forEach((track) => track.stop());
    }
    video.srcObject = null;
    video.removeAttribute('src');
    video.load?.();
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
  const [manualCode, setManualCode] = useState('');
  const [cameras, setCameras] = useState([]);
  const [activeCameraId, setActiveCameraId] = useState('');
  const scannerRef = useRef(null);
  const mountedRef = useRef(false);
  const onScanRef = useRef(onScan);
  const disabledRef = useRef(disabled);
  const lastScanRef = useRef({ value: '', time: 0 });
  const startTokenRef = useRef(0);

  const setScannerStatus = useCallback(
    (nextStatus, nextError = '') => {
      setStatus(nextStatus);
      setError(nextError);
      onStatusChange?.(nextStatus, nextError);
    },
    [onStatusChange]
  );

  const consumeScan = useCallback((decodedText) => {
    const value = String(decodedText || '').trim();
    if (!value || disabledRef.current) return;

    const now = Date.now();
    if (lastScanRef.current.value === value && now - lastScanRef.current.time < COOLDOWN_MS) return;

    lastScanRef.current = { value, time: now };

    try {
      scannerRef.current?.pause?.(true);
      window.setTimeout(() => scannerRef.current?.resume?.(), 900);
    } catch {
      // Some browsers throw if pause/resume races with stop.
    }

    onScanRef.current?.(value);
  }, []);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  const clearScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;

    if (scanner) {
      try {
        if (scanner.isScanning) {
          await withTimeout(scanner.stop(), 1800);
        }
      } catch {
        // The camera may already be stopped or stuck in a browser prompt.
      }

      try {
        await withTimeout(scanner.clear(), 900);
      } catch {
        // Clear is best-effort after failed startup.
      }
    }

    releaseReaderVideoTracks();

    const reader = document.getElementById(READER_ID);
    if (reader) reader.innerHTML = '';
  }, []);

  const loadCameras = useCallback(async () => {
    const devices = await Html5Qrcode.getCameras();
    const nextCameras = devices || [];
    setCameras(nextCameras);

    if (!activeCameraId && nextCameras.length > 0) {
      const preferred = nextCameras.find(isBackCamera) || nextCameras[nextCameras.length - 1] || nextCameras[0];
      setActiveCameraId(preferred.id);
    }

    return nextCameras;
  }, [activeCameraId]);

  const startWithCamera = useCallback(
    async (cameraId) => {
      const scanner = new Html5Qrcode(READER_ID, false);
      scannerRef.current = scanner;
      await scanner.start(cameraId, scanConfig, (decodedText) => consumeScan(decodedText), () => {});
    },
    [consumeScan]
  );

  const startScanner = useCallback(
    async ({ force = false, cameraId = '' } = {}) => {
      if (status === 'active' && !force) return;

      const secureMessage = getSecureContextMessage();
      if (secureMessage) {
        setScannerStatus('error', secureMessage);
        return;
      }

      if (!isCameraSupported()) {
        setScannerStatus('error', 'This browser does not expose camera access. Open the scanner in Chrome or Edge.');
        return;
      }

      const token = startTokenRef.current + 1;
      startTokenRef.current = token;
      setScannerStatus('starting');
      await clearScanner();
      await sleep(260);

      if (!mountedRef.current || startTokenRef.current !== token) return;

      try {
        const reader = document.getElementById(READER_ID);
        if (!reader) throw new Error('Scanner area is not ready. Refresh and try again.');

        const devices = cameras.length > 0 ? cameras : await loadCameras();
        if (devices.length === 0) throw new Error('No camera found.');

        const preferred = devices.find((device) => device.id === (cameraId || activeCameraId));
        const backCamera = devices.find(isBackCamera);
        const attempts = [...new Set([preferred?.id, backCamera?.id, devices[devices.length - 1]?.id, devices[0]?.id].filter(Boolean))];

        let lastError = null;

        for (const attemptId of attempts) {
          try {
            await startWithCamera(attemptId);
            if (!mountedRef.current || startTokenRef.current !== token) {
              await clearScanner();
              return;
            }
            setActiveCameraId(attemptId);
            setScannerStatus('active');
            return;
          } catch (cameraError) {
            lastError = cameraError;
            await clearScanner();
            await sleep(360);
          }
        }

        throw lastError || new Error('Could not start the video camera.');
      } catch (scannerError) {
        setScannerStatus('error', getReadableCameraMessage(scannerError));
      }
    },
    [activeCameraId, cameras, clearScanner, loadCameras, setScannerStatus, startWithCamera, status]
  );

  const stopScanner = useCallback(async () => {
    startTokenRef.current += 1;
    await clearScanner();
    setScannerStatus('idle');
  }, [clearScanner, setScannerStatus]);

  const restartScanner = useCallback(() => {
    startScanner({ force: true });
  }, [startScanner]);

  const submitManualCode = useCallback(() => {
    const value = manualCode.trim();
    if (!value) return;
    consumeScan(value);
    setManualCode('');
  }, [consumeScan, manualCode]);

  useEffect(() => {
    mountedRef.current = true;
    const timer = window.setTimeout(() => startScanner(), 420);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(timer);
      startTokenRef.current += 1;
      clearScanner();
    };
  }, []);

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
            <p className="text-xs text-white/45">Start camera, scan pass, keep screen awake</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-widest text-white/60">
          <span className={`h-2 w-2 rounded-full ${status === 'active' ? 'bg-emerald-400' : status === 'error' ? 'bg-red-400' : status === 'starting' ? 'bg-amber-300' : 'bg-white/30'}`} />
          {status}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-white/10 bg-black">
        <div id={READER_ID} className="min-h-[320px] w-full" />
        {status === 'active' && <div className="scan-bar pointer-events-none absolute left-0 right-0 top-0 h-px bg-cyan-200 shadow-[0_0_18px_rgba(0,245,255,0.95)]" />}

        <AnimatePresence>
          {(status === 'idle' || status === 'error' || status === 'starting') && (
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90 p-5 text-center backdrop-blur"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {status === 'error' ? <CameraOff className="h-10 w-10 text-red-300" /> : <Camera className="h-10 w-10 text-cyan-200" />}
              <p className="text-sm leading-relaxed text-white/70">
                {status === 'starting' ? 'Opening camera...' : error || 'Tap Start Camera and allow camera permission.'}
              </p>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/30 bg-cyan-500/15 px-4 py-2 font-orbitron text-xs uppercase tracking-widest text-cyan-100"
                onClick={restartScanner}
                disabled={status === 'starting'}
              >
                {status === 'error' ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {status === 'starting' ? 'Starting' : status === 'error' ? 'Restart Camera' : 'Start Camera'}
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
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300/20 bg-red-400/10 px-3 py-2 font-orbitron text-[10px] uppercase tracking-widest text-red-100"
          onClick={stopScanner}
        >
          <Square className="h-3.5 w-3.5" />
          Stop
        </button>
      </div>

      <label className="mt-2 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] uppercase tracking-widest text-white/45">
        <Video className="h-3.5 w-3.5 text-pink-200" />
        <select
          value={activeCameraId}
          onChange={(event) => {
            const nextCameraId = event.target.value;
            setActiveCameraId(nextCameraId);
            startScanner({ force: true, cameraId: nextCameraId });
          }}
          className="min-w-0 flex-1 bg-transparent text-cyan-100 outline-none"
        >
          {cameras.length === 0 ? (
            <option value="">Camera will load after permission</option>
          ) : (
            cameras.map((camera, index) => (
              <option key={camera.id} value={camera.id}>
                {cameraLabel(camera, index)}
              </option>
            ))
          )}
        </select>
      </label>

      <div className="mt-3 rounded-lg border border-white/10 bg-black/25 p-3">
        <label className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/45">
          <Keyboard className="h-3.5 w-3.5 text-pink-200" />
          Backup Entry
        </label>
        <div className="flex gap-2">
          <input
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitManualCode();
            }}
            placeholder="Enter receipt ID"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/40"
          />
          <button
            type="button"
            onClick={submitManualCode}
            className="rounded-lg border border-pink-300/25 bg-pink-400/10 px-3 py-2 font-orbitron text-[10px] uppercase tracking-widest text-pink-100"
          >
            Check
          </button>
        </div>
      </div>
    </section>
  );
}
