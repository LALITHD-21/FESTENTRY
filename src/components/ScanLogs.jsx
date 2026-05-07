import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Clock3, XCircle } from 'lucide-react';

const statusStyle = {
  success: {
    icon: CheckCircle2,
    text: 'text-emerald-200',
    bg: 'bg-emerald-400/10',
    label: 'Success',
  },
  duplicate: {
    icon: AlertTriangle,
    text: 'text-amber-200',
    bg: 'bg-amber-400/10',
    label: 'Duplicate',
  },
  invalid: {
    icon: XCircle,
    text: 'text-red-200',
    bg: 'bg-red-400/10',
    label: 'Invalid',
  },
};

export default function ScanLogs({ logs }) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.045] p-4 backdrop-blur-2xl">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-pink-200" />
          <span className="font-orbitron text-xs uppercase tracking-[0.25em] text-pink-100">Scan Logs</span>
        </div>
        <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-white/45">{logs.length}</span>
      </div>

      {logs.length === 0 ? (
        <div className="flex min-h-32 items-center justify-center rounded-lg border border-white/10 bg-black/25 text-center text-sm text-white/35">
          No scans yet
        </div>
      ) : (
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {logs.map((log) => {
              const meta = statusStyle[log.status] || statusStyle.invalid;
              const Icon = meta.icon;
              return (
                <motion.div
                  key={log.id}
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/25 p-3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.bg}`}>
                    <Icon className={`h-4 w-4 ${meta.text}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-white">{log.name || log.passId}</p>
                      <span className="shrink-0 text-[10px] text-white/35">{log.time || formatLogTime(log.scanTime)}</span>
                    </div>
                    <p className="truncate text-xs text-white/45">{log.detail}</p>
                  </div>
                  <span className={`font-orbitron text-[10px] uppercase tracking-wider ${meta.text}`}>{meta.label}</span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}

function formatLogTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
