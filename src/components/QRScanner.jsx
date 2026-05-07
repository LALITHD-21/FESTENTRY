import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, CameraOff, Loader2, Play, RotateCcw, ScanLine } from 'lucide-react';

const READER_ID = 'vivan-mobile-qr-reader';
const COOLDOWN_MS = 2400;
const CAMERA_TIMEOUT_MS = 9000;
const QR_TIMEOUT_MS = 9000;
const WATCHDOG_MS = 14000;

const scannerConfig = {
  fps: 12,
  qrbox: (viewfinder) => {
    const size = Math.floor(Math.min(viewfinder.width, viewfinder.height) * 0.72);
    return { width: size, height: size };
  },
  aspectRatio: 1,
  disableFlip: false,
};

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

function stopStream(stream) {
  stream?.getTracks?.().forEach((track) => track.stop());
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
    return 'Camera did not open in time. Tap Start Camera again and press Allow immediately.';
  }

  if (isPermissionError(error)) {
    return 'Camera permission is blocked. Open site settings, set Camera to Allow, then tap Start Camera.';
  }

  if (name === 'NotFoundError' || /not found|no camera|requested device not found/i.test(message)) {
    return 'No camera was found on this device.';
  }

  if (name === 'NotReadableError' || /in use|busy|could not start|track start/i.test(message)) {
    return 'Camera is busy in another app or tab. Close other camera apps, then tap Start Camera.';
  }

  return message || 'Unable to start camera. Tap Start Camera.';
}

async function createQrDetector() {
  const Detector = window.BarcodeDetector;
  if (!Detector) return null;

  if (Detector.getSupportedFormats) {
    const formats = await Detector.getSupportedFormats().catch(() => []);
    if (formats.length && !formats.includes('qr_code')) return null;
  }

  return new Detector({ formats: ['qr_code'] });
}

async function getLibraryCameraConfig() {
  const cameras = await withTimeout(Html5Qrcode.getCameras(), 2500, 'Camera list timed out.').catch(() => []);
  const rearCamera = cameras.find((camera) => {
    const label = String(camera.label || '').toLowerCase();
    return label.includes('back') || label.includes('rear') || label.includes('environment') || label.includes('wide');
  });

  if (rearCamera?.id) return rearCamera.id;
  if (cameras[0]?.id) return cameras[0].id;
  return { facingMode: { ideal: 'environment' } };
}

