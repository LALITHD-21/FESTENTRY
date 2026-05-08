import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Clock3, Download, Search, XCircle } from 'lucide-react';

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
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const filteredLogs = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return logs.filter((log) => {
      const matchesFilter = filter === 'all' || log.status === filter;
      if (!matchesFilter) return false;
      if (!needle) return true;

      return [log.name, log.passId, log.detail, log.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [filter, logs, query]);

  const counts = useMemo(
    () => logs.reduce(
      (total, log) => ({
        ...total,
        [log.status]: (total[log.status] || 0) + 1,
      }),
      { all: logs.length, success: 0, duplicate: 0, invalid: 0 }
    ),
    [logs]
  );

  const exportLogs = () => {
    if (filteredLogs.length === 0) return;

    const header = ['status', 'name', 'pass_id', 'detail', 'scan_time'];
    const rows = filteredLogs.map((log) => [
      log.status,
      log.name || '',
      log.passId || '',
      log.detail || '',
      log.scanTime || log.time || '',
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vivan-scan-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.045] p-4 backdrop-blur-2xl">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-pink-200" />
          <span className="font-orbitron text-xs uppercase tracking-[0.25em] text-pink-100">Scan Logs</span>
        </div>
        <button
          type="button"
          onClick={exportLogs}
          disabled={filteredLogs.length === 0}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-orbitron text-[10px] uppercase tracking-widest text-white/50 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Download className="h-3.5 w-3.5" />
          CSV
        </button>
      </div>

      <label className="mb-3 flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2">
        <Search className="h-4 w-4 text-cyan-100/65" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name or receipt ID"
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/28"
        />
      </label>

      <div className="mb-3 grid grid-cols-4 gap-1.5">
        {[
          ['all', 'All'],
          ['success', 'Ok'],
          ['duplicate', 'Dup'],
          ['invalid', 'Bad'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-lg border px-2 py-2 font-orbitron text-[9px] uppercase tracking-widest transition ${
              filter === key
                ? 'border-cyan-300/35 bg-cyan-400/15 text-cyan-100'
                : 'border-white/10 bg-white/[0.035] text-white/38'
            }`}
          >
            {label} {counts[key] || 0}
          </button>
        ))}
      </div>

      {logs.length === 0 ? (
        <div className="flex min-h-32 items-center justify-center rounded-lg border border-white/10 bg-black/25 text-center text-sm text-white/35">
          No scans yet
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="flex min-h-32 items-center justify-center rounded-lg border border-white/10 bg-black/25 text-center text-sm text-white/35">
          No matching scans
        </div>
      ) : (
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {filteredLogs.map((log) => {
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
