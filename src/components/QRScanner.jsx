import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanType, Html5QrcodeScanner } from 'html5-qrcode';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, CameraOff, Keyboard, Play, RotateCcw, ScanLine } from 'lucide-react';

const READER_ID = 'vivan-mobile-qr-reader';
const COOLDOWN_MS = 2400;

const scannerConfig = {
  fps: 12,
  qrbox: (viewfinder) => {
    const size = Math.floor(Math.min(viewfinder.width, viewfinder.height) * 0.72);
    return { width: size, height: size };
  },
  rememberLastUsedCamera: true,
  showTorchButtonIfSupported: true,
  showZoomSliderIfSupported: true,
  supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA, Html5QrcodeScanType.SCAN_TYPE_FILE],
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

function withTimeout(promise, ms) {
  let timer = null;
  const timeout = new Promise((resolve) => {
    timer = window.setTimeout(resolve, ms);
  });

  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer));
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
  const scannerRef = useRef(null);
  const mountedRef = useRef(false);
  const onScanRef = useRef(onScan);
  const disabledRef = useRef(disabled);
  const lastScanRef = useRef({ value: '', time: 0 });

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

    if (!scanner) return;

    try {
      await withTimeout(scanner.clear(), 1800);
    } catch {
      // The library can already be stopped or mid-permission prompt.
    }

    const reader = document.getElementById(READER_ID);
    if (reader) reader.innerHTML = '';
  }, []);

  const startScanner = useCallback(
    async ({ force = false } = {}) => {
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

      setScannerStatus('starting');
      await clearScanner();

      if (!mountedRef.current) return;

      try {
        const reader = document.getElementById(READER_ID);
        if (!reader) throw new Error('Scanner area is not ready. Refresh and try again.');

        const scanner = new Html5QrcodeScanner(READER_ID, scannerConfig, false);
        scannerRef.current = scanner;

        scanner.render(
          (decodedText) => consumeScan(decodedText),
          () => {}
        );

        setScannerStatus('active');
      } catch (scannerError) {
        setScannerStatus('error', scannerError?.message || 'Unable to load camera controls.');
      }
    },
    [clearScanner, consumeScan, setScannerStatus, status]
  );

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

    return () => {
      mountedRef.current = false;
      clearScanner();
    };
  }, [clearScanner]);

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
            <p className="text-xs text-white/45">Use Request Permission, then Start Scanning</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-widest text-white/60">
          <span className={`h-2 w-2 rounded-full ${status === 'active' ? 'bg-emerald-400' : status === 'error' ? 'bg-red-400' : status === 'starting' ? 'bg-amber-300' : 'bg-white/30'}`} />
          {status}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-white/10 bg-black">
        <div id={READER_ID} className="min-h-[320px] w-full" />

        <AnimatePresence>
          {(status === 'idle' || status === 'error') && (
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90 p-5 text-center backdrop-blur"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {status === 'error' ? <CameraOff className="h-10 w-10 text-red-300" /> : <Camera className="h-10 w-10 text-cyan-200" />}
              <p className="text-sm leading-relaxed text-white/70">{error || 'Camera controls are ready to load.'}</p>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/30 bg-cyan-500/15 px-4 py-2 font-orbitron text-xs uppercase tracking-widest text-cyan-100"
                onClick={restartScanner}
              >
                {status === 'error' ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                Load Camera Settings
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
          Reload Camera
        </button>
        <div className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] uppercase tracking-widest text-white/45">
          <Camera className="h-3.5 w-3.5 text-pink-200" />
          Camera UI
        </div>
      </div>

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