function normalizeCode(result) {
  return String(result?.rawValue || result?.rawData || '').trim();
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
  const [engine, setEngine] = useState('native');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scannerRef = useRef(null);
  const detectorRef = useRef(null);
  const scanTimerRef = useRef(null);
  const mountedRef = useRef(false);
  const startingRef = useRef(false);
  const startTokenRef = useRef(0);
  const statusRef = useRef('idle');
  const onScanRef = useRef(onScan);
  const disabledRef = useRef(disabled);
  const lastScanRef = useRef({ value: '', time: 0 });
  const shouldRecoverRef = useRef(false);

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

  const consumeScan = useCallback((decodedText) => {
    const value = String(decodedText || '').trim();
    if (!value || disabledRef.current) return;

    const now = Date.now();
    if (lastScanRef.current.value === value && now - lastScanRef.current.time < COOLDOWN_MS) return;

    lastScanRef.current = { value, time: now };
    onScanRef.current?.(value);
  }, []);

  const stopNativeCamera = useCallback(() => {
    window.clearTimeout(scanTimerRef.current);
    scanTimerRef.current = null;
    detectorRef.current = null;
    stopStream(streamRef.current);
    streamRef.current = null;

    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
  }, []);

  const stopLibraryScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;

    try {
      if (scanner.isScanning) {
        await withTimeout(scanner.stop(), 1200, 'Stop scanner timed out.');
      }
    } catch {
      // The scanner can already be stopped or stuck mid-start.
    }

    try {
      scanner.clear();
    } catch {
      // The reader element can be replaced during retry.
    }
  }, []);

  const stopEverything = useCallback(async () => {
    stopNativeCamera();
    await stopLibraryScanner();
  }, [stopLibraryScanner, stopNativeCamera]);

  const runNativeLoop = useCallback(() => {
    const tick = async () => {
      const video = videoRef.current;
      const detector = detectorRef.current;

      if (!mountedRef.current || statusRef.current !== 'active' || !video || !detector) return;

      try {
        if (video.readyState >= 2) {
          const results = await detector.detect(video);
          const code = normalizeCode(results?.[0]);
          if (code) consumeScan(code);
        }
      } catch {
        // Detection failures are transient while frames are changing.
      }

      scanTimerRef.current = window.setTimeout(tick, 140);
    };

    tick();
  }, [consumeScan]);

  const startNativeCamera = useCallback(async () => {
    const detector = await createQrDetector();
    if (!detector) return false;

    const stream = await withTimeout(
      navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      }),
      CAMERA_TIMEOUT_MS,
      'Camera permission timed out.'
    );

    const video = videoRef.current;
    if (!video) {
      stopStream(stream);
      throw new Error('Camera preview is not ready.');
    }

    setEngine('native');
    detectorRef.current = detector;
    streamRef.current = stream;
    video.srcObject = stream;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.muted = true;

    await withTimeout(video.play(), 4000, 'Camera preview could not play.').catch(() => {});
    setScannerStatus('active');
    runNativeLoop();
    return true;
  }, [runNativeLoop, setScannerStatus]);

  const startLibraryScanner = useCallback(async () => {
    setEngine('library');
    const reader = document.getElementById(READER_ID);
    if (!reader) throw new Error('Scanner view is not ready.');
    reader.innerHTML = '';

    const scanner = new Html5Qrcode(READER_ID, false);
    scannerRef.current = scanner;
    const cameraConfig = await getLibraryCameraConfig();

    await withTimeout(
      scanner.start(cameraConfig, scannerConfig, consumeScan, () => {}),
      QR_TIMEOUT_MS,
      'QR camera start timed out.'
    );

    const video = document.querySelector(`#${READER_ID} video`);
    if (video) {
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.setAttribute('muted', 'true');
      video.setAttribute('autoplay', 'true');
    }

    setScannerStatus('active');
    return true;
  }, [consumeScan, setScannerStatus]);

  const startScanner = useCallback(
    async ({ force = false } = {}) => {
      if (startingRef.current && !force) return;
      if (statusRef.current === 'active' && !force) return;

      const token = startTokenRef.current + 1;
      startTokenRef.current = token;
      startingRef.current = true;
      shouldRecoverRef.current = true;
      lastScanRef.current = { value: '', time: 0 };
      setScannerStatus('starting');
      await stopEverything();

      const watchdog = window.setTimeout(() => {
        if (!mountedRef.current || token !== startTokenRef.current || statusRef.current !== 'starting') return;

        startTokenRef.current += 1;
        startingRef.current = false;
        setScannerStatus('error', 'Camera is still opening. Tap Start Camera again and press Allow immediately.');
        stopEverything();
      }, WATCHDOG_MS);

      try {
        await wait(120);
        if (!mountedRef.current || token !== startTokenRef.current) return;

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera needs Chrome, Edge, or Safari with HTTPS enabled.');
        }

        if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          throw new Error('Open the HTTPS scanner link on mobile to allow camera access.');
        }

        const nativeStarted = await startNativeCamera();
        if (!mountedRef.current || token !== startTokenRef.current) return;

        if (!nativeStarted) {
          await startLibraryScanner();
        }
      } catch (scannerError) {
        if (!mountedRef.current || token !== startTokenRef.current) return;
        setScannerStatus('error', getCameraErrorMessage(scannerError));
        stopEverything();
      } finally {
        window.clearTimeout(watchdog);
        if (token === startTokenRef.current) startingRef.current = false;
      }
    },
    [setScannerStatus, startLibraryScanner, startNativeCamera, stopEverything]
  );

  const restartScanner = useCallback(() => {
    startScanner({ force: true });
  }, [startScanner]);

  useEffect(() => {
    mountedRef.current = true;

    const handleVisibility = () => {
      if (!document.hidden && shouldRecoverRef.current && statusRef.current === 'active' && !streamRef.current && !scannerRef.current) {
        startScanner({ force: true });
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      mountedRef.current = false;
      startTokenRef.current += 1;
      document.removeEventListener('visibilitychange', handleVisibility);
      stopEverything();
    };
  }, [startScanner, stopEverything]);

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
            <p className="text-xs text-white/45">Tap Start Camera and allow permission</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-widest text-white/60">
          <span className={`h-2 w-2 rounded-full ${status === 'active' ? 'bg-emerald-400' : status === 'error' ? 'bg-red-400' : status === 'starting' ? 'bg-amber-300' : 'bg-white/30'}`} />
          {status}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-white/10 bg-black">
        <video
          ref={videoRef}
          className={`h-[320px] w-full object-cover ${engine === 'native' ? 'block' : 'hidden'}`}
          muted
          playsInline
        />
        <div id={READER_ID} className={`${engine === 'library' ? 'block' : 'hidden'} min-h-[320px] w-full`} />

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
              <span className="max-w-[240px] text-center text-xs leading-relaxed text-white/45">
                Use the browser popup and press Allow. This screen will stop automatically if it hangs.
              </span>
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
                Start Camera
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
          Start / Restart
        </button>
        <div className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] uppercase tracking-widest text-white/45">
          <Camera className="h-3.5 w-3.5 text-pink-200" />
          Point at QR
        </div>
      </div>
    </section>
  );
}
